"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { clearPiToken } from "@/lib/piAuth";

/* =========================
   TYPES
========================= */
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

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  piReady: false,
  pilogin: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [piReady, setPiReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const timer = setInterval(() => {
      if (window.Pi) {
        setPiReady(true);
        clearInterval(timer);
      }
    }, 300);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
  async function init() {
    try {
      console.log("🟡 AUTH INIT START");

      const token = await getPiAccessToken();

      console.log("🟢 TOKEN:", token);

      if (!token) {
        console.log("🔴 NO TOKEN → LOGOUT STATE");
        setUser(null);
        return;
      }

      const res = await fetch("/api/pi/verify", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      console.log("🟢 VERIFY RESPONSE:", data);

      if (res.ok && data?.user) {
        console.log("🟢 LOGIN SUCCESS");
        setUser(data.user);
      } else {
        console.log("🔴 VERIFY FAIL");
        setUser(null);
      }
    } catch (err) {
      console.error("❌ AUTH INIT ERROR:", err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  void init();
}, []);

  const pilogin = async () => {
  const token = await getPiAccessToken();

  if (!token) return;

  const res = await fetch("/api/pi/verify", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();

  if (!res.ok || !data?.user) return;

  setUser(data.user);

  // ❗ optional cache
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
};
      const verifiedUser: PiUser = data.user;

      localStorage.setItem(USER_KEY, JSON.stringify(verifiedUser));
      setUser(verifiedUser);
    } catch (err) {
      console.error("❌ Pi login error:", err);
      alert("❌ Lỗi đăng nhập Pi");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
  console.log("🔴 LOGOUT");
  localStorage.removeItem("pi_user");
  clearPiToken();
  setUser(null);
};

  return (
    <AuthContext.Provider
      value={{ user, loading, piReady, pilogin, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
