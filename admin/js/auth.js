/* ============================================================
   auth.js — حماية لوحة التحكم عبر Supabase Auth فقط
   ============================================================ */

(function initAdminAuth() {
  const style = document.createElement("style");
  style.textContent = `
    .auth-gate { position: fixed; inset: 0; z-index: 9999; display: grid; place-items: center; padding: 20px; background: rgba(7, 10, 15, .96); }
    .auth-card { width: min(100%, 430px); background: #151c25; border: 1px solid #2a3544; border-radius: 18px; padding: 30px; box-shadow: 0 20px 80px rgba(0,0,0,.45); text-align: right; }
    .auth-card h2 { margin: 0 0 8px; color: #fff; font-size: 1.45rem; }
    .auth-card p { color: #9aa8b8; line-height: 1.8; margin: 0 0 22px; }
    .auth-card label { display: block; color: #dce4ee; margin: 14px 0 7px; font-weight: 700; }
    .auth-card input { box-sizing: border-box; width: 100%; border: 1px solid #344253; background: #0e141b; color: #fff; border-radius: 10px; padding: 12px 14px; font: inherit; }
    .auth-card button { width: 100%; border: 0; border-radius: 10px; padding: 12px; margin-top: 20px; background: #3b82f6; color: #fff; font: inherit; font-weight: 800; cursor: pointer; }
    .auth-card button:disabled { opacity: .65; cursor: wait; }
    .auth-error { min-height: 24px; color: #ff8f8f; margin-top: 14px; line-height: 1.6; }
    .auth-logout { margin: 18px 16px 0; width: calc(100% - 32px); border: 1px solid #354355; border-radius: 9px; padding: 9px 12px; color: #cbd5e1; background: transparent; cursor: pointer; font: inherit; }
    .auth-logout:hover { background: #202b38; }
  `;
  document.head.appendChild(style);

  function createGate() {
    if (document.getElementById("auth-gate")) return;
    const gate = document.createElement("div");
    gate.className = "auth-gate";
    gate.id = "auth-gate";
    gate.innerHTML = `
      <form class="auth-card" id="auth-form">
        <h2>تسجيل دخول لوحة التحكم</h2>
        <p>استخدم حسابًا موجودًا في Supabase Authentication لإدارة المحتوى بأمان من الواجهة مباشرة.</p>
        <label for="auth-email">البريد الإلكتروني</label>
        <input id="auth-email" type="email" autocomplete="email" required placeholder="admin@example.com" dir="ltr">
        <label for="auth-password">كلمة المرور</label>
        <input id="auth-password" type="password" autocomplete="current-password" required placeholder="••••••••" dir="ltr">
        <div class="auth-error" id="auth-error" role="alert"></div>
        <button id="auth-submit" type="submit">دخول</button>
      </form>`;
    document.body.appendChild(gate);

    gate.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = document.getElementById("auth-submit");
      const errorEl = document.getElementById("auth-error");
      button.disabled = true;
      button.textContent = "جارٍ التحقق...";
      errorEl.textContent = "";
      const { error } = await sb.auth.signInWithPassword({
        email: document.getElementById("auth-email").value.trim(),
        password: document.getElementById("auth-password").value,
      });
      if (error) {
        errorEl.textContent = error.message || "بيانات الدخول غير صحيحة";
        button.disabled = false;
        button.textContent = "دخول";
        return;
      }
      window.location.reload();
    });
  }

  function removeGate() {
    document.getElementById("auth-gate")?.remove();
  }

  function addLogoutButton() {
    const sidebar = document.querySelector(".sidebar");
    if (!sidebar || document.getElementById("auth-logout")) return;
    const button = document.createElement("button");
    button.id = "auth-logout";
    button.className = "auth-logout";
    button.textContent = "تسجيل الخروج";
    button.addEventListener("click", async () => {
      await sb.auth.signOut();
      window.location.reload();
    });
    sidebar.appendChild(button);
  }

  window.adminAuthReady = (async () => {
    const { data, error } = await sb.auth.getSession();
    if (error || !data.session) {
      createGate();
      return null;
    }
    addLogoutButton();
    return data.session;
  })();

  sb.auth.onAuthStateChange((_event, session) => {
    if (session) {
      removeGate();
      addLogoutButton();
    } else {
      createGate();
    }
  });
})();
