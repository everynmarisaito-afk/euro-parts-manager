"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "../../../lib/supabase/admin";
import {
  requireAdmin,
  loginIdToEmail,
  LOGIN_ID_PATTERN,
  ROLES,
} from "../../../lib/staff";

function back(params) {
  revalidatePath("/staff");
  const qs = new URLSearchParams(params).toString();
  redirect(`/staff?${qs}`);
}

// Supabaseのエラーを日本語にする
function jaError(message) {
  const m = String(message || "");
  if (/already been registered|already exists|duplicate/i.test(m)) {
    return "このログインIDはすでに使われています";
  }
  if (/password/i.test(m)) {
    return `パスワードの条件を満たしていません（12文字以上で、英大文字・英小文字・数字・記号をそれぞれ1文字以上）`;
  }
  return m || "処理に失敗しました";
}

export async function createStaffAction(formData) {
  await requireAdmin();
  const loginId = String(formData.get("login_id") || "").trim().toLowerCase();
  const name = String(formData.get("display_name") || "").trim();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "staff");

  if (!LOGIN_ID_PATTERN.test(loginId)) {
    back({
      error: "ログインIDは半角英数字・「.」「_」「-」で3〜32文字にしてください（先頭は英数字）",
    });
  }
  if (!name) back({ error: "表示名を入力してください" });
  if (!ROLES[role]) back({ error: "権限が正しくありません" });

  let errorMessage = "";
  try {
    const admin = createAdminClient();

    const { data: exists } = await admin
      .from("staff_profiles")
      .select("user_id")
      .eq("login_id", loginId)
      .maybeSingle();
    if (exists) throw new Error("このログインIDはすでに使われています");

    const { data, error } = await admin.auth.admin.createUser({
      email: loginIdToEmail(loginId),
      password,
      email_confirm: true,
      user_metadata: { login_id: loginId, display_name: name },
    });
    if (error) throw error;

    const { error: profileError } = await admin.from("staff_profiles").insert({
      user_id: data.user.id,
      login_id: loginId,
      display_name: name,
      role,
    });
    if (profileError) {
      // プロフィールが作れなかったらアカウントも消して元に戻す
      await admin.auth.admin.deleteUser(data.user.id);
      throw profileError;
    }
  } catch (err) {
    errorMessage = jaError(err.message);
  }

  if (errorMessage) back({ error: errorMessage });
  back({ created: loginId });
}

export async function updateStaffAction(userId, formData) {
  const me = await requireAdmin();
  const name = String(formData.get("display_name") || "").trim();
  const role = String(formData.get("role") || "");

  if (!name) back({ error: "表示名を入力してください" });
  if (!ROLES[role]) back({ error: "権限が正しくありません" });
  if (userId === me.id && role !== "admin") {
    back({ error: "自分自身の管理者権限は外せません" });
  }

  let errorMessage = "";
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("staff_profiles")
      .update({ display_name: name, role, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) throw error;
  } catch (err) {
    errorMessage = jaError(err.message);
  }

  if (errorMessage) back({ error: errorMessage });
  back({ updated: "1" });
}

export async function resetPasswordAction(userId, formData) {
  await requireAdmin();
  const password = String(formData.get("password") || "");
  if (!password) back({ error: "新しいパスワードを入力してください" });

  let errorMessage = "";
  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) throw error;
  } catch (err) {
    errorMessage = jaError(err.message);
  }

  if (errorMessage) back({ error: errorMessage });
  back({ password: "1" });
}

export async function setActiveAction(userId, active) {
  const me = await requireAdmin();
  if (userId === me.id && !active) {
    back({ error: "自分自身は停止できません" });
  }

  let errorMessage = "";
  try {
    const admin = createAdminClient();
    // 停止中はログインもできないようにする
    const { error: banError } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: active ? "none" : "876000h",
    });
    if (banError) throw banError;

    const { error } = await admin
      .from("staff_profiles")
      .update({ active, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) throw error;
  } catch (err) {
    errorMessage = jaError(err.message);
  }

  if (errorMessage) back({ error: errorMessage });
  back({ [active ? "activated" : "deactivated"]: "1" });
}
