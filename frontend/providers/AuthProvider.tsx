"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { getCurrentUser, getStoredToken } from "@/lib/api";
import type { UserInfo } from "@/lib/api";

const STORAGE_KEY = "pawacloud_user";

function loadCachedUser(): UserInfo | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function cacheUser(u: UserInfo | null) {
  try {
    if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private browsing */
  }
}

interface AuthContextType {
  user: UserInfo | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setUser: (u: UserInfo | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refresh: async () => {},
  setUser: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  const setUser = useCallback((u: UserInfo | null) => {
    setUserState(u);
    cacheUser(u);
  }, []);

  const refresh = useCallback(async () => {
    const cached = loadCachedUser();
    const hasToken = !!getStoredToken();

    try {
      const data = await getCurrentUser();
      if (data?.authenticated) {
        if ((!data.name || !data.email) && cached?.authenticated) {
          setUserState({ ...cached, authenticated: true });
        } else {
          setUser(data);
        }
        setLoading(false);
        return;
      }
    } catch {
      // backend unreachable
    }

    if (hasToken && cached?.authenticated) {
      setUserState(cached);
    } else {
      setUser(null);
    }
    setLoading(false);
  }, [setUser]);

  // hydrate auth state on mount — ref guard prevents double-fire in strict mode
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, not synchronous cascade
    refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
