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
  sender_id: string | null;
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

  /* =====================================================
     STATE
  ===================================================== */

  const [
    messages,
    setMessages,
  ] =
    useState<
      ChatMessage[]
    >([]);

  const [
    input,
    setInput,
  ] =
    useState("");

  const bottomRef =
    useRef<HTMLDivElement>(
      null
    );

  /* =====================================================
     SCROLL
  ===================================================== */

  function scrollToBottom() {

    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });

  }

  useEffect(() => {

    scrollToBottom();

  }, [messages]);

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
     FIRST LOAD
  ===================================================== */

  useEffect(() => {

    if (
      loading ||
      !piReady ||
      !user?.is_admin
    ) {
      return;
    }

    if (!roomId) {
      return;
    }

    void loadMessages();

  }, [
    loading,
    piReady,
    user,
    roomId,
  ]);

  /* =====================================================
     POLLING
  ===================================================== */

  useEffect(() => {

    if (!roomId) {
      return;
    }

    const timer =
  setInterval(() => {

    if (
      document.visibilityState === "visible"
    ) {

      void loadMessages();

    }

  }, 2000);
    return () => {

      clearInterval(
        timer
      );

    };

  }, [roomId]);

  /* =====================================================
     LOAD MESSAGES
  ===================================================== */

  async function loadMessages() {

    try {

      const res =
        await apiAuthFetch(
          `/api/admin/chat/messages?roomId=${roomId}`
        );

      if (!res.ok) {
        return;
      }

      const data =
        await res.json();

      const next =
        Array.isArray(
          data.messages
        )
          ? data.messages
          : [];

      setMessages((prev) => {

  if (
    prev.length === next.length &&
    prev.at(-1)?.id === next.at(-1)?.id
  ) {
    return prev;
  }

  return next;

});

    } catch (err) {

      console.error(
        "[ADMIN CHAT]",
        err
      );

    }

  }

  /* =====================================================
     SEND MESSAGE
  ===================================================== */

  async function handleSend() {

    const content =
      input.trim();

    if (!content) {
      return;
    }

    const optimisticMessage: ChatMessage = {

      id:
        `temp-${Date.now()}`,

      room_id:
        roomId,

      sender_id:
        user!.id,

      message_type:
        "text",

      content,

      created_at:
        new Date().toISOString(),

    };

    setInput("");

    setMessages(
      (prev) => [
        ...prev,
        optimisticMessage,
      ]
    );

    try {

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
              content,
            }),
          }
        );

      if (!res.ok) {

        setMessages(
          (prev) =>
            prev.filter(
              (m) =>
                m.id !==
                optimisticMessage.id
            )
        );

        return;

      }

      const data =
        await res.json();

      setMessages(
        (prev) =>
          prev.map(
            (m) =>
              m.id ===
              optimisticMessage.id
                ? data.message
                : m
          )
      );

    } catch (err) {

      setMessages(
        (prev) =>
          prev.filter(
            (m) =>
              m.id !==
              optimisticMessage.id
          )
      );

      console.error(
        "[ADMIN CHAT]",
        err
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
    <main className="flex min-h-[100dvh] flex-col bg-gray-100">

      {/* Header */}

      <header className="sticky top-0 border-b bg-white px-4 py-4">

        <div className="flex items-center gap-3">

          <button
            type="button"
            onClick={() =>
              router.back()
            }
            className="text-xl"
          >
            ←
          </button>

          <div>

            <h1 className="text-lg font-semibold">
              Support Chat
            </h1>

            <p className="text-sm text-green-600">
              Online
            </p>

          </div>

        </div>

      </header>

      {/* Messages */}

      <section className="flex-1 overflow-y-auto px-4 py-6">

        <div className="mx-auto flex max-w-3xl flex-col gap-4">

          {messages.map(
            (
              message
            ) => {

              const isAdmin =
                message.sender_id ===
                user?.id;

              const isSystem =
                message.sender_id ===
                null;

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
                    className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                      isAdmin
                        ? "bg-blue-600 text-white"
                        : isSystem
                        ? "bg-yellow-50 border border-yellow-200 text-gray-900"
                        : "bg-white text-gray-900"
                    }`}
                  >

                    <p className="mb-2 whitespace-pre-wrap text-sm">
                      {message.content}
                    </p>

                    <div
                      className={`text-xs ${
                        isAdmin
                          ? "text-blue-100"
                          : "text-gray-500"
                      }`}
                    >

                      {new Date(
                        message.created_at
                      ).toLocaleTimeString()}

                    </div>

                  </div>

                </div>

              );

            }
          )}

          <div
            ref={bottomRef}
          />

        </div>

      </section>

      {/* Footer */}

      <footer
        className="
          fixed
          bottom-16
          left-0
          right-0
          z-50
          border-t
          bg-white
          p-4
          pb-[max(env(safe-area-inset-bottom),16px)]
        "
      >

        <div className="mx-auto flex max-w-3xl gap-3">

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

                void handleSend();

              }

            }}
            placeholder="Nhập tin nhắn..."
            className="flex-1 rounded-full border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
          />

          <button
            type="button"
            onClick={() => {

              void handleSend();

            }}
            className="rounded-full bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-700"
          >

            Gửi

          </button>

        </div>

      </footer>

    </main>

  );

}
