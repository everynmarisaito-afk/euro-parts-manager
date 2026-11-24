import { redirect } from "next/navigation";
import { getCurrentStaff } from "../../lib/staff";
import Sidebar from "./Sidebar";
import "./admin.css";

export default async function AdminLayout({ children }) {
  const staff = await getCurrentStaff();

  // 未ログイン・スタッフ未登録・停止中はログイン画面へ
  if (!staff) {
    redirect("/login?denied=1");
  }

  return (
    <div className="admin-shell">
      <Sidebar
        name={staff.name}
        loginId={staff.loginId}
        email={staff.email}
        isAdmin={staff.isAdmin}
      />
      <main className="admin-main">{children}</main>
    </div>
  );
}
