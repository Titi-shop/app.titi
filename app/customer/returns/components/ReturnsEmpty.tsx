"use client";

import { RefreshCcw } from "lucide-react";

type Props = {
  title: string;
  description: string;
};

export default function ReturnsEmpty({
  title,
  description,
}: Props) {
  return (
    <div
      className="
        mt-10 overflow-hidden rounded-3xl
        border border-dashed border-orange-500/20
        bg-[var(--card-bg)]
        p-10 text-center
      "
    >
      <div
        className="
          mx-auto mb-4 flex h-20 w-20
          items-center justify-center
          rounded-full
          bg-orange-500/10
          text-orange-500
        "
      >
        <RefreshCcw size={34} />
      </div>

      <h2 className="text-lg font-bold text-[var(--foreground)]">
        {title}
      </h2>

      <p className="mt-2 text-sm text-[var(--text-muted)]">
        {description}
      </p>
    </div>
  );
}
