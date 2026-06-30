// app/account/messages/page.tsx

"use client";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/context/AuthContext";

import { getPiAccessToken } from "@/lib/piAuth";
type ChatMessage = {
  id: string;
  sender: "admin" | "user";
  content: string;
  createdAt: string;
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
  function handleSend() {
    if (!input.trim()) return;

    // Chưa kết nối API.
    console.log("Send:", input);

    setInput("");
  }

  return (
    <main className="flex h-[100dvh] flex-col bg-gray-100">
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
            const isUser = message.sender === "user";

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
                    {message.createdAt}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Input */}
      <footer className="border-t bg-white p-4">
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
