// app/account/messages/page.tsx

"use client";

import { useMemo, useState } from "react";

type ChatMessage = {
  id: string;
  sender: "admin" | "user";
  content: string;
  createdAt: string;
};

export default function MessagesPage() {
  const [input, setInput] = useState("");

  const messages = useMemo<ChatMessage[]>(
    () => [
      {
        id: "1",
        sender: "admin",
        content: "Xin chào 👋 Chào mừng bạn đến với bộ phận hỗ trợ Titi Marketplace.",
        createdAt: "09:00",
      },
      {
        id: "2",
        sender: "admin",
        content: "Bạn cần chúng tôi hỗ trợ vấn đề gì?",
        createdAt: "09:01",
      },
      {
        id: "3",
        sender: "user",
        content: "Tôi muốn hỏi về đơn hàng của mình.",
        createdAt: "09:02",
      },
    ],
    []
  );

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
