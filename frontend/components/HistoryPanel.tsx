"use client";

import { useEffect, useRef } from "react";
import { PanelLeftClose, Trash2, MessageSquare, Clock, X } from "lucide-react";
import type { HistoryItem } from "@/lib/api";

interface HistoryPanelProps {
  items: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onClear: () => void;
  onClose: () => void;
  onDeleteItem?: (itemId: string) => void;
}

export function HistoryPanel({
  items,
  onSelect,
  onClear,
  onClose,
  onDeleteItem,
}: HistoryPanelProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeBtnRef.current?.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <aside
      role="dialog"
      aria-label="Conversation history"
      className="flex w-80 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--card)]/40 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4 text-pawa-cyan" />
          History
        </h2>
        <div className="flex items-center gap-1">
          {items.length > 0 && (
            <button
              onClick={onClear}
              className="rounded-md p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-pawa-error/10 hover:text-pawa-error"
              title="Clear history"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            ref={closeBtnRef}
            onClick={onClose}
            className="glow-on-hover rounded-md p-1.5 text-[var(--muted-foreground)] transition-all hover:bg-pawa-cyan/10 hover:text-pawa-cyan"
            title="Collapse panel"
          >
            <PanelLeftClose className="h-4 w-4 transition-transform hover:scale-110" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="mb-3 h-8 w-8 text-[var(--muted)]" />
            <p className="text-sm text-[var(--muted-foreground)]">No history yet</p>
            <p className="text-xs text-[var(--muted-foreground)]/50">
              Start a conversation to see it here
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {items.map((item) => (
              <div key={item.id} className="group/item relative">
                <button
                  onClick={() => onSelect(item)}
                  className="w-full rounded-lg p-3 text-left transition-colors hover:bg-[var(--muted)]/20"
                >
                  <p className="mb-1 truncate text-sm pr-6">
                    {item.query}
                  </p>
                  <p className="truncate text-xs text-[var(--muted-foreground)]/60">
                    {item.response.slice(0, 80)}...
                  </p>
                  <p className="mt-1 text-[10px] text-[var(--muted-foreground)]/40">
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                </button>
                {onDeleteItem && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteItem(item.id); }}
                    className="absolute right-2 top-3 rounded-md p-1 text-[var(--muted-foreground)]/40 opacity-0 transition-all hover:bg-pawa-error/10 hover:text-pawa-error group-hover/item:opacity-100"
                    title="Delete conversation"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
