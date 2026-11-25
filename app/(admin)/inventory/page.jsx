import Link from "next/link";
import {
  listProducts,
  listVariations,
  listProductsByIds,
} from "../../../lib/woocommerce";
import { variationLabel, formatDateTime } from "../../../lib/format";
import {
  LOW_STOCK,
  stockKey,
  getStockMap,
  getCutover,
  getSetting,
  productIdsWithStockAtMost,
  syncStockQuietly,
} from "../../../lib/stock";
import { searchProductIdsByOem } from "../../../lib/oem";
import { getCurrentStaff } from "../../../lib/staff";
import { updateStockAction } from "../products/actions";
import { cutoverAction, syncNowAction } from "./actions";

export const dynamic = "force-dynamic";

const TABS = [
  { value: "", label: "すべて" },
  { value: "reorder", label: "要発注（0以下）" },
  { value: "low", label: `残りわずか（${LOW_STOCK}以下）` },
  { value: "stopped", label: "販売停止" },
];

function buildHref({ tab, search, page }) {
  const p = new URLSearchParams();
  if (tab) p.set("tab", tab);
  if (search) p.set("q", search);
  if (page && page > 1) p.set("page", String(page));
  const qs = p.toString();
  return qs ? `/inventory?${qs}` : "/inventory";
}

function QtyBadge({ qty }) {
  if (qty <= 0) {
    return (
      <span className="badge" style={{ color: "#991b1b", background: "#fee2e2" }}>
        要発注{qty < 0 ? ` ${-qty}個不足` : ""}
      </span>
    );
  }
  if (qty <= LOW_STOCK) {
    return (
      <span className="badge" style={{ color: "#92400e", background: "#fef3c7" }}>
        残りわずか
      </span>
    );
  }
  return (
    <span className="badge" style={{ color: "#166534", background: "#dcfce7" }}>
      在庫あり
    </span>
  );
}

function SiteBadge({ status }) {
  if (status === "outofstock") {
    return (
      <span className="badge" style={{ color: "#4b5563", background: "#e5e7eb" }}>
        販売停止
      </span>
    );
  }
  if (status === "onbackorder") {
    return <span style={{ fontSize: 12, color: "#6b7280" }}>取り寄せ表示</span>;
  }
  return (
    <span className="badge" style={{ color: "#92400e", background: "#fef3c7" }}>
      在庫あり表示
    </span>
  );
}

function StockForm({ productId, variationId, qty, returnTo }) {
  return (
    <form action={updateStockAction} className="stock-form">
      <input type="hidden" name="productId" value={productId} />
      {variationId ? <input type="hidden" name="variationId" value={variationId} /> : null}
      <input type="hidden" name="returnTo" value={returnTo} />
      <input
        type="number"
        name="stock"
        step="1"
        required
        defaultValue={qty}
        className="input stock-input"
        style={
          qty <= 0
            ? { borderColor: "#f87171", background: "#fef2f2" }
            : qty <= LOW_STOCK
            ? { borderColor: "#fbbf24", background: "#fffbeb" }
            : undefined
        }
      />
      <button type="submit" className="btn">
        保存
      </button>
    </form>
  );
}

export default async function InventoryPage({ searchParams }) {
  const sp = await searchParams;
  const tab = TABS.some((t) => t.value === sp?.tab) ? sp.tab : "";
  const search = typeof sp?.q === "string" ? sp.q.trim() : "";
  const page = Math.max(1, Number(sp?.page) || 1);
  const returnTo = buildHref({ tab, search, page });

  const me = await getCurrentStaff();
  await syncStockQuietly();

  let cutover = null;
  let lastSync = null;
  let products = [];
  let total = 0;
  let totalPages = 1;
  let stock = {};
  let variationsById = {};
  let error = "";

  try {
    [cutover, lastSync] = await Promise.all([
      getCutover(),
      getSetting("stock_last_sync"),
    ]);

    if (tab === "reorder" || tab === "low") {
      const ids = await productIdsWithStockAtMost(tab === "reorder" ? 0 : LOW_STOCK);
      products = await listProductsByIds(ids);
      if (search) {
        const q = search.toLowerCase();
        products = products.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            String(p.sku || "").toLowerCase().includes(q)
        );
      }
      total = products.length;
    } else {
      const res = await listProducts({
        page,
        perPage: 20,
        search,
        stockStatus: tab === "stopped" ? "outofstock" : undefined,
        status: "any",
      });
      products = res.data;
      total = res.total;
      totalPages = Math.max(1, res.totalPages);

      // 純正品番でも探す
      if (search && page === 1 && tab !== "stopped") {
        const oemIds = await searchProductIdsByOem(search);
        const missing = oemIds.filter((id) => !products.some((p) => p.id === id));
        if (missing.length) {
          const extra = await listProductsByIds(missing);
          products = [...extra, ...products];
          total += extra.length;
        }
      }
    }

    const variable = products.filter((p) => p.type === "variable");
    const [map, lists] = await Promise.all([
      getStockMap(products.map((p) => p.id)),
      Promise.all(variable.map((p) => listVariations(p.id).catch(() => []))),
    ]);
    stock = map;
    variable.forEach((p, i) => {
      variationsById[p.id] = lists[i];
    });
  } catch (err) {
    error = err.message;
  }

  const qtyOf = (pid, vid = 0) => stock[stockKey(pid, vid)]?.quantity ?? 0;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">在庫管理</h1>
          <p className="page-sub">
            社内用の在庫数です（ECサイトには表示されません）。注文が入ると自動で減り、キャンセル・返金で戻ります。
          </p>
        </div>
        <form method="get" action="/inventory" style={{ display: "flex", gap: 8 }}>
          {tab && <input type="hidden" name="tab" value={tab} />}
          <input
            className="input"
            type="search"
            name="q"
            defaultValue={search}
            placeholder="商品名・SKU・純正品番で検索"
            style={{ width: 220 }}
          />
          <button type="submit" className="btn">
            検索
          </button>
        </form>
      </div>

      {!cutover && (
        <div className="card" style={{ background: "#eff6ff", borderColor: "#bfdbfe", marginBottom: 16 }}>
          <h2 className="card-title">在庫管理の切り替えがまだです</h2>
          <p style={{ fontSize: 14, margin: "0 0 12px" }}>
            切り替えると、ECサイトの全商品を「取り寄せ」表示にして在庫数を非表示にし、今の在庫数を管理アプリに取り込みます。
            これ以降の注文から、在庫が自動で減るようになります。
          </p>
          {me?.isAdmin ? (
            <form action={cutoverAction}>
              <button type="submit" className="btn btn-primary">
                切り替える
              </button>
            </form>
          ) : (
            <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
              管理者が切り替えを行ってください。
            </p>
          )}
        </div>
      )}

      {cutover && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 12,
            color: "#6b7280",
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          <span>注文の最終反映：{lastSync ? formatDateTime(lastSync) : "-"}</span>
          {me?.isAdmin && (
            <form action={syncNowAction}>
              <button type="submit" className="btn" style={{ padding: "4px 10px", fontSize: 12 }}>
                今すぐ反映
              </button>
            </form>
          )}
        </div>
      )}

      <div className="status-tabs">
        {TABS.map((t) => (
          <Link
            key={t.value || "all"}
            href={buildHref({ tab: t.value, search })}
            className={`status-tab${tab === t.value ? " is-active" : ""}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {sp?.updated && <div className="alert-success">在庫を更新しました</div>}
      {sp?.cutover && (
        <div className="alert-success">
          切り替えが完了しました（商品 {sp.cutover}件を確認、{sp.converted}件を「取り寄せ」に変更、
          {sp.seeded}件の在庫数を取り込み）
        </div>
      )}
      {sp?.synced && (
        <div className="alert-success">
          変更のあった注文 {sp.checked ?? 0}件を確認し、{sp.synced}件を在庫に反映しました
          {Number(sp.old) > 0 ? `（切り替え前の注文 ${sp.old}件は対象外）` : ""}
        </div>
      )}
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
                <th className="hide-sm">ECサイト</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const variations = variationsById[p.id] || [];
                const isVariable = p.type === "variable";
                return [
                  <tr key={p.id}>
                    <td>
                      <Link href={`/products/${p.id}`} className="row-link">
                        {p.name}
                      </Link>
                      {isVariable && (
                        <div style={{ fontSize: 12, color: "#6b7280" }}>
                          バリエーション {variations.length}件
                        </div>
                      )}
                    </td>
                    <td className="hide-sm">{p.sku || "-"}</td>
                    <td>{!isVariable && <QtyBadge qty={qtyOf(p.id)} />}</td>
                    <td>
                      {isVariable ? (
                        <span style={{ fontSize: 12, color: "#6b7280" }}>
                          バリエーションごとに管理
                        </span>
                      ) : (
                        <StockForm productId={p.id} qty={qtyOf(p.id)} returnTo={returnTo} />
                      )}
                    </td>
                    <td className="hide-sm">
                      <SiteBadge status={p.stock_status} />
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
                        <QtyBadge qty={qtyOf(p.id, v.id)} />
                      </td>
                      <td>
                        <StockForm
                          productId={p.id}
                          variationId={v.id}
                          qty={qtyOf(p.id, v.id)}
                          returnTo={returnTo}
                        />
                      </td>
                      <td className="hide-sm">
                        <SiteBadge status={v.stock_status} />
                      </td>
                    </tr>
                  )),
                ];
              })}
              {!error && products.length === 0 && (
                <tr>
                  <td colSpan={5} className="placeholder">
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
            href={buildHref({ tab, search, page: page - 1 })}
          >
            ← 前へ
          </Link>
          <span>
            {page} / {totalPages}
          </span>
          <Link
            className="btn"
            aria-disabled={page >= totalPages}
            href={buildHref({ tab, search, page: page + 1 })}
          >
            次へ →
          </Link>
        </div>
      )}
      {(tab === "reorder" || tab === "low") && (
        <p className="form-hint" style={{ marginTop: 12 }}>
          バリエーション商品は、条件に合うバリエーションがひとつでもあれば表示されます（{total}商品）。
        </p>
      )}
    </>
  );
}
