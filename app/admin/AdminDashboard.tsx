"use client";

import { useRouter } from "next/navigation";

type AdminModule = {
  title: string;
  description: string;
  icon: string;
  href: string;
  enabled: boolean;
};

const modules: AdminModule[] = [
  {
    title: "Seller Requests",
    description: "Quản lý đăng ký Seller",
    icon: "🧾",
    href: "/admin/sellers",
    enabled: true,
  },
  {
    title: "Chat Support",
    description: "Hỗ trợ người dùng",
    icon: "💬",
    href: "/admin/chat",
    enabled: true,
  },
  {
    title: "Withdraws",
    description: "Duyệt rút tiền",
    icon: "💰",
    href: "/admin/withdraws",
    enabled: true,
  },
  {
    title: "Products",
    description: "Coming Soon",
    icon: "📦",
    href: "/admin/products",
    enabled: false,
  },
  {
    title: "Orders",
    description: "Coming Soon",
    icon: "📋",
    href: "/admin/orders",
    enabled: false,
  },
  {
    title: "Users",
    description: "Coming Soon",
    icon: "👥",
    href: "/admin/users",
    enabled: false,
  },
  {
    title: "Reports",
    description: "Coming Soon",
    icon: "🚨",
    href: "/admin/reports",
    enabled: false,
  },
  {
    title: "Payments",
    description: "Coming Soon",
    icon: "💳",
    href: "/admin/payments",
    enabled: false,
  },
  {
    title: "Settings",
    description: "Coming Soon",
    icon: "⚙️",
    href: "/admin/settings",
    enabled: false,
  },
];

export default function AdminDashboard() {
  const router = useRouter();

  return (
    <section className="grid grid-cols-2 gap-4">
      {modules.map((module) => (
        <button
          key={module.href}
          type="button"
          disabled={!module.enabled}
          onClick={() => {
            if (module.enabled) {
              router.push(module.href);
            }
          }}
          className={`
            rounded-2xl
            border
            bg-white
            p-5
            text-left
            shadow-sm
            transition-all
            ${
              module.enabled
                ? "hover:border-blue-500 hover:shadow-md"
                : "cursor-not-allowed opacity-60"
            }
          `}
        >
          <div className="mb-3 text-3xl">
            {module.icon}
          </div>

          <h2 className="text-base font-semibold">
            {module.title}
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            {module.description}
          </p>
        </button>
      ))}
    </section>
  );
}
