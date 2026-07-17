"use client";

import { format } from "date-fns";

export interface ProductReview {
  id: string;
  username: string;
  rating: number;
  comment: string | null;
  images: string[];
  seller_reply: string | null;
  created_at: string;
  is_verified_purchase: boolean;
}

type ProductReviewsProps = {
  t: Record<string, string>;
  ratingAvg: number;
  ratingCount: number;
  reviews: ProductReview[];
  onViewAll?: () => void;
};

function renderStars(rating: number) {
  return (
    <div className="flex items-center gap-0.5 text-yellow-500 text-sm">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i}>
          {i < rating ? "★" : "☆"}
        </span>
      ))}
    </div>
  );
}

export default function ProductReviews({
  t,
  ratingAvg,
  ratingCount,
  reviews,
  onViewAll,
}: ProductReviewsProps) {
  return (
    <section
      className="mt-2 rounded-xl"
      style={{
        background: "var(--card-bg)",
      }}
    >
      {/* Header */}
      <div className="p-4 border-b border-[var(--nav-border)] flex justify-between items-center">
        <div>
          <h2 className="font-semibold text-base">
            ⭐ {t.customer_reviews}
          </h2>

          <div className="mt-1 flex items-center gap-2">
            <span
              className="text-xl font-bold"
              style={{
                color: "var(--color-primary)",
              }}
            >
              {ratingAvg.toFixed(1)}
            </span>

            {renderStars(Math.round(ratingAvg))}

            <span
              className="text-sm"
              style={{
                color: "var(--text-muted)",
              }}
            >
              ({ratingCount})
            </span>
          </div>
        </div>

        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-sm"
            style={{
              color: "var(--color-primary)",
            }}
          >
            {t.view_all_reviews}
          </button>
        )}
      </div>

      {/* Empty */}
      {reviews.length === 0 && (
        <div
          className="p-8 text-center"
          style={{
            color: "var(--text-muted)",
          }}
        >
          {t.no_reviews}
        </div>
      )}

      {/* List */}
      {reviews.slice(0, 5).map((review) => (
        <div
          key={review.id}
          className="p-4 border-b last:border-b-0"
          style={{
            borderColor: "var(--nav-border)",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="font-medium">
              @{review.username}
            </div>

            <div
              className="text-xs"
              style={{
                color: "var(--text-muted)",
              }}
            >
              {format(
                new Date(review.created_at),
                "dd/MM/yyyy"
              )}
            </div>
          </div>

          <div className="mt-2">
            {renderStars(review.rating)}
          </div>

          {review.is_verified_purchase && (
            <div
              className="mt-1 text-xs"
              style={{
                color: "var(--success)",
              }}
            >
              ✔ {t.verified_purchase}
            </div>
          )}

          {review.comment && (
            <p className="mt-3 whitespace-pre-wrap text-sm">
              {review.comment}
            </p>
          )}

          {review.images.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {review.images.map((img) => (
                <img
                  key={img}
                  src={img}
                  alt=""
                  className="w-16 h-16 rounded object-cover"
                />
              ))}
            </div>
          )}

          {review.seller_reply && (
            <div
              className="mt-4 rounded-lg p-3"
              style={{
                background: "var(--surface-2)",
              }}
            >
              <div
                className="text-xs font-medium"
                style={{
                  color: "var(--color-primary)",
                }}
              >
                {t.shop_reply}
              </div>

              <div className="mt-1 text-sm">
                {review.seller_reply}
              </div>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
