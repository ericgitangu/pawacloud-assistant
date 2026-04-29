"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Paperclip } from "lucide-react";

interface ChatInputProps {
  onSend: (query: string) => void;
  onAttach?: () => void;
  isLoading: boolean;
}

export function ChatInput({ onSend, onAttach, isLoading }: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }
  }, [input]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [input, isLoading, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === "Escape") {
        textareaRef.current?.blur();
      }
    },
    [handleSubmit],
  );

  const CHAR_LIMIT = 2000;
  const showCharCount = input.length > CHAR_LIMIT * 0.8;

  return (
    <div
      className="relative flex items-end gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)]/60 p-2 shadow-lg transition-colors focus-within:border-pawa-cyan/40 focus-within:shadow-pawa-cyan/5"
      aria-busy={isLoading}
    >
      {onAttach && (
        <button
          type="button"
          onClick={onAttach}
          title="Attach document"
          aria-label="Attach document"
          className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)]/40 hover:text-[var(--foreground)]"
        >
          <Paperclip className="h-4 w-4" />
        </button>
      )}
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask me anything..."
        rows={1}
        maxLength={CHAR_LIMIT}
        disabled={isLoading}
        className="flex-1 resize-none bg-transparent px-3 py-2 text-sm placeholder-[var(--muted-foreground)]/50 outline-none disabled:opacity-50"
      />
      <button
        onClick={handleSubmit}
        disabled={!input.trim() || isLoading}
        className="btn-press glow-on-hover flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-pawa-cyan to-pawa-accent text-pawa-dark transition-all hover:shadow-lg hover:shadow-pawa-cyan/25 disabled:opacity-30 disabled:hover:shadow-none"
        title="Send message"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
      </button>
      {showCharCount && (
        <span className="absolute -top-5 right-1 text-[10px] text-[var(--muted-foreground)]/60">
          {input.length}/{CHAR_LIMIT}
        </span>
      )}
    </div>
  );
}
