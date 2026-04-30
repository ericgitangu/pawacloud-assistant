"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Cloud,
  Sparkles,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  Zap,
  Shield,
  Globe,
  Code2,
  Database,
} from "lucide-react";
import { signupWithEmail, getLoginUrl } from "@/lib/api";
import { Footer } from "@/components/Footer";
import { FadeIn, Stagger, StaggerItem } from "@/components/FadeIn";
import { useAuth } from "@/providers/AuthProvider";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Cloud,
    title: "Cloud Infrastructure",
    desc: "GCP, AWS, Azure — architecture, deployment, and pricing",
  },
  {
    icon: Zap,
    title: "Real-time Streaming",
    desc: "Watch answers arrive word-by-word as they're generated",
  },
  {
    icon: Shield,
    title: "Best Practices",
    desc: "Security, cost optimisation, and Africa-aware guidance",
  },
  {
    icon: Globe,
    title: "Multilingual",
    desc: "Swahili, Amharic, French, Portuguese, and 100+ languages",
  },
  {
    icon: Code2,
    title: "Python + Rust (PyO3)",
    desc: "Native text processing with Python fallback",
  },
  {
    icon: Database,
    title: "Session History",
    desc: "Persistent conversation history per user",
  },
];

const required: { label: string; icon?: string }[] = [
  {
    label: "Python + FastAPI backend",
    icon: "https://cdn.simpleicons.org/python/3776AB",
  },
  {
    label: "Next.js 16 frontend",
    icon: "https://cdn.simpleicons.org/nextdotjs/white",
  },
  {
    label: "TailwindCSS v4 styling",
    icon: "https://cdn.simpleicons.org/tailwindcss/06B6D4",
  },
  {
    label: "LLM integration (Gemini)",
    icon: "https://cdn.simpleicons.org/googlegemini/4285F4",
  },
  { label: "Real-time streaming" },
  {
    label: "Swagger documentation",
    icon: "https://cdn.simpleicons.org/swagger/85EA2D",
  },
  {
    label: "Docker Compose",
    icon: "https://cdn.simpleicons.org/docker/2496ED",
  },
];

const bonus: { label: string; icon?: string }[] = [
  { label: "Google OAuth", icon: "https://cdn.simpleicons.org/google/4285F4" },
  {
    label: "Email/password auth",
    icon: "https://cdn.simpleicons.org/maildotru/white",
  },
  {
    label: "PostgreSQL users",
    icon: "https://cdn.simpleicons.org/postgresql/4169E1",
  },
  { label: "Redis sessions", icon: "https://cdn.simpleicons.org/redis/DC382D" },
  { label: "Query history" },
  { label: "Status dashboard" },
  {
    label: "Terraform IaC",
    icon: "https://cdn.simpleicons.org/terraform/7B42BC",
  },
  { label: "PWA installable", icon: "https://cdn.simpleicons.org/pwa/5A0FC8" },
  {
    label: "Python + Rust (PyO3)",
    icon: "https://cdn.simpleicons.org/python/3776AB",
  },
];

export default function SignupPage() {
  const router = useRouter();
  const { user, loading: authLoading, setUser } = useAuth();

  // already-authed users hitting /signup get bounced home (matches middleware)
  useEffect(() => {
    if (!authLoading && user?.authenticated) {
      router.replace("/");
    }
  }, [authLoading, user, router]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordsMatch = password === confirm;
  const canSubmit =
    name && email && password.length >= 8 && passwordsMatch && !loading;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!passwordsMatch) {
      setError("Passwords don't match");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const data = await signupWithEmail(email, name, password);
      document.cookie = "pawacloud_auth=1; path=/; max-age=86400; SameSite=Lax";
      setUser({
        email: data.user.email,
        name: data.user.name,
        picture: data.user.picture,
        authenticated: true,
      });
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      <div className="mesh-gradient flex-1">
        {/* hero + auth */}
        <div className="mx-auto grid max-w-5xl gap-6 px-4 pb-12 pt-12 sm:gap-10 sm:pt-16 lg:grid-cols-2 lg:items-center lg:gap-16">
          {/* left: branding + features */}
          <div>
            <FadeIn>
              <div className="mb-6 flex items-center gap-4 sm:mb-8">
                <div className="animate-float flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pawa-cyan to-pawa-accent shadow-xl shadow-pawa-cyan/20 sm:h-16 sm:w-16">
                  <Cloud className="h-7 w-7 text-pawa-dark sm:h-8 sm:w-8" />
                </div>
                <div>
                  <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">
                    PawaCloud Assistant
                    <Sparkles className="h-4 w-4 text-pawa-accent sm:h-5 sm:w-5" />
                  </h1>
                  <p className="text-xs text-[var(--muted-foreground)] sm:text-sm">
                    Cloud + General Assistant
                  </p>
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={0.1}>
              <div className="mx-auto mb-6 h-px w-16 bg-gradient-to-r from-pawa-cyan to-transparent lg:mx-0" />

              <p className="mb-6 max-w-md text-xs leading-relaxed text-[var(--muted-foreground)] sm:mb-8 sm:text-sm">
                Ask anything — &quot;What documents do I need to travel from
                Kenya to Ireland?&quot; or &quot;Explain Cloud Run autoscaling
                in plain English.&quot;
              </p>
            </FadeIn>

            {/* feature cards */}
            <Stagger className="grid gap-2 sm:grid-cols-2 sm:gap-2.5">
              {features.map((feat) => (
                <StaggerItem key={feat.title}>
                  <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)]/30 p-2.5 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-pawa-cyan/20 hover:shadow-lg hover:shadow-pawa-cyan/5 sm:p-3">
                    <feat.icon className="mt-0.5 h-4 w-4 shrink-0 text-pawa-cyan" />
                    <div>
                      <p className="text-xs font-medium">{feat.title}</p>
                      <p className="text-[10px] leading-snug text-[var(--muted-foreground)]">
                        {feat.desc}
                      </p>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>

          {/* right: signup form */}
          <FadeIn
            delay={0.2}
            className="w-full max-w-sm justify-self-center lg:justify-self-end"
          >
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/60 p-5 shadow-lg backdrop-blur-sm sm:p-6">
              <h2 className="mb-5 text-center text-lg font-semibold">
                Create account
              </h2>

              {error && (
                <div className="mb-4 rounded-lg border border-pawa-error/30 bg-pawa-error/10 px-3 py-2 text-sm text-pawa-error">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label
                    htmlFor="name"
                    className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]"
                  >
                    Full name
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="name"
                    autoFocus
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm outline-none transition-colors focus:border-pawa-cyan/50 focus:ring-1 focus:ring-pawa-cyan/20"
                    placeholder="Jane Doe"
                  />
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm outline-none transition-colors focus:border-pawa-cyan/50 focus:ring-1 focus:ring-pawa-cyan/20"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 pr-10 text-sm outline-none transition-colors focus:border-pawa-cyan/50 focus:ring-1 focus:ring-pawa-cyan/20"
                      placeholder="Min. 8 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="confirm"
                    className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]"
                  >
                    Confirm password
                  </label>
                  <input
                    id="confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                    className={cn(
                      "w-full rounded-lg border bg-[var(--background)] px-3 py-2.5 text-sm outline-none transition-colors focus:ring-1",
                      confirm && !passwordsMatch
                        ? "border-pawa-error/50 focus:border-pawa-error/50 focus:ring-pawa-error/20"
                        : "border-[var(--border)] focus:border-pawa-cyan/50 focus:ring-pawa-cyan/20",
                    )}
                    placeholder="Repeat password"
                  />
                  {confirm && !passwordsMatch && (
                    <p className="mt-1 text-xs text-pawa-error">
                      Passwords don&apos;t match
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={cn(
                    "btn-press flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
                    "bg-gradient-to-r from-pawa-cyan to-pawa-accent text-pawa-dark",
                    "hover:shadow-lg hover:shadow-pawa-cyan/25 disabled:opacity-40",
                  )}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Create account"
                  )}
                </button>
              </form>

              {/* divider */}
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-[var(--border)]" />
                <span className="text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]/60">
                  or
                </span>
                <div className="h-px flex-1 bg-[var(--border)]" />
              </div>

              {/* google OAuth */}
              <a
                href={getLoginUrl()}
                className={cn(
                  "flex w-full items-center justify-center gap-3 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm transition-all",
                  "hover:border-pawa-cyan/30 hover:bg-pawa-cyan/5",
                )}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Continue with Google
              </a>

              {/* navigation */}
              <p className="mt-5 text-center text-sm text-[var(--muted-foreground)]">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-medium text-pawa-cyan hover:underline"
                >
                  Log in
                </Link>
              </p>
            </div>
          </FadeIn>
        </div>

        {/* tech showcase */}
        <div className="border-t border-[var(--border)]/50 bg-[var(--background)]/40 backdrop-blur-sm">
          <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
            <FadeIn>
              <p className="eyebrow mb-3 text-center text-[var(--muted-foreground)]/60">
                Assessment Checklist
              </p>
            </FadeIn>
            <Stagger className="mb-8 grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {required.map((item) => (
                <StaggerItem key={item.label}>
                  <div className="flex items-center gap-2 rounded-lg border border-pawa-accent/20 bg-pawa-accent/5 px-2.5 py-2 text-[11px] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:shadow-pawa-accent/5 sm:px-3 sm:text-xs">
                    {item.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.icon}
                        alt=""
                        className="h-3.5 w-3.5 shrink-0"
                      />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-pawa-accent" />
                    )}
                    <span className="text-[var(--foreground)]">
                      {item.label}
                    </span>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>

            <FadeIn>
              <p className="eyebrow mb-3 text-center text-[var(--muted-foreground)]/60">
                Extras
              </p>
            </FadeIn>
            <Stagger className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
              {bonus.map((item) => (
                <StaggerItem key={item.label}>
                  <div className="flex items-center gap-2 rounded-lg border border-pawa-cyan/20 bg-pawa-cyan/5 px-2.5 py-2 text-[11px] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:shadow-pawa-cyan/5 sm:px-3 sm:text-xs">
                    {item.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.icon}
                        alt=""
                        className="h-3 w-3 shrink-0"
                      />
                    ) : (
                      <Sparkles className="h-3 w-3 shrink-0 text-pawa-cyan" />
                    )}
                    <span className="text-[var(--muted-foreground)]">
                      {item.label}
                    </span>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>

            {/* tech stack pills */}
            <FadeIn delay={0.15}>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:mt-8 sm:gap-3">
                {[
                  {
                    icon: "https://cdn.simpleicons.org/python/3776AB",
                    label: "Python 3.12",
                  },
                  {
                    icon: "https://cdn.simpleicons.org/fastapi/009688",
                    label: "FastAPI",
                  },
                  {
                    icon: "https://cdn.simpleicons.org/nextdotjs/white",
                    label: "Next.js 16",
                  },
                  {
                    icon: "https://cdn.simpleicons.org/googlegemini/4285F4",
                    label: "Gemini 2.5",
                  },
                  {
                    icon: "https://cdn.simpleicons.org/postgresql/4169E1",
                    label: "PostgreSQL",
                  },
                  {
                    icon: "https://cdn.simpleicons.org/redis/DC382D",
                    label: "Redis",
                  },
                  {
                    icon: "https://cdn.simpleicons.org/terraform/7B42BC",
                    label: "Terraform",
                  },
                  {
                    icon: "https://cdn.simpleicons.org/rust/DEA584",
                    label: "Rust (PyO3)",
                  },
                ].map((t) => (
                  <div
                    key={t.label}
                    className="flex items-center gap-1.5 rounded-full border border-[var(--border)]/50 px-2.5 py-1 text-[10px] text-[var(--muted-foreground)] sm:px-3"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={t.icon} alt="" className="h-3 w-3" />
                    {t.label}
                  </div>
                ))}
              </div>
            </FadeIn>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
