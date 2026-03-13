"use client";

import { Download } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt.current) return;
    await deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    if (outcome === "accepted") setShow(false);
    deferredPrompt.current = null;
  }, []);

  if (!show) return null;

  return (
    <button
      onClick={handleInstall}
      className="eyebrow flex items-center gap-1.5 rounded-full border border-pawa-accent/20 bg-pawa-accent/10 px-3 py-1 text-pawa-accent transition-colors hover:bg-pawa-accent hover:text-pawa-dark"
    >
      <Download className="h-3 w-3" />
      Install
    </button>
  );
}
