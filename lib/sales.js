// 売上集計：期間の計算と集計処理（日本時間で区切る）

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// "YYYY-MM-DD"（日本時間）→ その日の0:00（JST）をUTCのDateで返す
function jstDayStartUtc(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - JST_OFFSET_MS);
}

// UTCのDate → 日本時間の "YYYY-MM-DD"
export function toJstYmd(date) {
  const j = new Date(date.getTime() + JST_OFFSET_MS);
  return j.toISOString().slice(0, 10);
}

function addDays(ymd, n) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function isYmd(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export const PRESETS = {
  today: "今日",
  "7d": "過去7日",
  "30d": "過去30日",
  thisMonth: "今月",
  lastMonth: "先月",
  thisYear: "今年",
};

// 期間（from・to はどちらも日本時間の日付で、to を含む）
export function resolveRange({ preset, from, to }) {
  const today = toJstYmd(new Date());
  const [ty, tm] = today.split("-").map(Number);
  const pad = (n) => String(n).padStart(2, "0");

  if (isYmd(from) && isYmd(to) && !preset) {
    const [a, b] = from <= to ? [from, to] : [to, from];
    return { key: "custom", label: `${a} 〜 ${b}`, from: a, to: b };
  }

  switch (preset) {
    case "today":
      return { key: "today", label: PRESETS.today, from: today, to: today };
    case "7d":
      return { key: "7d", label: PRESETS["7d"], from: addDays(today, -6), to: today };
    case "30d":
      return { key: "30d", label: PRESETS["30d"], from: addDays(today, -29), to: today };
    case "lastMonth": {
      const y = tm === 1 ? ty - 1 : ty;
      const m = tm === 1 ? 12 : tm - 1;
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return {
        key: "lastMonth",
        label: PRESETS.lastMonth,
        from: `${y}-${pad(m)}-01`,
        to: `${y}-${pad(m)}-${pad(last)}`,
      };
    }
    case "thisYear":
      return { key: "thisYear", label: PRESETS.thisYear, from: `${ty}-01-01`, to: today };
    case "thisMonth":
    default:
      return {
        key: "thisMonth",
        label: PRESETS.thisMonth,
        from: `${ty}-${pad(tm)}-01`,
        to: today,
      };
  }
}

export function rangeToUtc(range) {
  return {
    afterUtc: jstDayStartUtc(range.from).toISOString(),
    // to の翌日0:00（JST）の直前まで
    beforeUtc: new Date(jstDayStartUtc(addDays(range.to, 1)).getTime() - 1).toISOString(),
  };
}

function orderDate(o) {
  const g = o.date_created_gmt || "";
  return new Date(g.endsWith("Z") ? g : `${g}Z`);
}

function refundTotal(o) {
  // refunds[].total はマイナスの金額
  return (o.refunds || []).reduce((s, r) => s + Math.abs(Number(r.total) || 0), 0);
}

export function aggregate(orders, range) {
  const days = [];
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) days.push(d);
  const monthly = days.length > 62;

  const buckets = new Map();
  for (const d of days) {
    const k = monthly ? d.slice(0, 7) : d;
    if (!buckets.has(k)) buckets.set(k, { key: k, sales: 0, orders: 0 });
  }

  const products = new Map();
  const payments = new Map();
  let gross = 0;
  let refunds = 0;
  let items = 0;
  let shipping = 0;
  let discount = 0;

  for (const o of orders) {
    const total = Number(o.total) || 0;
    const refund = refundTotal(o);
    gross += total;
    refunds += refund;
    shipping += Number(o.shipping_total) || 0;
    discount += Number(o.discount_total) || 0;

    const ymd = toJstYmd(orderDate(o));
    const k = monthly ? ymd.slice(0, 7) : ymd;
    const b = buckets.get(k);
    if (b) {
      b.sales += total - refund;
      b.orders += 1;
    }

    const pm = o.payment_method_title || "不明";
    const p = payments.get(pm) || { name: pm, sales: 0, orders: 0 };
    p.sales += total - refund;
    p.orders += 1;
    payments.set(pm, p);

    for (const li of o.line_items || []) {
      const qty = Number(li.quantity) || 0;
      items += qty;
      const key = li.variation_id || li.product_id || li.name;
      const prod = products.get(key) || {
        name: li.name,
        sku: li.sku,
        productId: li.product_id,
        qty: 0,
        sales: 0,
      };
      prod.qty += qty;
      prod.sales += Number(li.total) || 0;
      products.set(key, prod);
    }
  }

  const net = gross - refunds;
  return {
    monthly,
    net,
    gross,
    refunds,
    shipping,
    discount,
    orderCount: orders.length,
    items,
    average: orders.length ? net / orders.length : 0,
    series: [...buckets.values()],
    topProducts: [...products.values()].sort((a, b) => b.sales - a.sales).slice(0, 10),
    payments: [...payments.values()].sort((a, b) => b.sales - a.sales),
  };
}

// 比較用：同じ長さの直前の期間
export function previousRange(range) {
  const [fy, fm, fd] = range.from.split("-").map(Number);
  const [ty, tm, td] = range.to.split("-").map(Number);
  const len = Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000) + 1;
  return { from: addDays(range.from, -len), to: addDays(range.from, -1) };
}
