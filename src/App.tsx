/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { ShieldCheck, Lock, Unlock, ShieldAlert, LayoutGrid, Cpu, Power, Terminal, AlertTriangle, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import LoginScreen from "./components/LoginScreen";
import VaultGallery from "./components/VaultGallery";
import IntruderDashboard from "./components/IntruderDashboard";
import { VaultStatus, VaultItem, IntruderLog } from "./types";

export default function App() {
  const [sessionToken, setSessionToken] = useState<string | null>(() => {
    return localStorage.getItem("smart_vault_session");
  });
  
  const [status, setStatus] = useState<VaultStatus>({
    isLocked: true,
    cooldownUntil: null,
    failedAttempts: 0,
    isSupabaseConnected: false,
    rateLimitMax: 5,
  });

  const [activeTab, setActiveTab] = useState<"gallery" | "alerts">("gallery");
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
  const [intruderLogs, setIntruderLogs] = useState<IntruderLog[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Fetch status of the vault on the server
  const fetchVaultStatus = async () => {
    try {
      const res = await fetch("/api/status");
      if (res.ok) {
        const data = await res.json();
        // Keep status synchronized
        setStatus(data);
      }
    } catch (err) {
      console.warn("Could not reach vault API terminal status metrics.");
    }
  };

  // Fetch private gallery items
  const fetchGalleryItems = async (token: string) => {
    setIsLoadingData(true);
    try {
      const res = await fetch("/api/gallery", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setVaultItems(data);
      } else if (res.status === 401 || res.status === 403) {
        // Token expired/invalid, clear session
        handleLockVault();
      }
    } catch (err) {
      console.error("Failed to read secure gallery assets.", err);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Fetch intruder logs
  const fetchIntruderLogs = async (token: string) => {
    try {
      const res = await fetch("/api/admin/logs", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setIntruderLogs(data);
      }
    } catch (err) {
      console.error("Failed to read intrusion logs.", err);
    }
  };

  // On mount: read status and load data if is already unlocked
  useEffect(() => {
    fetchVaultStatus();

    if (sessionToken) {
      fetchGalleryItems(sessionToken);
      fetchIntruderLogs(sessionToken);
    }

    // Refresh status stats every 10 seconds to sync cooldown triggers automatically
    const interval = setInterval(fetchVaultStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  // When session token starts, fetch everything
  const handleUnlockSuccess = (token: string) => {
    setSessionToken(token);
    localStorage.setItem("smart_vault_session", token);
    fetchGalleryItems(token);
    fetchIntruderLogs(token);
  };

  // Lock vault securely
  const handleLockVault = () => {
    setSessionToken(null);
    localStorage.removeItem("smart_vault_session");
    setVaultItems([]);
    setIntruderLogs([]);
    fetchVaultStatus();
  };

  // Manual payload refreshers pass-downs
  const refreshLogsOnly = () => {
    if (sessionToken) fetchIntruderLogs(sessionToken);
  };

  const refreshItemsOnly = () => {
    if (sessionToken) fetchGalleryItems(sessionToken);
  };

  return (
    <div className="min-h-screen bg-[#020408] text-slate-300 flex flex-col justify-between py-6 px-4 font-sans selection:bg-cyan-500/30 selection:text-white relative">
      {/* Visual cyber grid paper layer */}
      <div className="fixed inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />
      {/* CRT scan lines overlay simulator */}
      <div className="fixed inset-0 pointer-events-none opacity-5 scanlines-overlay" />

      {/* Main Container */}
      <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col justify-self-center my-6 relative z-10">
        
        {/* Core Global Application Header branding */}
        <header className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8 border-b border-cyan-900/30 pb-5 relative z-10">
          <div className="text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-3">
              <div className="p-2 rounded bg-cyan-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.4)]">
                <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-wider text-white uppercase leading-none">
                  AXON-9
                </h1>
                <p className="font-mono text-[9px] tracking-[0.2em] text-cyan-400 mt-1 uppercase select-none">
                  Smart Vault Protocol v4.0.2
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 font-mono text-xs">
            <div className="flex flex-col items-end">
              <span className="text-slate-550 text-[10px]">ENCRYPTION</span>
              <span className="text-cyan-400 font-bold">AES-256-GCM ACTIVE</span>
            </div>
            <div className="w-px h-8 bg-slate-800"></div>

            {/* System Encryption Badge */}
            <div className="px-3 py-1.5 rounded border border-cyan-500/30 bg-cyan-500/5 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${sessionToken ? "bg-emerald-400" : "bg-cyan-400"}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${sessionToken ? "bg-emerald-500" : "bg-cyan-500"}`}></span>
              </span>
              <span className="text-slate-450 text-[9px] font-bold">
                {sessionToken ? "ADMIN UNLOCKED" : "SYSTEM SECURED"}
              </span>
            </div>
          </div>
        </header>

        {/* Dynamic Route/State Swapper */}
        <main className="flex-1 flex flex-col justify-center relative z-10">
          <AnimatePresence mode="wait">
            {!sessionToken ? (
              // LOCKED PROTOCOL SCREEN
              <motion.div
                key="locked-auth"
                initial={{ opacity: 0, scale: 0.98, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: -15 }}
                transition={{ duration: 0.25 }}
                className="w-full"
              >
                <LoginScreen
                  status={status}
                  onUnlockSuccess={handleUnlockSuccess}
                  onRefreshStatus={fetchVaultStatus}
                />
              </motion.div>
            ) : (
              // DECRYPTED ACTIVE CONTROL DASHBOARD
              <motion.div
                key="unlocked-vault"
                initial={{ opacity: 0, scale: 0.98, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: -15 }}
                className="w-full space-y-6"
              >
                {/* Dashboard Operations SubHeader */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-md">
                  
                  {/* Tabs */}
                  <div className="flex gap-2.5">
                    {/* Gallery Tab */}
                    <button
                      onClick={() => setActiveTab("gallery")}
                      className={`flex items-center gap-2 py-2 px-4 rounded font-mono text-xs font-bold tracking-wider transition duration-155 cursor-pointer border ${
                        activeTab === "gallery"
                          ? "bg-cyan-650 border-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                      }`}
                    >
                      <LayoutGrid className="w-4 h-4" />
                      <span>VAULT SAFE FILES</span>
                    </button>

                    {/* Alerts/Intrusions Tab */}
                    <button
                      onClick={() => setActiveTab("alerts")}
                      className={`flex items-center gap-2 py-2 px-4 rounded font-mono text-xs font-bold tracking-wider transition duration-155 cursor-pointer border relative ${
                        activeTab === "alerts"
                          ? "bg-rose-955/60 border-rose-800 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.3)]"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-950"
                      }`}
                    >
                      <ShieldAlert className="w-4 h-4" />
                      <span>SURVEILLANCE ALERTS</span>
                      {intruderLogs.length > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold font-mono bg-rose-600 text-white animate-pulse">
                          {intruderLogs.length}
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Right hand close locking trigger */}
                  <button
                    onClick={handleLockVault}
                    className="flex items-center justify-center gap-1.5 py-2 px-4 rounded font-mono text-xs font-bold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 active:scale-95 duration-150 cursor-pointer"
                  >
                    <Power className="w-3.5 h-3.5 text-rose-500" />
                    <span>SECURELY LOCK VAULT</span>
                  </button>
                </div>

                {/* Sub Tab contents panels */}
                <div className="relative">
                  {isLoadingData ? (
                    <div className="p-16 text-center">
                      <RefreshCw className="w-8 h-8 mx-auto text-cyan-500 animate-spin" />
                      <p className="font-mono text-xs text-slate-500 uppercase tracking-widest mt-3">
                        Decrypting database sectors...
                      </p>
                    </div>
                  ) : (
                    <div>
                      {activeTab === "gallery" ? (
                        <VaultGallery
                          items={vaultItems}
                          authToken={sessionToken}
                          onRefreshItems={refreshItemsOnly}
                          onLockVault={handleLockVault}
                        />
                      ) : (
                        <IntruderDashboard
                          logs={intruderLogs}
                          authToken={sessionToken}
                          onRefreshLogs={refreshLogsOnly}
                        />
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Humblest global engineering visual status footer */}
      <footer className="w-full border-t border-slate-800 px-6 flex items-center justify-between text-[10px] font-mono text-slate-500 bg-black/40 backdrop-blur-md z-10 py-3 mt-8">
        <div>
          SYSTEM LOG: <span className="text-cyan-400">UPTIME ACTIVE</span> • VERSION 4.0.2-RELEASE
        </div>
        <div className="flex gap-6">
          <span>LATENCY: 12ms</span>
          <span>REGION: GLOBAL-NODE</span>
          <span>ENCRYPTION: SHARD-4A</span>
        </div>
      </footer>
    </div>
  );
}
