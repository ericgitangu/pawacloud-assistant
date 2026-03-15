"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Cloud,
  History,
  Sparkles,
  ExternalLink,
  Menu,
  ChevronsLeft,
  LogOut,
  User,
  UserPlus,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { InstallPrompt } from "@/components/InstallPrompt";
import { logout as logoutApi } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface HeaderProps {
  onToggleHistory?: () => void;
  historyOpen?: boolean;
  messageCount?: number;
}

export function Header({
  onToggleHistory,
  historyOpen,
  messageCount,
}: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);
  const { user, refresh } = useAuth();

  // close avatar dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    };
    if (avatarOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [avatarOpen]);

  const handleLogout = async () => {
    await logoutApi();
    await refresh();
    router.push("/login");
  };

  const navLinks = [
    { href: "/", label: "Chat" },
    { href: "/status", label: "Status" },
  ];

  return (
    <>
      <header className="relative z-40 flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)]/60 px-4 py-2.5 backdrop-blur-md dark:bg-pawa-navy/50">
        <div className="flex items-center gap-3">
          {/* mobile hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)] sm:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-pawa-cyan to-pawa-accent shadow-lg shadow-pawa-cyan/20">
              <Cloud className="h-5 w-5 text-pawa-dark" />
            </div>
            <div>
              <h1 className="flex items-center gap-1.5 text-base font-semibold">
                PawaCloud Assistant
                <Sparkles className="h-3.5 w-3.5 text-pawa-accent" />
              </h1>
              <p className="eyebrow text-[var(--muted-foreground)]">
                Cloud + General Assistant
              </p>
            </div>
          </Link>

          {/* desktop nav */}
          <nav className="ml-4 hidden items-center gap-1 sm:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  pathname === link.href
                    ? "bg-pawa-cyan/15 text-pawa-cyan font-medium"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
                )}
              >
                {link.label}
              </Link>
            ))}
            <a
              href={`${API_BASE}/docs`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            >
              API Docs
              <ExternalLink className="h-3 w-3" />
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <InstallPrompt />
          {messageCount != null && messageCount > 0 && (
            <span className="eyebrow hidden rounded-full bg-[var(--muted)] px-2.5 py-0.5 text-[var(--muted-foreground)] sm:inline-block">
              {Math.ceil(messageCount / 2)} exchanges
            </span>
          )}
          <ThemeToggle />
          {onToggleHistory && (
            <button
              onClick={onToggleHistory}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-all",
                historyOpen
                  ? "bg-pawa-cyan/20 text-pawa-cyan"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
              )}
              title="Toggle conversation history"
            >
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">History</span>
            </button>
          )}

          {/* auth — avatar with dropdown */}
          {user?.authenticated ? (
            <div className="relative" ref={avatarRef}>
              <button
                onClick={() => setAvatarOpen(!avatarOpen)}
                className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-[var(--muted)]"
              >
                {user.picture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.picture}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-full object-cover "
                  />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pawa-cyan/15 ">
                    <User className="h-4 w-4 text-pawa-cyan" />
                  </div>
                )}
                <span className="hidden text-xs text-[var(--muted-foreground)] sm:inline">
                  {user.name?.split(" ")[0]}
                </span>
              </button>

              {avatarOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-56 animate-fade-in-up rounded-xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-xl shadow-black/20 backdrop-blur-md">
                  <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
                    {user.picture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={user.picture}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-full object-cover "
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pawa-cyan/15 ">
                        <User className="h-5 w-5 text-pawa-cyan" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {user.name}
                      </p>
                      <p className="truncate text-[10px] text-[var(--muted-foreground)]">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <div className="my-1 h-px bg-[var(--border)]" />
                  <button
                    onClick={() => {
                      setAvatarOpen(false);
                      handleLogout();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--muted-foreground)] transition-colors hover:bg-pawa-error/10 hover:text-pawa-error"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden items-center gap-1.5 sm:flex">
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-sm text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                  "bg-pawa-cyan/15 text-pawa-cyan hover:bg-pawa-cyan/25",
                )}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Sign up
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* mobile slide-out drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />

          {/* drawer */}
          <nav className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-[var(--border)] bg-[var(--background)]">
            {/* drawer header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-pawa-cyan to-pawa-accent">
                  <Cloud className="h-4 w-4 text-pawa-dark" />
                </div>
                <span className="text-sm font-semibold">PawaCloud</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                aria-label="Close menu"
              >
                <ChevronsLeft className="h-5 w-5" />
              </button>
            </div>

            {/* user info */}
            {user?.authenticated && (
              <div className="border-b border-[var(--border)] px-4 py-3">
                <div className="flex items-center gap-2">
                  {user.picture ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.picture}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-full object-cover "
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pawa-cyan/15 ">
                      <User className="h-5 w-5 text-pawa-cyan" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{user.name}</p>
                    <p className="truncate text-[10px] text-[var(--muted-foreground)]">
                      {user.email}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* nav links */}
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <div className="space-y-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center rounded-lg px-3 py-2.5 text-sm transition-colors",
                      pathname === link.href
                        ? "bg-pawa-cyan/15 text-pawa-cyan font-medium"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
                <a
                  href={`${API_BASE}/docs`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                >
                  API Docs
                  <ExternalLink className="h-3 w-3" />
                </a>
                <a
                  href={`${API_BASE}/redoc`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                >
                  ReDoc
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="my-4 h-px bg-[var(--border)]" />

              {onToggleHistory && (
                <button
                  onClick={() => {
                    onToggleHistory();
                    setMobileOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                >
                  <History className="h-4 w-4" />
                  Conversation History
                </button>
              )}
            </div>

            {/* drawer footer */}
            <div className="border-t border-[var(--border)] px-4 py-3">
              {user?.authenticated ? (
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              ) : (
                <div className="space-y-2">
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                  >
                    <User className="h-4 w-4" />
                    Log in
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setMobileOpen(false)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-pawa-cyan hover:bg-pawa-cyan/10"
                  >
                    <UserPlus className="h-4 w-4" />
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
