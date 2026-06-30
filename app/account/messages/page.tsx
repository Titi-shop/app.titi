
"use client";
import {
  useEffect,
  useState,
} from "react";

import { useAuth } from "@/context/AuthContext";

import { getPiAccessToken } from "@/lib/piAuth";
type ChatMessage = {
  id: string;
  room_id: string;
  sender_id: string;
  message_type: string;
  content: string;
  created_at: string;
};

export default function MessagesPage() {
  const [input, setInput] = useState("");
const {
  user,
  loading,
} = useAuth();

const [roomId, setRoomId] =
  useState<string | null>(null);
  useEffect(() => {
  if (loading) return;

  if (!user) return;

  loadRoom();
}, [loading, user]);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  async function loadRoom() {
  try {
    const token =
      await getPiAccessToken();

    if (!token) {
      return;
    }

    const res =
      await fetch("/api/chat/room", {
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
      });

    if (!res.ok) {
      return;
    }

    const data =
      await res.json();

    setRoomId(data.room.id);
await loadMessages(data.room.id);
  } catch (err) {
    console.error(err);
  }
}
  async function loadMessages(roomId: string) {
  const token = await getPiAccessToken();

  if (!token) return;

  const res = await fetch(
    `/api/chat/messages?roomId=${roomId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) return;

  const data = await res.json();

  setMessages(data.messages);
}
  async function handleSend() {
  if (!roomId) {
    return;
  }

  const content = input.trim();

  if (!content) {
    return;
  }

  try {
    const token = await getPiAccessToken();

    if (!token) {
      return;
    }

    const res = await fetch(
      "/api/chat/messages",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId,
          content,
        }),
      }
    );

    if (!res.ok) {
      const error = await res.json();

      console.error(
        "[CHAT][SEND]",
        error
      );

      return;
    }

    setInput("");

    await loadMessages(roomId);
  } catch (err) {
    console.error(
      "[CHAT][SEND]",
      err
    );
  }
}
  return (
    <main className="flex min-h-[100dvh] flex-col bg-gray-100">
      {/* Header */}
      <header className="sticky top-0 border-b bg-white px-4 py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => history.back()}
            className="text-xl"
          >
            ←
          </button>

          <div>
            <h1 className="text-lg font-semibold">
              Hỗ trợ Titi Marketplace
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
          {messages.map((message) => {
            const isUser =
  message.sender_id === user?.id;

            return (
              <div
                key={message.id}
                className={`flex ${
                  isUser ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                    isUser
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-900"
                  }`}
                >
                  <p className="mb-2 text-sm whitespace-pre-wrap">
                    {message.content}
                  </p>

                  <div
                    className={`text-xs ${
                      isUser
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
          })}
        </div>
      </section>

      {/* Input */}
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
            type="text"
            placeholder="Nhập tin nhắn..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSend();
              }
            }}
            className="flex-1 rounded-full border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
          />

          <button
            type="button"
            onClick={handleSend}
            className="rounded-full bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-700"
          >
            Gửi
          </button>
        </div>
      </footer>
    </main>
  );
}
