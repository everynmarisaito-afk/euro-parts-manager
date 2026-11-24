import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

// ログインIDから認証用のメールアドレスを作る（実在のメールは送られない）
export const STAFF_EMAIL_DOMAIN = "staff.everyn-club.com";
export const LOGIN_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export function loginIdToEmail(loginId) {
  return `${String(loginId).trim().toLowerCase()}@${STAFF_EMAIL_DOMAIN}`;
}

export function isStaffEmail(email) {
  return String(email || "").endsWith(`@${STAFF_EMAIL_DOMAIN}`);
}

export const ROLES = {
  admin: { label: "管理者", color: "#1e40af", bg: "#dbeafe" },
  staff: { label: "スタッフ", color: "#374151", bg: "#f3f4f6" },
};

// ログイン中のスタッフ情報（未ログイン・未登録・停止中は null）
export async function getCurrentStaff() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user;
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from("staff_profiles")
    .select("user_id, login_id, display_name, role, active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || !profile.active) return null;

  return {
    id: user.id,
    email: user.email,
    loginId: profile.login_id,
    name: profile.display_name || profile.login_id || user.email,
    role: profile.role,
    isAdmin: profile.role === "admin",
  };
}

// サーバーアクション・ページで使う：スタッフでなければログイン画面へ
export async function requireStaff() {
  const staff = await getCurrentStaff();
  if (!staff) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login?denied=1");
  }
  return staff;
}

// 管理者でなければトップへ
export async function requireAdmin() {
  const staff = await requireStaff();
  if (!staff.isAdmin) {
    redirect("/?forbidden=1");
  }
  return staff;
}

// 注文メモなどに残す担当者名
export function staffLabel(staff) {
  return staff.loginId ? `${staff.name}（${staff.loginId}）` : staff.name;
}
