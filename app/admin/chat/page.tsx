"use client";

import { useState } from "react";

type Room = {
  id: string;
  username: string;
};

type Message = {
  id: string;
  sender: "user" | "admin";
  content: string;
  time: string;
};

const rooms: Room[] = [
  {
    id: "1",
    username: "Hung",
  },
  {
    id: "2",
    username: "Minh",
  },
  {
    id: "3",
    username: "Lan",
  },
];

const demoMessages: Message[] = [
  {
    id: "1",
    sender: "user",
    content: "Xin chào Admin",
    time: "09:00",
  },
  {
    id: "2",
    sender: "admin",
    content: "Chào bạn, mình có thể giúp gì?",
    time: "09:01",
  },
];

export default function AdminChatPage() {
  const [selectedRoom] = useState("1");
  const [messages] =
    useState<Message[]>(demoMessages);

  const [input, setInput] =
    useState("");

  return (
    <main className="flex h-[100dvh] bg-gray-100">

      {/* Sidebar */}
      <aside className="w-72 border-r bg-white">

        <div className="border-b p-4">
          <h1 className="text-xl font-bold">
            Chat Support
          </h1>
        </div>

        <div className="overflow-y-auto">

          {rooms.map((room) => (
            <button
              key={room.id}
              className={`w-full border-b px-4 py-4 text-left transition ${
                room.id === selectedRoom
                  ? "bg-blue-50"
                  : "hover:bg-gray-50"
              }`}
            >
              <div className="font-medium">
                {room.username}
              </div>

              <div className="text-sm text-gray-500">
                Người dùng
              </div>
            </button>
          ))}

        </div>

      </aside>

      {/* Chat */}
      <section className="flex flex-1 flex-col">

        <header className="border-b bg-white p-4">
          <h2 className="font-semibold">
            Hung
          </h2>
        </header>

        <div className="flex-1 overflow-y-auto p-4">

          {messages.map((message) => {

            const isAdmin =
              message.sender === "admin";

            return (
              <div
                key={message.id}
                className={`mb-4 flex ${
                  isAdmin
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                <div
                  className={`max-w-sm rounded-2xl px-4 py-3 ${
                    isAdmin
                      ? "bg-blue-600 text-white"
                      : "bg-white"
                  }`}
                >
                  <div>
                    {message.content}
                  </div>

                  <div
                    className={`mt-2 text-xs ${
                      isAdmin
                        ? "text-blue-100"
                        : "text-gray-500"
                    }`}
                  >
                    {message.time}
                  </div>
                </div>
              </div>
            );

          })}

        </div>

        <footer className="border-t bg-white p-4">

          <div className="flex gap-3">

            <input
              value={input}
              onChange={(e) =>
                setInput(e.target.value)
              }
              placeholder="Nhập tin nhắn..."
              className="flex-1 rounded-full border px-4 py-3"
            />

            <button
              className="rounded-full bg-blue-600 px-6 text-white"
            >
              Gửi
            </button>

          </div>

        </footer>

      </section>

    </main>
  );
}
