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
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">

        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
          <AlertTriangle
            className="text-red-600 dark:text-red-400"
            size={30}
          />
        </div>

        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Something went wrong
        </h1>

        <p className="mt-3 text-sm text-gray-500 dark:text-zinc-400">
          An unexpected error occurred while loading seller orders.
        </p>

        <button
          onClick={reset}
          className="
            mt-6
            inline-flex
            items-center
            gap-2
            rounded-xl
            bg-orange-500
            px-5
            py-3
            text-sm
            font-medium
            text-white
            transition
            hover:bg-orange-600
            active:scale-95
          "
        >
          <RotateCw size={18} />
          Try again
        </button>

      </div>
    </main>
  );
}
