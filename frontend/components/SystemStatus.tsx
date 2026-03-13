"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

type ServiceHealth = "operational" | "degraded" | "outage" | "checking";

interface ServiceStatus {
  api: ServiceHealth;
  llm: ServiceHealth;
  rust: ServiceHealth;
  latency: number | null;
  model?: string;
  rustNative?: boolean;
}

const STATUS_COLORS: Record<ServiceHealth, string> = {
  operational: "bg-pawa-accent",
  degraded: "bg-pawa-warning",
  outage: "bg-pawa-error",
  checking: "bg-[var(--muted-foreground)]",
};

const STATUS_LABELS: Record<ServiceHealth, string> = {
  operational: "Operational",
  degraded: "Degraded",
  outage: "Offline",
  checking: "Checking...",
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface SystemStatusProps {
  size?: "xs" | "sm" | "md";
  showDetails?: boolean;
  pollInterval?: number;
}

export function SystemStatus({ size = "xs", showDetails = false, pollInterval = 30000 }: SystemStatusProps) {
  const [status, setStatus] = useState<ServiceStatus>({
    api: "checking", llm: "checking", rust: "checking", latency: null, rustNative: undefined,
  });
  const abortRef = useRef<AbortController | null>(null);

  const checkHealth = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const start = performance.now();

    try {
      const res = await fetch(`${API_BASE}/health`, {
        signal: controller.signal,
        credentials: "include",
      });
      const elapsed = Math.round(performance.now() - start);

      if (!res.ok) {
        setStatus({ api: "degraded", llm: "checking", rust: "checking", latency: elapsed });
        return;
      }

      const data = await res.json();
      // rust fallback to Python is fine — both paths work, just different perf
      setStatus({
        api: "operational",
        llm: data.llm_provider ? "operational" : "degraded",
        rust: "operational",
        latency: elapsed,
        model: data.llm_model,
        rustNative: data.rust_native,
      });

      // cache for offline display
      try { localStorage.setItem("pawacloud_status", JSON.stringify({ ...data, latency: elapsed })); } catch { /* noop */ }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setStatus({ api: "outage", llm: "outage", rust: "checking", latency: null });
    }
  }, []);

  // poll backend health
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- polling external API
    void checkHealth();
    const interval = setInterval(checkHealth, pollInterval);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void checkHealth();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      abortRef.current?.abort();
    };
  }, [checkHealth, pollInterval]);

  const dotSize = {
    xs: "h-1.5 w-1.5",
    sm: "h-2 w-2",
    md: "h-2.5 w-2.5",
  }[size];

  const textSize = {
    xs: "text-[9px]",
    sm: "text-[10px]",
    md: "text-xs",
  }[size];

  const services = [
    { key: "api" as const, label: "API" },
    { key: "llm" as const, label: "Gemini" },
    { key: "rust" as const, label: "Rust" },
  ];

  if (showDetails && size === "md") {
    return (
      <div className="grid grid-cols-3 gap-3">
        {services.map((svc) => (
          <div
            key={svc.key}
            className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)]/40 px-3 py-2"
          >
            <div className={cn(
              "h-2.5 w-2.5 rounded-full shrink-0",
              STATUS_COLORS[status[svc.key]],
              status[svc.key] === "operational" && "animate-pulse",
            )} />
            <div className="min-w-0">
              <span className="text-xs font-medium block">{svc.label}</span>
              <span className="text-[10px] text-[var(--muted-foreground)] block">
                {STATUS_LABELS[status[svc.key]]}
                {svc.key === "api" && status.latency != null && ` \u00b7 ${status.latency}ms`}
                {svc.key === "llm" && status.model && ` \u00b7 ${status.model}`}
                {svc.key === "rust" && status.rustNative === false && " \u00b7 fallback"}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", textSize)}>
      {services.map((svc) => (
        <div key={svc.key} className="flex items-center gap-1" title={`${svc.label}: ${status[svc.key]}${svc.key === "api" && status.latency ? ` (${status.latency}ms)` : ""}`}>
          <div className={cn(
            dotSize, "rounded-full",
            STATUS_COLORS[status[svc.key]],
            status[svc.key] === "operational" && "animate-pulse",
          )} />
          {showDetails && (
            <span className="text-[var(--muted-foreground)]/60">
              {svc.label}
              {svc.key === "api" && status.latency != null && <span className="ml-0.5 opacity-60">{status.latency}ms</span>}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
