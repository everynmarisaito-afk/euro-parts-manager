# Supabase のテーブル

本番の Supabase プロジェクト（euro-parts-manager）に適用済みのテーブル：

- `staff_profiles`：スタッフと権限（admin / staff）
- `internal_stock`：社内在庫（ECサイトには表示しない）
- `stock_movements`：在庫の増減履歴
- `order_stock_sync`：どの注文を在庫に反映済みか
- `app_settings`：切り替え日時・最終同期日時など

関数：`adjust_stock`（在庫の増減と履歴）、`apply_order_stock`（注文の反映・戻し、二重反映なし）
