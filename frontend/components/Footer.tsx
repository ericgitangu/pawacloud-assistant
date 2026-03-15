"use client";

import { SystemStatus } from "@/components/SystemStatus";

const links = [
  {
    label: "Portfolio",
    href: "https://developer.ericgitangu.com",
    icon: "https://cdn.simpleicons.org/safari/00b4d8",
  },
  {
    label: "GitHub",
    href: "https://github.com/ericgitangu",
    icon: "https://cdn.simpleicons.org/github/8facc8",
  },
  {
    label: "LinkedIn",
    href: "https://linkedin.com/in/ericgitangu",
    icon: "https://cdn.simpleicons.org/linktree/0A66C2",
  },
  {
    label: "Resume",
    href: "https://resume.ericgitangu.com",
    icon: "https://cdn.simpleicons.org/readthedocs/00b4d8",
  },
  {
    label: "BSD Engine",
    href: "https://bsd-engine-web.fly.dev",
    icon: "https://cdn.simpleicons.org/rust/DEA584",
  },
  {
    label: "UniCorns",
    href: "https://unicorns.run",
    icon: "https://cdn.simpleicons.org/turborepo/00e5a0",
  },
  {
    label: "ElimuAI",
    href: "https://elimu-ai.vercel.app/",
    icon: "https://cdn.simpleicons.org/huggingface/8facc8",
  },
];

export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--card)]/50 px-4 py-4 backdrop-blur-sm dark:bg-pawa-navy/40">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-2 sm:flex-row sm:justify-between">
        <div className="flex flex-col items-center gap-1 sm:flex-row sm:gap-4">
          <span className="eyebrow text-pawa-muted">
            Submitted by{" "}
            <a
              href="https://developer.ericgitangu.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-pawa-cyan transition-colors hover:text-pawa-accent"
            >
              Eric Gitangu
            </a>
          </span>
          <SystemStatus size="xs" showDetails />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-pawa-muted/60 transition-all hover:bg-pawa-cyan/5 hover:text-pawa-cyan"
              title={link.label}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={link.icon}
                alt=""
                className="h-3 w-3 opacity-40 transition-opacity group-hover:opacity-80"
              />
              <span>{link.label}</span>
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
