/* ============================================================
   series.js  — صفحة تفاصيل المسلسل (series.html?id=...)
   ============================================================ */

(async function () {
/* async IIFE — ليدعم top-level await في سكربت عادي */
const pageEl = document.getElementById("page");
const params = new URLSearchParams(location.search);
const cartoonId = params.get("id");

document.getElementById("year").textContent = new Date().getFullYear();

// ---------- قائمة الموبايل ----------
const menuBtn = document.getElementById("menu-btn");
const mobileMenu = document.getElementById("mobile-menu");
menuBtn.addEventListener("click", () => mobileMenu.classList.add("is-open"));
mobileMenu.addEventListener("click", (e) => {
  if (e.target === mobileMenu) mobileMenu.classList.remove("is-open");
});

// ---------- التحقق من المعرف ----------
if (!cartoonId) {
  pageEl.innerHTML = `<div class="error-box">معرف المسلسل مفقود من الرابط</div>`;
  throw new Error("missing id");
}

// ---------- تحميل بيانات المسلسل ----------
const { data: cartoon, error: cError } = await sb
  .from(TABLES.cartoons)
  .select("*")
  .eq("id", cartoonId)
  .single();

if (cError || !cartoon) {
  pageEl.innerHTML = `
    <div class="error-box">
      <p>لم يتم العثور على المسلسل</p>
      <br>
      <a class="btn btn--primary" href="index.html">العودة للرئيسية</a>
    </div>`;
  throw new Error("cartoon not found");
}

const cat = await getCategoryName(cartoon.category_id);

// ---------- تحميل المواسم ----------
const { data: seasons, error: sError } = await sb
  .from(TABLES.seasons)
  .select("id, season_number, title")
  .eq("cartoon_id", cartoonId)
  .order("season_number", { ascending: true });

if (sError) {
  pageEl.innerHTML = `<div class="error-box">حدث خطأ أثناء جلب المواسم</div>`;
  throw sError;
}

// ---------- بناء الصفحة ----------
pageEl.innerHTML = `
  <div class="page-banner">
    <img class="page-banner__img" src="${cartoon.banner_url || ""}" alt="" onerror="this.style.display='none'">
    <div class="page-banner__overlay"></div>
  </div>

  <div class="series-head">
    <img class="series-head__poster" src="${cartoon.poster_url || ""}"
         alt="${esc(cartoon.title)}" onerror="handleImageError(this)">
    <div class="series-head__info">
      <h1 class="series-head__title">${esc(cartoon.title)}</h1>
      <p class="series-head__desc">${esc(cartoon.description)}</p>
      <div class="series-head__stats">
        <span>${esc(cat?.name || "—")}</span>
        <span>سنة الإنتاج: ${cartoon.release_year || "—"}</span>
        <span>الحالة: ${esc(cartoon.status)}</span>
        <span>${fmtNum(cartoon.views)} مشاهدة</span>
      </div>
    </div>
  </div>

  ${seasons.length === 0
    ? `<div class="empty-box">لا توجد مواسم أو حلقات لهذا المسلسل بعد</div>`
    : `
    <div class="seasons-tabs" id="seasons-tabs">
      ${seasons.map((s, i) => `
        <button class="season-tab ${i === 0 ? "is-active" : ""}" data-id="${s.id}">
          الموسم ${s.season_number}
        </button>`).join("")}
    </div>
    <div class="episodes-list" id="episodes-list">
      <div class="spinner"></div>
    </div>`}
`;

// ---------- تحميل حلقات الموسم ----------
const episodesList = document.getElementById("episodes-list");
const seasonIds = (seasons || []).map((s) => s.id);

async function loadEpisodes(seasonId) {
  if (!episodesList) return;
  episodesList.innerHTML = `<div class="spinner"></div>`;

  const { data, error } = await sb
    .from(TABLES.episodes)
    .select("id, title, episode_number, views, thumbnail_url, description")
    .eq("season_id", seasonId)
    .order("episode_number", { ascending: true });

  if (error) {
    episodesList.innerHTML = `<div class="error-box">حدث خطأ أثناء جلب الحلقات</div>`;
    return;
  }

  episodesList.innerHTML = data
    .map((ep) => episodeRow(ep))
    .join("") || `<div class="empty-box">لا توجد حلقات في هذا الموسم</div>`;
}

// تبديل المواسم
document.querySelectorAll("#seasons-tabs .season-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll("#seasons-tabs .season-tab")
      .forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    loadEpisodes(tab.dataset.id);
  });
});

// تحميل أول موسم
if (seasons.length > 0) loadEpisodes(seasonIds[0]);

})();
