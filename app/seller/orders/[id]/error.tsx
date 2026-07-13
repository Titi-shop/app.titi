"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

type Props = {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
};

export default function Error({
  error,
  reset,
}: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      className="
        flex
        min-h-screen
        items-center
        justify-center
        bg-[var(--background)]
        p-6
      "
    >
      <div
        className="
          w-full
          max-w-md
          rounded-3xl
          border
          border-[var(--border-color)]
          bg-[var(--card-bg)]
          p-8
          text-center
          shadow-lg
        "
      >
        <div
          className="
            mx-auto
            mb-5
            flex
            h-16
            w-16
            items-center
            justify-center
            rounded-full
            bg-[color:color-mix(in_srgb,var(--color-danger)_15%,transparent)]
          "
        >
          <AlertTriangle
            size={30}
            className="text-[var(--color-danger)]"
          />
        </div>

        <h1
          className="
            text-xl
            font-bold
            text-[var(--text-primary)]
          "
        >
          Something went wrong
        </h1>

        <p
          className="
            mt-3
            text-sm
            text-[var(--text-muted)]
          "
        >
          An unexpected error occurred while loading this order.
        </p>

        <button
          type="button"
          onClick={reset}
          className="
            mt-6
            inline-flex
            items-center
            gap-2
            rounded-xl
            bg-[var(--color-primary)]
            px-5
            py-3
            text-sm
            font-medium
            text-white
            transition
            hover:opacity-90
            active:scale-95
          "
        >
          <RotateCw size={18} />
          Try Again
        </button>
      </div>
    </main>
  );
}
