// WooCommerce REST API (v3) をサーバー側だけで呼び出すためのヘルパー。
// 接続キーはブラウザに出さないよう、必ずサーバーコンポーネント／サーバーアクションから使う。

function getBaseUrl() {
  const raw = process.env.WOOCOMMERCE_URL;
  if (!raw) {
    throw new Error("WOOCOMMERCE_URL が設定されていません");
  }
  // 末尾の / や、誤って付けた /wp-json 以降を取り除く
  return raw.trim().replace(/\/wp-json.*$/, "").replace(/\/+$/, "");
}

function getCredentials() {
  const key = process.env.WOOCOMMERCE_CONSUMER_KEY;
  const secret = process.env.WOOCOMMERCE_CONSUMER_SECRET;
  if (!key || !secret) {
    throw new Error("WooCommerceの接続キーが設定されていません");
  }
  return { key: key.trim(), secret: secret.trim() };
}

export class WooError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function wooFetch(path, options = {}) {
  try {
    return await wooFetchRaw(path, options);
  } catch (err) {
    // Vercel のログで原因を追えるようにする（接続キーは出力しない）
    let host = "(未設定)";
    try {
      host = new URL(getBaseUrl()).host;
    } catch {}
    console.error(
      `[woocommerce] ${options.method || "GET"} ${path} host=${host} status=${
        err.status ?? "-"
      } ${err.message}`
    );
    throw err;
  }
}

async function wooFetchRaw(path, { method = "GET", query = {}, body } = {}) {
  const { key, secret } = getCredentials();
  const url = new URL(`${getBaseUrl()}/wp-json/wc/v3${path}`);

  // サーバーによっては Authorization ヘッダーが捨てられるため、
  // HTTPS 上でクエリパラメータとして認証情報を渡す（WooCommerce公式の方式）
  url.searchParams.set("consumer_key", key);
  url.searchParams.set("consumer_secret", secret);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  }

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch (err) {
    throw new WooError(`WooCommerceに接続できませんでした（${err.message}）`, 0);
  }

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // JSONでない（HTMLのエラーページなど）
  }

  if (!res.ok) {
    if (res.status === 403 && /XSERVER/i.test(text)) {
      throw new WooError(
        "WooCommerceエラー 403: Xserverにアクセスを拒否されました。Xserverのサーバーパネル「WordPressセキュリティ設定」で REST API の海外アクセス制限を確認してください。",
        403
      );
    }
    const detail = data?.message || text.slice(0, 200) || res.statusText;
    throw new WooError(`WooCommerceエラー ${res.status}: ${detail}`, res.status);
  }
  if (data === null) {
    throw new WooError(
      "WooCommerceから想定外の応答がありました（URL設定を確認してください）",
      res.status
    );
  }

  return {
    data,
    total: Number(res.headers.get("x-wp-total") || 0),
    totalPages: Number(res.headers.get("x-wp-totalpages") || 1),
  };
}

export async function listOrders({
  page = 1,
  perPage = 20,
  status,
  search,
  order = "desc",
} = {}) {
  return wooFetch("/orders", {
    query: {
      page,
      per_page: perPage,
      status: status || undefined,
      search: search || undefined,
      orderby: "date",
      order,
    },
  });
}

export async function getOrder(id) {
  const { data } = await wooFetch(`/orders/${encodeURIComponent(id)}`);
  return data;
}

export async function updateOrder(id, fields) {
  const { data } = await wooFetch(`/orders/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: fields,
  });
  return data;
}

export async function addOrderNote(id, note, customerNote = false) {
  const { data } = await wooFetch(`/orders/${encodeURIComponent(id)}/notes`, {
    method: "POST",
    body: { note, customer_note: customerNote },
  });
  return data;
}

export async function listOrderNotes(id) {
  const { data } = await wooFetch(`/orders/${encodeURIComponent(id)}/notes`);
  return data;
}

// ===== 商品・在庫 =====

export async function listProducts({
  page = 1,
  perPage = 20,
  search,
  stockStatus,
  status,
  orderby = "title",
  order = "asc",
} = {}) {
  return wooFetch("/products", {
    query: {
      page,
      per_page: perPage,
      search: search || undefined,
      stock_status: stockStatus || undefined,
      status: status || undefined,
      orderby,
      order,
    },
  });
}

export async function countProducts(query = {}) {
  const { total } = await wooFetch("/products", {
    query: { per_page: 1, ...query },
  });
  return total;
}

export async function getProduct(id) {
  const { data } = await wooFetch(`/products/${encodeURIComponent(id)}`);
  return data;
}

export async function updateProduct(id, fields) {
  const { data } = await wooFetch(`/products/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: fields,
  });
  return data;
}

export async function listVariations(productId) {
  const { data } = await wooFetch(
    `/products/${encodeURIComponent(productId)}/variations`,
    { query: { per_page: 100 } }
  );
  return data;
}

export async function updateVariation(productId, variationId, fields) {
  const { data } = await wooFetch(
    `/products/${encodeURIComponent(productId)}/variations/${encodeURIComponent(
      variationId
    )}`,
    { method: "PUT", body: fields }
  );
  return data;
}
