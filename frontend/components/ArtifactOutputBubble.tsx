// SPDX-License-Identifier: MIT
"use client";

import { Bot, Copy, Check } from "lucide-react";
import { useCallback, useState } from "react";
import ReactMarkdown from "react-markdown";

import { DownloadMenu } from "@/components/DownloadMenu";
import { haptics } from "@/lib/haptics";
import { toast } from "@/lib/toast";

interface Props {
  content: string;
  isStreaming?: boolean;
  filename: string;
  action: "summarize" | "translate";
  targetLang: string;
  timestamp: Date;
}

export function ArtifactOutputBubble({
  content,
  isStreaming,
  filename,
  action,
  targetLang,
  timestamp,
}: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    haptics.tap();
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success("Copied.");
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  const baseName = `${filename.replace(/\.(pdf|docx|jpg|jpeg|png)$/i, "")}-${action}-${targetLang}`;

  return (
    <div className="animate-fade-in-up flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-pawa-cyan to-pawa-accent text-pawa-dark">
        <Bot className="h-4 w-4" />
      </div>
      <div
        aria-live="polite"
        className="group relative max-w-[85%] rounded-2xl rounded-tl-sm bg-[var(--card)]/80 px-4 py-3"
      >
        {content ? (
          <div className="prose-chat text-sm">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <div
            className="flex items-center gap-1.5 py-1"
            role="status"
            aria-label="Generating"
          >
            <div className="typing-dot h-2 w-2 rounded-full bg-pawa-cyan" />
            <div className="typing-dot h-2 w-2 rounded-full bg-pawa-cyan" />
            <div className="typing-dot h-2 w-2 rounded-full bg-pawa-cyan" />
          </div>
        )}

        {isStreaming && content && (
          <span className="inline-block h-4 w-0.5 animate-pulse bg-pawa-cyan" />
        )}

        {!isStreaming && content && (
          <div className="mt-2 flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 rounded-md bg-[var(--muted)] px-2 py-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-pawa-accent" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" /> Copy
                </>
              )}
            </button>
            <DownloadMenu markdown={content} filename={baseName} />
          </div>
        )}

        <p className="mt-1 text-[10px] text-[var(--muted-foreground)]/40">
          {timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
