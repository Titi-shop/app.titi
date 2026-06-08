"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

import { getPiAccessToken, clearPiToken } from "@/lib/piAuth";
import { usePi } from "@/app/pi/PiContext";

/* ========================= TYPES ========================= */

export type PiUser = {
  id: string;
  pi_uid: string;
  username: string;
  wallet_address?: string | null;
  role?: string;
};

type AuthContextType = {
  user: PiUser | null;
  loading: boolean;
  piReady: boolean;
  pilogin: () => Promise<void>;
  logout: () => void;
};

const USER_KEY = "pi_user";

/* ========================= CONTEXT ========================= */

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  piReady: false,
  pilogin: async () => {},
  logout: () => {},
});

/* ========================= PROVIDER ========================= */

export function AuthProvider({ children }: { children: ReactNode }) {
  const { ready: piReady } = usePi();

  const [user, setUser] = useState<PiUser | null>(null);
  const [loading, setLoading] = useState(true);

  /* ================= INIT AUTH ================= */

  useEffect(() => {
    if (!piReady) return;

    const initAuth = async () => {
      try {
        const token = await getPiAccessToken();

        if (!token) {
          setUser(null);
          return;
        }

        const res = await fetch("/api/pi/verify", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          setUser(null);
          return;
        }

        const data: { user?: PiUser } = await res.json();

        if (data?.user) {
          setUser(data.user);
          localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("INIT AUTH ERROR:", err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [piReady]);

  /* ================= LOGIN ================= */

  const pilogin = async () => {
    try {
      setLoading(true);

      const token = await getPiAccessToken();

      if (!token) return;

      const res = await fetch("/api/pi/verify", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data: { user?: PiUser } = await res.json();

      if (!res.ok || !data?.user) {
        throw new Error("VERIFY_FAILED");
      }

      setUser(data.user);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      sessionStorage.removeItem("cart_merged");

      console.log("🟢 LOGIN SUCCESS");
    } catch (err) {
      console.error("❌ LOGIN ERROR:", err);
    } finally {
      setLoading(false);
    }
  };

  /* ================= LOGOUT ================= */

  const logout = () => {
    console.log("🔴 LOGOUT");

    localStorage.removeItem(USER_KEY);
    localStorage.removeItem("cart");
    sessionStorage.removeItem("cart_merged");

    clearPiToken();

    setUser(null);
  };

  /* ================= PROVIDER ================= */

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        piReady,
        pilogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/* ================= HOOK ================= */

export const useAuth = () => useContext(AuthContext);
