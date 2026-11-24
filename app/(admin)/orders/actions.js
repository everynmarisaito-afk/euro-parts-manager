"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "../../../lib/supabase/server";
import { updateOrder, addOrderNote } from "../../../lib/woocommerce";
import { ORDER_STATUSES } from "../../../lib/format";

async function requireStaff() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data?.user) {
    redirect("/login");
  }
  return data.user;
}

function backTo(id, params) {
  const qs = new URLSearchParams(params).toString();
  return `/orders/${id}?${qs}`;
}

export async function updateOrderStatus(orderId, formData) {
  const user = await requireStaff();
  const status = String(formData.get("status") || "");
  const note = String(formData.get("note") || "").trim();

  if (!ORDER_STATUSES[status]) {
    redirect(backTo(orderId, { error: "ステータスが正しくありません" }));
  }

  let errorMessage = "";
  try {
    await updateOrder(orderId, { status });
    const label = ORDER_STATUSES[status].label;
    const staffNote = `[管理アプリ] ${user.email} がステータスを「${label}」に変更${
      note ? `\nメモ: ${note}` : ""
    }`;
    await addOrderNote(orderId, staffNote, false);
  } catch (err) {
    errorMessage = err.message || "更新に失敗しました";
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);

  if (errorMessage) {
    redirect(backTo(orderId, { error: errorMessage }));
  }
  redirect(backTo(orderId, { updated: "1" }));
}

export async function addStaffNote(orderId, formData) {
  const user = await requireStaff();
  const note = String(formData.get("note") || "").trim();
  if (!note) {
    redirect(backTo(orderId, { error: "メモを入力してください" }));
  }

  let errorMessage = "";
  try {
    await addOrderNote(orderId, `[管理アプリ] ${user.email}\n${note}`, false);
  } catch (err) {
    errorMessage = err.message || "メモの追加に失敗しました";
  }

  revalidatePath(`/orders/${orderId}`);

  if (errorMessage) {
    redirect(backTo(orderId, { error: errorMessage }));
  }
  redirect(backTo(orderId, { noted: "1" }));
}
