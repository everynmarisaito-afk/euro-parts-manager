"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

// lib/staff.js と同じ値（サーバー専用コードを読み込まないようにここにも定義）
const STAFF_EMAIL_DOMAIN = "staff.everyn-club.com";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("denied")) {
      setError("このアカウントは利用できません。管理者に確認してください。");
    }
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();

      // ログインIDの場合はスタッフ用のメールアドレスに変換する
      const id = email.trim().toLowerCase();
      const loginEmail = id.includes("@") ? id : `${id}@${STAFF_EMAIL_DOMAIN}`;

      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email: loginEmail,
          password,
        });

      if (loginError) {
        if (/invalid login credentials/i.test(loginError.message)) {
          throw new Error("ログインIDまたはパスワードが違います");
        }
        if (/banned/i.test(loginError.message)) {
          throw new Error("このアカウントは停止されています");
        }
        throw loginError;
      }

      const { data: userData, error: userError } =
  await supabase.auth.getUser();

if (userError || !userData.user) {
  setError("認証後のセッション確認に失敗しました: " +
    (userError?.message || "ユーザー情報なし"));
  return;
}

// ログイン成功：トップ画面へ移動
    router.replace("/");
    router.refresh();
    } catch (err) {
      console.error("Login error:", err);
      setError(
        "ログインできませんでした：" + (err?.message || "原因不明のエラー")
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>EURO PARTS</div>
        <h1 style={styles.title}>管理システム</h1>
        <p style={styles.subtitle}>
          在庫・注文管理 スタッフログイン
        </p>

        <form onSubmit={handleLogin}>
          <label style={styles.label}>
            ログインID または メールアドレス
          </label>
          <input
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            placeholder="ログインIDを入力"
          />

          <label style={styles.label}>
            パスワード
          </label>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            placeholder="パスワードを入力"
          />

          {error && (
            <p role="alert" style={styles.error}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={styles.button}
          >
            {loading ? "認証中..." : "ログイン"}
          </button>
        </form>

        <p style={styles.footer}>
          Authorized Staff Only
        </p>
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    background: "#f1f3f6",
  },
  card: {
    width: "100%",
    maxWidth: 400,
    padding: 32,
    borderRadius: 16,
    background: "#ffffff",
    boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
  },
  logo: {
    textAlign: "center",
    fontWeight: 800,
    letterSpacing: 3,
    color: "#333333",
  },
  title: {
    textAlign: "center",
    fontSize: 26,
    marginBottom: 8,
  },
  subtitle: {
    textAlign: "center",
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 32,
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 8,
  },
  input: {
    boxSizing: "border-box",
    width: "100%",
    padding: 13,
    marginBottom: 20,
    border: "1px solid #d1d5db",
    borderRadius: 8,
    fontSize: 15,
  },
  button: {
    width: "100%",
    padding: 14,
    background: "#252b37",
    color: "#ffffff",
    border: 0,
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  },
  error: {
    color: "#b91c1c",
    fontSize: 13,
    marginBottom: 16,
  },
  footer: {
    textAlign: "center",
    fontSize: 11,
    color: "#9ca3af",
    marginTop: 28,
  },
};
