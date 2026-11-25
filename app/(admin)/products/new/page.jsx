import Link from "next/link";
import { listCategories } from "../../../../lib/woocommerce";
import { PRODUCT_STATUSES } from "../../../../lib/format";
import { createProductAction } from "../actions";
import ImageUploader from "./ImageUploader";
import SubmitButton from "./SubmitButton";

export const dynamic = "force-dynamic";

export default async function NewProductPage({ searchParams }) {
  const sp = await searchParams;
  let categories = [];
  let catError = "";
  try {
    categories = await listCategories();
  } catch (err) {
    catError = err.message;
  }

  // 親カテゴリーの下に子カテゴリーを並べる
  const byParent = {};
  for (const c of categories) {
    (byParent[c.parent] ||= []).push(c);
  }
  const ordered = [];
  const walk = (parent, depth) => {
    for (const c of byParent[parent] || []) {
      ordered.push({ ...c, depth });
      walk(c.id, depth + 1);
    }
  };
  walk(0, 0);

  return (
    <>
      <div className="page-header">
        <div>
          <Link href="/products" style={{ fontSize: 13, color: "#6b7280" }}>
            ← 商品一覧へ
          </Link>
          <h1 className="page-title" style={{ marginTop: 6 }}>
            商品を登録
          </h1>
          <p className="page-sub">
            登録した商品はECサイトで「取り寄せ」表示になり、在庫数は表示されません
          </p>
        </div>
      </div>

      {typeof sp?.error === "string" && <div className="alert-error">{sp.error}</div>}
      {catError && <div className="alert-error">カテゴリーを取得できませんでした：{catError}</div>}

      <form action={createProductAction}>
        <div className="card">
          <h2 className="card-title">基本情報</h2>
          <div className="form-grid">
            <div className="form-field full">
              <label>商品名 *</label>
              <input name="name" className="input" required placeholder="例：Audi A4 (B9) フロントブレーキパッド" />
            </div>
            <div className="form-field">
              <label>SKU（品番）</label>
              <input name="sku" className="input" placeholder="例：EP-AUDI-002" autoComplete="off" />
              <div className="form-hint">他の商品と重複できません</div>
            </div>
            <div className="form-field">
              <label>純正品番</label>
              <textarea
                name="oem_numbers"
                className="input"
                rows={2}
                placeholder={"例：8W0 698 151 AB\n複数ある場合は改行かカンマで区切る"}
              />
              <div className="form-hint">ECサイトの「追加情報」に表示され、管理アプリで検索できます</div>
            </div>
            <div className="form-field">
              <label>公開状態</label>
              <select name="status" className="select" defaultValue="draft">
                {Object.entries(PRODUCT_STATUSES).map(([v, info]) => (
                  <option key={v} value={v}>
                    {info.label}
                  </option>
                ))}
              </select>
              <div className="form-hint">まず「下書き」で登録し、ECサイトで確認してから公開するのがおすすめです</div>
            </div>
            <div className="form-field">
              <label>通常価格（円）*</label>
              <input name="regular_price" className="input" inputMode="numeric" required />
            </div>
            <div className="form-field">
              <label>セール価格（円）</label>
              <input name="sale_price" className="input" inputMode="numeric" />
            </div>
            <div className="form-field">
              <label>社内在庫数</label>
              <input name="stock" type="number" step="1" className="input" defaultValue="0" />
              <div className="form-hint">ECサイトには表示されません</div>
            </div>
            <div className="form-field">
              <label>ECサイトでの表示</label>
              <select name="site_status" className="select" defaultValue="onbackorder">
                <option value="onbackorder">取り寄せ（注文を受け付ける）</option>
                <option value="outofstock">販売停止（注文を受け付けない）</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">カテゴリー</h2>
          {ordered.length === 0 ? (
            <p className="form-hint">カテゴリーがありません（WordPressで作成できます）</p>
          ) : (
            <div className="category-list">
              {ordered.map((c) => (
                <label key={c.id} style={{ paddingLeft: c.depth * 18 }}>
                  <input type="checkbox" name="categories" value={c.id} /> {c.name}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="card-title">画像</h2>
          <ImageUploader />
        </div>

        <div className="card">
          <h2 className="card-title">説明</h2>
          <div className="form-grid">
            <div className="form-field full">
              <label>短い説明（商品名の下に表示）</label>
              <textarea name="short_description" className="input" rows={3} placeholder="適合車種・品番などの要点" />
            </div>
            <div className="form-field full">
              <label>詳しい説明</label>
              <textarea name="description" className="input" rows={8} placeholder="商品の詳細、注意事項など（改行はそのまま反映されます）" />
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Link href="/products" className="btn">
            キャンセル
          </Link>
          <SubmitButton />
        </div>
      </form>
    </>
  );
}
