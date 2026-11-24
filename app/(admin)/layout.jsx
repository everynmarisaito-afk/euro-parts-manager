import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import Sidebar from "./Sidebar";
import "./admin.css";

export default async function AdminLayout({ children }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  // proxy でも確認しているが、念のためここでも未ログインを弾く
  if (!data?.user) {
    redirect("/login");
  }

  return (
    <div className="admin-shell">
      <Sidebar email={data.user.email} />
      <main className="admin-main">{children}</main>
    </div>
  );
}
