/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { Upload, Trash2, Eye, X, Lock, Plus, Image, RefreshCw, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { VaultItem } from "../types";

interface VaultGalleryProps {
  items: VaultItem[];
  authToken: string;
  onRefreshItems: () => void;
  onLockVault: () => void;
}

export default function VaultGallery({ items, authToken, onRefreshItems, onLockVault }: VaultGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<string>("");

  // Upload UI state managers
  const [isUploading, setIsUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Convert File to Base64
  const processUploadFile = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorText("Only image uploads (JPEG/PNG/WEBP) are authorized for the graphics vault.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorText("File size limit is 5MB for security encryption constraints.");
      return;
    }

    setIsUploading(true);
    setErrorText(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Content = reader.result as string;
      const assetTitle = uploadTitle.trim() || file.name.split(".")[0] || "Secured Asset";

      try {
        const res = await fetch("/api/gallery/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({
            title: assetTitle,
            image: base64Content
          })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          onRefreshItems();
          setUploadTitle("");
          if (fileInputRef.current) fileInputRef.current.value = "";
        } else {
          setErrorText(data.error || "Failed to catalog file. Asset lock denied.");
        }
      } catch (err) {
        setErrorText("Server upload interface timed out.");
      } finally {
        setIsUploading(false);
      }
    };

    reader.onerror = () => {
      setErrorText("FileReader aborted. File reading corrupted.");
      setIsUploading(false);
    };

    reader.readAsDataURL(file);
  };

  // Drag handles
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processUploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processUploadFile(e.target.files[0]);
    }
  };

  const triggerFileInputClick = () => {
    fileInputRef.current?.click();
  };

  // Shred / Delete handle
  const handleShredAsset = async (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you absolutely sure you want to systematically shred this asset? This cannot be undone.")) return;

    try {
      const res = await fetch("/api/gallery/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ id: itemId })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onRefreshItems();
      } else {
        alert(data.error || "Failed to shred asset.");
      }
    } catch (err) {
      alert("Terminal delete connection timeout.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Panel */}
      <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-xl backdrop-blur-md relative">
        <h3 className="font-mono text-xs font-semibold tracking-wider text-cyan-400 mb-4 flex items-center gap-1.5">
          <Upload className="w-3.5 h-3.5 text-cyan-400" />
          SECURE ENCRYPTED GRAPHIC TRANSMISSION
        </h3>

        <div className="space-y-3">
          {/* Asset Title Entry */}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="Name of secured asset (optional)..."
              disabled={isUploading}
              className="flex-1 px-4 py-2 font-mono text-xs bg-slate-950 border border-slate-800 rounded text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
            />
            <button
              onClick={triggerFileInputClick}
              disabled={isUploading}
              className="py-2 px-5 rounded font-mono text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 active:scale-95 duration-150 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 shadow-[0_4px_15px_rgba(8,145,178,0.2)]"
            >
              {isUploading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span>UPLOAD IMAGE FILE</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
          </div>

          {/* Secure Drag Drop Area */}
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={triggerFileInputClick}
            className={`border border-dashed py-6 px-4 rounded text-center transition cursor-pointer flex flex-col items-center justify-center ${
              dragActive
                ? "border-cyan-500 bg-cyan-500/5"
                : "border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/20"
            }`}
          >
            <Image className="w-7 h-7 text-slate-500 mb-1.5" />
            <p className="font-sans text-xs text-slate-300 font-medium">
              Drag file here, or click to browse local memory disk
            </p>
            <p className="font-mono text-[10px] text-slate-500 mt-1 uppercase">
              Encrypted Sandbox JPEG, PNG, WEBP (Max 5MB)
            </p>
          </div>

          {errorText && (
            <div className="flex items-center gap-2 p-3 rounded border border-rose-950 bg-rose-950/20 text-rose-400 text-xs font-mono">
              <AlertCircle className="w-4 h-4" />
              <span>{errorText}</span>
            </div>
          )}
        </div>
      </div>

      {/* Grid Content */}
      <h3 className="font-mono text-xs font-medium tracking-wider text-slate-400 border-b border-cyan-900/20 pb-2">
        DECRYPTED ARCHIVES ({items.length})
      </h3>

      {items.length === 0 ? (
        <div className="p-8 text-center rounded-xl border border-slate-800 bg-slate-900/20 text-slate-500">
          <Lock className="w-8 h-8 mx-auto text-slate-600 mb-2" />
          <p className="font-mono text-xs uppercase tracking-wider">Empty Security Safe</p>
          <p className="font-sans text-xs text-slate-600 mt-1">Record fresh images into the private vault above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {items.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, delay: Math.min(index * 0.04, 0.2) }}
                className="group border border-slate-850 hover:border-cyan-500/30 bg-slate-900/10 hover:bg-slate-900/40 p-3 rounded-lg backdrop-blur-sm transition relative overflow-hidden flex flex-col"
              >
                {/* Visual Image */}
                <div
                  onClick={() => {
                    setSelectedImage(item.url);
                    setSelectedTitle(item.title);
                  }}
                  className="w-full aspect-video rounded overflow-hidden relative cursor-pointer bg-slate-950"
                >
                  <img
                    src={item.url}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 duration-300 pointer-events-none"
                  />
                  <div className="absolute inset-0 bg-slate-950/55 opacity-0 group-hover:opacity-100 transition duration-200 flex items-center justify-center">
                    <Eye className="w-6 h-6 text-cyan-400" />
                  </div>
                </div>

                {/* Body Details */}
                <div className="mt-3 text-left flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-sans text-xs font-bold text-slate-200 uppercase tracking-wide group-hover:text-cyan-400 transition-colors truncate">
                      {item.title}
                    </h4>
                    <p className="font-mono text-[9px] text-slate-500 mt-1">
                      CATALOGED: {new Date(item.created_at || item.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-800/50 flex justify-between items-center bg-slate-950/20 px-1 rounded">
                    <span className="font-mono text-[8px] text-slate-600 uppercase">CLASS: RESTRICTED</span>
                    <button
                      onClick={(e) => handleShredAsset(item.id, e)}
                      className="p-1 px-1.5 text-rose-450 hover:text-white bg-transparent hover:bg-rose-950/50 border border-transparent hover:border-rose-900/60 rounded text-[10px] font-mono flex items-center gap-1 transition-all duration-150 cursor-pointer"
                      title="Shred this image permanently"
                    >
                      <Trash2 className="w-3 h-3 text-rose-450 group-hover:text-rose-300" />
                      <span>SHRED</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
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
              <div className="w-full max-h-[75vh] md:max-h-[80vh] overflow-hidden rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-center">
                <img
                  src={selectedImage}
                  alt={selectedTitle}
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-[75vh] object-contain rounded-lg"
                />
              </div>

              {/* Title & Metadata Details Footer */}
              <div className="mt-4 text-left">
                <h3 className="font-sans text-sm font-bold text-white uppercase tracking-wider">{selectedTitle}</h3>
                <div className="flex gap-4 font-mono text-[10px] text-slate-500 mt-1">
                  <span>AES-256 SYMMETRIC SEAL</span>
                  <span>PREVIEW ACTIVE</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
