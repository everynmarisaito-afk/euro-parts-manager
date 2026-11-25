import Link from "next/link";
import { listOrders } from "../../../lib/woocommerce";
import {
  formatDateTime,
  formatMoney,
  personName,
  addressLines,
} from "../../../lib/format";
import { CARRIERS, getTracking } from "../../../lib/shipping";
import { markShippedAction } from "./actions";

import { syncStockQuietly } from "../../../lib/stock";

export const dynamic = "force-dynamic";

const TABS = [
  { value: "pending", label: "未発送" },
  { value: "shipped", label: "発送済み" },
];

function buildHref({ tab, page }) {
  const p = new URLSearchParams();
  if (tab && tab !== "pending") p.set("tab", tab);
  if (page && page > 1) p.set("page", String(page));
  const qs = p.toString();
  return qs ? `/shipping?${qs}` : "/shipping";
}

// 配送先が空なら請求先を使う
function shipTo(order) {
  const s = order.shipping || {};
  const hasShipping = s.address_1 || s.last_name || s.first_name;
  const base = hasShipping ? s : order.billing || {};
  return { ...base, phone: base.phone || order.billing?.phone || "" };
}

function daysSince(gmt) {
  if (!gmt) return 0;
  const d = new Date(gmt.endsWith("Z") ? gmt : `${gmt}Z`);
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function OrderItems({ order }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
      {(order.line_items || []).map((li) => (
        <li key={li.id}>
          {li.name} <b>×{li.quantity}</b>
          {li.sku && (
            <span style={{ fontSize: 12, color: "#6b7280" }}>（{li.sku}）</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function Address({ order }) {
  const to = shipTo(order);
  return (
    <div style={{ fontSize: 14, lineHeight: 1.6 }}>
      <b>{personName(to)} 様</b>
      {addressLines(to).map((l, i) => (
        <div key={i}>{l}</div>
      ))}
      {to.phone && <div>TEL {to.phone}</div>}
    </div>
  );
}

export default async function ShippingPage({ searchParams }) {
  const sp = await searchParams;
  await syncStockQuietly();
  const tab = sp?.tab === "shipped" ? "shipped" : "pending";
  const page = Math.max(1, Number(sp?.page) || 1);
  const returnTo = buildHref({ tab, page });

  let orders = [];
  let total = 0;
  let totalPages = 1;
  let error = "";

  try {
    const res = await listOrders({
      page,
      perPage: 20,
      status: tab === "pending" ? "processing" : "completed",
      // 未発送は古い注文から、発送済みは新しい順
      order: tab === "pending" ? "asc" : "desc",
    });
    orders = res.data;
    total = res.total;
    totalPages = Math.max(1, res.totalPages);
  } catch (err) {
    error = err.message;
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">発送管理</h1>
          <p className="page-sub">
            {tab === "pending"
              ? `ステータスが「処理中」の注文（${total}件）を古い順に表示`
              : `ステータスが「完了」の注文（${total}件）`}
          </p>
        </div>
      </div>

      <div className="status-tabs">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={buildHref({ tab: t.value })}
            className={`status-tab${tab === t.value ? " is-active" : ""}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {typeof sp?.shipped === "string" && (
        <div className="alert-success">注文 #{sp.shipped} を発送済みにしました</div>
      )}
      {typeof sp?.error === "string" && <div className="alert-error">{sp.error}</div>}
      {error && <div className="alert-error">{error}</div>}

      {!error && orders.length === 0 && (
        <div className="card placeholder">
          {tab === "pending" ? "未発送の注文はありません 🎉" : "発送済みの注文はありません"}
        </div>
      )}

      {tab === "pending" &&
        orders.map((o) => {
          const days = daysSince(o.date_created_gmt);
          return (
            <div key={o.id} className="card ship-card">
              <div className="ship-head">
                <div>
                  <Link href={`/orders/${o.id}`} className="row-link">
                    注文 #{o.number}
                  </Link>
                  <span style={{ fontSize: 12, color: "#6b7280", marginLeft: 8 }}>
                    {formatDateTime(o.date_created_gmt)}
                  </span>
                  {days >= 3 && (
                    <span
                      className="badge"
                      style={{ marginLeft: 8, color: "#991b1b", background: "#fee2e2" }}
                    >
                      注文から{days}日
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>
                  {o.shipping_lines?.[0]?.method_title || "配送方法未設定"}・
                  {formatMoney(o.total, o.currency)}
                </div>
              </div>

              <div className="grid-2" style={{ marginTop: 12 }}>
                <div>
                  <div className="ship-label">お届け先</div>
                  <Address order={o} />
                </div>
                <div>
                  <div className="ship-label">商品</div>
                  <OrderItems order={o} />
                  {o.customer_note && (
                    <div className="ship-note">備考：{o.customer_note}</div>
                  )}
                </div>
              </div>

              <form action={markShippedAction} className="ship-form">
                <input type="hidden" name="orderId" value={o.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <select name="carrier" className="select" defaultValue="yamato" required>
                  {Object.entries(CARRIERS).map(([k, c]) => (
                    <option key={k} value={k}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <input
                  name="tracking"
                  className="input"
                  placeholder="追跡番号"
                  inputMode="numeric"
                  autoComplete="off"
                  required
                  style={{ flex: 1, minWidth: 160 }}
                />
                <label className="ship-notify">
                  <input type="checkbox" name="notify" defaultChecked />
                  お客様にメールで知らせる
                </label>
                <button type="submit" className="btn btn-primary">
                  発送済みにする
                </button>
              </form>
            </div>
          );
        })}

      {tab === "shipped" && orders.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>注文番号</th>
                  <th>お届け先</th>
                  <th className="hide-sm">商品</th>
                  <th>配送業者・追跡番号</th>
                  <th className="hide-sm">発送日時</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const t = getTracking(o);
                  const to = shipTo(o);
                  return (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/orders/${o.id}`} className="row-link">
                          #{o.number}
                        </Link>
                      </td>
                      <td>{personName(to)}</td>
                      <td className="hide-sm" style={{ fontSize: 13 }}>
                        {o.line_items?.[0]?.name || "-"}
                        {o.line_items?.length > 1 ? ` ほか${o.line_items.length - 1}点` : ""}
                      </td>
                      <td>
                        {t ? (
                          <>
                            <div style={{ fontSize: 12, color: "#6b7280" }}>
                              {t.carrierLabel}
                            </div>
                            {t.url ? (
                              <a href={t.url} target="_blank" rel="noreferrer">
                                {t.number}
                              </a>
                            ) : (
                              t.number
                            )}
                          </>
                        ) : (
                          <span style={{ fontSize: 12, color: "#9ca3af" }}>
                            追跡番号なし
                          </span>
                        )}
                      </td>
                      <td className="hide-sm" style={{ whiteSpace: "nowrap" }}>
                        {t?.shippedAt
                          ? formatDateTime(t.shippedAt)
                          : formatDateTime(o.date_completed_gmt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="pager">
          <Link
            className="btn"
            aria-disabled={page <= 1}
            href={buildHref({ tab, page: page - 1 })}
          >
            ← 前へ
          </Link>
          <span>
            {page} / {totalPages}
          </span>
          <Link
            className="btn"
            aria-disabled={page >= totalPages}
            href={buildHref({ tab, page: page + 1 })}
          >
            次へ →
          </Link>
        </div>
      )}
    </>
  );
}
