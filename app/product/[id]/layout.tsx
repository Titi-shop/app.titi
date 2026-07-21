import type { Metadata } from "next";

export async function generateMetadata(
  props: {
    params: Promise<{
      id: string;
    }>;
  }
): Promise<Metadata> {
   // lấy id
   // gọi getProductService(id)
   // trả về metadata của sản phẩm
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
