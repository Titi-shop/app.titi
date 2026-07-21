import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "TiTi Shop",
    template: "%s | TiTi Shop",
  },

  description:
    "Sàn thương mại điện tử Pi Network",

  openGraph: {
    title: "TiTi Shop",
    description:
      "Sàn thương mại điện tử Pi Network",

    type: "website",

    images: [
      {
        url: "/logo.png",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",

    title:
      "TiTi Shop",

    description:
      "Sàn thương mại điện tử Pi Network",

    images: [
      "/logo.png",
    ],
  },
};

export default function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
