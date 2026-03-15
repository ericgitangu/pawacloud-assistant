"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SystemStatus } from "@/components/SystemStatus";
import {
  Activity,
  Server,
  Cpu,
  Zap,
  Database,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { MetricsChart } from "@/components/MetricsChart";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface HealthData {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  llm_provider: string;
  llm_model: string;
  rust_native: boolean;
}

interface InfraData {
  fly_io: {
    app: string;
    region: string;
    alloc_id: string;
    image: string;
  };
  cloud_run: {
    service: string;
    revision: string;
  };
  environment: string;
}

interface LLMTestResult {
  status: string;
  model: string;
  latency_ms: number;
  tokens_used?: number;
}

interface BenchmarkResult {
  function: string;
  backend: string;
  avg_us: number;
  payload_bytes: number;
  iterations: number;
}

interface MetricsData {
  uptime_seconds: number;
  boot_time: string;
  rust_native: boolean;
  benchmarks: BenchmarkResult[];
  redis: {
    status: string;
    version?: string;
    uptime_seconds?: number;
    used_memory_mb?: number;
    total_keys?: number;
  };
  postgres: {
    status: string;
    version?: string;
    database_size?: string;
    conversations?: number;
    users?: number;
    pool_size?: number;
    pool_idle?: number;
  };
}

type TestState = "idle" | "testing" | "done" | "error";

function StatusIcon({ ok }: { ok: boolean | null }) {
  if (ok === null)
    return (
      <Loader2 className="h-5 w-5 animate-spin text-[var(--muted-foreground)]" />
    );
  return ok ? (
    <CheckCircle2 className="h-5 w-5 text-pawa-accent" />
  ) : (
    <XCircle className="h-5 w-5 text-pawa-error" />
  );
}

export default function StatusPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [infra, setInfra] = useState<InfraData | null>(null);
  const [apiLatency, setApiLatency] = useState<number | null>(null);
  const [llmTest, setLlmTest] = useState<LLMTestResult | null>(null);
  const [llmTestState, setLlmTestState] = useState<TestState>("idle");
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchHealth = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const start = performance.now();
    try {
      const res = await fetch(`${API_BASE}/health`, {
        signal: controller.signal,
        credentials: "include",
      });
      setApiLatency(Math.round(performance.now() - start));
      if (res.ok) setHealth(await res.json());
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setHealth(null);
      setApiLatency(null);
    }
    setLastChecked(new Date());
  }, []);

  const fetchInfra = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/health/infra`, {
        credentials: "include",
      });
      if (res.ok) setInfra(await res.json());
    } catch {
      // infra endpoint may not exist yet
    }
  }, []);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/health/metrics`, {
        credentials: "include",
      });
      if (res.ok) setMetrics(await res.json());
    } catch {
      // metrics endpoint may not be deployed yet
    }
  }, []);

  const testLLM = async () => {
    setLlmTestState("testing");
    setLlmTest(null);
    try {
      const start = performance.now();
      const res = await fetch(`${API_BASE}/health/llm`, {
        credentials: "include",
      });
      const elapsed = Math.round(performance.now() - start);
      if (res.ok) {
        const data = await res.json();
        setLlmTest({ ...data, latency_ms: elapsed });
        setLlmTestState("done");
      } else {
        setLlmTestState("error");
      }
    } catch {
      setLlmTestState("error");
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- polling external API
    void fetchHealth();
    void fetchInfra();
    void fetchMetrics();
    const interval = setInterval(fetchHealth, 10000);
    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [fetchHealth, fetchInfra, fetchMetrics]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <Header />

      <main className="mesh-gradient flex-1 overflow-y-auto px-4 py-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-5 w-5 text-pawa-cyan" />
              <h2 className="text-xl font-semibold">System Status</h2>
            </div>
            <p className="text-sm text-[var(--muted-foreground)]">
              Live health monitoring for PawaCloud services
              {lastChecked && (
                <span className="ml-2 opacity-60">
                  — last checked {lastChecked.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>

          {/* service overview */}
          <div className="mb-8">
            <SystemStatus size="md" showDetails pollInterval={10000} />
          </div>

          {/* service cards */}
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            {/* API */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]/40 p-5 transition-all hover:border-pawa-cyan/30 hover:shadow-lg hover:shadow-pawa-cyan/5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-pawa-cyan" />
                  <span className="text-sm font-medium">API Server</span>
                </div>
                <StatusIcon ok={health ? true : null} />
              </div>
              <div className="space-y-1.5 text-xs text-[var(--muted-foreground)]">
                <div className="flex justify-between">
                  <span>Status</span>
                  <span className={health ? "text-pawa-accent" : ""}>
                    {health?.status || "checking..."}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Latency</span>
                  <span>{apiLatency != null ? `${apiLatency}ms` : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Version</span>
                  <span>{health?.version || "—"}</span>
                </div>
              </div>
            </div>

            {/* Gemini */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]/40 p-5 transition-all hover:border-pawa-cyan/30 hover:shadow-lg hover:shadow-pawa-cyan/5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-pawa-cyan" />
                  <span className="text-sm font-medium">Gemini LLM</span>
                </div>
                <StatusIcon ok={health ? !!health.llm_provider : null} />
              </div>
              <div className="space-y-1.5 text-xs text-[var(--muted-foreground)]">
                <div className="flex justify-between">
                  <span>Provider</span>
                  <span>{health?.llm_provider || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Model</span>
                  <span>{health?.llm_model || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Test</span>
                  {llmTestState === "idle" && (
                    <button
                      onClick={testLLM}
                      className="text-pawa-cyan hover:underline"
                    >
                      Run test
                    </button>
                  )}
                  {llmTestState === "testing" && (
                    <span className="flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> testing...
                    </span>
                  )}
                  {llmTestState === "done" && llmTest && (
                    <span className="text-pawa-accent">
                      {llmTest.status} ({llmTest.latency_ms}ms)
                    </span>
                  )}
                  {llmTestState === "error" && (
                    <span className="text-pawa-error">failed</span>
                  )}
                </div>
              </div>
            </div>

            {/* Rust */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]/40 p-5 transition-all hover:border-pawa-cyan/30 hover:shadow-lg hover:shadow-pawa-cyan/5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-pawa-cyan" />
                  <span className="text-sm font-medium">Rust Core</span>
                </div>
                <StatusIcon ok={health ? true : null} />
              </div>
              <div className="space-y-1.5 text-xs text-[var(--muted-foreground)]">
                <div className="flex justify-between">
                  <span>Mode</span>
                  <span
                    className={health?.rust_native ? "text-pawa-accent" : ""}
                  >
                    {health
                      ? health.rust_native
                        ? "Native PyO3"
                        : "Python fallback"
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Functions</span>
                  <span>7 exported</span>
                </div>
                {!health?.rust_native && health && (
                  <div className="flex items-start gap-1 mt-1 text-[10px] text-pawa-warning">
                    <AlertTriangle className="h-3 w-3 shrink-0 mt-px" />
                    <span>
                      Rust binary not compiled — using Python fallback
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* latency time-series — 5s polling */}
          <div className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--card)]/40 p-5">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4 text-pawa-cyan" />
              API Latency
            </h3>
            <MetricsChart pollInterval={5000} />
          </div>

          {/* infra section */}
          {infra && (
            <div className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--card)]/40 p-5">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Server className="h-4 w-4 text-pawa-cyan" />
                {infra.environment === "fly_io"
                  ? "Fly.io Infrastructure"
                  : infra.environment === "cloud_run"
                    ? "Cloud Run Infrastructure"
                    : "Local Environment"}
              </h3>
              <div className="grid gap-2 text-xs text-[var(--muted-foreground)] sm:grid-cols-2">
                <div className="flex justify-between">
                  <span>Environment</span>
                  <span>{infra.environment}</span>
                </div>
                {infra.environment === "fly_io" && (
                  <>
                    <div className="flex justify-between">
                      <span>App</span>
                      <span>{infra.fly_io.app}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Region</span>
                      <span>{infra.fly_io.region}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Alloc ID</span>
                      <span className="font-mono text-[10px]">
                        {infra.fly_io.alloc_id}
                      </span>
                    </div>
                  </>
                )}
                {infra.environment === "cloud_run" && (
                  <>
                    <div className="flex justify-between">
                      <span>Service</span>
                      <span>{infra.cloud_run.service}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Revision</span>
                      <span className="font-mono text-[10px]">
                        {infra.cloud_run.revision}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* PyO3 benchmarks */}
          {metrics && metrics.benchmarks.length > 0 && (
            <div className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--card)]/40 p-5">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-pawa-cyan" />
                PyO3 Performance —{" "}
                {metrics.rust_native ? "Rust Native" : "Python Fallback"}
              </h3>
              <div className="space-y-3">
                {metrics.benchmarks.map((b) => (
                  <div
                    key={b.function}
                    className="flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-mono text-[var(--foreground)]">
                        {b.function}
                      </span>
                      <span className="ml-2 text-[var(--muted-foreground)]">
                        ({b.payload_bytes}B payload)
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--muted)]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-pawa-cyan to-pawa-accent transition-all"
                          style={{
                            width: `${Math.min(100, Math.max(5, 100 - b.avg_us))}%`,
                          }}
                        />
                      </div>
                      <span
                        className={cn(
                          "font-mono tabular-nums",
                          b.avg_us < 5
                            ? "text-pawa-accent"
                            : "text-[var(--foreground)]",
                        )}
                      >
                        {b.avg_us.toFixed(1)}us
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {metrics.redis.status === "connected" && (
                <div className="mt-4 border-t border-[var(--border)] pt-3">
                  <div className="grid grid-cols-2 gap-2 text-xs text-[var(--muted-foreground)] sm:grid-cols-4">
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider">
                        Uptime
                      </span>
                      <span className="font-mono">
                        {Math.floor(metrics.uptime_seconds / 3600)}h{" "}
                        {Math.floor((metrics.uptime_seconds % 3600) / 60)}m
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider">
                        Redis Memory
                      </span>
                      <span className="font-mono">
                        {metrics.redis.used_memory_mb}MB
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider">
                        Redis Keys
                      </span>
                      <span className="font-mono">
                        {metrics.redis.total_keys}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wider">
                        Redis Version
                      </span>
                      <span className="font-mono">{metrics.redis.version}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PostgreSQL metrics */}
          {metrics?.postgres?.status === "connected" && (
            <div className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--card)]/40 p-5">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Database className="h-4 w-4 text-pawa-cyan" />
                PostgreSQL — Neon
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs text-[var(--muted-foreground)] sm:grid-cols-4">
                <div>
                  <span className="block text-[10px] uppercase tracking-wider">
                    Version
                  </span>
                  <span className="font-mono">{metrics.postgres.version}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wider">
                    DB Size
                  </span>
                  <span className="font-mono">
                    {metrics.postgres.database_size}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wider">
                    Conversations
                  </span>
                  <span className="font-mono">
                    {metrics.postgres.conversations}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wider">
                    Users
                  </span>
                  <span className="font-mono">{metrics.postgres.users}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wider">
                    Pool Size
                  </span>
                  <span className="font-mono">
                    {metrics.postgres.pool_size}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wider">
                    Pool Idle
                  </span>
                  <span className="font-mono">
                    {metrics.postgres.pool_idle}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* given more time */}
          <div className="mb-8 rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)]/20 p-5">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-pawa-warning" />
              Given More Time
            </h3>
            <ul className="space-y-2 text-xs text-[var(--muted-foreground)]">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-pawa-warning/60" />
                <span>
                  <strong>Observability</strong> — ELK stack for structured log
                  aggregation, Prometheus exporters for request metrics, Grafana
                  dashboards for latency percentiles and error rates
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-pawa-warning/60" />
                <span>
                  <strong>APM</strong> — OpenTelemetry traces across FastAPI →
                  Gemini → Redis, distributed tracing with Cloud Trace, SLO
                  alerting on p99 latency
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-pawa-warning/60" />
                <span>
                  <strong>CI/CD</strong> — GitHub Actions pipeline with parallel
                  lint/test/build, preview deployments per PR, automated
                  Lighthouse audits
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-pawa-warning/60" />
                <span>
                  <strong>Multi-turn context</strong> — conversation_id
                  parameter already in schema, wire to Gemini chat sessions for
                  follow-up questions
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-pawa-warning/60" />
                <span>
                  <strong>RAG pipeline</strong> — embed GCP docs with Vertex AI,
                  store in AlloyDB pgvector, retrieval-augmented generation for
                  grounded answers
                </span>
              </li>
            </ul>
          </div>

          {/* quick links */}
          <div className="flex flex-wrap gap-2">
            <a
              href={`${API_BASE}/docs`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-4 py-2",
                "text-sm text-[var(--muted-foreground)] transition-colors",
                "hover:border-pawa-cyan/30 hover:text-pawa-cyan",
              )}
            >
              Swagger Docs <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href={`${API_BASE}/redoc`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-4 py-2",
                "text-sm text-[var(--muted-foreground)] transition-colors",
                "hover:border-pawa-cyan/30 hover:text-pawa-cyan",
              )}
            >
              ReDoc <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
