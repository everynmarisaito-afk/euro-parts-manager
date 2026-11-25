"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff, staffLabel } from "../../../lib/staff";
import { updateProduct, updateVariation } from "../../../lib/woocommerce";
import { PRODUCT_STATUSES } from "../../../lib/format";
import { setStock } from "../../../lib/stock";

// ECサイトでの表示（在庫数は出さず、「取り寄せ」か「販売停止」だけ）
const SITE_STATUSES = new Set(["onbackorder", "outofstock"]);

// 戻り先は管理画面内のパスだけ許可する
function safeReturn(raw, fallback) {
  const s = String(raw || "");
  if (/^\/(inventory|products)(\/|\?|$)/.test(s)) return s;
  return fallback;
}

function withParam(path, key, value) {
  const [base, qs = ""] = path.split("?");
  const p = new URLSearchParams(qs);
  p.delete("updated");
  p.delete("error");
  p.delete("cutover");
  p.delete("synced");
  p.set(key, value);
  return `${base}?${p.toString()}`;
}

function parseStock(raw) {
  const s = String(raw ?? "").trim();
  if (s === "") return { ok: false, message: "在庫数を入力してください" };
  const n = Number(s);
  if (!Number.isInteger(n) || Math.abs(n) > 999999) {
    return { ok: false, message: "在庫数は整数で入力してください" };
  }
  return { ok: true, value: n };
}

function parsePrice(raw, label) {
  const s = String(raw ?? "").trim().replace(/,/g, "");
  if (s === "") return { ok: true, value: "" };
  const n = Number(s);
  if (Number.isNaN(n) || n < 0) {
    return { ok: false, message: `${label}は0以上の数値で入力してください` };
  }
  return { ok: true, value: String(n) };
}

function finish(returnTo, errorMessage) {
  revalidatePath("/inventory");
  revalidatePath("/products");
  revalidatePath("/");
  if (errorMessage) {
    redirect(withParam(returnTo, "error", errorMessage));
  }
  redirect(withParam(returnTo, "updated", "1"));
}

// 在庫一覧からの在庫数変更（社内在庫。ECサイトには影響しない）
export async function updateStockAction(formData) {
  const me = await requireStaff();
  const productId = String(formData.get("productId") || "");
  const variationId = String(formData.get("variationId") || "");
  const returnTo = safeReturn(formData.get("returnTo"), "/inventory");

  const stock = parseStock(formData.get("stock"));
  if (!productId || !stock.ok) {
    finish(returnTo, stock.message || "商品が指定されていません");
  }

  let errorMessage = "";
  try {
    await setStock({
      productId,
      variationId: variationId || 0,
      quantity: stock.value,
      by: staffLabel(me),
    });
  } catch (err) {
    errorMessage = err.message || "在庫の更新に失敗しました";
  }
  finish(returnTo, errorMessage);
}

// 商品詳細の編集
export async function updateProductAction(productId, formData) {
  const me = await requireStaff();
  const returnTo = `/products/${productId}`;

  const name = String(formData.get("name") || "").trim();
  const sku = String(formData.get("sku") || "").trim();
  const status = String(formData.get("status") || "");
  const siteStatus = String(formData.get("site_status") || "onbackorder");
  const isVariable = formData.get("type") === "variable";
  const regular = parsePrice(formData.get("regular_price"), "通常価格");
  const sale = parsePrice(formData.get("sale_price"), "セール価格");

  if (!name) finish(returnTo, "商品名を入力してください");
  if (!PRODUCT_STATUSES[status]) finish(returnTo, "公開状態が正しくありません");
  if (!SITE_STATUSES.has(siteStatus)) finish(returnTo, "ECサイトの表示が正しくありません");
  if (!regular.ok) finish(returnTo, regular.message);
  if (!sale.ok) finish(returnTo, sale.message);
  if (
    sale.value !== "" &&
    regular.value !== "" &&
    Number(sale.value) >= Number(regular.value)
  ) {
    finish(returnTo, "セール価格は通常価格より安くしてください");
  }

  let stock = null;
  if (!isVariable) {
    stock = parseStock(formData.get("stock"));
    if (!stock.ok) finish(returnTo, stock.message);
  }

  const fields = {
    name,
    sku,
    status,
    // 在庫数はECサイトに出さない
    manage_stock: false,
    stock_status: siteStatus,
  };
  if (!isVariable) {
    fields.regular_price = regular.value;
    fields.sale_price = sale.value;
  }

  let errorMessage = "";
  try {
    await updateProduct(productId, fields);
    if (stock) {
      await setStock({ productId, quantity: stock.value, by: staffLabel(me) });
    }
  } catch (err) {
    errorMessage = err.message || "商品の更新に失敗しました";
  }
  revalidatePath(returnTo);
  finish(returnTo, errorMessage);
}

// 商品詳細のバリエーション行の編集
export async function updateVariationAction(productId, variationId, formData) {
  const me = await requireStaff();
  const returnTo = `/products/${productId}`;

  const regular = parsePrice(formData.get("regular_price"), "通常価格");
  const sale = parsePrice(formData.get("sale_price"), "セール価格");
  const stock = parseStock(formData.get("stock"));
  const siteStatus = String(formData.get("site_status") || "onbackorder");
  if (!regular.ok) finish(returnTo, regular.message);
  if (!sale.ok) finish(returnTo, sale.message);
  if (!stock.ok) finish(returnTo, stock.message);
  if (!SITE_STATUSES.has(siteStatus)) finish(returnTo, "ECサイトの表示が正しくありません");

  let errorMessage = "";
  try {
    await updateVariation(productId, variationId, {
      regular_price: regular.value,
      sale_price: sale.value,
      manage_stock: false,
      stock_status: siteStatus,
    });
    await setStock({
      productId,
      variationId,
      quantity: stock.value,
      by: staffLabel(me),
    });
  } catch (err) {
    errorMessage = err.message || "バリエーションの更新に失敗しました";
  }
  revalidatePath(returnTo);
  finish(returnTo, errorMessage);
}
