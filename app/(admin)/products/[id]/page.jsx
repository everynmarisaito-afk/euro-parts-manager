import Link from "next/link";
import { getProduct, listVariations } from "../../../../lib/woocommerce";
import {
  PRODUCT_STATUSES,
  STOCK_STATUSES,
  productStatusInfo,
  stockStatusInfo,
  isLowStock,
  variationLabel,
} from "../../../../lib/format";
import { updateProductAction, updateVariationAction } from "../actions";

export const dynamic = "force-dynamic";

function numOrEmpty(v) {
  return v === null || v === undefined || v === "" ? "" : String(v);
}

export default async function ProductDetailPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;

  let product = null;
  let variations = [];
  let error = "";

  try {
    product = await getProduct(id);
    if (product.type === "variable") {
      variations = await listVariations(id);
    }
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
  const ss = stockStatusInfo(product.stock_status);
  const isVariable = product.type === "variable";
  const updateAction = updateProductAction.bind(null, product.id);
  const img = product.images?.[0]?.src;

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
              <span className="badge" style={{ color: ss.color, background: ss.bg }}>
                {ss.label}
              </span>
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
      {typeof sp?.error === "string" && <div className="alert-error">{sp.error}</div>}

      <div className="card">
        <h2 className="card-title">基本情報</h2>
        <form action={updateAction}>
          <input type="hidden" name="type" value={product.type} />
          <div className="form-grid">
            <div className="form-field full">
              <label>商品名</label>
              <input
                name="name"
                className="input"
                defaultValue={product.name}
                required
              />
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

            <div className="form-field full">
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  name="manage_stock"
                  defaultChecked={product.manage_stock}
                />
                在庫数を管理する
              </label>
              <div className="form-hint">
                オンにすると在庫数が0になったとき自動で「在庫切れ」になります
                {isVariable ? "（バリエーション商品は下の表で個別に管理するのがおすすめです）" : ""}
              </div>
            </div>
            <div className="form-field">
              <label>在庫数（在庫管理オンのとき）</label>
              <input
                type="number"
                name="stock"
                min="0"
                step="1"
                className="input"
                defaultValue={numOrEmpty(product.stock_quantity) || "0"}
                style={
                  isLowStock(product)
                    ? { borderColor: "#f87171", background: "#fef2f2" }
                    : undefined
                }
              />
            </div>
            <div className="form-field">
              <label>在庫状態（在庫管理オフのとき）</label>
              <select
                name="stock_status"
                className="select"
                defaultValue={product.stock_status}
              >
                {Object.entries(STOCK_STATUSES).map(([v, info]) => (
                  <option key={v} value={v}>
                    {info.label}
                  </option>
                ))}
              </select>
            </div>
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
                  <th className="hide-sm">SKU</th>
                  <th>通常価格</th>
                  <th>セール価格</th>
                  <th>在庫数</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {variations.map((v) => {
                  const formId = `var-${v.id}`;
                  const action = updateVariationAction.bind(null, product.id, v.id);
                  return (
                    <tr key={v.id}>
                      <td>
                        {variationLabel(v)}
                        <form id={formId} action={action} />
                      </td>
                      <td className="hide-sm">{v.sku || "-"}</td>
                      <td>
                        <input
                          form={formId}
                          name="regular_price"
                          className="input"
                          inputMode="numeric"
                          defaultValue={v.regular_price}
                          style={{ width: 100 }}
                        />
                      </td>
                      <td>
                        <input
                          form={formId}
                          name="sale_price"
                          className="input"
                          inputMode="numeric"
                          defaultValue={v.sale_price}
                          style={{ width: 100 }}
                        />
                      </td>
                      <td>
                        <input
                          form={formId}
                          type="number"
                          name="stock"
                          min="0"
                          step="1"
                          required
                          className="input"
                          defaultValue={v.manage_stock ? v.stock_quantity ?? 0 : 0}
                          style={{
                            width: 80,
                            ...(isLowStock(v)
                              ? { borderColor: "#f87171", background: "#fef2f2" }
                              : {}),
                          }}
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
