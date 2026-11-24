"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "./actions";

const MENU = [
  { href: "/", label: "ダッシュボード", icon: "📊" },
  { href: "/orders", label: "注文管理", icon: "📋" },
  { href: "/inventory", label: "在庫管理", icon: "📦" },
  { href: "/products", label: "商品管理", icon: "🧩" },
  { href: "/shipping", label: "発送管理", icon: "🚚" },
  { href: "/sales", label: "売上集計", icon: "📈" },
];

const ADMIN_MENU = [{ href: "/staff", label: "スタッフ管理", icon: "👥" }];

export default function Sidebar({ name, loginId, email, isAdmin }) {
  const pathname = usePathname();

  function isActive(href) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <aside className="admin-sidebar">
      <div className="admin-brand">
        <div className="admin-brand-logo">EURO PARTS</div>
        <div className="admin-brand-sub">管理システム</div>
      </div>

      <nav className="admin-nav">
        {[...MENU, ...(isAdmin ? ADMIN_MENU : [])].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`admin-nav-link${isActive(item.href) ? " is-active" : ""}`}
          >
            <span className="admin-nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="admin-user">
        <div className="admin-user-email" title={loginId || email}>
          <span style={{ color: "#ffffff", fontWeight: 700 }}>{name}</span>
          <span style={{ marginLeft: 6 }}>{isAdmin ? "管理者" : "スタッフ"}</span>
        </div>
        <form action={signOut}>
          <button type="submit" className="admin-logout">
            ログアウト
          </button>
        </form>
      </div>
    </aside>
  );
}
