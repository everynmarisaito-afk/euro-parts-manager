"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "../../../lib/supabase/server";
import {
  updateProduct,
  updateVariation,
} from "../../../lib/woocommerce";
import { PRODUCT_STATUSES } from "../../../lib/format";

async function requireStaff() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data?.user) {
    redirect("/login");
  }
  return data.user;
}

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
  p.set(key, value);
  return `${base}?${p.toString()}`;
}

function parseStock(raw) {
  const s = String(raw ?? "").trim();
  if (s === "") return { ok: false, message: "在庫数を入力してください" };
  const n = Number(s);
  if (!Number.isInteger(n) || n < 0) {
    return { ok: false, message: "在庫数は0以上の整数で入力してください" };
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

// 在庫一覧からの在庫数変更（商品 or バリエーション）
export async function updateStockAction(formData) {
  await requireStaff();
  const productId = String(formData.get("productId") || "");
  const variationId = String(formData.get("variationId") || "");
  const returnTo = safeReturn(formData.get("returnTo"), "/inventory");

  const stock = parseStock(formData.get("stock"));
  if (!productId || !stock.ok) {
    finish(returnTo, stock.message || "商品が指定されていません");
  }

  let errorMessage = "";
  try {
    const fields = { manage_stock: true, stock_quantity: stock.value };
    if (variationId) {
      await updateVariation(productId, variationId, fields);
    } else {
      await updateProduct(productId, fields);
    }
  } catch (err) {
    errorMessage = err.message || "在庫の更新に失敗しました";
  }
  finish(returnTo, errorMessage);
}

// 商品詳細の編集
export async function updateProductAction(productId, formData) {
  await requireStaff();
  const returnTo = `/products/${productId}`;

  const name = String(formData.get("name") || "").trim();
  const sku = String(formData.get("sku") || "").trim();
  const status = String(formData.get("status") || "");
  const manageStock = formData.get("manage_stock") === "on";
  const regular = parsePrice(formData.get("regular_price"), "通常価格");
  const sale = parsePrice(formData.get("sale_price"), "セール価格");

  if (!name) finish(returnTo, "商品名を入力してください");
  if (!PRODUCT_STATUSES[status]) finish(returnTo, "公開状態が正しくありません");
  if (!regular.ok) finish(returnTo, regular.message);
  if (!sale.ok) finish(returnTo, sale.message);
  if (
    sale.value !== "" &&
    regular.value !== "" &&
    Number(sale.value) >= Number(regular.value)
  ) {
    finish(returnTo, "セール価格は通常価格より安くしてください");
  }

  const fields = {
    name,
    sku,
    status,
    manage_stock: manageStock,
  };

  // バリエーション商品は価格をバリエーションごとに持つので送らない
  if (formData.get("type") !== "variable") {
    fields.regular_price = regular.value;
    fields.sale_price = sale.value;
  }

  if (manageStock) {
    const stock = parseStock(formData.get("stock"));
    if (!stock.ok) finish(returnTo, stock.message);
    fields.stock_quantity = stock.value;
  } else {
    const stockStatus = String(formData.get("stock_status") || "instock");
    fields.stock_status = stockStatus;
  }

  let errorMessage = "";
  try {
    await updateProduct(productId, fields);
  } catch (err) {
    errorMessage = err.message || "商品の更新に失敗しました";
  }
  revalidatePath(returnTo);
  finish(returnTo, errorMessage);
}

// 商品詳細のバリエーション行の編集
export async function updateVariationAction(productId, variationId, formData) {
  await requireStaff();
  const returnTo = `/products/${productId}`;

  const regular = parsePrice(formData.get("regular_price"), "通常価格");
  const sale = parsePrice(formData.get("sale_price"), "セール価格");
  const stock = parseStock(formData.get("stock"));
  if (!regular.ok) finish(returnTo, regular.message);
  if (!sale.ok) finish(returnTo, sale.message);
  if (!stock.ok) finish(returnTo, stock.message);

  let errorMessage = "";
  try {
    await updateVariation(productId, variationId, {
      regular_price: regular.value,
      sale_price: sale.value,
      manage_stock: true,
      stock_quantity: stock.value,
    });
  } catch (err) {
    errorMessage = err.message || "バリエーションの更新に失敗しました";
  }
  revalidatePath(returnTo);
  finish(returnTo, errorMessage);
}
