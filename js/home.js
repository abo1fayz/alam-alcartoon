/* ============================================================
   home.js — منطق الصفحة الرئيسية
   ============================================================ */

(async function () {
  const heroEl = document.getElementById("hero");
  const latestSeriesEl = document.getElementById("latest-series");
  const latestMoviesEl = document.getElementById("latest-movies");
  const topSeriesEl = document.getElementById("top-series");
  const categoriesGridEl = document.getElementById("categories-grid");

  document.getElementById("year").textContent = new Date().getFullYear();

  const menuBtn = document.getElementById("menu-btn");
  const mobileMenu = document.getElementById("mobile-menu");
  menuBtn?.addEventListener("click", () => mobileMenu?.classList.add("is-open"));
  mobileMenu?.addEventListener("click", (event) => {
    if (event.target === mobileMenu) mobileMenu.classList.remove("is-open");
  });

  async function renderContentCards(target, content, emptyMessage) {
    const categoryMap = await getCartoonCategories(content || []);
    target.innerHTML = (content || [])
      .map((cartoon) => cartoonCard(cartoon, categoryMap.get(cartoon.id) || []))
      .join("") || `<div class="empty-box">${emptyMessage}</div>`;
  }

  // ---------- المحتوى المميز ----------
  async function loadHero() {
    const { data, error } = await sb
      .from(TABLES.cartoons)
      .select("id, title, description, banner_url, status, category_id, content_type")
      .order("views", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      heroEl.innerHTML = `<div class="error-box">لا يوجد محتوى مميز حاليًا</div>`;
      return;
    }

    const categoryMap = await getCartoonCategories([data]);
    const categoryLabel = (categoryMap.get(data.id) || [])
      .slice(0, 2)
      .map((category) => category.name)
      .join(" · ") || "—";
    const contentLabel = data.content_type === "movie" ? "فيلم" : "مسلسل";

    heroEl.innerHTML = `
      <img class="hero__img" src="${data.banner_url || ""}" alt="${esc(data.title)}" onerror="this.style.display='none'">
      <div class="hero__overlay"></div>
      <div class="hero__content">
        <h1 class="hero__title">${esc(data.title)}</h1>
        <p class="hero__desc">${esc(data.description)}</p>
        <div class="hero__tags">
          <span>${esc(contentLabel)}</span>
          <span>${esc(categoryLabel)}</span>
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
      .select("id, title, poster_url, release_year, status, views, category_id, content_type")
      .eq("content_type", "series")
      .order("created_at", { ascending: false })
      .limit(8);

    if (error) {
      showError(latestSeriesEl, v2MigrationMessage(error, "حدث خطأ أثناء جلب المسلسلات"));
      return;
    }
    await renderContentCards(latestSeriesEl, data, "لا توجد مسلسلات بعد");
  }

  // ---------- أحدث الأفلام ----------
  async function loadLatestMovies() {
    showSkeleton(latestMoviesEl, 4);
    const { data, error } = await sb
      .from(TABLES.cartoons)
      .select("id, title, poster_url, release_year, status, views, category_id, content_type")
      .eq("content_type", "movie")
      .order("created_at", { ascending: false })
      .limit(8);

    if (error) {
      showError(latestMoviesEl, v2MigrationMessage(error, "حدث خطأ أثناء جلب الأفلام"));
      return;
    }
    await renderContentCards(latestMoviesEl, data, "لا توجد أفلام بعد");
  }

  // ---------- الأكثر مشاهدة ----------
  async function loadTopContent() {
    showSkeleton(topSeriesEl, 4);
    const { data, error } = await sb
      .from(TABLES.cartoons)
      .select("id, title, poster_url, release_year, status, views, category_id, content_type")
      .order("views", { ascending: false })
      .limit(8);

    if (error) {
      showError(topSeriesEl, v2MigrationMessage(error, "حدث خطأ أثناء جلب المحتوى"));
      return;
    }
    await renderContentCards(topSeriesEl, data, "لا يوجد محتوى بعد");
  }

  // ---------- التصنيفات ----------
  async function loadCategories() {
    const categories = await getCategories();
    categoriesGridEl.innerHTML = categories
      .map((category) => `<a class="cat-chip" href="search.html?q=${encodeURIComponent(category.name)}">${esc(category.name)}</a>`)
      .join("") || `<div class="empty-box">لا توجد تصنيفات بعد</div>`;
  }

  await Promise.all([
    loadHero(),
    loadLatestSeries(),
    loadLatestMovies(),
    loadTopContent(),
    loadCategories(),
  ]);
})();
