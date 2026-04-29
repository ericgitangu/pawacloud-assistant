// SPDX-License-Identifier: MIT
"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface LanguagePickerProps {
  value: string;
  onChange: (next: string) => void;
  detectedSource?: string | null;
}

const CURATED: { tag: string; label: string; flag: string }[] = [
  { tag: "en", label: "English", flag: "🇬🇧" },
  { tag: "sw", label: "Swahili", flag: "🇰🇪" },
  { tag: "fr", label: "French", flag: "🇫🇷" },
  { tag: "pt", label: "Portuguese", flag: "🇵🇹" },
  { tag: "ar", label: "Arabic", flag: "🇸🇦" },
  { tag: "am", label: "Amharic", flag: "🇪🇹" },
  { tag: "yo", label: "Yoruba", flag: "🇳🇬" },
  { tag: "ha", label: "Hausa", flag: "🇳🇪" },
  { tag: "zu", label: "Zulu", flag: "🇿🇦" },
  { tag: "es", label: "Spanish", flag: "🇪🇸" },
  { tag: "de", label: "German", flag: "🇩🇪" },
  { tag: "zh", label: "Mandarin", flag: "🇨🇳" },
];

export function LanguagePicker({
  value,
  onChange,
  detectedSource,
}: LanguagePickerProps) {
  const isCurated = CURATED.some((c) => c.tag === value);
  const [showOther, setShowOther] = useState(!isCurated && value !== "");

  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
        Target language
        {detectedSource && (
          <span className="ml-2 normal-case text-[var(--muted-foreground)]/60">
            — detected source: {detectedSource}
          </span>
        )}
      </Label>
      <div className="flex flex-wrap gap-1.5">
        {CURATED.map((opt) => (
          <button
            key={opt.tag}
            type="button"
            onClick={() => {
              setShowOther(false);
              onChange(opt.tag);
            }}
            aria-label={opt.label}
            title={opt.label}
            className={cn(
              "flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors",
              value === opt.tag
                ? "border-pawa-cyan/50 bg-pawa-cyan/15 text-pawa-cyan"
                : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-pawa-cyan/30 hover:bg-pawa-cyan/5",
            )}
          >
            <span className="text-sm leading-none" aria-hidden="true">
              {opt.flag}
            </span>
            <span>{opt.label}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowOther(true)}
          className={cn(
            "rounded-md border px-2.5 py-1 text-xs transition-colors",
            showOther
              ? "border-pawa-cyan/50 bg-pawa-cyan/15 text-pawa-cyan"
              : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-pawa-cyan/30 hover:bg-pawa-cyan/5",
          )}
        >
          Other…
        </button>
      </div>
      {showOther && (
        <Input
          autoFocus
          value={isCurated ? "" : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. Tagalog, Kinyarwanda"
          maxLength={64}
        />
      )}
    </div>
  );
}
