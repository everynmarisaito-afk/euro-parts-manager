import Link from "next/link";
import { listOrders } from "../../lib/woocommerce";

export const dynamic = "force-dynamic";

async function countOrders(status) {
  try {
    const res = await listOrders({ status, perPage: 1 });
    return res.total;
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const [processing, onHold, pending] = await Promise.all([
    countOrders("processing"),
    countOrders("on-hold"),
    countOrders("pending"),
  ]);

  const stats = [
    { label: "処理中の注文", value: processing, href: "/orders?status=processing" },
    { label: "保留中の注文", value: onHold, href: "/orders?status=on-hold" },
    { label: "支払い待ちの注文", value: pending, href: "/orders?status=pending" },
  ];

  const connected = stats.some((s) => s.value !== null);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">ダッシュボード</h1>
          <p className="page-sub">輸入車パーツ 在庫・注文管理システム</p>
        </div>
      </div>

      {!connected && (
        <div className="alert-error">
          WooCommerce から注文数を取得できませんでした。注文管理画面で詳しいエラーを確認できます。
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
        }}
      >
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="card"
            style={{ textDecoration: "none", color: "inherit", marginTop: 0 }}
          >
            <div style={{ fontSize: 13, color: "#6b7280" }}>{s.label}</div>
            <div style={{ fontSize: 32, fontWeight: 800, marginTop: 8 }}>
              {s.value === null ? "-" : s.value}
              <span style={{ fontSize: 14, fontWeight: 400, marginLeft: 4 }}>件</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 className="card-title">準備中の機能</h2>
        <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
          在庫不足アラート・売上サマリーは、在庫管理・売上集計の画面ができたあとに追加します。
        </p>
      </div>
    </>
  );
}
