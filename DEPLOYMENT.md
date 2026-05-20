# 🛡️ Secure Smart Vault: Vercel & Supabase Deployment Guide

Follow these sequential steps to deploy your Smart Vault application to Vercel in production with full Supabase integration.

---

## 💻 1. Environment Variable Setup

To guarantee secure vault communications, define the following variables in your **Vercel Project Settings** or local `.env` runtime:

| Variable Name | Required | Description |
|---|---|---|
| `VAULT_PASSWORD` | **Yes** | Master cryptographic password credentials to unlock the gallery (e.g. `admin123`). |
| `SUPABASE_URL` | Optional | Your Supabase Project API endpoint URL (e.g. `https://your-project.supabase.co`). |
| `SUPABASE_ANON_KEY` | Optional | Your Supabase Project Anonymous API security key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Your Supabase Project Service Role key (recommended for secure server-side bucket writes). |

> 💡 **Self-Healing Sandbox fallback:** If `SUPABASE_URL` is omitted, the vault automatically runs in a local workspace sandbox environment storing files in-memory and local databases.

---

## 🗄️ 2. Supabase Integration Setup

To prepare your cloud database and storage:
1. Log in to [Supabase Dashboard](https://supabase.com).
2. Open your project, click on **SQL Editor** from the left-side menu, and create a **New Query**.
3. Copy the entire contents of `setup.sql` in this directory and click **Run**.
4. Navigate to **Storage** -> **New Bucket**:
   - Create a bucket named `intruders` (keep it public with unique randomized filenames as configured in `server.ts`).
   - Create another bucket named `vault` (for private gallery uploads).

---

## ⚡ 3. Vercel Serverless Optimization

Since this is an integrated Full-Stack Express + React Vite SPA, you can deploy it to Vercel as a serverless project.
To map standard routes to Vercel's serverless engine, create a `vercel.json` file on your project root:

```json
{
  "version": 2,
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index.js" },
    { "source": "/uploads/(.*)", "destination": "/uploads/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## 🔒 4. Production Security Checklist

To protect private records from malicious attackers:
- [x] **Secure Hashing Algorithm**: All entry checks compute PBKDF2 with SHA-512, keeping password bytes safe from memory inspection.
- [x] **API Rate-Limiting Threshold**: Attempts are strictly hardcapped per Client IP (Max 5 attempts) to eliminate bot-cracking threats.
- [x] **Row-Level Security (RLS)**: Enforce RLS rules on tables to shield records from unauthenticated read actions.
- [x] **Sanitized Base64 Buffers**: Camera captures convert strictly through binary array filters, restricting file vulnerability execution.
- [x] **Subtle Security Flags**: Error response channels hide specific system exceptions, avoiding details leak to probes.

---

## 🖼️ 5. Visual Asset & Web Camera Protection

- **Browser Camera Permissions**: The app utilizes HTML5 getUserMedia specifications. Video telemetry is processed local-only inside a layout canvas and parsed as base64 - *no video feed is ever transmitted or streamed network-wide*.
- **Mobile Camera Adaptability**: Camera constraints automatically invoke the primary front-facing webcam module (`facingMode: "user"`) for maximum reliability on iOS and Android devices.
