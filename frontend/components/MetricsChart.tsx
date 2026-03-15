"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const MAX_POINTS = 60;

interface DataPoint {
  time: string;
  latency: number;
  status: 0 | 1;
}

// format HH:MM:SS for axis labels
function fmtTime(date: Date): string {
  return date.toLocaleTimeString([], { hour12: false });
}

export function MetricsChart({
  pollInterval = 5000,
}: {
  pollInterval?: number;
}) {
  const [series, setSeries] = useState<DataPoint[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const poll = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const start = performance.now();
    let latency = 0;
    let status: 0 | 1 = 0;

    try {
      const res = await fetch(`${API_BASE}/health`, {
        signal: controller.signal,
        credentials: "include",
      });
      latency = Math.round(performance.now() - start);
      status = res.ok ? 1 : 0;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      latency = Math.round(performance.now() - start);
    }

    setSeries((prev) => {
      const next = [...prev, { time: fmtTime(new Date()), latency, status }];
      return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
    });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- polling external API
    void poll();
    const id = setInterval(poll, pollInterval);
    return () => {
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [poll, pollInterval]);

  if (series.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center text-xs text-[var(--muted-foreground)]">
        Collecting metrics...
      </div>
    );
  }

  const avgLatency = Math.round(
    series.reduce((s, d) => s + d.latency, 0) / series.length,
  );
  const maxLatency = Math.max(...series.map((d) => d.latency));
  const uptime = Math.round(
    (series.filter((d) => d.status === 1).length / series.length) * 100,
  );

  return (
    <div>
      {/* summary row */}
      <div className="mb-3 flex gap-4 text-xs text-[var(--muted-foreground)]">
        <span>
          Avg <span className="font-mono text-pawa-cyan">{avgLatency}ms</span>
        </span>
        <span>
          Peak{" "}
          <span className="font-mono text-pawa-warning">{maxLatency}ms</span>
        </span>
        <span>
          Uptime <span className="font-mono text-pawa-accent">{uptime}%</span>
        </span>
        <span className="ml-auto opacity-60">
          {series.length} samples / {pollInterval / 1000}s interval
        </span>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <AreaChart
          data={series}
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00b4d8" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#00b4d8" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            opacity={0.3}
          />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            interval="preserveStartEnd"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            unit="ms"
            width={48}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--muted-foreground)" }}
            formatter={(value) => [`${value}ms`, "Latency"]}
          />
          <Area
            type="monotone"
            dataKey="latency"
            stroke="#00b4d8"
            strokeWidth={1.5}
            fill="url(#latencyGradient)"
            dot={false}
            animationDuration={300}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
