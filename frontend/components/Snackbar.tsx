"use client";

import { useEffect, useState } from "react";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";

type SnackbarVariant = "success" | "error" | "info";

interface SnackbarProps {
  message: string;
  variant?: SnackbarVariant;
  duration?: number;
  onDismiss: () => void;
}

const variantStyles: Record<SnackbarVariant, { border: string; bg: string; icon: typeof CheckCircle }> = {
  success: { border: "border-pawa-accent/40", bg: "bg-pawa-accent/10", icon: CheckCircle },
  error: { border: "border-pawa-error/40", bg: "bg-pawa-error/10", icon: AlertCircle },
  info: { border: "border-pawa-cyan/40", bg: "bg-pawa-cyan/10", icon: Info },
};

export function Snackbar({ message, variant = "info", duration = 4000, onDismiss }: SnackbarProps) {
  const [exiting, setExiting] = useState(false);
  const styles = variantStyles[variant];
  const Icon = styles.icon;

  useEffect(() => {
    const timer = setTimeout(() => setExiting(true), duration - 200);
    const dismiss = setTimeout(onDismiss, duration);
    return () => { clearTimeout(timer); clearTimeout(dismiss); };
  }, [duration, onDismiss]);

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div
        className={`flex items-center gap-3 rounded-xl border ${styles.border} ${styles.bg} px-4 py-3 shadow-lg backdrop-blur-md ${
          exiting ? "animate-slide-out" : "animate-slide-up"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0 text-[var(--foreground)]" />
        <span className="text-sm text-[var(--foreground)]">{message}</span>
        <button
          onClick={() => { setExiting(true); setTimeout(onDismiss, 200); }}
          className="ml-1 rounded-md p-0.5 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
