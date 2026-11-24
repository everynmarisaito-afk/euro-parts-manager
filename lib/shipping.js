// 発送・追跡番号まわりの共通処理
// 追跡情報は WooCommerce の注文メタデータに保存する（Supabaseには持たない）

export const META_KEYS = {
  carrier: "epm_tracking_carrier",
  number: "epm_tracking_number",
  shippedAt: "epm_shipped_at",
  shippedBy: "epm_shipped_by",
};

export const CARRIERS = {
  yamato: {
    label: "ヤマト運輸",
    url: (n) =>
      `https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?number00=1&number01=${encodeURIComponent(n)}`,
  },
  sagawa: {
    label: "佐川急便",
    url: (n) =>
      `https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do?okurijoNo=${encodeURIComponent(n)}`,
  },
  japanpost: {
    label: "日本郵便",
    url: (n) =>
      `https://trackings.post.japanpost.jp/services/srv/search/direct?reqCodeNo1=${encodeURIComponent(
        n
      )}&locale=ja`,
  },
  seino: {
    label: "西濃運輸",
    url: (n) =>
      `https://track.seino.co.jp/cgi-bin/gnpquery.pgm?GNPNO1=${encodeURIComponent(n)}`,
  },
  other: { label: "その他", url: () => "" },
};

export function carrierLabel(key) {
  return CARRIERS[key]?.label || key || "-";
}

export function trackingUrl(carrier, number) {
  if (!number) return "";
  return CARRIERS[carrier]?.url(number) || "";
}

function metaValue(order, key) {
  const m = (order?.meta_data || []).find((x) => x.key === key);
  return m ? String(m.value ?? "") : "";
}

export function getTracking(order) {
  const carrier = metaValue(order, META_KEYS.carrier);
  const number = metaValue(order, META_KEYS.number);
  if (!number && !carrier) return null;
  return {
    carrier,
    carrierLabel: carrierLabel(carrier),
    number,
    url: trackingUrl(carrier, number),
    shippedAt: metaValue(order, META_KEYS.shippedAt),
    shippedBy: metaValue(order, META_KEYS.shippedBy),
  };
}
