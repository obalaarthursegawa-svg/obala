/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { Camera, CameraOff, Shield, ShieldAlert } from "lucide-react";

export interface CameraTrackerHandle {
  captureSnapshot: () => string | null;
}

interface CameraTrackerProps {
  onPermissionStatus: (granted: boolean) => void;
}

export const CameraTracker = forwardRef<CameraTrackerHandle, CameraTrackerProps>(
  ({ onPermissionStatus }, ref) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [status, setStatus] = useState<"not-requested" | "granted" | "denied">("not-requested");
    const [errorMessage, setErrorMessage] = useState<string>("");

    // Initialize the hidden webcam stream
    const initializeWebcam = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("WebRTC camera APIs are not supported by this browser client.");
        }

        const constraints = {
          video: { width: 640, height: 480, facingMode: "user" },
          audio: false,
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        setStream(mediaStream);
        setStatus("granted");
        onPermissionStatus(true);
        setErrorMessage("");

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch((err) => {
            console.warn("Webcam auto-play delayed:", err);
          });
        }
      } catch (err: any) {
        console.error("Camera access failed / denied:", err);
        setStatus("denied");
        onPermissionStatus(false);
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setErrorMessage("Camera access request was denied. Smart Vault intruder surveillance is offline.");
        } else {
          setErrorMessage(err.message || "Failed to initialize standard webcam hardware.");
        }
      }
    };

    // Release camera stream on cleanup
    useEffect(() => {
      // Auto-request initial access for the Smart Vault
      initializeWebcam();

      return () => {
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
      };
    }, []);

    // Expose capture method via ref
    useImperativeHandle(ref, () => ({
      captureSnapshot: () => {
        if (!videoRef.current || status !== "granted") {
          console.warn("Cannot snapshot: Camera tracking stream not active.");
          return null;
        }

        try {
          const video = videoRef.current;
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;

          const ctx = canvas.getContext("2d");
          if (!ctx) return null;

          // Flip horizontally for natural mirror look in snapshots
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          // Reset transform
          ctx.setTransform(1, 0, 0, 1, 0, 0);

          // Return base64 URL
          return canvas.toDataURL("image/jpeg", 0.85);
        } catch (e) {
          console.error("Snapshot canvas capture failure:", e);
          return null;
        }
      },
    }));

    return (
      <div className="flex flex-col items-center justify-center p-3 rounded-xl border border-dashed border-slate-800 bg-slate-950/40 backdrop-blur-md">
        {/* Hidden Video Tracker Source */}
        <div className="absolute opacity-0 pointer-events-none w-px h-px overflow-hidden">
          <video
            ref={videoRef}
            id="hidden-surveillance-feed"
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </div>

        {/* Human Interactive UI State Indicator */}
        <div className="flex items-center gap-3">
          <div className="relative">
            {status === "granted" ? (
              <>
                <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
                <div className="relative p-2 rounded-full border border-emerald-500 bg-emerald-950 text-emerald-400">
                  <Shield className="w-5 h-5" />
                </div>
              </>
            ) : (
              <div className="p-2 rounded-full border border-rose-500 bg-rose-950 text-rose-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
            )}
          </div>

          <div className="text-left">
            <div className="flex items-center gap-1.5 font-mono text-xs font-semibold tracking-wider">
              {status === "granted" ? (
                <>
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">SURVEILLANCE SENSOR LINKED</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                  <span className="text-rose-400">SURVEILLANCE DEGRADED</span>
                </>
              )}
            </div>
            <p className="font-sans text-xs text-slate-400 mt-0.5 max-w-xs leading-snug">
              {status === "granted" ? (
                "Biometric web sensor ready."
              ) : (
                <span className="text-rose-400/90 font-mono text-[11px]">
                  {errorMessage || "Permissions pending. Grant camera rights to activate lock triggers."}
                </span>
              )}
            </p>
          </div>
        </div>

        {status === "denied" && (
          <button
            onClick={initializeWebcam}
            className="mt-2.5 px-3 py-1 font-mono text-[10px] text-rose-400 hover:text-white hover:bg-rose-950/50 border border-rose-800 rounded transition duration-200"
          >
            RETRY SENSOR REQUEST
          </button>
        )}
      </div>
    );
  }
);

CameraTracker.displayName = "CameraTracker";
