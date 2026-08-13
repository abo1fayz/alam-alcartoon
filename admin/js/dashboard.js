/* ============================================================
   dashboard.js — الصفحة الرئيسية للوحة التحكم Frontend فقط
   ============================================================ */

const dashEl = document.getElementById("dashboard");

async function load() {
  const adminSession = await window.adminAuthReady;
  if (!adminSession) return;
  try {
    const s = await API.stats();

    dashEl.innerHTML = `
      <div class="page-head">
        <h1 class="page-title">نظرة عامة</h1>
      </div>

      <div class="stats-grid">
        <div class="stat-card"><div class="stat-card__num">${s.cartoonsCount}</div><div class="stat-card__label">إجمالي المسلسلات</div></div>
        <div class="stat-card"><div class="stat-card__num">${s.seasonsCount}</div><div class="stat-card__label">إجمالي المواسم</div></div>
        <div class="stat-card"><div class="stat-card__num">${s.episodesCount}</div><div class="stat-card__label">إجمالي الحلقات</div></div>
        <div class="stat-card"><div class="stat-card__num">${s.categoriesCount}</div><div class="stat-card__label">إجمالي التصنيفات</div></div>
        <div class="stat-card"><div class="stat-card__num">${fmtNum(s.totalViews)}</div><div class="stat-card__label">إجمالي المشاهدات</div></div>
      </div>

      <h2 style="font-size:1.15rem;font-weight:800;margin-bottom:14px">أكثر الحلقات مشاهدة</h2>
      <div class="table-wrap" style="margin-bottom:28px">
        <table>
          <thead><tr><th>الحلقة</th><th>المسلسل</th><th>الموسم</th><th>المشاهدات</th></tr></thead>
          <tbody>${renderEpisodeRows(s.topEpisodes, true)}</tbody>
        </table>
      </div>

      <h2 style="font-size:1.15rem;font-weight:800;margin-bottom:14px">أحدث الحلقات</h2>
      <div class="table-wrap" style="margin-bottom:28px">
        <table>
          <thead><tr><th>الحلقة</th><th>المسلسل</th><th>الموسم</th><th>تاريخ الإضافة</th></tr></thead>
          <tbody>${renderEpisodeRows(s.latestEpisodes, false)}</tbody>
        </table>
      </div>

      <h2 style="font-size:1.15rem;font-weight:800;margin-bottom:14px">أحدث المسلسلات</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>البوستر</th><th>المسلسل</th><th>تاريخ الإضافة</th></tr></thead>
          <tbody>${s.latestCartoons.map((c) => `
            <tr>
              <td><img class="tbl-img" src="${escAttr(c.poster_url || "")}" alt="" onerror="this.style.visibility='hidden'"></td>
              <td>${esc(c.title)}</td>
              <td>${fmtDate(c.created_at)}</td>
            </tr>`).join("") || `<tr><td colspan="3" style="text-align:center;color:var(--text-dim)">لا توجد مسلسلات بعد</td></tr>`}</tbody>
        </table>
      </div>`;
  } catch (err) {
    dashEl.innerHTML = `<div class="error-box">حدث خطأ في Supabase: ${esc(err.message)}</div>`;
  }
}

function renderEpisodeRows(episodes, includeViews) {
  if (!episodes || !episodes.length) {
    return `<tr><td colspan="${includeViews ? 4 : 4}" style="text-align:center;color:var(--text-dim)">لا توجد حلقات بعد</td></tr>`;
  }
  return episodes.map((ep) => {
    const season = ep.seasons || {};
    const cartoon = season.cartoons || {};
    return `<tr>
      <td>${esc(ep.title) || `<span style="color:var(--text-dim)">بدون اسم</span>`}</td>
      <td>${esc(cartoon.title || "—")}</td>
      <td>${esc(season.season_number ?? "—")}</td>
      ${includeViews ? `<td>${fmtNum(ep.views)}</td>` : `<td>${fmtDate(ep.created_at)}</td>`}
    </tr>`;
  }).join("");
}

load();
