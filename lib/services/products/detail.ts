import {
  getProductById,
  getProductsByCategory,
  getSoldByProduct,
} from "@/lib/db/products";

import {
  getReviewsByProduct,
} from "@/lib/db/reviews";

export async function getProductDetailService(
  productId: string,
  userId: string | null
) {
  const product =
    await getProductById(
      productId,
      userId
    );

  if (!product) {
    return {
      product: null,
      reviews: [],
      related: [],
      sold: 0,
    };
  }

  const [
    reviews,
    related,
    sold,
  ] = await Promise.all([
    getReviewsByProduct(
      product.id
    ),

    getProductsByCategory(
      product.category_id,
      10
    ),

    getSoldByProduct(
      product.id
    ),
  ]);

  return {
    product,

    reviews,

    sold,

    related:
      related.filter(
        (p) =>
          p.id !== product.id
      ),
  };
}
