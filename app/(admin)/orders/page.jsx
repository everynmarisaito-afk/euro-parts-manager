import Link from "next/link";
import { listOrders } from "../../../lib/woocommerce";
import {
  ORDER_STATUSES,
  statusInfo,
  formatDateTime,
  formatMoney,
  personName,
} from "../../../lib/format";

import { syncStockQuietly } from "../../../lib/stock";

export const dynamic = "force-dynamic";

const TABS = [
  { value: "", label: "すべて" },
  { value: "processing", label: ORDER_STATUSES.processing.label },
  { value: "on-hold", label: ORDER_STATUSES["on-hold"].label },
  { value: "pending", label: ORDER_STATUSES.pending.label },
  { value: "completed", label: ORDER_STATUSES.completed.label },
  { value: "cancelled", label: ORDER_STATUSES.cancelled.label },
  { value: "refunded", label: ORDER_STATUSES.refunded.label },
];

function buildHref({ status, search, page }) {
  const p = new URLSearchParams();
  if (status) p.set("status", status);
  if (search) p.set("q", search);
  if (page && page > 1) p.set("page", String(page));
  const qs = p.toString();
  return qs ? `/orders?${qs}` : "/orders";
}

export default async function OrdersPage({ searchParams }) {
  const sp = await searchParams;
  await syncStockQuietly();
  const status = typeof sp?.status === "string" ? sp.status : "";
  const search = typeof sp?.q === "string" ? sp.q.trim() : "";
  const page = Math.max(1, Number(sp?.page) || 1);

  let orders = [];
  let total = 0;
  let totalPages = 1;
  let error = "";

  try {
    const res = await listOrders({ page, perPage: 20, status, search });
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
          <h1 className="page-title">注文管理</h1>
          <p className="page-sub">WooCommerce の注文一覧（{total}件）</p>
        </div>
        <form method="get" action="/orders" style={{ display: "flex", gap: 8 }}>
          {status && <input type="hidden" name="status" value={status} />}
          <input
            className="input"
            type="search"
            name="q"
            defaultValue={search}
            placeholder="注文番号・氏名・メールで検索"
            style={{ width: 240 }}
          />
          <button type="submit" className="btn">
            検索
          </button>
        </form>
      </div>

      <div className="status-tabs">
        {TABS.map((t) => (
          <Link
            key={t.value || "all"}
            href={buildHref({ status: t.value, search })}
            className={`status-tab${status === t.value ? " is-active" : ""}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {error && <div className="alert-error">{error}</div>}

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>注文番号</th>
                <th>注文日時</th>
                <th>お客様</th>
                <th className="hide-sm">商品</th>
                <th className="num">合計</th>
                <th className="hide-sm">支払い方法</th>
                <th>ステータス</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const s = statusInfo(o.status);
                const itemCount = (o.line_items || []).reduce(
                  (sum, li) => sum + (Number(li.quantity) || 0),
                  0
                );
                const firstItem = o.line_items?.[0]?.name;
                return (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/orders/${o.id}`} className="row-link">
                        #{o.number}
                      </Link>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {formatDateTime(o.date_created_gmt)}
                    </td>
                    <td>
                      {personName(o.billing)}
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        {o.billing?.email}
                      </div>
                    </td>
                    <td className="hide-sm">
                      {firstItem || "-"}
                      {o.line_items?.length > 1 && (
                        <span style={{ color: "#6b7280" }}>
                          {" "}
                          ほか{o.line_items.length - 1}点
                        </span>
                      )}
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        計{itemCount}個
                      </div>
                    </td>
                    <td className="num">{formatMoney(o.total, o.currency)}</td>
                    <td className="hide-sm">{o.payment_method_title || "-"}</td>
                    <td>
                      <span
                        className="badge"
                        style={{ color: s.color, background: s.bg }}
                      >
                        {s.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!error && orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="placeholder">
                    該当する注文はありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="pager">
          <Link
            className="btn"
            aria-disabled={page <= 1}
            href={buildHref({ status, search, page: page - 1 })}
          >
            ← 前へ
          </Link>
          <span>
            {page} / {totalPages}
          </span>
          <Link
            className="btn"
            aria-disabled={page >= totalPages}
            href={buildHref({ status, search, page: page + 1 })}
          >
            次へ →
          </Link>
        </div>
      )}
    </>
  );
}
