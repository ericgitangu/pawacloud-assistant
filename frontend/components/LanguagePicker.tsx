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

const CURATED: { tag: string; label: string }[] = [
  { tag: "en", label: "English" },
  { tag: "sw", label: "Swahili" },
  { tag: "fr", label: "French" },
  { tag: "pt", label: "Portuguese" },
  { tag: "ar", label: "Arabic" },
  { tag: "am", label: "Amharic" },
  { tag: "yo", label: "Yoruba" },
  { tag: "ha", label: "Hausa" },
  { tag: "zu", label: "Zulu" },
  { tag: "es", label: "Spanish" },
  { tag: "de", label: "German" },
  { tag: "zh", label: "Mandarin" },
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
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs transition-colors",
              value === opt.tag
                ? "border-pawa-cyan/50 bg-pawa-cyan/15 text-pawa-cyan"
                : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-pawa-cyan/30 hover:bg-pawa-cyan/5",
            )}
          >
            {opt.label}
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
