import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getProductService,
} from "@/lib/services/products/by-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public Metadata API.
 *
 * Used by:
 * - Pi Browser
 * - PiNet crawler
 * - OpenGraph consumers
 *
 * No authentication required.
 */

export async function GET(
  req: NextRequest
) {
  try {
    const pathname =
      req.nextUrl.searchParams.get(
        "pathname"
      );

    if (
      pathname?.startsWith(
        "/product/"
      )
    ) {
      const id =
        pathname.split("/")[2];

      if (
        !id ||
        typeof id !== "string"
      ) {
        return NextResponse.json(
          {
            error:
              "INVALID_PRODUCT_ID",
          },
          {
            status: 400,
          }
        );
      }

      const product =
        await getProductService(
          id
        );

      if (
        !product ||
        "error" in product
      ) {
        return NextResponse.json(
          {
            title:
              "TiTi Shop",

            description:
              "Product not found",
          }
        );
      }

      return NextResponse.json({
        title:
          product.name,

        description:
          product.short_description?.trim()
            ? product.short_description
            : product.description ??
              "TiTi Shop",

        keywords: [
          "Pi Network",
          "TiTi Shop",
          product.name,
        ],

        openGraph: {
          type: "website",

          title:
            product.name,

          description:
            product.short_description?.trim()
              ? product.short_description
              : product.description,

          images: [
            {
              url:
                product.thumbnail,
            },
          ],
        },

        twitter: {
          card:
            "summary_large_image",

          title:
            product.name,

          description:
            product.short_description?.trim()
              ? product.short_description
              : product.description,

          images: [
            product.thumbnail,
          ],
        },
      });
    }

    return NextResponse.json({
      title: "TiTi Shop",

      description:
        "Pi Network Marketplace",

      openGraph: {
        type: "website",

        title:
          "TiTi Shop",

        description:
          "Pi Network Marketplace",

        images: [
          {
            url:
              "https://app.titi.onl/logo.png",
          },
        ],
      },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "PINET_METADATA_ERROR",
      },
      {
        status: 500,
      }
    );
  }
}
