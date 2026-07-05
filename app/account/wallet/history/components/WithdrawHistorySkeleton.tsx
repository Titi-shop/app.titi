// =====================================================
// app/account/wallet/history/components/WithdrawHistorySkeleton.tsx
// =====================================================

"use client";

/* =====================================================
   COMPONENT
===================================================== */

export default function WithdrawHistorySkeleton() {

  return (

    <div
      className="
        space-y-4
        px-4
        py-4
      "
    >

      {Array.from({
        length: 6,
      }).map((_, index) => (

        <div
          key={index}
          className="
            card
            animate-pulse
            p-4
          "
        >

          {/* ================= TOP ================= */}

          <div
            className="
              flex
              items-start
              justify-between
            "
          >

            <div>

              <div
                className="
                  h-5
                  w-28
                  rounded
                  bg-muted
                "
              />

              <div
                className="
                  mt-2
                  h-3
                  w-36
                  rounded
                  bg-muted
                "
              />

            </div>

            <div
              className="
                h-7
                w-24
                rounded-full
                bg-muted
              "
            />

          </div>

          {/* ================= ADDRESS ================= */}

          <div
            className="
              mt-5
              flex
              items-center
              justify-between
            "
          >

            <div
              className="
                flex-1
              "
            >

              <div
                className="
                  h-3
                  w-20
                  rounded
                  bg-muted
                "
              />

              <div
                className="
                  mt-2
                  h-4
                  w-full
                  max-w-xs
                  rounded
                  bg-muted
                "
              />

            </div>

            <div
              className="
                ml-4
                h-10
                w-10
                rounded-xl
                bg-muted
              "
            />

          </div>

          {/* ================= INFO ================= */}

          <div
            className="
              mt-5
              grid
              grid-cols-2
              gap-4
            "
          >

            <div>

              <div
                className="
                  h-3
                  w-16
                  rounded
                  bg-muted
                "
              />

              <div
                className="
                  mt-2
                  h-4
                  w-24
                  rounded
                  bg-muted
                "
              />

            </div>

            <div>

              <div
                className="
                  h-3
                  w-20
                  rounded
                  bg-muted
                "
              />

              <div
                className="
                  mt-2
                  h-4
                  w-20
                  rounded
                  bg-muted
                "
              />

            </div>

          </div>

        </div>

      ))}

    </div>

  );

}
