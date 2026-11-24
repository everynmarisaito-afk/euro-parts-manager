import Link from "next/link";
import { listProducts } from "../../../lib/woocommerce";
import {
  PRODUCT_STATUSES,
  productStatusInfo,
  stockStatusInfo,
  formatMoney,
  isLowStock,
} from "../../../lib/format";

export const dynamic = "force-dynamic";

const TABS = [
  { value: "", label: "すべて" },
  { value: "publish", label: PRODUCT_STATUSES.publish.label },
  { value: "draft", label: PRODUCT_STATUSES.draft.label },
  { value: "private", label: PRODUCT_STATUSES.private.label },
];

function buildHref({ status, search, page }) {
  const p = new URLSearchParams();
  if (status) p.set("status", status);
  if (search) p.set("q", search);
  if (page && page > 1) p.set("page", String(page));
  const qs = p.toString();
  return qs ? `/products?${qs}` : "/products";
}

function priceText(p) {
  if (p.type === "variable") {
    return p.price ? `${formatMoney(p.price)}〜` : "-";
  }
  if (p.sale_price) {
    return (
      <>
        <span style={{ textDecoration: "line-through", color: "#9ca3af", fontSize: 12 }}>
          {formatMoney(p.regular_price)}
        </span>{" "}
        <span style={{ color: "#b91c1c", fontWeight: 700 }}>
          {formatMoney(p.sale_price)}
        </span>
      </>
    );
  }
  return p.regular_price ? formatMoney(p.regular_price) : "-";
}

export default async function ProductsPage({ searchParams }) {
  const sp = await searchParams;
  const status = typeof sp?.status === "string" ? sp.status : "";
  const search = typeof sp?.q === "string" ? sp.q.trim() : "";
  const page = Math.max(1, Number(sp?.page) || 1);

  let products = [];
  let total = 0;
  let totalPages = 1;
  let error = "";

  try {
    const res = await listProducts({
      page,
      perPage: 20,
      search,
      status: status || "any",
      orderby: "date",
      order: "desc",
    });
    products = res.data;
    total = res.total;
    totalPages = Math.max(1, res.totalPages);
  } catch (err) {
    error = err.message;
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">商品管理</h1>
          <p className="page-sub">WooCommerce の商品一覧（{total}件）</p>
        </div>
        <form method="get" action="/products" style={{ display: "flex", gap: 8 }}>
          {status && <input type="hidden" name="status" value={status} />}
          <input
            className="input"
            type="search"
            name="q"
            defaultValue={search}
            placeholder="商品名・SKUで検索"
            style={{ width: 220 }}
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
                <th className="hide-sm"></th>
                <th>商品</th>
                <th className="hide-sm">カテゴリー</th>
                <th className="num">価格</th>
                <th>在庫</th>
                <th>公開</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const ps = productStatusInfo(p.status);
                const ss = stockStatusInfo(p.stock_status);
                const img = p.images?.[0]?.src;
                return (
                  <tr key={p.id}>
                    <td className="hide-sm" style={{ width: 44 }}>
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt="" className="thumb" loading="lazy" />
                      ) : (
                        <div className="thumb" />
                      )}
                    </td>
                    <td>
                      <Link href={`/products/${p.id}`} className="row-link">
                        {p.name}
                      </Link>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        {p.sku ? `SKU: ${p.sku}` : "SKUなし"}
                        {p.type === "variable" ? "・バリエーションあり" : ""}
                      </div>
                    </td>
                    <td className="hide-sm" style={{ fontSize: 13 }}>
                      {(p.categories || []).map((c) => c.name).join("、") || "-"}
                    </td>
                    <td className="num">{priceText(p)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <span className="badge" style={{ color: ss.color, background: ss.bg }}>
                        {ss.label}
                      </span>
                      {p.manage_stock && (
                        <span
                          style={{
                            marginLeft: 6,
                            fontSize: 13,
                            color: isLowStock(p) ? "#b91c1c" : "#374151",
                            fontWeight: isLowStock(p) ? 700 : 400,
                          }}
                        >
                          {p.stock_quantity}個
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="badge" style={{ color: ps.color, background: ps.bg }}>
                        {ps.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!error && products.length === 0 && (
                <tr>
                  <td colSpan={6} className="placeholder">
                    該当する商品はありません
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
