import Link from "next/link";
import { fetchOrdersForSales } from "../../../lib/woocommerce";
import {
  PRESETS,
  resolveRange,
  rangeToUtc,
  aggregate,
  previousRange,
} from "../../../lib/sales";
import { formatMoney } from "../../../lib/format";

export const dynamic = "force-dynamic";

function Change({ now, before }) {
  if (!before) {
    return <span className="kpi-change">前の期間：データなし</span>;
  }
  const pct = ((now - before) / before) * 100;
  const up = pct >= 0;
  return (
    <span className="kpi-change" style={{ color: up ? "#166534" : "#991b1b" }}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
      <span style={{ color: "#6b7280" }}> 前の期間比</span>
    </span>
  );
}

function Kpi({ label, value, sub }) {
  return (
    <div className="card kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub}
    </div>
  );
}

function bucketLabel(key, monthly) {
  if (monthly) {
    const [y, m] = key.split("-");
    return `${y}年${Number(m)}月`;
  }
  const [, m, d] = key.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function SalesChart({ series, monthly }) {
  const max = Math.max(...series.map((s) => s.sales), 1);
  // ラベルは多すぎると重なるので間引く
  const step = Math.ceil(series.length / 12);
  return (
    <div className="chart" role="img" aria-label="期間ごとの売上の棒グラフ">
      <div className="chart-bars">
        {series.map((s, i) => {
          const h = Math.max((s.sales / max) * 100, s.sales > 0 ? 1 : 0);
          return (
            <div
              key={s.key}
              className="chart-col"
              title={`${bucketLabel(s.key, monthly)}　${formatMoney(s.sales)}（${s.orders}件）`}
            >
              <div className="chart-bar" style={{ height: `${h}%` }} />
              <div className="chart-x">
                {i % step === 0 ? bucketLabel(s.key, monthly) : ""}
              </div>
            </div>
          );
        })}
      </div>
      <div className="chart-max">最大 {formatMoney(max)}</div>
    </div>
  );
}

export default async function SalesPage({ searchParams }) {
  const sp = await searchParams;
  const range = resolveRange({
    preset: typeof sp?.p === "string" ? sp.p : sp?.from ? "" : "thisMonth",
    from: sp?.from,
    to: sp?.to,
  });
  const prev = previousRange(range);

  let data = null;
  let prevData = null;
  let truncated = false;
  let error = "";

  try {
    const [cur, before] = await Promise.all([
      fetchOrdersForSales(rangeToUtc(range)),
      fetchOrdersForSales({ ...rangeToUtc(prev), maxPages: 20 }),
    ]);
    data = aggregate(cur.orders, range);
    prevData = aggregate(before.orders, prev);
    truncated = cur.truncated;
  } catch (err) {
    error = err.message;
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">売上集計</h1>
          <p className="page-sub">
            {range.from} 〜 {range.to}（日本時間）・対象：処理中／保留中／発送済み／完了の注文（返金を差し引き）
          </p>
        </div>
      </div>

      <div className="status-tabs" style={{ alignItems: "center" }}>
        {Object.entries(PRESETS).map(([k, label]) => (
          <Link
            key={k}
            href={`/sales?p=${k}`}
            className={`status-tab${range.key === k ? " is-active" : ""}`}
          >
            {label}
          </Link>
        ))}
        <form method="get" action="/sales" className="range-form">
          <input type="date" name="from" defaultValue={range.from} className="input" required />
          <span>〜</span>
          <input type="date" name="to" defaultValue={range.to} className="input" required />
          <button type="submit" className={`btn${range.key === "custom" ? " btn-primary" : ""}`}>
            表示
          </button>
        </form>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {truncated && (
        <div className="alert-error">
          注文が多いため、最初の2,000件だけを集計しています。期間を短くしてください。
        </div>
      )}

      {data && (
        <>
          <div className="kpi-grid">
            <Kpi
              label="売上（返金差し引き）"
              value={formatMoney(data.net)}
              sub={<Change now={data.net} before={prevData?.net} />}
            />
            <Kpi
              label="注文数"
              value={`${data.orderCount}件`}
              sub={<Change now={data.orderCount} before={prevData?.orderCount} />}
            />
            <Kpi
              label="平均注文額"
              value={formatMoney(data.average)}
              sub={<Change now={data.average} before={prevData?.average} />}
            />
            <Kpi
              label="販売個数"
              value={`${data.items}個`}
              sub={<Change now={data.items} before={prevData?.items} />}
            />
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h2 className="card-title">{data.monthly ? "月別の売上" : "日別の売上"}</h2>
            {data.orderCount === 0 ? (
              <div className="placeholder">この期間の売上はありません</div>
            ) : (
              <SalesChart series={data.series} monthly={data.monthly} />
            )}
            <div className="breakdown">
              <span>注文合計 {formatMoney(data.gross)}</span>
              <span>返金 −{formatMoney(data.refunds)}</span>
              <span>うち送料 {formatMoney(data.shipping)}</span>
              <span>割引 {formatMoney(data.discount)}</span>
            </div>
          </div>

          <div className="grid-2" style={{ marginTop: 16 }}>
            <div className="card" style={{ padding: 0 }}>
              <h2 className="card-title" style={{ padding: "20px 20px 0" }}>
                売れ筋商品（売上順・上位10）
              </h2>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>商品</th>
                      <th className="num">個数</th>
                      <th className="num">売上</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topProducts.map((p, i) => (
                      <tr key={`${p.productId}-${p.name}-${i}`}>
                        <td>
                          {p.productId ? (
                            <Link href={`/products/${p.productId}`} className="row-link">
                              {p.name}
                            </Link>
                          ) : (
                            p.name
                          )}
                          {p.sku && (
                            <div style={{ fontSize: 12, color: "#6b7280" }}>{p.sku}</div>
                          )}
                        </td>
                        <td className="num">{p.qty}</td>
                        <td className="num">{formatMoney(p.sales)}</td>
                      </tr>
                    ))}
                    {data.topProducts.length === 0 && (
                      <tr>
                        <td colSpan={3} className="placeholder">
                          データがありません
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card" style={{ padding: 0 }}>
              <h2 className="card-title" style={{ padding: "20px 20px 0" }}>
                支払い方法別
              </h2>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>支払い方法</th>
                      <th className="num">件数</th>
                      <th className="num">売上</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments.map((p) => (
                      <tr key={p.name}>
                        <td>{p.name}</td>
                        <td className="num">{p.orders}</td>
                        <td className="num">{formatMoney(p.sales)}</td>
                      </tr>
                    ))}
                    {data.payments.length === 0 && (
                      <tr>
                        <td colSpan={3} className="placeholder">
                          データがありません
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <p className="form-hint" style={{ marginTop: 12 }}>
            前の期間比は、同じ日数だけさかのぼった期間（{prev.from} 〜 {prev.to}）との比較です。
          </p>
        </>
      )}
    </>
  );
}
