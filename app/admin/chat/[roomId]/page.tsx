"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useParams,
  useRouter,
} from "next/navigation";

import {
  useAuth,
} from "@/context/AuthContext";

import {
  apiAuthFetch,
} from "@/lib/api/apiAuthFetch";

/* =====================================================
   TYPES
===================================================== */

type ChatMessage = {
  id: string;
  room_id: string;
  sender_id: string;
  message_type: string;
  content: string;
  created_at: string;
};

/* =====================================================
   PAGE
===================================================== */

export default function AdminChatRoomPage() {

  const {
    user,
    loading,
    piReady,
  } = useAuth();

  const router =
    useRouter();

  const params =
    useParams();

  const roomId =
    String(
      params.roomId ?? ""
    );

  const [
    messages,
    setMessages,
  ] =
    useState<
      ChatMessage[]
    >([]);

  const [
  roomInfo,
  setRoomInfo,
] = useState<{
  username: string;
} | null>(null);
  
  const [
    input,
    setInput,
  ] =
    useState("");

  const [
    sending,
    setSending,
  ] =
    useState(false);

  const bottomRef =
    useRef<
      HTMLDivElement | null
    >(null);

  /* =====================================================
     AUTH
  ===================================================== */

  useEffect(() => {

    if (
      loading ||
      !piReady
    ) {
      return;
    }

    if (
      !user?.is_admin
    ) {
      router.replace(
        "/404"
      );
    }

  }, [
    loading,
    piReady,
    user,
    router,
  ]);

  /* =====================================================
     LOAD
  ===================================================== */

  useEffect(() => {

  if (
    loading ||
    !piReady ||
    !user?.is_admin ||
    !roomId
  ) {
    return;
  }

  const timer =
    setInterval(() => {

      void loadMessages();

    }, 3000);

  return () => {

    clearInterval(timer);

  };

}, [
  loading,
  piReady,
  user,
  roomId,
]);

  /* =====================================================
     AUTO SCROLL
  ===================================================== */

  useEffect(() => {

    requestAnimationFrame(() => {

  bottomRef.current?.scrollIntoView({
    behavior: "smooth",
  });

});

  }, [
    messages,
  ]);

  /* =====================================================
     LOAD MESSAGES
  ===================================================== */

  async function loadMessages() {

    try {

      const res =
  await apiAuthFetch(
    `/api/admin/chat/messages?roomId=${roomId}`
  );

      const data =
        await res.json();

      console.log(
        "[ADMIN_CHAT][MESSAGES]",
        data
      );

      if (!res.ok) {
        return;
      }
if (data.room) {
  setRoomInfo(data.room);
}
      setMessages(
        Array.isArray(
          data.messages
        )
          ? data.messages
          : []
      );

    } catch (err) {

      console.error(
        "[ADMIN_CHAT]",
        err
      );

    }

  }

  /* =====================================================
     SEND MESSAGE
  ===================================================== */

  async function handleSend() {

    if (
      sending ||
      !input.trim()
    ) {
      return;
    }

    try {

      setSending(
        true
      );

      const res =
  await apiAuthFetch(
    "/api/admin/chat/messages",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        roomId,
        content: input.trim(),
      }),
    }
  );

      const data =
        await res.json();

      console.log(
        "[ADMIN_CHAT][SEND]",
        data
      );

      if (!res.ok) {
        return;
      }

      setInput("");

      await loadMessages();

    } catch (err) {

      console.error(
        "[ADMIN_CHAT][SEND]",
        err
      );

    } finally {

      setSending(
        false
      );

    }

  }

  /* =====================================================
     LOADING
  ===================================================== */

  if (
    loading ||
    !piReady
  ) {
    return (
      <main className="p-6">

        Loading...

      </main>
    );
  }

  if (
    !user?.is_admin
  ) {
    return null;
  }
    /* =====================================================
     PAGE
  ===================================================== */

  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden bg-gray-100">

      {/* ================= HEADER ================= */}

      <header
        className="
          sticky
          top-0
          z-20
          border-b
          bg-white
          shadow-sm
        "
      >

        <div className="mx-auto flex max-w-5xl items-center gap-4 p-4">

          <button
            type="button"
            onClick={() =>
              router.back()
            }
            className="
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-full
              bg-gray-100
              transition
              hover:bg-gray-200
            "
          >
            ←
          </button>

          <div
            className="
              flex
              h-12
              w-12
              items-center
              justify-center
              rounded-full
              bg-blue-600
              text-lg
              font-bold
              text-white
            "
          >
            U
          </div>

          <div>

          <h1 className="font-semibold">
  {roomInfo?.username ??
    "Support Chat"}
</h1>

<p className="text-sm text-green-600">
  Online
</p>

          </div>

        </div>

      </header>

      {/* ================= CHAT ================= */}

      <section
        className="
          flex-1
          overflow-y-auto
          px-4
          py-6
          pb-36
        "
      >

        <div
          className="
            mx-auto
            flex
            max-w-5xl
            flex-col
            gap-4
          "
        >

          {messages.length === 0 && (

            <div
              className="
                mt-10
                text-center
                text-gray-400
              "
            >
              Chưa có tin nhắn.
            </div>

          )}

          {messages.map(
            (
              message
            ) => {

              const isAdmin =
                message.sender_id ===
                user.id;

              return (

                <div
                  key={
                    message.id
                  }
                  className={`flex ${
                    isAdmin
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >

                  <div
                    className={`max-w-[80%] rounded-3xl px-5 py-3 shadow ${
                      isAdmin
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-900"
                    }`}
                  >

                    <div className="whitespace-pre-wrap text-sm">

                      {message.content}

                    </div>

                    <div
                      className={`mt-2 text-right text-xs ${
                        isAdmin
                          ? "text-blue-100"
                          : "text-gray-500"
                      }`}
                    >

                      {new Date(
                        message.created_at
                      ).toLocaleTimeString(
                        [],
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}

                    </div>

                  </div>

                </div>

              );

            }
          )}

          <div ref={bottomRef} />

        </div>

      </section>

      {/* ================= FOOTER ================= */}

      <footer
        className="
          fixed
          bottom-16
          left-0
          right-0
          z-30
          border-t
          bg-white
          p-4
          pb-[max(env(safe-area-inset-bottom),16px)]
          shadow-lg
        "
      >

        <div
          className="
            mx-auto
            flex
            max-w-5xl
            gap-3
          "
        >

          <input
            value={input}
            onChange={(e) =>
              setInput(
                e.target.value
              )
            }
            onKeyDown={(e) => {

              if (
                e.key ===
                "Enter"
              ) {

                e.preventDefault();

                void handleSend();

              }

            }}
            placeholder="Nhập tin nhắn..."
            className="
              flex-1
              rounded-full
              border
              border-gray-300
              bg-gray-50
              px-5
              py-3
              outline-none
              transition
              focus:border-blue-500
              focus:bg-white
            "
          />

          <button
            type="button"
            disabled={
              sending
            }
            onClick={() => {

              void handleSend();

            }}
            className="
              rounded-full
              bg-blue-600
              px-7
              py-3
              font-semibold
              text-white
              transition
              hover:bg-blue-700
              disabled:opacity-50
            "
          >

            {sending
              ? "..."
              : "Gửi"}

          </button>

        </div>

      </footer>

    </main>
  );

}
