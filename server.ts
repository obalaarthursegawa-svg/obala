/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables strictly
dotenv.config();

const app = express();
const PORT = 3000;

// Maximum body size for webcam base64 uploads (increased from default 100kb to 10mb)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Setup local data directory for persistent fallback storage if Supabase is not configured
const DATA_DIR = path.join(process.cwd(), "data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const DB_FILE = path.join(DATA_DIR, "db.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Global In-Memory Fallback State (persisted to data/db.json)
interface LocalDatabase {
  intruderLogs: any[];
  vaultItems: any[];
}

function loadLocalDB(): LocalDatabase {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn("Could not load local DB file, initializing fresh database:", err);
  }
  return { intruderLogs: [], vaultItems: [] };
}

function saveLocalDB(db: LocalDatabase) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save local database:", err);
  }
}

// In-Memory database instance for immediate fallback access
let localDB = loadLocalDB();

// Dynamic Supabase client initializer
let supabaseClient: any = null;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const isSupabaseConfigured = !!(supabaseUrl && supabaseKey);

if (isSupabaseConfigured) {
  try {
    supabaseClient = createClient(supabaseUrl!, supabaseKey!);
    console.log("Supabase Client initialized successfully for backend proxy routes.");
    
    // Auto-create storage buckets if missing
    (async () => {
      try {
        const { data: buckets, error: listError } = await supabaseClient.storage.listBuckets();
        const hasIntruders = buckets ? buckets.some((b: any) => b.name === "intruders" || b.id === "intruders") : false;
        const hasVault = buckets ? buckets.some((b: any) => b.name === "vault" || b.id === "vault") : false;
        
        if (!hasIntruders) {
          console.log("Bucket 'intruders' not detected. Creating it dynamically...");
          await supabaseClient.storage.createBucket("intruders", { public: true });
        } else {
          console.log("Bucket 'intruders' is verified to exist on Supabase.");
        }
        
        if (!hasVault) {
          console.log("Bucket 'vault' not detected. Creating it dynamically...");
          await supabaseClient.storage.createBucket("vault", { public: true });
        } else {
          console.log("Bucket 'vault' is verified to exist on Supabase.");
        }
      } catch (e) {
        // Fallback: silently attempt direct bucket creation if bucket listing is restricted
        try {
          await supabaseClient.storage.createBucket("intruders", { public: true });
        } catch (_) {}
        try {
          await supabaseClient.storage.createBucket("vault", { public: true });
        } catch (_) {}
        console.log("Probed and ensured storage buckets 'intruders' and 'vault' on Supabase.");
      }
    })();
  } catch (error) {
    console.error("Failed to initialize Supabase client:", error);
  }
} else {
  console.log("Supabase credentials missing. Smart Vault running in Local Storage Sandbox mode.");
}

// Expose local upload folder statically
app.use("/uploads", express.static(UPLOADS_DIR));

// Create a unique salt on boot to hash the password securely
const HASH_SALT = crypto.randomBytes(16).toString("hex");
const VAULT_PASS = process.env.VAULT_PASSWORD || "admin123";

// Hash function
function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
}

const SERVER_MASTER_HASH = hashPassword(VAULT_PASS, HASH_SALT);

// Secure light session token (used to identify authorized client requests)
const SESSION_TOKEN = crypto.createHmac("sha256", HASH_SALT).update("smart-vault-unlocked-token").digest("hex");

// IP Rate Limiting Map
interface RateLimitState {
  failedAttempts: number;
  cooldownUntil: number | null;
}
const ipLimits = new Map<string, RateLimitState>();

// Helper function to get clean IP
function getClientIp(req: express.Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return (typeof forwarded === "string" ? forwarded : forwarded[0]).split(",")[0].trim();
  }
  return req.socket.remoteAddress || "127.0.0.1";
}

// Authorization middleware
function authorizeRequest(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access Denied: Missing auth credentials." });
  }
  const token = authHeader.split(" ")[1];
  if (token !== SESSION_TOKEN) {
    return res.status(403).json({ error: "Access Denied: Invalid Security Token." });
  }
  next();
}

/** 
 * API Route: Status check 
 */
app.get("/api/status", (req, res) => {
  const ip = getClientIp(req);
  let state = ipLimits.get(ip);
  if (!state) {
    state = { failedAttempts: 0, cooldownUntil: null };
  }

  // Check if cooldown has expired
  if (state.cooldownUntil && state.cooldownUntil < Date.now()) {
    state.cooldownUntil = null;
    state.failedAttempts = 0;
    ipLimits.set(ip, state);
  }

  res.json({
    isLocked: true,
    cooldownUntil: state.cooldownUntil ? new Date(state.cooldownUntil).toISOString() : null,
    failedAttempts: state.failedAttempts,
    isSupabaseConnected: isSupabaseConfigured,
    rateLimitMax: 5,
  });
});

/**
 * API Route: Authenticate / Unlock vault
 */
app.post("/api/unlock", async (req, res) => {
  const ip = getClientIp(req);
  const { password, deviceInfo, imageUrl } = req.body;

  let state = ipLimits.get(ip) || { failedAttempts: 0, cooldownUntil: null };

  // 1. Cooldown Rate Limit Validation
  if (state.cooldownUntil) {
    if (state.cooldownUntil > Date.now()) {
      const remaining = Math.ceil((state.cooldownUntil - Date.now()) / 1000);
      return res.status(429).json({
        error: `System Locked: Too many failed attempts. Try again in ${remaining}s.`,
        cooldownRemaining: remaining,
      });
    } else {
      // Cooldown expired
      state.cooldownUntil = null;
      state.failedAttempts = 0;
    }
  }

  // 2. Validate Password
  const providedHash = hashPassword(password || "", HASH_SALT);
  const isCorrect = crypto.timingSafeEqual(
    Buffer.from(providedHash, "utf-8"),
    Buffer.from(SERVER_MASTER_HASH, "utf-8")
  );

  if (isCorrect) {
    // SUCCESS - Reset failed counts
    state.failedAttempts = 0;
    state.cooldownUntil = null;
    ipLimits.set(ip, state);

    return res.json({
      success: true,
      token: SESSION_TOKEN,
      message: "Access granted. Welcome to the Smart Vault.",
    });
  }

  // FAILURE - Increment counter
  state.failedAttempts += 1;
  const isCooldownTriggered = state.failedAttempts >= 5;
  if (isCooldownTriggered) {
    state.cooldownUntil = Date.now() + 60000; // 60 seconds cooldown for instant developer loop feedback
  }
  ipLimits.set(ip, state);

  // Collect intruder analytics
  const timestamp = new Date().toISOString();
  let logSavedUrl = "";

  // Upload or save image
  if (imageUrl && imageUrl.startsWith("data:image")) {
    const base64Content = imageUrl.replace(/^data:image\/\w+;base64,/, "");
    const imgBuffer = Buffer.from(base64Content, "base64");
    const fileName = `intruder_${Date.now()}_attempts_${state.failedAttempts}.jpg`;

    if (isSupabaseConfigured && supabaseClient) {
      try {
        let uploadResult = await supabaseClient.storage
          .from("intruders")
          .upload(fileName, imgBuffer, {
            contentType: "image/jpeg",
            upsert: true,
          });

        if (uploadResult.error) {
          // If bucket is missing, dynamically create and retry
          if (uploadResult.error.message?.includes("Bucket not found") || (uploadResult.error as any).status === 404) {
            console.log("Bucket 'intruders' not found during capture. Creating dynamically...");
            await supabaseClient.storage.createBucket("intruders", { public: true });
            uploadResult = await supabaseClient.storage
              .from("intruders")
              .upload(fileName, imgBuffer, {
                contentType: "image/jpeg",
                upsert: true,
              });
          }
          if (uploadResult.error) throw uploadResult.error;
        }

        const { data: urlObj } = supabaseClient.storage
          .from("intruders")
          .getPublicUrl(fileName);

        logSavedUrl = urlObj.publicUrl;
      } catch (err: any) {
        console.warn(`Supabase Storage upload fallback triggered: ${err?.message || err}. Saving securely to local storage.`);
        // Fallback to local
        const localPath = path.join(UPLOADS_DIR, fileName);
        fs.writeFileSync(localPath, imgBuffer);
        logSavedUrl = `/uploads/${fileName}`;
      }
    } else {
      // Direct Local Saving
      const localPath = path.join(UPLOADS_DIR, fileName);
      fs.writeFileSync(localPath, imgBuffer);
      logSavedUrl = `/uploads/${fileName}`;
    }
  } else {
    logSavedUrl = "https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=300&q=80"; // Fallback security mesh
  }

  // Add Log payload
  const logData = {
    id: crypto.randomUUID(),
    image_url: logSavedUrl,
    timestamp,
    ip_address: ip,
    device_info: deviceInfo || "Unknown Web Device",
    failed_attempts: state.failedAttempts,
  };

  // Write Log to Supabase Database or Local database
  if (isSupabaseConfigured && supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from("intruder_logs")
        .insert([logData]);

      if (error) throw error;
      console.log("Intruder logged systematically into Supabase Database.");
    } catch (err: any) {
      console.warn(`[Supabase DB Warning] Failed to insert log to 'intruder_logs' (${err?.message || "Table might not be created yet. Please execute setup.sql inside your Supabase dashboard."}). Logging caught details into local secure database instead.`);
      localDB.intruderLogs.unshift(logData);
      saveLocalDB(localDB);
    }
  } else {
    localDB.intruderLogs.unshift(logData);
    saveLocalDB(localDB);
  }

  return res.status(401).json({
    error: "Access Denied: Incorrect Security Pin Code.",
    failedAttempts: state.failedAttempts,
    cooldownUntil: state.cooldownUntil ? new Date(state.cooldownUntil).toISOString() : null,
    cooldownRemaining: isCooldownTriggered ? 60 : 0,
    intruderCaught: true,
  });
});

/**
 * API Route: Get Intruder Log list (Guarded)
 */
app.get("/api/admin/logs", authorizeRequest, async (req, res) => {
  if (isSupabaseConfigured && supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from("intruder_logs")
        .select("*")
        .order("timestamp", { ascending: false });

      if (error) throw error;
      return res.json(data);
    } catch (err: any) {
      console.warn(`[Supabase DB Warning] Failed to fetch 'intruder_logs' (${err?.message || "Table might not be created yet. Please execute setup.sql inside your Supabase dashboard."}). Displaying local secure storage fallbacks.`);
      return res.json(localDB.intruderLogs);
    }
  }

  return res.json(localDB.intruderLogs);
});

/**
 * API Route: Clear Intruder Logs (Guarded)
 */
app.post("/api/admin/clear-logs", authorizeRequest, async (req, res) => {
  if (isSupabaseConfigured && supabaseClient) {
    try {
      // Keep it safe or delete
      const { error } = await supabaseClient
        .from("intruder_logs")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // deletes all

      if (error) throw error;
    } catch (err: any) {
      console.warn(`[Supabase DB Warning] Failed to delete 'intruder_logs' records (${err?.message || "Table might not be created or accessible."}). Flushing local secure alarm logs.`);
    }
  }

  localDB.intruderLogs = [];
  saveLocalDB(localDB);
  return res.json({ success: true, message: "Alerthistory cleared systematically." });
});

/**
 * API Route: Get Private Gallery items (Guarded)
 */
app.get("/api/gallery", authorizeRequest, async (req, res) => {
  if (isSupabaseConfigured && supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from("vault_items")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return res.json(data);
    } catch (err: any) {
      console.warn(`[Supabase DB Warning] Failed to fetch 'vault_items' (${err?.message || "Table might not be created yet. Please execute setup.sql inside your Supabase dashboard."}). Displaying local secure gallery assets.`);
      return res.json(localDB.vaultItems);
    }
  }

  // Load sample visual vault items if local gallery is empty so developers have pre-loaded design assets
  if (localDB.vaultItems.length === 0) {
    localDB.vaultItems = [
      {
        id: "1",
        title: "Alpha Cipher Codes",
        url: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=500&q=80",
        created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
      },
      {
        id: "2",
        title: "Quantum Ledger Backups",
        url: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=500&q=80",
        created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
      },
      {
        id: "3",
        title: "Cyberpunk Terminal blueprints",
        url: "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=500&q=80",
        created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
      }
    ];
    saveLocalDB(localDB);
  }

  return res.json(localDB.vaultItems);
});

/**
 * API Route: Upload Image to Private Gallery (Guarded)
 */
app.post("/api/gallery/upload", authorizeRequest, async (req, res) => {
  const { title, image } = req.body;
  if (!image || !title) {
    return res.status(400).json({ error: "Missing required parameters: title or image payload." });
  }

  const timestamp = new Date().toISOString();
  let fileSavedUrl = "";
  const base64Content = image.replace(/^data:image\/\w+;base64,/, "");
  const imgBuffer = Buffer.from(base64Content, "base64");
  const fileName = `item_${Date.now()}_file.jpg`;

  if (isSupabaseConfigured && supabaseClient) {
    try {
      let uploadResult = await supabaseClient.storage
        .from("vault")
        .upload(fileName, imgBuffer, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadResult.error) {
        // If vault bucket is missing, dynamically create and retry
        if (uploadResult.error.message?.includes("Bucket not found") || (uploadResult.error as any).status === 404) {
          console.log("Bucket 'vault' not found during gallery upload. Creating dynamically...");
          await supabaseClient.storage.createBucket("vault", { public: true });
          uploadResult = await supabaseClient.storage
            .from("vault")
            .upload(fileName, imgBuffer, {
              contentType: "image/jpeg",
              upsert: true,
            });
        }
        if (uploadResult.error) throw uploadResult.error;
      }

      const { data: urlObj } = supabaseClient.storage
        .from("vault")
        .getPublicUrl(fileName);

      fileSavedUrl = urlObj.publicUrl;
    } catch (err: any) {
      console.warn(`Supabase Storage upload fallback triggered for gallery: ${err?.message || err}. Saving securely to local static uploads.`);
      const localPath = path.join(UPLOADS_DIR, fileName);
      fs.writeFileSync(localPath, imgBuffer);
      fileSavedUrl = `/uploads/${fileName}`;
    }
  } else {
    const localPath = path.join(UPLOADS_DIR, fileName);
    fs.writeFileSync(localPath, imgBuffer);
    fileSavedUrl = `/uploads/${fileName}`;
  }

  const galleryData = {
    id: crypto.randomUUID(),
    title: title || "Secured Asset",
    url: fileSavedUrl,
    created_at: timestamp,
  };

  if (isSupabaseConfigured && supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from("vault_items")
        .insert([galleryData]);

      if (error) throw error;
    } catch (err: any) {
      console.warn(`[Supabase DB Warning] Failed to save asset to 'vault_items' (${err?.message || "Table might not be created yet. Please execute setup.sql inside your Supabase dashboard."}). Saving into local fallback database instead.`);
      localDB.vaultItems.unshift(galleryData);
      saveLocalDB(localDB);
    }
  } else {
    localDB.vaultItems.unshift(galleryData);
    saveLocalDB(localDB);
  }

  return res.json({ success: true, item: galleryData });
});

/**
 * API Route: Delete private gallery item (Guarded)
 */
app.post("/api/gallery/delete", authorizeRequest, async (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: "Missing payload parameter id." });
  }

  if (isSupabaseConfigured && supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from("vault_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
    } catch (err: any) {
      console.warn(`[Supabase DB Warning] Failed to delete 'vault_items' record (${err?.message || "Table might not be created or accessible."}). Shredding local secure backup.`);
    }
  }

  localDB.vaultItems = localDB.vaultItems.filter((i: any) => i.id !== id);
  saveLocalDB(localDB);
  return res.json({ success: true, message: "Asset systematically shredded from vault." });
});


// Vite Middleware for integrated Client + Server Single Port 3000 Ingress Routing
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Smart Vault Core] Operational on port http://localhost:${PORT}`);
    console.log(`[Smart Vault Core] Sandbox Local Database is active at ${DB_FILE}`);
  });
}

startServer();
