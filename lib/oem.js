// 純正品番（OEM品番）
// ・ECサイトには WooCommerce の商品属性「純正品番」として表示する
// ・管理アプリの検索用に Supabase にも保存する

import { createAdminClient } from "./supabase/admin";

export const OEM_ATTRIBUTE_NAME = "純正品番";

// 検索用の形：全角→半角、英大文字、空白・ハイフン・ドットなどを除く
export function normalizeOem(s) {
  return String(s || "")
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");
}

// 入力（改行・カンマ・読点・スラッシュ区切り）を品番の配列にする
export function parseOemInput(raw) {
  const seen = new Set();
  const out = [];
  for (const part of String(raw || "").split(/[\n,，、/／|]+/)) {
    const v = part.normalize("NFKC").trim().replace(/\s+/g, " ");
    const n = normalizeOem(v);
    if (!v || !n || seen.has(n)) continue;
    seen.add(n);
    out.push(v);
  }
  return out.slice(0, 30);
}

// WooCommerceの商品から純正品番を取り出す
export function oemFromProduct(product) {
  const attr = (product?.attributes || []).find(
    (a) => !a.id && a.name === OEM_ATTRIBUTE_NAME
  );
  return attr?.options || [];
}

// 他の属性（バリエーション用など）を残したまま、純正品番だけ差し替える
export function mergeOemAttribute(attributes, numbers) {
  const others = (attributes || [])
    .filter((a) => !(!a.id && a.name === OEM_ATTRIBUTE_NAME))
    .map((a) => ({
      id: a.id,
      name: a.name,
      position: a.position,
      visible: a.visible,
      variation: a.variation,
      options: a.options,
    }));
  if (!numbers.length) return others;
  return [
    ...others,
    {
      name: OEM_ATTRIBUTE_NAME,
      position: others.length,
      visible: true,
      variation: false,
      options: numbers,
    },
  ];
}

export async function saveOemIndex(productId, numbers) {
  const admin = createAdminClient();
  const pid = Number(productId);
  const { error: delErr } = await admin
    .from("product_oem_numbers")
    .delete()
    .eq("product_id", pid);
  if (delErr) throw delErr;
  if (!numbers.length) return;
  const { error } = await admin.from("product_oem_numbers").insert(
    numbers.map((n) => ({ product_id: pid, oem_number: n, normalized: normalizeOem(n) }))
  );
  if (error) throw error;
}

export async function getOemMap(productIds) {
  const ids = [...new Set(productIds.map(Number))].filter(Boolean);
  if (!ids.length) return {};
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("product_oem_numbers")
    .select("product_id, oem_number")
    .in("product_id", ids)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const map = {};
  for (const r of data || []) (map[r.product_id] ||= []).push(r.oem_number);
  return map;
}

// 純正品番で検索（前方一致・部分一致）。4文字未満は誤ヒットが多いので対象外
export async function searchProductIdsByOem(query) {
  const n = normalizeOem(query);
  if (n.length < 4) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("product_oem_numbers")
    .select("product_id")
    .ilike("normalized", `%${n}%`)
    .limit(200);
  if (error) throw error;
  return [...new Set((data || []).map((r) => r.product_id))];
}
