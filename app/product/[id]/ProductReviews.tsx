"use client";

export interface ProductReview {
  id: string;
  display_name: string;
  avatar_url: string | null;
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
    <div className="flex items-center gap-0.5 text-yellow-500">
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={index}
          className="text-sm"
        >
          {index < rating ? "★" : "☆"}
        </span>
      ))}
    </div>
  );
}

function formatReviewDate(date: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

function getAvatar(name: string): string {
  if (!name) return "?";

  return name
    .trim()
    .charAt(0)
    .toUpperCase();
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
      className="mt-2 rounded-xl overflow-hidden"
      style={{
        background: "var(--card-bg)",
      }}
    >
      {/* HEADER */}

      <div
        className="flex items-center justify-between p-4 border-b"
        style={{
          borderColor: "var(--nav-border)",
        }}
      >
        <div>
          <h2 className="font-semibold text-base">
            ⭐ {t.customer_reviews}
          </h2>

          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-2xl font-bold"
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
            className="text-sm font-medium"
            style={{
              color: "var(--color-primary)",
            }}
          >
            {t.view_all_reviews}
          </button>
        )}
      </div>

      {/* EMPTY */}

      {reviews.length === 0 && (
        <div
          className="py-10 text-center"
          style={{
            color: "var(--text-muted)",
          }}
        >
          ⭐ {t.no_reviews}
        </div>
      )}

      {/* REVIEW LIST */}

      {reviews.slice(0, 5).map((review) => (
        <div
          key={review.id}
          className="p-4 border-b last:border-b-0"
          style={{
            borderColor: "var(--nav-border)",
          }}
        >
          {/* USER */}

          <div className="flex items-start gap-3">
 {review.avatar_url ? (
  <img
    src={review.avatar_url}
    alt={review.display_name}
    className="w-10 h-10 rounded-full object-cover shrink-0"
  />
) : (
  <div
    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold shrink-0"
    style={{
      background: "var(--color-primary)",
    }}
  >
    {getAvatar(review.display_name)}
  </div>
)}

            <div className="flex-1">
              <div className="flex justify-between items-start">
                <div>
                 <div className="font-medium">
               {review.display_name}
              </div>

                  <div className="mt-1">
                    {renderStars(review.rating)}
                  </div>
                </div>

                <div
                  className="text-xs"
                  style={{
                    color: "var(--text-muted)",
                  }}
                >
                  {formatReviewDate(review.created_at)}
                </div>
              </div>

              {review.is_verified_purchase && (
                <div
                  className="mt-2 text-xs inline-flex items-center gap-1"
                  style={{
                    color: "var(--success)",
                  }}
                >
                  ✔ {t.verified_purchase}
                </div>
              )}

              {review.comment && (
                <p className="mt-3 text-sm whitespace-pre-wrap leading-6">
                  {review.comment}
                </p>
              )}

              {review.images.length > 0 && (
                <div className="flex gap-2 mt-3 overflow-x-auto">
                  {review.images.map((image) => (
                    <img
                      key={image}
                      src={image}
                      alt="Review"
                      loading="lazy"
                      className="w-20 h-20 rounded-lg object-cover border"
                      style={{
                        borderColor: "var(--nav-border)",
                      }}
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
                    className="font-medium text-sm"
                    style={{
                      color: "var(--color-primary)",
                    }}
                  >
                    🏪 {t.shop_reply}
                  </div>

                  <div className="mt-2 text-sm leading-6">
                    {review.seller_reply}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {reviews.length > 0 && onViewAll && (
        <div
          className="p-4 border-t"
          style={{
            borderColor: "var(--nav-border)",
          }}
        >
          <button
            onClick={onViewAll}
            className="w-full py-3 rounded-lg font-medium transition"
            style={{
              background: "var(--surface-2)",
              color: "var(--color-primary)",
            }}
          >
            {t.view_all_reviews} ({ratingCount})
          </button>
        </div>
      )}
    </section>
  );
}
