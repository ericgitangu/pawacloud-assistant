"use client";

import { User, Bot, Copy, Check } from "lucide-react";
import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import type { ArtifactSummary } from "@/lib/api";
import { ArtifactCard } from "@/components/ArtifactCard";
import { ArtifactOutputBubble } from "@/components/ArtifactOutputBubble";

export type Message =
  | {
      kind: "chat";
      id: string;
      role: "user" | "assistant";
      content: string;
      timestamp: Date;
      isStreaming?: boolean;
    }
  | {
      kind: "document";
      id: string;
      role: "user";
      artifact: ArtifactSummary;
      action: "summarize" | "translate";
      targetLang: string;
      timestamp: Date;
    }
  | {
      kind: "document";
      id: string;
      role: "assistant";
      content: string;
      isStreaming?: boolean;
      filename: string;
      action: "summarize" | "translate";
      targetLang: string;
      timestamp: Date;
    };

interface MessageBubbleProps {
  message: Message;
  userPicture?: string;
}

export function MessageBubble({ message, userPicture }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  // content only exists on chat+assistant; safe to read here — hook must be unconditional
  const chatContent = message.kind === "chat" ? message.content : "";
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(chatContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [chatContent]);

  if (message.kind === "document" && message.role === "user") {
    return (
      <ArtifactCard
        artifact={message.artifact}
        action={message.action}
        targetLang={message.targetLang}
      />
    );
  }

  if (message.kind === "document" && message.role === "assistant") {
    return (
      <ArtifactOutputBubble
        content={message.content}
        isStreaming={message.isStreaming}
        filename={message.filename}
        action={message.action}
        targetLang={message.targetLang}
        timestamp={message.timestamp}
      />
    );
  }

  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "animate-fade-in-up flex gap-3",
        isUser && "flex-row-reverse",
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          isUser
            ? "bg-[var(--muted)] text-[var(--foreground)]"
            : "bg-gradient-to-br from-pawa-cyan to-pawa-accent text-pawa-dark",
        )}
      >
        {isUser ? (
          userPicture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={userPicture}
              alt=""
              className="h-8 w-8 rounded-lg object-cover"
            />
          ) : (
            <User className="h-4 w-4" />
          )
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>

      <div
        className={cn(
          "group relative max-w-[85%] rounded-2xl px-4 py-3",
          isUser
            ? "rounded-tr-sm bg-pawa-cyan/15"
            : "rounded-tl-sm bg-[var(--card)]/80",
        )}
        {...(!isUser && { "aria-live": "polite" as const })}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        ) : (
          <>
            {message.content ? (
              <div className="prose-chat text-sm">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            ) : (
              <div
                className="flex items-center gap-1.5 py-1"
                aria-label="Assistant is typing"
                role="status"
              >
                <div className="typing-dot h-2 w-2 rounded-full bg-pawa-cyan" />
                <div className="typing-dot h-2 w-2 rounded-full bg-pawa-cyan" />
                <div className="typing-dot h-2 w-2 rounded-full bg-pawa-cyan" />
              </div>
            )}

            {message.isStreaming && message.content && (
              <span className="inline-block h-4 w-0.5 animate-pulse bg-pawa-cyan" />
            )}
          </>
        )}

        {!isUser && message.content && !message.isStreaming && (
          <button
            onClick={handleCopy}
            className="absolute -bottom-1 right-2 flex items-center gap-1 rounded-md bg-[var(--muted)] px-2 py-1 text-xs text-[var(--muted-foreground)] opacity-0 transition-opacity active:scale-95 hover:text-[var(--foreground)] group-hover:opacity-100"
            title="Copy response"
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
        )}

        <p
          className={cn(
            "mt-1 text-[10px] text-[var(--muted-foreground)]/40",
            isUser ? "text-right" : "text-left",
          )}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
