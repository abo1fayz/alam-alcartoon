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

  // ---------- سلايدر الاقتراحات ----------
  async function loadHero() {
    const { data, error } = await sb
      .from(TABLES.cartoons)
      .select("id, title, description, banner_url, status, release_year, category_id, content_type")
      .order("views", { ascending: false })
      .limit(6);

    if (error || !data?.length) {
      heroEl.innerHTML = `<div class="error-box">لا يوجد محتوى مميز حاليًا</div>`;
      return;
    }

    const categoryMap = await getCartoonCategories(data);
    const slideMarkup = data.map((cartoon, index) => {
      const categoryLabel = (categoryMap.get(cartoon.id) || [])
        .slice(0, 2)
        .map((category) => category.name)
        .join(" · ") || "—";
      const contentLabel = cartoon.content_type === "movie" ? "فيلم" : "مسلسل";
      const heroMeta = [cartoon.release_year, contentLabel, cartoon.status || "متاح"].filter(Boolean);

      return `
        <article class="hero__slide${index === 0 ? " is-active" : ""}" aria-hidden="${index === 0 ? "false" : "true"}">
          <img class="hero__img" src="${cartoon.banner_url || ""}" alt="${esc(cartoon.title)}" onerror="this.style.display='none'">
          <div class="hero__overlay"></div>
          <div class="hero__content">
            <p class="hero__eyebrow">اختيار عالم الكرتون</p>
            <h1 class="hero__title">${esc(cartoon.title)}</h1>
            <div class="hero__meta">${heroMeta.map((item) => `<span>${esc(String(item))}</span>`).join("")}</div>
            <p class="hero__desc">${esc(cartoon.description || "استمتع بمشاهدة هذا المحتوى الكرتوني المميز.")}</p>
            <div class="hero__tags"><span>${esc(categoryLabel)}</span></div>
            <div class="hero__actions">
              <a class="btn btn--primary" href="series.html?id=${cartoon.id}">▶ مشاهدة الآن</a>
              <a class="btn btn--ghost" href="series.html?id=${cartoon.id}">التفاصيل</a>
            </div>
          </div>
        </article>`;
    }).join("");

    const dotsMarkup = data.map((cartoon, index) => `
      <button class="hero__dot${index === 0 ? " is-active" : ""}" type="button" data-hero-index="${index}" aria-label="عرض اقتراح ${index + 1}: ${esc(cartoon.title)}" aria-current="${index === 0 ? "true" : "false"}"></button>`
    ).join("");

    heroEl.classList.add("is-carousel");
    heroEl.setAttribute("aria-roledescription", "carousel");
    heroEl.setAttribute("aria-label", "اقتراحات عالم الكرتون");
    heroEl.innerHTML = `${slideMarkup}<div class="hero__dots" aria-label="اختيار اقتراح">${dotsMarkup}</div>`;

    const slides = [...heroEl.querySelectorAll(".hero__slide")];
    const dots = [...heroEl.querySelectorAll(".hero__dot")];
    let activeIndex = 0;
    let timerId;
    const intervalMs = 5600;

    function showSlide(nextIndex) {
      const normalizedIndex = (nextIndex + slides.length) % slides.length;
      if (normalizedIndex === activeIndex) return;

      const previous = slides[activeIndex];
      previous.classList.remove("is-active");
      previous.classList.add("is-leaving");
      previous.setAttribute("aria-hidden", "true");
      window.setTimeout(() => previous.classList.remove("is-leaving"), 460);

      activeIndex = normalizedIndex;
      const next = slides[activeIndex];
      next.classList.add("is-active");
      next.setAttribute("aria-hidden", "false");
      dots.forEach((dot, index) => {
        const isCurrent = index === activeIndex;
        dot.classList.toggle("is-active", isCurrent);
        dot.setAttribute("aria-current", String(isCurrent));
      });
    }

    function stopAutoAdvance() {
      window.clearInterval(timerId);
    }

    function startAutoAdvance() {
      stopAutoAdvance();
      if (slides.length > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        timerId = window.setInterval(() => showSlide(activeIndex + 1), intervalMs);
      }
    }

    dots.forEach((dot) => {
      dot.addEventListener("click", () => {
        showSlide(Number(dot.dataset.heroIndex));
        startAutoAdvance();
      });
    });

    let swipeStartX = null;
    let activePointerId = null;
    const swipeThreshold = 46;

    heroEl.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      swipeStartX = event.clientX;
      activePointerId = event.pointerId;
      heroEl.setPointerCapture?.(event.pointerId);
      heroEl.classList.add("is-dragging");
      stopAutoAdvance();
    });

    heroEl.addEventListener("pointerup", (event) => {
      if (activePointerId !== event.pointerId || swipeStartX === null) return;
      const distance = event.clientX - swipeStartX;
      heroEl.classList.remove("is-dragging");
      swipeStartX = null;
      activePointerId = null;

      if (Math.abs(distance) >= swipeThreshold) {
        showSlide(distance < 0 ? activeIndex + 1 : activeIndex - 1);
      }
      startAutoAdvance();
    });

    heroEl.addEventListener("pointercancel", () => {
      heroEl.classList.remove("is-dragging");
      swipeStartX = null;
      activePointerId = null;
      startAutoAdvance();
    });

    heroEl.addEventListener("mouseenter", stopAutoAdvance);
    heroEl.addEventListener("mouseleave", startAutoAdvance);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopAutoAdvance();
      else startAutoAdvance();
    });
    startAutoAdvance();
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

  document.querySelectorAll(".home-content-tabs a").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".home-content-tabs a").forEach((item) => item.classList.remove("is-active"));
      tab.classList.add("is-active");
    });
  });

  await Promise.all([
    loadHero(),
    loadLatestSeries(),
    loadLatestMovies(),
    loadTopContent(),
    loadCategories(),
  ]);
})();
