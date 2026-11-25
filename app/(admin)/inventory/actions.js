"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin, staffLabel } from "../../../lib/staff";
import { cutoverAll, syncStock } from "../../../lib/stock";

// ECサイトの全商品を「取り寄せ」表示にし、在庫数を管理アプリに取り込む
export async function cutoverAction() {
  const me = await requireAdmin();
  let result = null;
  let errorMessage = "";
  try {
    result = await cutoverAll(staffLabel(me));
  } catch (err) {
    errorMessage = err.message || "切り替えに失敗しました";
  }
  revalidatePath("/inventory");
  revalidatePath("/products");
  revalidatePath("/");
  if (errorMessage) {
    redirect(`/inventory?error=${encodeURIComponent(errorMessage)}`);
  }
  redirect(
    `/inventory?cutover=${result.products}&converted=${result.converted}&seeded=${result.seeded}`
  );
}

// 注文の反映を今すぐ実行する
export async function syncNowAction() {
  await requireAdmin();
  let errorMessage = "";
  let result = null;
  try {
    result = await syncStock({ force: true });
  } catch (err) {
    errorMessage = err.message || "反映に失敗しました";
  }
  revalidatePath("/inventory");
  if (errorMessage) {
    redirect(`/inventory?error=${encodeURIComponent(errorMessage)}`);
  }
  redirect(`/inventory?synced=${result?.applied ?? 0}`);
}
