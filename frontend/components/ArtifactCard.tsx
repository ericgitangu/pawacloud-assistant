// SPDX-License-Identifier: MIT
"use client";

import { Paperclip, FileText, AlertTriangle } from "lucide-react";

import type { ArtifactSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  artifact: ArtifactSummary;
  action: "summarize" | "translate";
  targetLang: string;
}

export function ArtifactCard({ artifact, action, targetLang }: Props) {
  return (
    <div className="animate-fade-in-up flex flex-row-reverse gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--muted)]">
        <Paperclip className="h-4 w-4 text-[var(--muted-foreground)]" />
      </div>
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-pawa-cyan/15 px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4 text-pawa-cyan" />
          <span className="font-medium">{artifact.filename}</span>
        </div>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          {artifact.page_count} pp · {artifact.char_count.toLocaleString()} chars
          {artifact.source_lang && ` · ${artifact.source_lang}`}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
          <span className="rounded-md bg-[var(--muted)] px-2 py-0.5">
            {action === "summarize" ? "Summarize" : "Translate"}
          </span>
          <span className="rounded-md bg-pawa-cyan/15 px-2 py-0.5 text-pawa-cyan">
            → {targetLang}
          </span>
        </div>
        {artifact.warnings.length > 0 && (
          <div className="mt-2 space-y-1">
            {artifact.warnings.map((w) => (
              <p
                key={w.code}
                className={cn(
                  "flex items-start gap-1 text-xs",
                  w.code === "scanned_no_ocr"
                    ? "text-pawa-error"
                    : "text-[var(--muted-foreground)]",
                )}
              >
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                {w.message}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
