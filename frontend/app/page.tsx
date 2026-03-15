"use client";

import { Suspense, useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { ChatInput } from "@/components/ChatInput";
import { MessageBubble } from "@/components/MessageBubble";
import { Header } from "@/components/Header";
import { HistoryPanel } from "@/components/HistoryPanel";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { Footer } from "@/components/Footer";
import { Snackbar } from "@/components/Snackbar";
import {
  streamQuery,
  getHistory,
  clearHistory,
  deleteHistoryItem,
  exchangeOAuthToken,
} from "@/lib/api";
import type { HistoryItem } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const { user, loading: authLoading, refresh, setUser } = useAuth();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    message: string;
    variant: "success" | "error" | "info";
  } | null>(null);
  const [lastQuery, setLastQuery] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadHistory = useCallback(async (restoreChat = false) => {
    try {
      const data = await getHistory(50);
      setHistory(data.items);

      // on initial mount, hydrate chat view from persisted conversations
      if (restoreChat && data.items.length > 0) {
        const chronological = [...data.items].reverse();
        const restored: Message[] = [];
        for (const item of chronological) {
          restored.push({
            id: `${item.id}-q`,
            role: "user",
            content: item.query,
            timestamp: new Date(item.created_at),
          });
          restored.push({
            id: `${item.id}-a`,
            role: "assistant",
            content: item.response,
            timestamp: new Date(item.created_at),
          });
        }
        setMessages(restored);
      }
    } catch {
      // history is optional — fail silently
    }
  }, []);

  useEffect(() => {
    const token = searchParams.get("token");
    if (searchParams.get("auth") === "token" && token) {
      (async () => {
        const userData = await exchangeOAuthToken(token);
        if (userData) {
          document.cookie =
            "pawacloud_auth=1; path=/; max-age=86400; SameSite=Lax";
          setUser(userData);
        }
        window.history.replaceState({}, "", "/");
      })();
    } else if (searchParams.get("auth") === "success") {
      document.cookie = "pawacloud_auth=1; path=/; max-age=86400; SameSite=Lax";
      void refresh();
      window.history.replaceState({}, "", "/");
    }
  }, [searchParams, refresh, setUser]);

  // re-fetch history when auth state changes (login/logout) or on mount
  // ref tracks prior user identity to detect actual auth transitions
  const prevUserRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (authLoading) return;
    const uid = user?.email ?? null;
    const isFirstLoad = prevUserRef.current === undefined;
    const authChanged =
      prevUserRef.current !== undefined && prevUserRef.current !== uid;
    prevUserRef.current = uid;
    if (isFirstLoad || authChanged) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, not synchronous cascade
      loadHistory(true);
    }
  }, [authLoading, loadHistory, user]);

  const handleDeleteHistoryItem = useCallback(async (itemId: string) => {
    try {
      await deleteHistoryItem(itemId);
      setHistory((prev) => prev.filter((h) => h.id !== itemId));
      setSnackbar({ message: "Conversation deleted", variant: "success" });
    } catch {
      setSnackbar({ message: "Failed to delete item", variant: "error" });
    }
  }, []);

  const handleClearHistory = useCallback(async () => {
    try {
      await clearHistory();
      setHistory([]);
      setSnackbar({ message: "History cleared", variant: "success" });
    } catch {
      setSnackbar({ message: "Failed to clear history", variant: "error" });
    }
  }, []);

  // dismiss error banner on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && error) setError(null);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [error]);

  const handleSend = useCallback(
    async (query: string) => {
      if (isLoading) return;
      setError(null);
      setLastQuery(query);

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: query,
        timestamp: new Date(),
      };

      const assistantId = crypto.randomUUID();
      const assistantMsg: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsLoading(true);

      await streamQuery(
        query,
        (chunk) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? { ...msg, content: msg.content + chunk }
                : msg,
            ),
          );
        },
        () => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId ? { ...msg, isStreaming: false } : msg,
            ),
          );
          setIsLoading(false);
          loadHistory();
        },
        (errorMsg) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? {
                    ...msg,
                    content: `${errorMsg}\n\nCheck that the backend is running and the API key is configured.`,
                    isStreaming: false,
                  }
                : msg,
            ),
          );
          setIsLoading(false);
          setError(errorMsg);
        },
      );
    },
    [isLoading, loadHistory],
  );

  const handleLoadFromHistory = useCallback((item: HistoryItem) => {
    const restored: Message[] = [
      {
        id: `${item.id}-q`,
        role: "user",
        content: item.query,
        timestamp: new Date(item.created_at),
      },
      {
        id: `${item.id}-a`,
        role: "assistant",
        content: item.response,
        timestamp: new Date(item.created_at),
      },
    ];
    setMessages((prev) => [...prev, ...restored]);
    setShowHistory(false);
  }, []);

  const suggestedQueries = [
    "What documents do I need to travel from Kenya to Ireland?",
    "Nahitaji nyaraka gani kusafiri kutoka Kenya kwenda Ireland?",
    "What caused the Nairobi floods and how many people were affected?",
    "Mafuriko ya Nairobi yalisababishwa na nini na watu wangapi waliathirika?",
    "How do the new NTSA smart cameras work for traffic fines?",
    "Hizi camera za NTSA zinawork aje na fine zinakam through simu?",
  ];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <Header
        onToggleHistory={() => setShowHistory(!showHistory)}
        historyOpen={showHistory}
        messageCount={messages.length}
      />

      <div className="relative flex flex-1 overflow-hidden">
        {showHistory && (
          <HistoryPanel
            items={history}
            onSelect={handleLoadFromHistory}
            onClear={handleClearHistory}
            onClose={() => setShowHistory(false)}
            onDeleteItem={handleDeleteHistoryItem}
          />
        )}

        <main className="flex flex-1 flex-col overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
            <div className="mx-auto max-w-3xl">
              {messages.length === 0 ? (
                <WelcomeScreen
                  suggestions={suggestedQueries}
                  onSelect={handleSend}
                />
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      userPicture={user?.picture}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="mx-auto max-w-3xl px-4">
              <div
                role="alert"
                className="mb-2 rounded-lg border border-pawa-error/30 bg-pawa-error/10 px-4 py-2 text-sm text-pawa-error"
              >
                {error}
                {lastQuery && (
                  <button
                    onClick={() => {
                      setError(null);
                      if (lastQuery) handleSend(lastQuery);
                    }}
                    className="ml-2 underline hover:no-underline"
                  >
                    Retry
                  </button>
                )}
                <button
                  onClick={() => setError(null)}
                  className="ml-2 underline hover:no-underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <div className="border-t border-[var(--border)] bg-[var(--background)]/80 px-4 py-4 backdrop-blur-sm">
            <div className="mx-auto max-w-3xl">
              <ChatInput onSend={handleSend} isLoading={isLoading} />
              <p className="mt-2 text-center text-xs text-[var(--muted-foreground)]/60">
                Responses are generated by AI and may not always be accurate.
              </p>
            </div>
          </div>

          <Footer />
        </main>
      </div>

      {snackbar && (
        <Snackbar
          message={snackbar.message}
          variant={snackbar.variant}
          onDismiss={() => setSnackbar(null)}
        />
      )}
    </div>
  );
}
