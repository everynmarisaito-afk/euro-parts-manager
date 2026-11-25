"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff, staffLabel } from "../../../lib/staff";
import { updateProduct, updateVariation, createProduct, getProduct } from "../../../lib/woocommerce";
import { parseOemInput, mergeOemAttribute, saveOemIndex } from "../../../lib/oem";
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

  // 純正品番（フォームに欄があるときだけ更新）
  const hasOem = formData.has("oem_numbers");
  const oemNumbers = hasOem ? parseOemInput(formData.get("oem_numbers")) : [];

  let errorMessage = "";
  try {
    if (hasOem) {
      const current = await getProduct(productId);
      fields.attributes = mergeOemAttribute(current.attributes, oemNumbers);
    }
    await updateProduct(productId, fields);
    if (hasOem) {
      await saveOemIndex(productId, oemNumbers);
    }
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

// 改行をHTMLの段落にする（WooCommerceの説明欄用）
function textToHtml(text) {
  const esc = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return String(text || "")
    .trim()
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br />")}</p>`)
    .join("\n");
}

// 商品の新規登録
export async function createProductAction(formData) {
  const me = await requireStaff();
  const back = (msg) => redirect(`/products/new?error=${encodeURIComponent(msg)}`);

  const name = String(formData.get("name") || "").trim();
  const sku = String(formData.get("sku") || "").trim();
  const status = String(formData.get("status") || "draft");
  const siteStatus = String(formData.get("site_status") || "onbackorder");
  const regular = parsePrice(formData.get("regular_price"), "通常価格");
  const sale = parsePrice(formData.get("sale_price"), "セール価格");
  const stockRaw = String(formData.get("stock") ?? "").trim();
  const stock = stockRaw === "" ? { ok: true, value: 0 } : parseStock(stockRaw);
  const categories = formData
    .getAll("categories")
    .map((v) => Number(v))
    .filter(Boolean);
  const supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host;
  const images = formData
    .getAll("image_urls")
    .map(String)
    // 自分たちのストレージの画像だけ受け付ける
    .filter((u) => {
      try {
        return new URL(u).host === supabaseHost;
      } catch {
        return false;
      }
    });

  if (!name) back("商品名を入力してください");
  if (!PRODUCT_STATUSES[status]) back("公開状態が正しくありません");
  if (!SITE_STATUSES.has(siteStatus)) back("ECサイトの表示が正しくありません");
  if (!regular.ok) back(regular.message);
  if (regular.value === "") back("通常価格を入力してください");
  if (!sale.ok) back(sale.message);
  if (sale.value !== "" && Number(sale.value) >= Number(regular.value)) {
    back("セール価格は通常価格より安くしてください");
  }
  if (!stock.ok) back(stock.message);
  const oemNumbers = parseOemInput(formData.get("oem_numbers"));

  let product = null;
  let errorMessage = "";
  try {
    product = await createProduct({
      name,
      type: "simple",
      status,
      sku: sku || undefined,
      regular_price: regular.value,
      sale_price: sale.value,
      manage_stock: false,
      stock_status: siteStatus,
      short_description: textToHtml(formData.get("short_description")),
      description: textToHtml(formData.get("description")),
      categories: categories.map((id) => ({ id })),
      images: images.map((src) => ({ src })),
      attributes: mergeOemAttribute([], oemNumbers),
    });
    await saveOemIndex(product.id, oemNumbers);
    await setStock({
      productId: product.id,
      quantity: stock.value,
      by: staffLabel(me),
      note: "商品登録時の在庫",
    });
  } catch (err) {
    errorMessage = err.message || "商品の登録に失敗しました";
    if (/sku/i.test(errorMessage) && /duplicate|already|重複|既に|すでに/i.test(errorMessage)) {
      errorMessage = "このSKUはすでに別の商品で使われています";
    }
  }

  if (errorMessage) back(errorMessage);
  revalidatePath("/products");
  revalidatePath("/inventory");
  redirect(`/products/${product.id}?created=1`);
}
