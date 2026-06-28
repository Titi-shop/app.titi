// =====================================================
// app/account/wallet/components/WalletSkeleton.tsx
// =====================================================

"use client";

/* =====================================================
   COMPONENT
===================================================== */

export default function WalletSkeleton() {

  return (

    <main
      className="
        min-h-screen
        bg-[var(--background)]
        pb-40
      "
    >

      {/* HERO */}

      <section
        className="
          rounded-b-[2.5rem]
          bg-[var(--card-secondary)]
          px-5
          pt-8
          pb-8
          animate-pulse
        "
      >

        {/* Balance */}

        <div
          className="
            h-4
            w-28
            rounded
            bg-[var(--nav-border)]
          "
        />

        <div
          className="
            mt-4
            h-10
            w-48
            rounded
            bg-[var(--nav-border)]
          "
        />

        {/* Default wallet */}

        <div
          className="
            mt-6
            h-20
            rounded-2xl
            bg-[var(--nav-border)]
          "
        />

        {/* Actions */}

        <div
          className="
            mt-6
            grid
            grid-cols-3
            gap-3
          "
        >

          {[1, 2, 3].map((item) => (

            <div
              key={item}
              className="
                h-24
                rounded-2xl
                bg-[var(--nav-border)]
              "
            />

          ))}

        </div>

      </section>

      {/* Stats */}

      <div
        className="
          mx-5
          mt-6
          grid
          grid-cols-2
          gap-4
        "
      >

        {[1, 2].map((item) => (

          <div
            key={item}
            className="
              h-24
              animate-pulse
              rounded-2xl
              bg-[var(--card-secondary)]
            "
          />

        ))}

      </div>

      {/* Transactions */}

      <div
        className="
          mx-5
          mt-6
          space-y-3
        "
      >

        {[1, 2, 3, 4, 5].map((item) => (

          <div
            key={item}
            className="
              h-20
              animate-pulse
              rounded-2xl
              bg-[var(--card-secondary)]
            "
          />

        ))}

      </div>

    </main>

  );

}
