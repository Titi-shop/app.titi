export interface ProductVariant {
  id?: string;
  optionName?: string;
  optionValue: string;
  stock: number;
  sku?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface ShippingRate {
  zone: string;
  price: number;
}

export interface Product {
  id: string;

  sellerId: string;

  name: string;
  slug: string;

  shortDescription: string;
  description: string;
  detail: string;

  thumbnail: string;
  images: string[];
  detailImages: string[];

  videoUrl: string;

  price: number;
  salePrice: number | null;
  finalPrice: number;

  currency: string;

  stock: number;
  isUnlimited: boolean;

  sold: number;
  views: number;

  ratingAvg: number;
  ratingCount: number;

  isActive: boolean;
  isFeatured: boolean;
  isDigital: boolean;

  status: string;

  categoryId: number | null;

  saleStart: string | null;
  saleEnd: string | null;

  metaTitle: string;
  metaDescription: string;

  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;

  variants: ProductVariant[];
  shippingRates: ShippingRate[];
}
