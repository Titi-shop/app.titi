"use client";

import { createContext, useContext, useEffect, useState } from "react";

type PiContextType = {
  ready: boolean;
};

const PiContext = createContext<PiContextType>({
  ready: false,
});

export function PiProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
  console.log("🟡 PiContext: waiting SDK...");

  const timer = setInterval(() => {
    if (typeof window !== "undefined" && window.Pi) {
      console.log("🟢 Pi SDK detected");

      setReady(true);
      clearInterval(timer);
    }
  }, 300);

  return () => clearInterval(timer);
}, []);

  return (
    <PiContext.Provider value={{ ready }}>
      {children}
    </PiContext.Provider>
  );
}

export const usePi = () => useContext(PiContext);
