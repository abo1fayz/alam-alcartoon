/* ============================================================
   home.js  — منطق الصفحة الرئيسية
   ============================================================ */

(async function () {
/* async IIFE — ليدعم top-level await في سكربت عادي */
const heroEl = document.getElementById("hero");
const latestSeriesEl = document.getElementById("latest-series");
const latestEpisodesEl = document.getElementById("latest-episodes");
const topSeriesEl = document.getElementById("top-series");
const categoriesGridEl = document.getElementById("categories-grid");

document.getElementById("year").textContent = new Date().getFullYear();

// ---------- القائمة للموبايل ----------
const menuBtn = document.getElementById("menu-btn");
const mobileMenu = document.getElementById("mobile-menu");
menuBtn.addEventListener("click", () => mobileMenu.classList.add("is-open"));
mobileMenu.addEventListener("click", (e) => {
  if (e.target === mobileMenu) mobileMenu.classList.remove("is-open");
});

// ---------- Hero: مسلسل مميز (الأعلى مشاهدة) ----------
async function loadHero() {
  const { data, error } = await sb
    .from(TABLES.cartoons)
    .select("id, title, description, banner_url, status, category_id")
    .order("views", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    heroEl.innerHTML = `<div class="error-box">لا يوجد مسلسل مميز حاليًا</div>`;
    return;
  }

  const cat = await getCategoryName(data.category_id);
  heroEl.innerHTML = `
    <img class="hero__img" src="${data.banner_url || ""}" alt="${esc(data.title)}"
         onerror="this.style.display='none'">
    <div class="hero__overlay"></div>
    <div class="hero__content">
      <h1 class="hero__title">${esc(data.title)}</h1>
      <p class="hero__desc">${esc(data.description)}</p>
      <div class="hero__tags">
        <span>${esc(cat?.name || "—")}</span>
        <span>${esc(data.status || "")}</span>
      </div>
      <div class="hero__actions">
        <a class="btn btn--primary" href="series.html?id=${data.id}">▶ مشاهدة الآن</a>
        <a class="btn btn--ghost" href="series.html?id=${data.id}">التفاصيل</a>
      </div>
    </div>`;
}

// ---------- أحدث المسلسلات ----------
async function loadLatestSeries() {
  showSkeleton(latestSeriesEl, 4);
  const { data, error } = await sb
    .from(TABLES.cartoons)
    .select("id, title, poster_url, release_year, status, views, category_id")
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    showError(latestSeriesEl, "حدث خطأ أثناء جلب المسلسلات");
    return;
  }

  const cats = await getCategories();
  latestSeriesEl.innerHTML = data
    .map((c) => cartoonCard(c, cats.find((x) => x.id === c.category_id)))
    .join("") || `<div class="empty-box">لا توجد مسلسلات بعد</div>`;
}

// ---------- أحدث الحلقات ----------
async function loadLatestEpisodes() {
  showSkeleton(latestEpisodesEl, 2);
  let { data, error } = await sb
    .from(TABLES.episodes)
    .select(`
      id, title, episode_number, views, thumbnail_url,
      seasons!inner ( season_number, cartoons!inner ( id, title ) )
    `)
    .order("created_at", { ascending: false })
    .limit(5);

  // إذا فشل الـ Join (بسبب RLS/RLS policies أحيانًا مع !inner)، حاول !left
  if (error) {
    ({ data, error } = await sb
      .from(TABLES.episodes)
      .select(`
        id, title, episode_number, views, thumbnail_url,
        seasons!left ( season_number, cartoons!left ( id, title ) )
      `)
      .order("created_at", { ascending: false })
      .limit(5));
  }

  if (error) {
    showError(latestEpisodesEl, "حدث خطأ أثناء جلب الحلقات");
    return;
  }

  latestEpisodesEl.innerHTML = data
    .map((ep) => {
      const s = ep.seasons || {};
      const label = (s && s.cartoons)
        ? `${s.cartoons.title} — الموسم ${s.season_number}`
        : "حلقة";
      const row = episodeRow({ ...ep, _label: label });
      return (s && s.cartoons)
        ? row.replace(
            `<h4 class="episode-row__title">${esc(ep.title)}</h4>`,
            `<h4 class="episode-row__title">${esc(ep.title)}</h4>
             <span class="episode-row__sub" style="font-size:.8rem;color:var(--text-dim)">${esc(s.cartoons.title)} · الموسم ${s.season_number}</span>`
          )
        : row;
    })
    .join("") || `<div class="empty-box">لا توجد حلقات بعد</div>`;
}

// ---------- الأكثر مشاهدة ----------
async function loadTopSeries() {
  showSkeleton(topSeriesEl, 4);
  const { data, error } = await sb
    .from(TABLES.cartoons)
    .select("id, title, poster_url, release_year, status, views, category_id")
    .order("views", { ascending: false })
    .limit(8);

  if (error) {
    showError(topSeriesEl, "حدث خطأ أثناء جلب المسلسلات");
    return;
  }

  const cats = await getCategories();
  topSeriesEl.innerHTML = data
    .map((c) => cartoonCard(c, cats.find((x) => x.id === c.category_id)))
    .join("") || `<div class="empty-box">لا توجد مسلسلات بعد</div>`;
}

// ---------- التصنيفات ----------
async function loadCategories() {
  const cats = await getCategories();
  categoriesGridEl.innerHTML = cats
    .map(
      (c) =>
        `<a class="cat-chip" href="search.html?q=${encodeURIComponent(c.name)}">${esc(c.name)}</a>`
    )
    .join("") || `<div class="empty-box">لا توجد تصنيفات بعد</div>`;
}

// ---------- تشغيل كل الأقسام ----------
Promise.all([
  loadHero(),
  loadLatestSeries(),
  loadLatestEpisodes(),
  loadTopSeries(),
  loadCategories(),
]);

})();
