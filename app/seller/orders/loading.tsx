export default function Loading() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="sticky top-0 border-b border-gray-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-6 w-40 animate-pulse rounded bg-gray-200 dark:bg-zinc-800" />
            <div className="mt-2 h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-zinc-800" />
          </div>

          <div className="h-12 w-28 animate-pulse rounded-2xl bg-gray-200 dark:bg-zinc-800" />
        </div>
      </div>

      {/* Filter */}
      <div className="space-y-3 p-4">
        <div className="h-11 animate-pulse rounded-xl bg-gray-200 dark:bg-zinc-800" />

        <div className="grid grid-cols-2 gap-3">
          <div className="h-11 animate-pulse rounded-xl bg-gray-200 dark:bg-zinc-800" />
          <div className="h-11 animate-pulse rounded-xl bg-gray-200 dark:bg-zinc-800" />
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-4 px-4 pb-6">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="h-16 animate-pulse border-b bg-gray-100 dark:border-zinc-800 dark:bg-zinc-800" />

            <div className="space-y-3 p-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="flex gap-3"
                >
                  <div className="h-16 w-16 animate-pulse rounded-xl bg-gray-200 dark:bg-zinc-800" />

                  <div className="flex-1">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-zinc-800" />
                    <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-gray-200 dark:bg-zinc-800" />
                  </div>
                </div>
              ))}
            </div>

            <div className="h-16 animate-pulse border-t bg-gray-100 dark:border-zinc-800 dark:bg-zinc-800" />
          </div>
        ))}
      </div>
    </main>
  );
}
