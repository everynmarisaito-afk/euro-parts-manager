// 表示用の共通フォーマット

export const ORDER_STATUSES = {
  pending: { label: "支払い待ち", color: "#92400e", bg: "#fef3c7" },
  processing: { label: "処理中", color: "#1e40af", bg: "#dbeafe" },
  "on-hold": { label: "保留中", color: "#6b21a8", bg: "#f3e8ff" },
  completed: { label: "完了", color: "#166534", bg: "#dcfce7" },
  cancelled: { label: "キャンセル", color: "#4b5563", bg: "#e5e7eb" },
  refunded: { label: "返金済み", color: "#4b5563", bg: "#e5e7eb" },
  failed: { label: "失敗", color: "#991b1b", bg: "#fee2e2" },
  "checkout-draft": { label: "下書き", color: "#4b5563", bg: "#f3f4f6" },
};

export function statusInfo(status) {
  return ORDER_STATUSES[status] || { label: status, color: "#374151", bg: "#f3f4f6" };
}

export function formatDateTime(gmt) {
  if (!gmt) return "-";
  // WooCommerce の *_gmt はタイムゾーン表記なしのUTC
  const d = new Date(gmt.endsWith("Z") ? gmt : `${gmt}Z`);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatMoney(amount, currency = "JPY") {
  const n = Number(amount);
  if (Number.isNaN(n)) return String(amount ?? "-");
  if (currency === "JPY") {
    return `¥${Math.round(n).toLocaleString("ja-JP")}`;
  }
  return n.toLocaleString("ja-JP", { style: "currency", currency });
}

export function personName(p) {
  if (!p) return "-";
  const name = [p.last_name, p.first_name].filter(Boolean).join(" ");
  return name || p.company || "-";
}

// WooCommerce は都道府県を JP01〜JP47 のコードで保存する
const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

export function prefectureName(state) {
  const m = /^JP(\d{2})$/.exec(state || "");
  if (m) return PREFECTURES[Number(m[1]) - 1] || state;
  return state || "";
}

export function addressLines(p) {
  if (!p) return [];
  return [
    p.postcode ? `〒${p.postcode}` : "",
    [prefectureName(p.state), p.city, p.address_1, p.address_2]
      .filter(Boolean)
      .join(" "),
    p.company || "",
  ].filter(Boolean);
}
