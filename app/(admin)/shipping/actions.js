"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff, staffLabel } from "../../../lib/staff";
import { getOrder, updateOrder, addOrderNote } from "../../../lib/woocommerce";
import { CARRIERS, META_KEYS, trackingUrl } from "../../../lib/shipping";

function safeReturn(raw) {
  const s = String(raw || "");
  if (/^\/(shipping|orders)(\/|\?|$)/.test(s)) return s;
  return "/shipping";
}

function withParam(path, key, value) {
  const [base, qs = ""] = path.split("?");
  const p = new URLSearchParams(qs);
  p.delete("shipped");
  p.delete("error");
  p.set(key, value);
  return `${base}?${p.toString()}`;
}

function done(returnTo, key, value) {
  revalidatePath("/shipping");
  revalidatePath("/orders");
  revalidatePath("/");
  redirect(withParam(returnTo, key, value));
}

// 追跡番号を登録して「完了（発送済み）」にする
export async function markShippedAction(formData) {
  const user = await requireStaff();
  const orderId = String(formData.get("orderId") || "");
  const carrier = String(formData.get("carrier") || "");
  const number = String(formData.get("tracking") || "").trim().replace(/\s+/g, "");
  const notify = formData.get("notify") === "on";
  const returnTo = safeReturn(formData.get("returnTo"));

  if (!orderId) done(returnTo, "error", "注文が指定されていません");
  if (!CARRIERS[carrier]) done(returnTo, "error", "配送業者を選んでください");
  if (!number) done(returnTo, "error", "追跡番号を入力してください");

  let orderNumber = orderId;
  let errorMessage = "";
  try {
    const order = await getOrder(orderId);
    orderNumber = order.number;

    const shippedAt = new Date().toISOString();
    await updateOrder(orderId, {
      status: "completed",
      meta_data: [
        { key: META_KEYS.carrier, value: carrier },
        { key: META_KEYS.number, value: number },
        { key: META_KEYS.shippedAt, value: shippedAt },
        { key: META_KEYS.shippedBy, value: staffLabel(user) },
      ],
    });

    const label = CARRIERS[carrier].label;
    const url = trackingUrl(carrier, number);

    // スタッフ用の記録
    await addOrderNote(
      orderId,
      `[管理アプリ] ${staffLabel(user)} が発送済みに変更\n${label} 追跡番号: ${number}`,
      false
    );

    // お客様へのお知らせ（WooCommerce からメールが届く）
    if (notify) {
      const lines = [
        "ご注文の商品を発送いたしました。",
        `配送業者：${label}`,
        `追跡番号：${number}`,
      ];
      if (url) lines.push(`配送状況の確認：${url}`);
      await addOrderNote(orderId, lines.join("\n"), true);
    }
  } catch (err) {
    errorMessage = err.message || "発送処理に失敗しました";
  }

  if (errorMessage) done(returnTo, "error", errorMessage);
  done(returnTo, "shipped", String(orderNumber));
}
