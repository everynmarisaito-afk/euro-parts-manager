import { requireAdmin, ROLES, isStaffEmail } from "../../../lib/staff";
import { createAdminClient, hasAdminKey } from "../../../lib/supabase/admin";
import { formatDateTime } from "../../../lib/format";
import {
  createStaffAction,
  updateStaffAction,
  resetPasswordAction,
  setActiveAction,
} from "./actions";

export const dynamic = "force-dynamic";

const PASSWORD_HINT =
  "12文字以上で、英大文字・英小文字・数字・記号をそれぞれ1文字以上含めてください";

function RoleBadge({ role }) {
  const r = ROLES[role] || ROLES.staff;
  return (
    <span className="badge" style={{ color: r.color, background: r.bg }}>
      {r.label}
    </span>
  );
}

const MESSAGES = {
  created: (v) => `スタッフ「${v}」を登録しました`,
  updated: () => "スタッフ情報を更新しました",
  password: () => "パスワードを変更しました",
  activated: () => "アカウントを再開しました",
  deactivated: () => "アカウントを停止しました",
};

export default async function StaffPage({ searchParams }) {
  const me = await requireAdmin();
  const sp = await searchParams;

  const success = Object.keys(MESSAGES)
    .filter((k) => typeof sp?.[k] === "string")
    .map((k) => MESSAGES[k](sp[k]))[0];

  if (!hasAdminKey()) {
    return (
      <>
        <div className="page-header">
          <h1 className="page-title">スタッフ管理</h1>
        </div>
        <div className="alert-error">
          スタッフを登録するには、Vercel の環境変数に <b>SUPABASE_SECRET_KEY</b>{" "}
          を設定する必要があります。
        </div>
      </>
    );
  }

  let staff = [];
  let error = "";
  try {
    const admin = createAdminClient();
    const [{ data: profiles, error: pErr }, { data: usersData, error: uErr }] =
      await Promise.all([
        admin
          .from("staff_profiles")
          .select("user_id, login_id, display_name, role, active, created_at")
          .order("created_at", { ascending: true }),
        admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      ]);
    if (pErr) throw pErr;
    if (uErr) throw uErr;

    const usersById = Object.fromEntries(
      (usersData?.users || []).map((u) => [u.id, u])
    );
    staff = (profiles || []).map((p) => {
      const u = usersById[p.user_id] || {};
      return {
        ...p,
        email: u.email,
        lastSignIn: u.last_sign_in_at,
      };
    });
  } catch (err) {
    error = err.message;
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">スタッフ管理</h1>
          <p className="page-sub">
            管理アプリにログインできるスタッフと権限（管理者だけが見られる画面です）
          </p>
        </div>
      </div>

      {success && <div className="alert-success">{success}</div>}
      {typeof sp?.error === "string" && <div className="alert-error">{sp.error}</div>}
      {error && <div className="alert-error">{error}</div>}

      <div className="card">
        <h2 className="card-title">スタッフを登録</h2>
        <form action={createStaffAction}>
          <div className="form-grid">
            <div className="form-field">
              <label>ログインID</label>
              <input
                name="login_id"
                className="input"
                required
                autoComplete="off"
                autoCapitalize="none"
                placeholder="例：tanaka"
                pattern="[a-zA-Z0-9][a-zA-Z0-9._\-]{2,31}"
              />
              <div className="form-hint">半角英数字と「.」「_」「-」、3〜32文字</div>
            </div>
            <div className="form-field">
              <label>表示名</label>
              <input
                name="display_name"
                className="input"
                required
                placeholder="例：田中"
              />
            </div>
            <div className="form-field">
              <label>初期パスワード</label>
              <input
                name="password"
                type="text"
                className="input"
                required
                minLength={12}
                autoComplete="new-password"
              />
              <div className="form-hint">{PASSWORD_HINT}</div>
            </div>
            <div className="form-field">
              <label>権限</label>
              <select name="role" className="select" defaultValue="staff">
                <option value="staff">スタッフ（スタッフ管理以外のすべて）</option>
                <option value="admin">管理者（スタッフ管理もできる）</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 16, textAlign: "right" }}>
            <button type="submit" className="btn btn-primary">
              登録する
            </button>
          </div>
        </form>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>スタッフ</th>
                <th>権限</th>
                <th className="hide-sm">最終ログイン</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => {
                const isMe = s.user_id === me.id;
                const update = updateStaffAction.bind(null, s.user_id);
                const reset = resetPasswordAction.bind(null, s.user_id);
                const toggle = setActiveAction.bind(null, s.user_id, !s.active);
                const formId = `staff-${s.user_id}`;
                const loginLabel =
                  s.login_id ||
                  (s.email && !isStaffEmail(s.email) ? s.email : "-");
                return (
                  <tr key={s.user_id} style={s.active ? undefined : { opacity: 0.55 }}>
                    <td>
                      <form id={formId} action={update} />
                      <input
                        form={formId}
                        name="display_name"
                        className="input"
                        defaultValue={s.display_name || ""}
                        required
                        style={{ width: 150 }}
                      />
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                        ID：{loginLabel}
                        {isMe && "（あなた）"}
                        {!s.active && (
                          <span style={{ color: "#991b1b", fontWeight: 700 }}>
                            ・停止中
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <select
                        form={formId}
                        name="role"
                        className="select"
                        defaultValue={s.role}
                        disabled={isMe}
                      >
                        <option value="staff">{ROLES.staff.label}</option>
                        <option value="admin">{ROLES.admin.label}</option>
                      </select>
                      {isMe && <input form={formId} type="hidden" name="role" value="admin" />}
                      <div style={{ marginTop: 4 }}>
                        <RoleBadge role={s.role} />
                      </div>
                    </td>
                    <td className="hide-sm" style={{ fontSize: 13, whiteSpace: "nowrap" }}>
                      {s.lastSignIn ? formatDateTime(s.lastSignIn) : "未ログイン"}
                    </td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        <button form={formId} type="submit" className="btn">
                          保存
                        </button>
                        {!isMe && (
                          <form action={toggle}>
                            <button
                              type="submit"
                              className="btn"
                              style={s.active ? { color: "#b91c1c" } : undefined}
                            >
                              {s.active ? "停止" : "再開"}
                            </button>
                          </form>
                        )}
                      </div>
                      <details style={{ marginTop: 8 }}>
                        <summary style={{ fontSize: 12, color: "#6b7280", cursor: "pointer" }}>
                          パスワードを変更
                        </summary>
                        <form action={reset} style={{ display: "flex", gap: 6, marginTop: 6 }}>
                          <input
                            name="password"
                            type="text"
                            className="input"
                            required
                            minLength={12}
                            autoComplete="new-password"
                            placeholder="新しいパスワード"
                            style={{ width: 170 }}
                          />
                          <button type="submit" className="btn">
                            変更
                          </button>
                        </form>
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
