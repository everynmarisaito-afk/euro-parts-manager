import Link from "next/link";
import { getProduct, listVariations } from "../../../../lib/woocommerce";
import {
  PRODUCT_STATUSES,
  productStatusInfo,
  variationLabel,
  formatDateTime,
} from "../../../../lib/format";
import {
  LOW_STOCK,
  stockKey,
  getStockMap,
  getMovements,
} from "../../../../lib/stock";
import { updateProductAction, updateVariationAction } from "../actions";

export const dynamic = "force-dynamic";

const SITE_OPTIONS = [
  { value: "onbackorder", label: "取り寄せ（注文を受け付ける）" },
  { value: "outofstock", label: "販売停止（注文を受け付けない）" },
];

const REASONS = {
  manual: "手動で変更",
  order: "注文",
  order_cancel: "キャンセル・返金で戻し",
  initial: "初期取り込み",
};

function stockStyle(qty) {
  if (qty <= 0) return { borderColor: "#f87171", background: "#fef2f2" };
  if (qty <= LOW_STOCK) return { borderColor: "#fbbf24", background: "#fffbeb" };
  return undefined;
}

function siteValue(status) {
  return status === "outofstock" ? "outofstock" : "onbackorder";
}

export default async function ProductDetailPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;

  let product = null;
  let variations = [];
  let stock = {};
  let movements = [];
  let error = "";

  try {
    product = await getProduct(id);
    const [vars, map, moves] = await Promise.all([
      product.type === "variable" ? listVariations(id) : Promise.resolve([]),
      getStockMap([product.id]),
      getMovements(product.id),
    ]);
    variations = vars;
    stock = map;
    movements = moves;
  } catch (err) {
    error = err.message;
  }

  if (!product) {
    return (
      <>
        <Link href="/products" className="btn">
          ← 商品一覧へ
        </Link>
        <div className="alert-error" style={{ marginTop: 16 }}>
          {error || "商品が見つかりませんでした"}
        </div>
      </>
    );
  }

  const ps = productStatusInfo(product.status);
  const isVariable = product.type === "variable";
  const updateAction = updateProductAction.bind(null, product.id);
  const img = product.images?.[0]?.src;
  const qtyOf = (vid = 0) => stock[stockKey(product.id, vid)]?.quantity ?? 0;
  const varName = Object.fromEntries(variations.map((v) => [v.id, variationLabel(v)]));

  return (
    <>
      <div className="page-header">
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img}
              alt=""
              className="thumb"
              style={{ width: 72, height: 72, borderRadius: 10 }}
            />
          )}
          <div>
            <Link href="/products" style={{ fontSize: 13, color: "#6b7280" }}>
              ← 商品一覧へ
            </Link>
            <h1 className="page-title" style={{ marginTop: 6 }}>
              {product.name}
            </h1>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <span className="badge" style={{ color: ps.color, background: ps.bg }}>
                {ps.label}
              </span>
              {product.stock_status === "outofstock" ? (
                <span className="badge" style={{ color: "#4b5563", background: "#e5e7eb" }}>
                  販売停止
                </span>
              ) : (
                <span className="badge" style={{ color: "#374151", background: "#f3f4f6" }}>
                  サイト表示：取り寄せ
                </span>
              )}
            </div>
          </div>
        </div>
        {product.permalink && (
          <a href={product.permalink} target="_blank" rel="noreferrer" className="btn">
            ECサイトで見る ↗
          </a>
        )}
      </div>

      {sp?.updated && <div className="alert-success">保存しました</div>}
      {sp?.created && (
        <div className="alert-success">
          商品を登録しました。「ECサイトで見る」から表示を確認できます（下書きの場合はWordPressにログインしたブラウザで見られます）
        </div>
      )}
      {typeof sp?.error === "string" && <div className="alert-error">{sp.error}</div>}
      {error && <div className="alert-error">{error}</div>}

      <div className="card">
        <h2 className="card-title">基本情報</h2>
        <form action={updateAction}>
          <input type="hidden" name="type" value={product.type} />
          <div className="form-grid">
            <div className="form-field full">
              <label>商品名</label>
              <input name="name" className="input" defaultValue={product.name} required />
            </div>
            <div className="form-field">
              <label>SKU（品番）</label>
              <input name="sku" className="input" defaultValue={product.sku} />
            </div>
            <div className="form-field">
              <label>公開状態</label>
              <select name="status" className="select" defaultValue={product.status}>
                {Object.entries(PRODUCT_STATUSES).map(([v, info]) => (
                  <option key={v} value={v}>
                    {info.label}
                  </option>
                ))}
              </select>
            </div>

            {!isVariable && (
              <>
                <div className="form-field">
                  <label>通常価格（円）</label>
                  <input
                    name="regular_price"
                    className="input"
                    inputMode="numeric"
                    defaultValue={product.regular_price}
                  />
                </div>
                <div className="form-field">
                  <label>セール価格（円）</label>
                  <input
                    name="sale_price"
                    className="input"
                    inputMode="numeric"
                    defaultValue={product.sale_price}
                  />
                  <div className="form-hint">空欄にするとセールを解除します</div>
                </div>
              </>
            )}

            <div className="form-field">
              <label>ECサイトでの表示</label>
              <select
                name="site_status"
                className="select"
                defaultValue={siteValue(product.stock_status)}
              >
                {SITE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <div className="form-hint">在庫数はECサイトに表示されません</div>
            </div>

            {!isVariable && (
              <div className="form-field">
                <label>社内在庫数</label>
                <input
                  type="number"
                  name="stock"
                  step="1"
                  required
                  className="input"
                  defaultValue={qtyOf(0)}
                  style={stockStyle(qtyOf(0))}
                />
                <div className="form-hint">注文が入ると自動で減ります（マイナス＝不足数）</div>
              </div>
            )}
          </div>
          <div style={{ marginTop: 16, textAlign: "right" }}>
            <button type="submit" className="btn btn-primary">
              保存
            </button>
          </div>
        </form>
      </div>

      {isVariable && (
        <div className="card">
          <h2 className="card-title">バリエーション（{variations.length}件）</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>バリエーション</th>
                  <th>通常価格</th>
                  <th>セール価格</th>
                  <th>ECサイト</th>
                  <th>社内在庫</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {variations.map((v) => {
                  const formId = `var-${v.id}`;
                  const action = updateVariationAction.bind(null, product.id, v.id);
                  const qty = qtyOf(v.id);
                  return (
                    <tr key={v.id}>
                      <td>
                        {variationLabel(v)}
                        {v.sku && (
                          <div style={{ fontSize: 12, color: "#6b7280" }}>{v.sku}</div>
                        )}
                        <form id={formId} action={action} />
                      </td>
                      <td>
                        <input
                          form={formId}
                          name="regular_price"
                          className="input"
                          inputMode="numeric"
                          defaultValue={v.regular_price}
                          style={{ width: 90 }}
                        />
                      </td>
                      <td>
                        <input
                          form={formId}
                          name="sale_price"
                          className="input"
                          inputMode="numeric"
                          defaultValue={v.sale_price}
                          style={{ width: 90 }}
                        />
                      </td>
                      <td>
                        <select
                          form={formId}
                          name="site_status"
                          className="select"
                          defaultValue={siteValue(v.stock_status)}
                        >
                          <option value="onbackorder">取り寄せ</option>
                          <option value="outofstock">販売停止</option>
                        </select>
                      </td>
                      <td>
                        <input
                          form={formId}
                          type="number"
                          name="stock"
                          step="1"
                          required
                          className="input"
                          defaultValue={qty}
                          style={{ width: 80, ...(stockStyle(qty) || {}) }}
                        />
                      </td>
                      <td>
                        <button form={formId} type="submit" className="btn">
                          保存
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <h2 className="card-title" style={{ padding: "20px 20px 0" }}>
          在庫の履歴（最新30件）
        </h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>日時</th>
                {isVariable && <th>バリエーション</th>}
                <th>内容</th>
                <th className="num">増減</th>
                <th className="num">在庫</th>
                <th className="hide-sm">担当</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td style={{ whiteSpace: "nowrap", fontSize: 13 }}>
                    {formatDateTime(m.created_at)}
                  </td>
                  {isVariable && (
                    <td style={{ fontSize: 13 }}>{varName[m.variation_id] || "-"}</td>
                  )}
                  <td style={{ fontSize: 13 }}>
                    {REASONS[m.reason] || m.reason}
                    {m.order_id && (
                      <>
                        {" "}
                        <Link href={`/orders/${m.order_id}`}>{m.note || `注文 ${m.order_id}`}</Link>
                      </>
                    )}
                  </td>
                  <td
                    className="num"
                    style={{ color: m.change < 0 ? "#b91c1c" : "#166534", fontWeight: 700 }}
                  >
                    {m.change > 0 ? `+${m.change}` : m.change}
                  </td>
                  <td className="num">{m.quantity_after}</td>
                  <td className="hide-sm" style={{ fontSize: 12, color: "#6b7280" }}>
                    {m.created_by || "-"}
                  </td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr>
                  <td colSpan={isVariable ? 6 : 5} className="placeholder">
                    履歴はまだありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">その他の情報</h2>
        <dl className="dl">
          <dt>商品ID</dt>
          <dd>{product.id}</dd>
          <dt>カテゴリー</dt>
          <dd>{(product.categories || []).map((c) => c.name).join("、") || "-"}</dd>
          <dt>販売数</dt>
          <dd>{product.total_sales ?? 0}個</dd>
        </dl>
        <p className="form-hint" style={{ marginTop: 12 }}>
          商品説明・画像・カテゴリーの変更は、WordPress の管理画面で行ってください。
        </p>
      </div>
    </>
  );
}
