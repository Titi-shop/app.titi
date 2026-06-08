
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

  /* ================= DEBUG STATE ================= */

  useEffect(() => {
    console.log("🧠 [AUTH] STATE CHANGE:", {
      user,
      loading,
      piReady,
    });
  }, [user, loading, piReady]);

  /* ================= HYDRATE FROM LOCALSTORAGE ================= */

  useEffect(() => {
    console.log("📦 [AUTH] Hydrating from localStorage...");

    try {
      const saved = localStorage.getItem(USER_KEY);

      if (saved) {
        const parsed: PiUser = JSON.parse(saved);
        console.log("✅ [AUTH] Found saved user:", parsed);

        setUser(parsed);
      } else {
        console.log("ℹ️ [AUTH] No saved user");
      }
    } catch (err) {
      console.error("❌ [AUTH] Failed to parse localStorage user:", err);
    } finally {
      setLoading(false);
      console.log("🏁 [AUTH] Hydration done, loading = false");
    }
  }, []);

  /* ================= INIT AUTH (PI LOGIN CHECK) ================= */

  useEffect(() => {
  if (!piReady) {
    console.log("⏳ Waiting Pi SDK ready...");
    return;
  }

  console.log("🚀 Pi SDK ready → initAuth start");

  const initAuth = async () => {
    try {
      console.log("🔐 Getting Pi access token...");

      const token = await getPiAccessToken();

      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      console.log("📡 Calling /api/pi/verify...");

      const res = await fetch("/api/pi/verify", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data: { user?: PiUser } = await res.json();

      if (res.ok && data?.user) {
        console.log("🟢 AUTO LOGIN SUCCESS:", data.user);

        setUser(data.user);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      } else {
        console.log("🔴 NO USER");
        setUser(null);
      }
    } catch (err) {
      console.error("❌ initAuth error:", err);
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
      console.log("👆 [AUTH] manual login triggered");

      setLoading(true);

      const token = await getPiAccessToken();

      console.log("🎟️ [AUTH] login token:", !!token);

      if (!token) return;

      const res = await fetch("/api/pi/verify", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("📨 [AUTH] login verify status:", res.status);

      const data: { user?: PiUser } = await res.json();

      console.log("📦 [AUTH] login response:", data);

      if (!res.ok || !data?.user) {
        throw new Error("VERIFY_FAILED");
      }

      console.log("🟢 [AUTH] LOGIN SUCCESS (manual)");

      setUser(data.user);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));

      sessionStorage.removeItem("cart_merged");
    } catch (err) {
      console.error("❌ [AUTH] LOGIN ERROR:", err);
    } finally {
      setLoading(false);
      console.log("🏁 [AUTH] login finished");
    }
  };

  /* ================= LOGOUT ================= */

  const logout = () => {
    console.log("🔴 [AUTH] logout triggered");

    localStorage.removeItem(USER_KEY);
    localStorage.removeItem("cart");
    sessionStorage.removeItem("cart_merged");

    clearPiToken();

    setUser(null);

    console.log("✅ [AUTH] logout done");
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
