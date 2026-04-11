"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslationClient as useTranslation } from "@/app/lib/i18n/client";
import { useCart } from "@/app/context/CartContext";

import { useProduct } from "./product.logic";
import { ProductView } from "./product.components";

export default function ProductDetail() {
  const { t } = useTranslation();
  const { addToCart } = useCart();
  const router = useRouter();

  const params = useParams();
  const id = String(params?.id ?? "");

  const { product, isLoading } = useProduct(id);

  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    if (!product) return;

    const first =
      product.variants.find((v: any) => v.stock > 0) ?? null;

    setSelectedVariant(first);
  }, [product]);

  if (isLoading) return <div>Loading...</div>;
  if (!product) return <div>{t.no_products}</div>;

  const hasVariants = product.variants.length > 0;

  const availableVariants = product.variants;

  const selectedStock = selectedVariant?.stock ?? 0;

  const canBuy = selectedStock > 0;

  const relatedProducts = [];

  const add = () => {
    addToCart({
      id: product.id,
      product_id: product.id,
      name: product.name,
      price: product.price,
      sale_price: product.finalPrice,
      thumbnail: product.thumbnail,
      quantity: 1,
    });
    router.push("/cart");
  };

  const buy = () => {
    add();
  };

  return (
    <ProductView
      product={product}
      t={t}
      router={router}
      add={add}
      buy={buy}
      zoomImage={zoomImage}
      setZoomImage={setZoomImage}
      scale={scale}
      setScale={setScale}
      position={position}
      setPosition={setPosition}
      selectedVariant={selectedVariant}
      setSelectedVariant={setSelectedVariant}
      availableVariants={availableVariants}
      hasVariants={hasVariants}
      canBuy={canBuy}
      selectedStock={selectedStock}
      relatedProducts={relatedProducts}
    />
  );
}
