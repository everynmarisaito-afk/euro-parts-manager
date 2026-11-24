import { createClient } from "@supabase/supabase-js";

// サーバー専用：管理者キー（secret key / service_role）でSupabaseを操作する。
// スタッフアカウントの作成・停止・パスワード再設定に使う。
export function hasAdminKey() {
  return Boolean(
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Vercel の環境変数 SUPABASE_SECRET_KEY が設定されていません"
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
