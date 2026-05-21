/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Lock, Unlock, KeyRound, AlertTriangle, ShieldCheck, Cpu, Terminal, RefreshCw, Eye, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { CameraTracker, CameraTrackerHandle } from "./CameraTracker";
import { VaultStatus } from "../types";

interface LoginScreenProps {
  onUnlockSuccess: (token: string) => void;
  status: VaultStatus;
  onRefreshStatus: () => void;
}

export default function LoginScreen({ onUnlockSuccess, status, onRefreshStatus }: LoginScreenProps) {
  const cameraRef = useRef<CameraTrackerHandle | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cameraGranted, setCameraGranted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attemptsInfo, setAttemptsInfo] = useState<any>(null);

  // Cooldown countdown state
  const [cooldownSecondsLeft, setCooldownSecondsLeft] = useState<number>(0);

  useEffect(() => {
    if (status.cooldownUntil) {
      const cooldownDate = new Date(status.cooldownUntil).getTime();
      const calculateSeconds = () => {
        const diff = Math.ceil((cooldownDate - Date.now()) / 1000);
        return diff > 0 ? diff : 0;
      };

      setCooldownSecondsLeft(calculateSeconds());

      const timer = setInterval(() => {
        const left = calculateSeconds();
        setCooldownSecondsLeft(left);
        if (left <= 0) {
          clearInterval(timer);
          onRefreshStatus();
        }
      }, 1000);

      return () => clearInterval(timer);
    } else {
      setCooldownSecondsLeft(0);
    }
  }, [status.cooldownUntil]);

  // Handle number pad button taps in vault style
  const handleKeyTap = (num: string) => {
    if (cooldownSecondsLeft > 0 || isSubmitting) return;
    setErrorMessage(null);
    setPassword((prev) => prev + num);
  };

  const handleBackspace = () => {
    if (cooldownSecondsLeft > 0 || isSubmitting) return;
    setPassword((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (cooldownSecondsLeft > 0 || isSubmitting) return;
    setPassword("");
  };

  // Submit password trigger
  const handleUnlockSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password) {
      setErrorMessage("Enter vault access code.");
      return;
    }
    if (cooldownSecondsLeft > 0 || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    // Capture intruder photo BEFORE hitting the network endpoint so we don't delay the camera shutter if network lags!
    let snapshotBase64: string | null = null;
    if (cameraRef.current) {
      try {
        snapshotBase64 = cameraRef.current.captureSnapshot();
      } catch (e) {
        console.warn("Failed to trigger instant webcam frame capture during login attempt:", e);
      }
    }

    // Dynamic browser specs collector
    const userAgent = navigator.userAgent;
    const platform = (navigator as any).userAgentData?.platform || navigator.platform || "WebClient";
    const screenRes = `${window.screen.width}x${window.screen.height}`;
    const deviceSpecString = `OS: ${platform} | Browser: ${userAgent.split(" ").pop() || "Generic"} | Screen: ${screenRes}`;

    try {
      const response = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          deviceInfo: deviceSpecString,
          imageUrl: snapshotBase64,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Correct pin code entered!
        onRefreshStatus();
        onUnlockSuccess(data.token);
      } else {
        // Vault lock failed
        onRefreshStatus();
        setErrorMessage(data.error || "Access Denied: Unrecognized cryptocode credentials.");
        setAttemptsInfo({
          failedAttempts: data.failedAttempts || (status.failedAttempts + 1),
          remSeconds: data.cooldownRemaining || 0,
        });
      }
    } catch (err: any) {
      setErrorMessage("Secure Vault terminal disconnected. Server offline.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto relative z-10">
      {/* Visual background decorative element */}
      <div className="absolute inset-0 bg-cyan-500/5 blur-3xl rounded-full -z-10 animate-pulse" />

      {/* Cyberpunk Outer Frame */}
      <div className="bg-slate-900/20 border border-slate-800 rounded-xl relative p-6 backdrop-blur-md flex flex-col overflow-hidden">
        {/* Neon accent corner lights */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-500/30"></div>
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-500/30"></div>
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-500/30"></div>
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-500/30"></div>

        {/* Server & Database Info Header */}
        <div className="flex justify-between items-center mb-6 border-b border-cyan-950/40 pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400 rotate-45" />
            <span className="font-mono text-[10px] tracking-wider text-slate-400">CIPHER VAULT TERMINAL</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${status.isSupabaseConnected ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]'}`} />
            <span className="font-mono text-[9px] tracking-widest text-slate-500">
              {status.isSupabaseConnected ? "LIVE SUPABASE" : "SANDBOX SECURE"}
            </span>
          </div>
        </div>

        {/* Big Secure Status Icon */}
        <div className="flex flex-col items-center justify-center my-4">
          <AnimatePresence mode="wait">
            {cooldownSecondsLeft > 0 ? (
              <motion.div
                key="lockdown"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="relative"
              >
                {/* Glowing alert effect */}
                <div className="absolute inset-0 rounded-full bg-rose-500/20 blur-xl animate-pulse" />
                <div className="relative p-5 rounded-full border border-rose-500/30 bg-rose-950/80 text-rose-450">
                  <AlertTriangle className="w-10 h-10 animate-bounce" />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="secure"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="relative"
              >
                <div className="absolute inset-0 rounded-full bg-cyan-500/10 blur-xl" />
                <div className="relative p-5 rounded-full border border-cyan-500/30 bg-cyan-500/5 shadow-[0_0_40px_rgba(6,182,212,0.1)]">
                  <Lock className="w-10 h-10 text-cyan-400" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Heading */}
          <h2 className="text-xl font-mono tracking-tight text-white mt-4 flex items-center gap-2">
            {cooldownSecondsLeft > 0 ? (
              <span className="text-rose-400">LOCKDOWN ACTIVE</span>
            ) : (
              <span>OBALA ARTHUR'S SECRET GALLERY</span>
            )}
          </h2>
          <p className="text-xs text-slate-400 mt-1 text-center max-w-xs font-sans">
            Archive access is restricted. Authentication signature is required for cryptographic entry.
          </p>
        </div>

        {/* Camera Sensor Component */}
        <div className="my-5">
          <CameraTracker onPermissionStatus={setCameraGranted} ref={cameraRef} />
        </div>

        {/* Lockout Screen vs Standard PIN Form */}
        <AnimatePresence mode="wait">
          {cooldownSecondsLeft > 0 ? (
            <motion.div
              key="lockdown-ui"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 rounded border border-rose-900 bg-rose-950/20 text-center"
            >
              <div className="font-mono text-sm tracking-wider text-rose-400 font-bold">
                SYSTEM COOLED DOWN FOR SECURITY
              </div>
              <div className="my-3 text-3xl font-mono text-rose-500 font-extrabold tracking-widest">
                {String(Math.floor(cooldownSecondsLeft / 60)).padStart(2, "0")}:
                {String(cooldownSecondsLeft % 60).padStart(2, "0")}
              </div>
              <p className="text-xs text-slate-400">
                To prevent brute-force attacks, the cryptographic ledger is temporarily offline. Try again when the timer expires.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="password-ui"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <form onSubmit={handleUnlockSubmit} className="space-y-4">
                {/* Input block */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-450">
                    <KeyRound className="w-4 h-4 text-cyan-400" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    disabled={isSubmitting}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter Private Pass-Pin..."
                    className="w-full pl-10 pr-10 py-3 font-mono text-center text-lg tracking-[0.4em] bg-slate-950 border border-slate-800 rounded-lg focus:border-cyan-500/50 focus:outline-none text-cyan-400 placeholder:text-slate-750 placeholder:tracking-normal transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-white transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Cyberpunk Custom Vault Keypad */}
                <div className="grid grid-cols-3 gap-2 p-1.5 rounded-lg border border-slate-800 bg-slate-950/40 font-mono">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleKeyTap(num)}
                      className="py-2.5 rounded border border-slate-800 bg-slate-900/10 hover:bg-slate-800 text-sm font-bold text-slate-300 active:scale-95 transition-all text-center hover:text-white cursor-pointer"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleClear}
                    className="py-2.5 rounded border border-slate-800/40 bg-rose-950/20 hover:bg-rose-900/30 text-[10px] font-bold text-rose-400 active:scale-95 transition-all cursor-pointer"
                  >
                    CLEAR
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeyTap("0")}
                    className="py-2.5 rounded border border-slate-800 bg-slate-900/10 hover:bg-slate-800 text-sm font-bold text-slate-300 active:scale-95 transition-all cursor-pointer"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleBackspace}
                    className="py-2.5 rounded border border-slate-800/40 bg-slate-900/30 hover:bg-slate-800/80 text-[10px] font-bold text-slate-405 active:scale-95 transition-all cursor-pointer"
                  >
                    DELETE
                  </button>
                </div>

                {/* Alert message notification */}
                {errorMessage && (
                  <div className="flex items-start gap-2 p-3 rounded-xl border border-rose-900/50 bg-rose-950/30 text-rose-400 text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="leading-snug">
                      <p className="font-semibold font-mono text-[10px] tracking-wider uppercase">ALARM TRIPPED</p>
                      <p className="text-slate-300 mt-0.5">{errorMessage}</p>
                    </div>
                  </div>
                )}

                {/* Submit Shield Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-lg font-mono text-xs tracking-wider font-bold text-white bg-cyan-650 hover:bg-cyan-500 active:scale-[0.99] transition-all duration-200 shadow-[0_4px_20px_rgba(8,145,178,0.3)] border border-cyan-500/20 disabled:opacity-50 cursor-pointer uppercase"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>DECRYPTING VAULT KEY...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>DECIPHER AND ENTER</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Subtle footer */}
        <div className="mt-5 pt-3 border-t border-slate-850 flex justify-between items-center text-[10px] font-mono text-slate-500">
          <span>FAIL COUNT: {status.failedAttempts} / 5</span>
          <span>SEC: STAGE 3 PROTOCOL</span>
        </div>
      </div>
    </div>
  );
}
