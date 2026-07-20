
import "./globals.css";
import Script from "next/script";
import PiRootClient from "./PiRootClient";
import { AuthProvider } from "@/context/AuthContext";
import AlertProvider from "@/app/components/AlertProvider";
import { SWRConfig } from "swr";
import ThemeProvider from "@/components/ThemeProvider";
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL(
    "https://muasam.titi.onl"
  ),

  title: {
    default: "TiTi Shop",
    template: "%s | TiTi Shop",
  },

  description:
    "Sàn thương mại điện tử Pi Network",

  applicationName:
    "TiTi Shop",

  keywords: [
    "Pi Network",
    "TiTi Shop",
    "Marketplace",
    "Pi Commerce",
  ],

  openGraph: {
    title: "TiTi Shop",
    description:
      "Sàn thương mại điện tử Pi Network",

    siteName:
      "TiTi Shop",

    type: "website",

    images: [
      {
        url: "/logo.png",
      },
    ],
  },

  twitter: {
    card:
      "summary_large_image",

    title:
      "TiTi Shop",

    description:
      "Sàn thương mại điện tử Pi Network",

    images: [
      "/logo.png",
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="theme-light">
      <head>
        <link rel="preload" as="image" href="/avatar.png" />
        <link rel="preload" as="image" href="/banners/default-shop.png" />

        <Script
          src="https://sdk.minepi.com/pi-sdk.js"
          strategy="afterInteractive"
        />

        {/* 🔥 FIX: tránh FOUC (nháy theme khi load) */}
        <Script id="theme-init" strategy="beforeInteractive">
          {`
            (function () {
              try {
                const theme = localStorage.getItem("theme") || "theme-light";
                document.documentElement.className = theme;
              } catch (e) {}
            })();
          `}
        </Script>
      </head>

      <body>
        <SWRConfig
          value={{
            revalidateOnFocus: false,
            dedupingInterval: 5000,
            shouldRetryOnError: false,
          }}
        >
          <AlertProvider />
          <AuthProvider>
            <ThemeProvider>
              <PiRootClient>{children}</PiRootClient>
            </ThemeProvider>
          </AuthProvider>
        </SWRConfig>
      </body>
    </html>
  );
}
