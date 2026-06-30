"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
  useParams,
} from "next/navigation";

import {
  useAuth,
} from "@/context/AuthContext";

import {
  apiAuthFetch,
} from "@/lib/api/apiAuthFetch";

type ChatMessage = {
  id: string;
  room_id: string;
  sender_id: string;
  message_type: string;
  content: string;
  created_at: string;
};

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
    input,
    setInput,
  ] =
    useState("");

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

  async function loadMessages() {

    try {

      const res =
        await apiAuthFetch(
          `/api/chat/messages?roomId=${roomId}`
        );

      const data =
        await res.json();

      if (
        !res.ok
      ) {
        return;
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
        "[ADMIN_CHAT_ROOM]",
        err
      );
    }
  }
async function handleSend() {

  if (!input.trim()) {
    return;
  }

  try {

    const res =
      await apiAuthFetch(
        "/api/chat/messages",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            roomId,
            content: input,
          }),
        }
      );

    const data =
      await res.json();

    console.log(
      "[ADMIN_CHAT_ROOM][SEND]",
      data
    );

    if (!res.ok) {
      return;
    }

    setInput("");

    await loadMessages();

  } catch (err) {

    console.error(
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
      <main className="p-4">
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
    <main className="flex h-[100dvh] flex-col bg-gray-100">

      {/* Header */}

      <header className="border-b bg-white p-4">

        <button
          type="button"
          onClick={() =>
            router.back()
          }
          className="mb-2 text-sm"
        >
          ← Quay lại
        </button>

        <h1 className="text-lg font-semibold">
          Chat
        </h1>

      </header>

      {/* Messages */}

      <section className="flex-1 overflow-y-auto p-4">

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
                className={`mb-4 flex ${
                  isAdmin
                    ? "justify-end"
                    : "justify-start"
                }`}
              >

                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    isAdmin
                      ? "bg-blue-600 text-white"
                      : "bg-white"
                  }`}
                >

                  <div>
                    {
                      message.content
                    }
                  </div>

                  <div
                    className={`mt-2 text-xs ${
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

      </section>

      {/* Footer */}

      <footer className="border-t bg-white p-4">

        <div className="flex gap-3">

         <input
  value={input}
  onChange={(e) =>
    setInput(
      e.target.value
    )
  }
  onKeyDown={(e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleSend();
    }
  }}
  placeholder="Nhập tin nhắn..."
  className="flex-1 rounded-full border px-4 py-3"
/>

  <button
  type="button"
  onClick={() => {
    void handleSend();
  }}
  className="rounded-full bg-blue-600 px-6 py-3 text-white"
>
  Gửi
</button>
        </div>

      </footer>

    </main>
  );
}
