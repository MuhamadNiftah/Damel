"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { RoleCode } from "@/lib/types";

export interface DemoUser {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role_code: RoleCode;
  branch_code: string;
  avatar_color: string;
}

interface UserContextValue {
  user: DemoUser;
  users: DemoUser[];
  ready: boolean;
  setUser: (user: DemoUser) => void;
  refreshUsers: () => Promise<void>;
  apiFetch: <T>(input: string, init?: RequestInit) => Promise<T>;
  downloadFile: (
    input: string,
    fallbackName: string,
  ) => Promise<void>;
}

const FALLBACK_USER: DemoUser = {
  id: "user-analyst",
  username: "rani.pratama",
  email: "rani.pratama@didimax.co.id",
  full_name: "Rani Pratama",
  role_code: "MAKER_ANALYST",
  branch_code: "JKT-01",
  avatar_color: "#0f766e",
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<DemoUser[]>([FALLBACK_USER]);
  const [user, setUserState] = useState<DemoUser>(FALLBACK_USER);
  const [ready, setReady] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/users", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { users: DemoUser[] };
      if (!payload.users?.length) return;
      setUsers(payload.users);
      setUserState((previous) => {
        const stored =
          typeof window !== "undefined"
            ? window.localStorage.getItem("dmb-demo-user")
            : null;
        if (stored) {
          const storedUser = payload.users.find((item) => item.id === stored);
          if (storedUser && previous.id === FALLBACK_USER.id) return storedUser;
        }
        const current = payload.users.find((item) => item.id === previous.id);
        if (current) return current;
        return (
          payload.users.find((item) => item.id === stored) ?? payload.users[0]
        );
      });
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const setUser = useCallback((next: DemoUser) => {
    setUserState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("dmb-demo-user", next.id);
    }
  }, []);

  const apiFetch = useCallback(
    async <T,>(input: string, init?: RequestInit): Promise<T> => {
      const headers = new Headers(init?.headers);
      headers.set("x-user-id", user.id);
      if (init?.body && !(init.body instanceof FormData)) {
        headers.set("Content-Type", "application/json");
      }
      const response = await fetch(input, {
        ...init,
        headers,
        cache: "no-store",
      });
      const contentType = response.headers.get("content-type") ?? "";
      const payload = contentType.includes("application/json")
        ? await response.json()
        : null;
      if (!response.ok) {
        throw new Error(
          payload?.error ?? `Permintaan gagal (${response.status}).`,
        );
      }
      return payload as T;
    },
    [user.id],
  );

  const downloadFile = useCallback(
    async (input: string, fallbackName: string) => {
      const response = await fetch(input, {
        headers: { "x-user-id": user.id },
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Unduhan gagal.");
      }
      const disposition = response.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename="?([^";]+)"?/);
      const filename = match?.[1] ?? fallbackName;
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    },
    [user.id],
  );

  const value = useMemo(
    () => ({
      user,
      users,
      ready,
      setUser,
      refreshUsers: loadUsers,
      apiFetch,
      downloadFile,
    }),
    [user, users, ready, setUser, loadUsers, apiFetch, downloadFile],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useDemoUser(): UserContextValue {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useDemoUser harus dipakai di dalam UserProvider.");
  }
  return context;
}
