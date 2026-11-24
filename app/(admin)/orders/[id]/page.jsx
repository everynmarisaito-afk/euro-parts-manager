import Link from "next/link";
import { getOrder, listOrderNotes } from "../../../../lib/woocommerce";
import {
  ORDER_STATUSES,
  statusInfo,
  formatDateTime,
  formatMoney,
  personName,
  addressLines,
} from "../../../../lib/format";
import { updateOrderStatus, addStaffNote } from "../actions";
import { getTracking } from "../../../../lib/shipping";

export const dynamic = "force-dynamic";

function Address({ person }) {
  const lines = addressLines(person);
  return (
    <dl className="dl">
      <dt>氏名</dt>
      <dd>{personName(person)}</dd>
      <dt>住所</dt>
      <dd>
        {lines.length
          ? lines.map((l, i) => <div key={i}>{l}</div>)
          : "-"}
      </dd>
      {person?.phone !== undefined && (
        <>
          <dt>電話番号</dt>
          <dd>{person.phone || "-"}</dd>
        </>
      )}
      {person?.email !== undefined && (
        <>
          <dt>メール</dt>
          <dd>{person.email || "-"}</dd>
        </>
      )}
    </dl>
  );
}

export default async function OrderDetailPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;

  let order = null;
  let notes = [];
  let error = "";

  try {
    [order, notes] = await Promise.all([getOrder(id), listOrderNotes(id)]);
  } catch (err) {
    error = err.message;
  }

  if (!order) {
    return (
      <>
        <Link href="/orders" className="btn" style={{ marginBottom: 16 }}>
          ← 注文一覧へ
        </Link>
        <div className="alert-error" style={{ marginTop: 16 }}>
          {error || "注文が見つかりませんでした"}
        </div>
      </>
    );
  }

  const s = statusInfo(order.status);
  const tracking = getTracking(order);
  const updateAction = updateOrderStatus.bind(null, order.id);
  const noteAction = addStaffNote.bind(null, order.id);
  const shippingTotal = Number(order.shipping_total) || 0;
  const discountTotal = Number(order.discount_total) || 0;

  return (
    <>
      <div className="page-header">
        <div>
          <Link href="/orders" style={{ fontSize: 13, color: "#6b7280" }}>
            ← 注文一覧へ
          </Link>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            注文 #{order.number}{" "}
            <span
              className="badge"
              style={{ color: s.color, background: s.bg, verticalAlign: "middle" }}
            >
              {s.label}
            </span>
          </h1>
          <p className="page-sub">
            注文日時 {formatDateTime(order.date_created_gmt)}
          </p>
        </div>
      </div>

      {sp?.updated && (
        <div className="alert-success">ステータスを更新しました</div>
      )}
      {sp?.noted && <div className="alert-success">メモを追加しました</div>}
      {typeof sp?.error === "string" && (
        <div className="alert-error">{sp.error}</div>
      )}

      {tracking && (
        <div className="card">
          <h2 className="card-title">発送情報</h2>
          <dl className="dl">
            <dt>配送業者</dt>
            <dd>{tracking.carrierLabel}</dd>
            <dt>追跡番号</dt>
            <dd>
              {tracking.url ? (
                <a href={tracking.url} target="_blank" rel="noreferrer">
                  {tracking.number}
                </a>
              ) : (
                tracking.number || "-"
              )}
            </dd>
            <dt>発送日時</dt>
            <dd>{tracking.shippedAt ? formatDateTime(tracking.shippedAt) : "-"}</dd>
            <dt>担当</dt>
            <dd>{tracking.shippedBy || "-"}</dd>
          </dl>
        </div>
      )}

      {order.status === "processing" && !tracking && (
        <div className="card" style={{ background: "#eff6ff", borderColor: "#bfdbfe" }}>
          <div style={{ fontSize: 14 }}>
            この注文は未発送です。追跡番号の登録は{" "}
            <Link href="/shipping">発送管理</Link> から行えます。
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="card-title">ステータス変更</h2>
        <form
          action={updateAction}
          style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}
        >
          <select name="status" defaultValue={order.status} className="select">
            {Object.entries(ORDER_STATUSES)
              .filter(([v]) => v !== "checkout-draft")
              .map(([value, info]) => (
                <option key={value} value={value}>
                  {info.label}
                </option>
              ))}
          </select>
          <input
            name="note"
            className="input"
            placeholder="メモ（任意）"
            style={{ flex: 1, minWidth: 180 }}
          />
          <button type="submit" className="btn btn-primary">
            更新
          </button>
        </form>
        <p style={{ fontSize: 12, color: "#6b7280", margin: "8px 0 0" }}>
          「完了」などに変更すると、WooCommerce の設定によってはお客様にメールが送信されます。
        </p>
      </div>

      <div className="card">
        <h2 className="card-title">注文商品</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>商品</th>
                <th className="hide-sm">SKU</th>
                <th className="num">単価</th>
                <th className="num">数量</th>
                <th className="num">小計</th>
              </tr>
            </thead>
            <tbody>
              {(order.line_items || []).map((li) => (
                <tr key={li.id}>
                  <td>
                    {li.name}
                    {(li.meta_data || [])
                      .filter((m) => m.display_key && !String(m.key).startsWith("_"))
                      .map((m) => (
                        <div key={m.id} style={{ fontSize: 12, color: "#6b7280" }}>
                          {m.display_key}: {String(m.display_value ?? m.value)}
                        </div>
                      ))}
                  </td>
                  <td className="hide-sm">{li.sku || "-"}</td>
                  <td className="num">{formatMoney(li.price, order.currency)}</td>
                  <td className="num">{li.quantity}</td>
                  <td className="num">{formatMoney(li.total, order.currency)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {discountTotal > 0 && (
                <tr>
                  <td colSpan={4} className="num">割引</td>
                  <td className="num">
                    -{formatMoney(order.discount_total, order.currency)}
                  </td>
                </tr>
              )}
              <tr>
                <td colSpan={4} className="num">
                  送料
                  {order.shipping_lines?.[0]?.method_title
                    ? `（${order.shipping_lines[0].method_title}）`
                    : ""}
                </td>
                <td className="num">
                  {formatMoney(shippingTotal, order.currency)}
                </td>
              </tr>
              <tr>
                <td colSpan={4} className="num" style={{ fontWeight: 700 }}>
                  合計
                </td>
                <td className="num" style={{ fontWeight: 700 }}>
                  {formatMoney(order.total, order.currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h2 className="card-title">請求先</h2>
          <Address person={order.billing} />
        </div>
        <div className="card">
          <h2 className="card-title">配送先</h2>
          <Address person={order.shipping} />
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h2 className="card-title">決済</h2>
          <dl className="dl">
            <dt>支払い方法</dt>
            <dd>{order.payment_method_title || "-"}</dd>
            <dt>支払日時</dt>
            <dd>
              {order.date_paid_gmt ? formatDateTime(order.date_paid_gmt) : "未払い"}
            </dd>
            <dt>取引ID</dt>
            <dd>{order.transaction_id || "-"}</dd>
          </dl>
          {order.customer_note && (
            <>
              <h3 className="card-title" style={{ marginTop: 16 }}>
                お客様からの備考
              </h3>
              <p style={{ fontSize: 14, whiteSpace: "pre-wrap", margin: 0 }}>
                {order.customer_note}
              </p>
            </>
          )}
        </div>

        <div className="card">
          <h2 className="card-title">注文メモ</h2>
          <form action={noteAction} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              name="note"
              className="input"
              placeholder="スタッフ用メモを追加"
              style={{ flex: 1 }}
              required
            />
            <button type="submit" className="btn">
              追加
            </button>
          </form>
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {notes.length === 0 && (
              <p style={{ fontSize: 13, color: "#6b7280" }}>メモはありません</p>
            )}
            {notes.map((n) => (
              <div
                key={n.id}
                style={{
                  padding: "8px 0",
                  borderBottom: "1px solid #f3f4f6",
                  fontSize: 13,
                }}
              >
                <div style={{ whiteSpace: "pre-wrap" }}>
                  {n.note.replace(/<[^>]+>/g, "")}
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                  {formatDateTime(n.date_created_gmt)}
                  {n.customer_note ? "・お客様に送信済み" : ""}
                  {n.author && n.author !== "system" ? `・${n.author}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
