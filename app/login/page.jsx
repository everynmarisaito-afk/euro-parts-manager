"use client";

import { useState } from "react";
import { createClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();

      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (loginError) {
        throw loginError;
      }

      window.location.assign("/");
    } catch {
      setError(
        "ログインできませんでした。メールアドレスとパスワードをご確認ください。"
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

        <form on‍Submit={handleLogin}>
          <label style={styles.label}>
            メールアドレス
          </label>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            placeholder="メールアドレスを入力"
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
