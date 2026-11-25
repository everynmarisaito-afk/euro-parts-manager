// 管理アプリ専用の在庫（Supabase）と、WooCommerceとの連動処理。
// ECサイトは常に「取り寄せ」表示にし、在庫数はここでだけ管理する。

import { createAdminClient } from "./supabase/admin";
import {
  listAll,
  listVariations,
  batchUpdateProducts,
  batchUpdateVariations,
} from "./woocommerce";
import { oemFromProduct, saveOemIndex, getOemMap } from "./oem";

export const LOW_STOCK = 2; // これ以下は「残りわずか」
const SYNC_INTERVAL_MS = 60 * 1000; // 注文の反映は最短1分おき
// 売上にならない注文（これ以外のステータスは、独自ステータスも含めて在庫を減らす）
const NON_SALE_STATUSES = new Set([
  "pending",
  "cancelled",
  "refunded",
  "failed",
  "checkout-draft",
  "draft",
  "trash",
]);

export function stockKey(productId, variationId = 0) {
  return `${Number(productId)}:${Number(variationId) || 0}`;
}

// ---------- 設定 ----------

export async function getSetting(key) {
  const admin = createAdminClient();
  const { data } = await admin.from("app_settings").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}

async function setSetting(key, value) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function getCutover() {
  return getSetting("stock_cutover_at");
}

// ---------- 在庫の読み書き ----------

export async function getStockMap(productIds) {
  const ids = [...new Set(productIds.map(Number))].filter(Boolean);
  if (!ids.length) return {};
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("internal_stock")
    .select("product_id, variation_id, quantity, updated_at, updated_by")
    .in("product_id", ids);
  if (error) throw error;
  return Object.fromEntries(
    (data || []).map((r) => [stockKey(r.product_id, r.variation_id), r])
  );
}

export async function setStock({ productId, variationId = 0, quantity, by, note }) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("adjust_stock", {
    p_product: Number(productId),
    p_variation: Number(variationId) || 0,
    p_change: null,
    p_set: quantity,
    p_reason: "manual",
    p_order: null,
    p_note: note || null,
    p_by: by,
  });
  if (error) throw error;
  return data;
}

export async function getMovements(productId, limit = 30) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("stock_movements")
    .select("id, variation_id, change, quantity_after, reason, order_id, note, created_by, created_at")
    .eq("product_id", Number(productId))
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

// 在庫数で絞り込んだ商品IDの一覧（maxQty 以下）
export async function productIdsWithStockAtMost(maxQty) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("internal_stock")
    .select("product_id")
    .lte("quantity", maxQty)
    .limit(1000);
  if (error) throw error;
  return [...new Set((data || []).map((r) => r.product_id))];
}

export async function countStockAtMost(maxQty) {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("internal_stock")
    .select("product_id", { count: "exact", head: true })
    .lte("quantity", maxQty);
  if (error) throw error;
  return count ?? 0;
}

// ---------- ECサイト側を「取り寄せ」にそろえる ----------

// 商品（とバリエーション）を「在庫管理オフ・取り寄せ」にし、
// まだ在庫データがなければ、WooCommerceの在庫数を初期値として取り込む
async function convertProducts(products, { includeOutOfStock, by }) {
  const admin = createAdminClient();
  const existing = await getStockMap(products.map((p) => p.id));
  const seeds = [];
  const productUpdates = [];
  let converted = 0;

  for (const p of products) {
    const needsFix =
      p.manage_stock === true ||
      p.stock_status === "instock" ||
      (includeOutOfStock && p.stock_status === "outofstock");

    if (p.type === "variable") {
      const variations = await listVariations(p.id);
      const varUpdates = [];
      for (const v of variations) {
        const key = stockKey(p.id, v.id);
        if (!existing[key]) {
          seeds.push({
            product_id: p.id,
            variation_id: v.id,
            quantity: v.manage_stock ? Math.max(Number(v.stock_quantity) || 0, 0) : 0,
          });
        }
        if (
          v.manage_stock === true ||
          v.stock_status === "instock" ||
          (includeOutOfStock && v.stock_status === "outofstock")
        ) {
          varUpdates.push({ id: v.id, manage_stock: false, stock_status: "onbackorder" });
        }
      }
      for (let i = 0; i < varUpdates.length; i += 100) {
        await batchUpdateVariations(p.id, varUpdates.slice(i, i + 100));
      }
      converted += varUpdates.length;
      if (p.manage_stock === true) {
        productUpdates.push({ id: p.id, manage_stock: false });
      }
    } else {
      const key = stockKey(p.id, 0);
      if (!existing[key]) {
        seeds.push({
          product_id: p.id,
          variation_id: 0,
          quantity: p.manage_stock ? Math.max(Number(p.stock_quantity) || 0, 0) : 0,
        });
      }
      if (needsFix) {
        productUpdates.push({ id: p.id, manage_stock: false, stock_status: "onbackorder" });
      }
    }
  }

  for (let i = 0; i < productUpdates.length; i += 100) {
    await batchUpdateProducts(productUpdates.slice(i, i + 100));
  }
  converted += productUpdates.length;

  if (seeds.length) {
    const { error } = await admin
      .from("internal_stock")
      .upsert(
        seeds.map((s) => ({ ...s, updated_by: by })),
        { onConflict: "product_id,variation_id", ignoreDuplicates: true }
      );
    if (error) throw error;
    await admin.from("stock_movements").insert(
      seeds.map((s) => ({
        product_id: s.product_id,
        variation_id: s.variation_id,
        change: s.quantity,
        quantity_after: s.quantity,
        reason: "initial",
        note: "WooCommerceの在庫数から取り込み",
        created_by: by,
      }))
    );
  }

  return { converted, seeded: seeds.length };
}

// 最初の一括切り替え（管理者が実行）
export async function cutoverAll(by) {
  const products = await listAll("/products", { status: "any" }, 20);
  const result = await convertProducts(products, { includeOutOfStock: true, by });
  const now = new Date().toISOString();
  await setSetting("stock_cutover_at", now);
  await setSetting("stock_last_sync", now);
  return { ...result, products: products.length };
}

// ---------- 注文の自動反映 ----------

function lineItemsForStock(order) {
  return (order.line_items || []).map((li) => ({
    product_id: li.product_id,
    variation_id: li.variation_id || 0,
    quantity: Number(li.quantity) || 0,
  }));
}

function gmtDate(s) {
  if (!s) return null;
  return new Date(s.endsWith("Z") ? s : `${s}Z`);
}

// 前回から変わった注文・商品を確認して在庫に反映する。
// 画面を開いたときに呼ぶ（1分以内に実行済みなら何もしない）
export async function syncStock({ force = false } = {}) {
  const cutover = await getCutover();
  if (!cutover) return { skipped: "not_cutover" };

  const last = (await getSetting("stock_last_sync")) || cutover;
  if (!force && Date.now() - new Date(last).getTime() < SYNC_INTERVAL_MS) {
    return { skipped: "recent" };
  }

  const startedAt = new Date().toISOString();
  // 取りこぼし防止に5分重ねて確認する（二重反映はDB側で防ぐ）
  const since = new Date(new Date(last).getTime() - 5 * 60 * 1000).toISOString();
  const cutoverTime = new Date(cutover).getTime();

  const admin = createAdminClient();
  let applied = 0;

  // 1) 注文
  const orders = await listAll(
    "/orders",
    {
      modified_after: since,
      dates_are_gmt: "true",
      orderby: "modified",
      order: "asc",
      _fields: "id,number,status,date_created_gmt,line_items",
    },
    10
  );

  let beforeCutover = 0;
  for (const o of orders) {
    const created = gmtDate(o.date_created_gmt);
    // 切り替え前の注文は在庫に反映しない
    if (!created || created.getTime() < cutoverTime) {
      beforeCutover += 1;
      continue;
    }

    const shouldApply = !NON_SALE_STATUSES.has(o.status);
    const { data, error } = await admin.rpc("apply_order_stock", {
      p_order: o.id,
      p_status: o.status,
      p_apply: shouldApply,
      p_items: lineItemsForStock(o),
      p_note: `注文 #${o.number}（${o.status}）`,
    });
    if (error) throw error;
    if (data) applied += 1;
  }

  // 2) 新しく登録・変更された商品を「取り寄せ」にそろえる
  const products = await listAll(
    "/products",
    { modified_after: since, dates_are_gmt: "true", status: "any" },
    5
  );
  const fix = await convertProducts(products, {
    includeOutOfStock: false,
    by: "システム（新商品）",
  });

  // WordPressで入力された純正品番も検索できるようにする
  const indexed = await getOemMap(products.map((p) => p.id));
  for (const p of products) {
    const nums = oemFromProduct(p);
    const before = (indexed[p.id] || []).join("|");
    if (nums.join("|") !== before) {
      await saveOemIndex(p.id, nums);
    }
  }

  await setSetting("stock_last_sync", startedAt);
  const result = {
    since,
    orders: orders.length,
    beforeCutover,
    applied,
    orderSummary: orders.map((o) => `#${o.number}:${o.status}:${o.date_created_gmt}`).join(" "),
    productsFixed: fix.converted,
    seeded: fix.seeded,
  };
  console.log("[stock-sync]", JSON.stringify(result));
  return result;
}

// 画面表示の邪魔をしないように、失敗してもエラーにしない
export async function syncStockQuietly() {
  try {
    return await syncStock();
  } catch (err) {
    console.error("[stock-sync]", err.message);
    return { error: err.message };
  }
}
