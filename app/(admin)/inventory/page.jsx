import Link from "next/link";
import { listProducts, listVariations } from "../../../lib/woocommerce";
import {
  STOCK_STATUSES,
  stockStatusInfo,
  isLowStock,
  variationLabel,
  DEFAULT_LOW_STOCK,
} from "../../../lib/format";
import { updateStockAction } from "../products/actions";

export const dynamic = "force-dynamic";

const TABS = [
  { value: "", label: "すべて" },
  { value: "outofstock", label: STOCK_STATUSES.outofstock.label },
  { value: "onbackorder", label: STOCK_STATUSES.onbackorder.label },
  { value: "instock", label: STOCK_STATUSES.instock.label },
];

function buildHref({ stock, search, page }) {
  const p = new URLSearchParams();
  if (stock) p.set("stock", stock);
  if (search) p.set("q", search);
  if (page && page > 1) p.set("page", String(page));
  const qs = p.toString();
  return qs ? `/inventory?${qs}` : "/inventory";
}

function StockBadge({ item }) {
  const s = stockStatusInfo(item.stock_status);
  return (
    <span className="badge" style={{ color: s.color, background: s.bg }}>
      {s.label}
    </span>
  );
}

function StockForm({ productId, variationId, item, returnTo }) {
  const low = isLowStock(item);
  return (
    <form action={updateStockAction} className="stock-form">
      <input type="hidden" name="productId" value={productId} />
      {variationId && <input type="hidden" name="variationId" value={variationId} />}
      <input type="hidden" name="returnTo" value={returnTo} />
      <input
        type="number"
        name="stock"
        min="0"
        step="1"
        required
        defaultValue={item.manage_stock ? item.stock_quantity ?? 0 : ""}
        placeholder={item.manage_stock ? "" : "未管理"}
        className="input stock-input"
        style={low ? { borderColor: "#f87171", background: "#fef2f2" } : undefined}
      />
      <button type="submit" className="btn">
        保存
      </button>
    </form>
  );
}

export default async function InventoryPage({ searchParams }) {
  const sp = await searchParams;
  const stock = typeof sp?.stock === "string" ? sp.stock : "";
  const search = typeof sp?.q === "string" ? sp.q.trim() : "";
  const page = Math.max(1, Number(sp?.page) || 1);
  const returnTo = buildHref({ stock, search, page });

  let products = [];
  let total = 0;
  let totalPages = 1;
  let error = "";
  let variationsById = {};

  try {
    const res = await listProducts({ page, perPage: 20, search, stockStatus: stock });
    products = res.data;
    total = res.total;
    totalPages = Math.max(1, res.totalPages);

    // バリエーション商品は、バリエーションごとの在庫も取得する
    const variable = products.filter((p) => p.type === "variable");
    const lists = await Promise.all(
      variable.map((p) => listVariations(p.id).catch(() => []))
    );
    variable.forEach((p, i) => {
      variationsById[p.id] = lists[i];
    });
  } catch (err) {
    error = err.message;
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">在庫管理</h1>
          <p className="page-sub">
            WooCommerce の在庫（{total}商品）・在庫が{DEFAULT_LOW_STOCK}個以下は赤枠で表示
          </p>
        </div>
        <form method="get" action="/inventory" style={{ display: "flex", gap: 8 }}>
          {stock && <input type="hidden" name="stock" value={stock} />}
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
            href={buildHref({ stock: t.value, search })}
            className={`status-tab${stock === t.value ? " is-active" : ""}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {sp?.updated && <div className="alert-success">在庫を更新しました</div>}
      {typeof sp?.error === "string" && <div className="alert-error">{sp.error}</div>}
      {error && <div className="alert-error">{error}</div>}

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>商品</th>
                <th className="hide-sm">SKU</th>
                <th>状態</th>
                <th>在庫数</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const variations = variationsById[p.id] || [];
                return [
                  <tr key={p.id}>
                    <td>
                      <Link href={`/products/${p.id}`} className="row-link">
                        {p.name}
                      </Link>
                      {p.type === "variable" && (
                        <div style={{ fontSize: 12, color: "#6b7280" }}>
                          バリエーション {variations.length}件
                        </div>
                      )}
                    </td>
                    <td className="hide-sm">{p.sku || "-"}</td>
                    <td>
                      <StockBadge item={p} />
                    </td>
                    <td>
                      {p.type === "variable" && !p.manage_stock ? (
                        <span style={{ fontSize: 12, color: "#6b7280" }}>
                          下のバリエーションごとに管理
                        </span>
                      ) : (
                        <StockForm productId={p.id} item={p} returnTo={returnTo} />
                      )}
                    </td>
                  </tr>,
                  ...variations.map((v) => (
                    <tr key={`${p.id}-${v.id}`} className="variation-row">
                      <td style={{ paddingLeft: 28 }}>
                        <span style={{ color: "#9ca3af" }}>└ </span>
                        {variationLabel(v)}
                      </td>
                      <td className="hide-sm">{v.sku || "-"}</td>
                      <td>
                        <StockBadge item={v} />
                      </td>
                      <td>
                        <StockForm
                          productId={p.id}
                          variationId={v.id}
                          item={v}
                          returnTo={returnTo}
                        />
                      </td>
                    </tr>
                  )),
                ];
              })}
              {!error && products.length === 0 && (
                <tr>
                  <td colSpan={4} className="placeholder">
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
            href={buildHref({ stock, search, page: page - 1 })}
          >
            ← 前へ
          </Link>
          <span>
            {page} / {totalPages}
          </span>
          <Link
            className="btn"
            aria-disabled={page >= totalPages}
            href={buildHref({ stock, search, page: page + 1 })}
          >
            次へ →
          </Link>
        </div>
      )}
    </>
  );
}
