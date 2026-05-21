/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { AlertTriangle, Trash2, Cpu, Globe, Clock, ShieldAlert, RefreshCw, BarChart2, Eye, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { IntruderLog } from "../types";

interface IntruderDashboardProps {
  logs: any[];
  authToken: string;
  onRefreshLogs: () => void;
}

export default function IntruderDashboard({ logs, authToken, onRefreshLogs }: IntruderDashboardProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  // Compute stats helper
  const totalAlerts = logs.length;
  
  // Find most frequent IP
  const getMostActiveIp = () => {
    if (logs.length === 0) return "N/A";
    const freq: { [key: string]: number } = {};
    logs.forEach((l) => {
      const ip = l.ipAddress || l.ip_address || "127.0.0.1";
      freq[ip] = (freq[ip] || 0) + 1;
    });
    let maxIp = "N/A";
    let maxCount = 0;
    Object.entries(freq).forEach(([ip, count]) => {
      if (count > maxCount) {
        maxCount = count;
        maxIp = ip;
      }
    });
    return `${maxIp} (${maxCount} attempts)`;
  };

  const getSevereIntruderCount = () => {
    return logs.filter((l) => (l.failedAttempts || l.failed_attempts || 0) >= 3).length;
  };

  // Clear log trigger
  const handleClearLogs = async () => {
    if (logs.length === 0) return;
    if (!confirm("Are you absolutely sure you want to flush all surveillance logs and intruder photo evidence? This action is permanent.")) return;

    setIsClearing(true);
    try {
      const res = await fetch("/api/admin/clear-logs", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });

      const data = await res.json();
      if (res.ok) {
        onRefreshLogs();
      } else {
        alert(data.error || "Failed to clear alarm logs.");
      }
    } catch (err) {
      alert("Terminal delete connection timeout.");
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* High-Tech Cyber Metrics Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Metric 1 */}
        <div className="bg-slate-900/40 border border-rose-950/40 p-4 rounded-lg backdrop-blur-sm relative">
          <div className="absolute top-2 right-2 p-1 bg-rose-950/50 border border-rose-900 rounded text-rose-500">
            <ShieldAlert className="w-4 h-4 animate-pulse" />
          </div>
          <span className="font-mono text-[9px] font-semibold text-rose-450 uppercase tracking-widest block">SEC BREACHES RECORDED</span>
          <span className="font-mono text-3xl font-extrabold text-white block mt-1">
            {totalAlerts}
          </span>
          <span className="text-[10px] text-slate-500 font-mono mt-1 block">ALL TIME INTRUSIONS</span>
        </div>

        {/* Metric 2 */}
        <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-lg backdrop-blur-sm relative">
          <div className="absolute top-2 right-2 p-1 bg-slate-900 border border-slate-800 rounded text-cyan-400">
            <Globe className="w-4 h-4" />
          </div>
          <span className="font-mono text-[9px] font-semibold text-slate-500 uppercase tracking-widest block">ATTACK SOURCE IP</span>
          <span className="font-sans text-xs font-bold text-slate-200 block mt-3 truncate">
            {getMostActiveIp()}
          </span>
          <span className="text-[10px] text-slate-500 font-mono mt-1 block">HIGHEST LOG SEQUENCES</span>
        </div>

        {/* Metric 3 */}
        <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-lg relative">
          <div className="absolute top-2 right-2 p-1 bg-slate-900 border border-slate-800 rounded text-orange-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <span className="font-mono text-[9px] font-semibold text-slate-500 uppercase tracking-widest block">COERCIVE ENTRIES (≥3 FAIL)</span>
          <span className="font-mono text-3xl font-extrabold text-orange-400 block mt-1">
            {getSevereIntruderCount()}
          </span>
          <span className="text-[10px] text-slate-500 font-mono mt-1 block">HIGH REPETITION ATTACKERS</span>
        </div>

        {/* Metric 4 */}
        <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-lg relative">
          <div className="absolute top-2 right-2 p-1 bg-slate-900 border border-slate-800 rounded text-emerald-400">
            <BarChart2 className="w-4 h-4" />
          </div>
          <span className="font-mono text-[9px] font-semibold text-slate-500 uppercase tracking-widest block">SURVEILLANCE FEED SECURITY</span>
          <span className="font-mono text-sm font-bold text-emerald-400 block mt-3.5 uppercase tracking-wider">
            100% ONLINE
          </span>
          <span className="text-[10px] text-slate-500 font-mono mt-1 block">SECURE CAPABILITY ACTIVE</span>
        </div>
      </div>

      {/* Controller actions */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-3">
        <h3 className="font-mono text-xs font-semibold tracking-wider text-rose-500 flex items-center gap-1.5 animate-pulse">
          <AlertTriangle className="w-4 h-4" />
          SURVEILLANCE INTRUSION LOG DATABASE
        </h3>

        <div className="flex gap-2">
          {/* Refresh Buttons */}
          <button
            onClick={onRefreshLogs}
            className="p-1.5 rounded border border-slate-800 bg-slate-900/10 hover:bg-slate-800 text-slate-400 hover:text-white transition duration-200 cursor-pointer"
            title="Refresh logs feed"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleClearLogs}
            disabled={logs.length === 0 || isClearing}
            className="px-3 py-1.5 font-mono text-[10px] font-bold text-rose-450 hover:text-white bg-rose-950/20 hover:bg-rose-900/40 border border-rose-900/40 rounded transition duration-200 disabled:opacity-30 flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>FLUSH DATABASE</span>
          </button>
        </div>
      </div>

      {/* Timeline of intruders */}
      {logs.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-slate-800 bg-slate-900/20 text-slate-500">
          <ShieldAlert className="w-8 h-8 mx-auto text-slate-755 mb-2" />
          <p className="font-mono text-xs uppercase tracking-wider">Zero Security Alerts</p>
          <p className="font-sans text-xs text-slate-650 mt-1">Surveillance telemetry is clear. No unauthorized access codes detected.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {logs.map((log: any, index) => {
            const dateStr = new Date(log.timestamp).toLocaleString();
            const attempts = log.failed_attempts || log.failedAttempts || 1;
            const ip = log.ip_address || log.ipAddress || "127.0.0.1";
            const device = log.device_info || log.deviceInfo || "Unrecognized Engine";
            const imgUrl = log.image_url || log.imageUrl;

            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: Math.min(index * 0.05, 0.25) }}
                className="group border border-rose-950/20 hover:border-rose-900/40 bg-slate-900/10 hover:bg-slate-900/40 p-4 rounded-lg backdrop-blur-sm transition flex flex-col md:flex-row gap-4 items-start relative overflow-hidden"
              >
                {/* Visual Intruder Tag indicator line */}
                <div className={`absolute top-0 bottom-0 left-0 w-1 ${attempts >= 3 ? "bg-rose-500" : "bg-amber-500"}`} />

                {/* Webcam Image Block with magnification */}
                <div
                  onClick={() => setSelectedImage(imgUrl)}
                  className="w-full md:w-32 aspect-[4/3] rounded-lg overflow-hidden relative border border-slate-900 bg-slate-900 cursor-zoom-in shrink-0 shadow-lg"
                >
                  <img
                    src={imgUrl}
                    alt="Intruder Snapshot"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 duration-300 pointer-events-none"
                  />
                  <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 border border-slate-800 text-[8px] font-mono text-rose-400 font-bold uppercase">
                    TRY #{attempts}
                  </div>
                  <div className="absolute inset-0 bg-slate-950/55 opacity-0 group-hover:opacity-100 transition duration-200 flex items-center justify-center text-white">
                    <Eye className="w-5 h-5" />
                  </div>
                </div>

                {/* Intrusion Telemetry Metadata Content */}
                <div className="flex-1 space-y-2 mt-0.5">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1.5">
                    <span className="font-mono text-xs font-extrabold text-rose-400 flex items-center gap-1 tracking-wider uppercase">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                      UNAUTHORIZED CODES INTRUSION ALERT
                    </span>
                    <span className="font-mono text-[9px] text-slate-500 flex items-center gap-1 leading-none shrink-0">
                      <Clock className="w-3 h-3 text-slate-600" />
                      {dateStr}
                    </span>
                  </div>

                  {/* Machine Logs details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 border-t border-slate-900/60 pt-2 text-[11px]">
                    <div className="flex items-center gap-1.5 font-mono text-slate-400">
                      <Globe className="w-3.5 h-3.5 text-slate-650 shrink-0" />
                      <span className="text-slate-500 uppercase tracking-widest text-[9px]">SOURCE IP:</span>
                      <span className="text-slate-200 font-bold tracking-wider">{ip}</span>
                    </div>

                    <div className="flex items-center gap-1.5 font-mono text-slate-400">
                      <Cpu className="w-3.5 h-3.5 text-slate-650 shrink-0" />
                      <span className="text-slate-500 uppercase tracking-widest text-[9px]">MACHINE:</span>
                      <span className="text-slate-200 truncate group-hover:whitespace-normal transition-all" title={device}>
                        {device}
                      </span>
                    </div>
                  </div>

                  {/* Security recommendation footer block */}
                  <div className="flex items-center justify-between text-[9px] font-mono pt-1 text-slate-500">
                    <span className="uppercase text-rose-500/80">THREAT: {attempts >= 3 ? "HIGH SEVERITY ATTACK" : "MINOR BRUTE ENTRY"}</span>
                    <span className="uppercase">STATUS: RECORDED</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Full Screen Lightbox Modal viewer inside iframe */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4"
          >
            <div className="relative max-w-4xl w-full flex flex-col">
              {/* Close Button */}
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute -top-12 right-0 p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-full transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Main Expanded Image */}
              <div className="w-full max-h-[75vh] md:max-h-[80vh] overflow-hidden rounded-xl border border-rose-900 bg-slate-950 flex items-center justify-center">
                <img
                  src={selectedImage}
                  alt="Expanded Intruder snapshot"
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-[75vh] object-contain rounded-lg"
                />
              </div>

              {/* Title & Metadata Details Footer */}
              <div className="mt-4 text-left">
                <h3 className="font-sans text-xs font-bold text-rose-500 uppercase tracking-wider">CRIMINAL PHOTO EVIDENCE DECRYPTED</h3>
                <div className="flex gap-4 font-mono text-[10px] text-slate-500 mt-1">
                  <span>WEBCAM RESOLUTION CAPTURE</span>
                  <span>EVIDENCIARY LEGAL ARCHIVE</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
