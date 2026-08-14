/* ============================================================
   series.js — صفحة تفاصيل المحتوى السينمائية (series.html?id=...)
   ============================================================ */

(async function () {
  const pageEl = document.getElementById("page");
  const params = new URLSearchParams(location.search);
  const cartoonId = params.get("id");

  document.getElementById("year").textContent = new Date().getFullYear();

  // ---------- قائمة الموبايل ----------
  const menuBtn = document.getElementById("menu-btn");
  const mobileMenu = document.getElementById("mobile-menu");
  menuBtn.addEventListener("click", () => mobileMenu.classList.add("is-open"));
  mobileMenu.addEventListener("click", (event) => {
    if (event.target === mobileMenu) mobileMenu.classList.remove("is-open");
  });

  // ---------- التحقق من المعرف ----------
  if (!cartoonId) {
    pageEl.className = "container";
    pageEl.innerHTML = `<div class="error-box">معرف المحتوى مفقود من الرابط</div>`;
    throw new Error("missing id");
  }

  // ---------- تحميل بيانات المسلسل ----------
  const { data: cartoon, error: cartoonError } = await sb
    .from(TABLES.cartoons)
    .select("*")
    .eq("id", cartoonId)
    .single();

  if (cartoonError || !cartoon) {
    pageEl.className = "container";
    pageEl.innerHTML = `
      <div class="error-box">
        <p>لم يتم العثور على المحتوى</p>
        <br>
        <a class="btn btn--primary" href="index.html">العودة للرئيسية</a>
      </div>`;
    throw new Error("cartoon not found");
  }

  const categoryMap = await getCartoonCategories([cartoon]);
  const categories = categoryMap.get(cartoon.id) || [];
  const categoryLabel = categories.map((category) => category.name).join(" · ") || "رسوم متحركة";
  const contentLabel = cartoon.content_type === "movie" ? "فيلم" : "مسلسل";

  // ---------- تحميل المواسم ----------
  const { data: seasons, error: seasonsError } = await sb
    .from(TABLES.seasons)
    .select("id, season_number, title, image_url")
    .eq("cartoon_id", cartoonId)
    .order("season_number", { ascending: true });

  if (seasonsError) {
    pageEl.className = "container";
    pageEl.innerHTML = `<div class="error-box">حدث خطأ أثناء جلب المواسم</div>`;
    throw seasonsError;
  }

  const safeTitle = esc(cartoon.title || "محتوى كرتوني");
  const safeDescription = esc(cartoon.description || "لا يتوفر ملخص لهذا المحتوى بعد.");
  // لا يُستخدم البوستر كخلفية للبطل: البانر يجب أن يكون صورة عرضية فقط.
  const backdrop = cartoon.banner_url || "";
  const hasBackdrop = Boolean(backdrop);
  const mediaImages = [...new Set([cartoon.banner_url, cartoon.poster_url].filter(Boolean))];
  const hasSaved = isInMyList(cartoonId);
  const primarySeason = seasons?.[0];
  const watchLabel = cartoon.content_type === "movie" ? "شاهد الآن" : "شاهد الحلقات";
  const summaryTitle = cartoon.content_type === "movie" ? "ملخص الفيلم" : "ملخص المسلسل";
  const seasonCountLabel = seasons.length === 1 ? "موسم واحد" : `${seasons.length} مواسم`;
  const heroMeta = [categoryLabel, cartoon.release_year, seasons.length ? seasonCountLabel : null].filter(Boolean);

  // ---------- بناء الصفحة ----------
  pageEl.className = "series-page";
  pageEl.innerHTML = `
    <section class="series-cinematic-hero ${hasBackdrop ? "" : "series-cinematic-hero--no-backdrop"}" aria-labelledby="series-title">
      ${hasBackdrop ? `<img class="series-cinematic-hero__backdrop" src="${esc(backdrop)}" alt="">` : ""}
      <div class="series-cinematic-hero__shade"></div>
      <div class="series-cinematic-hero__vignette"></div>

      <div class="series-cinematic-hero__inner">
        <div class="series-cinematic-hero__content">
          <p class="series-cinematic-hero__eyebrow">${esc(contentLabel)}</p>
          <h1 class="series-cinematic-hero__title" id="series-title">${safeTitle}</h1>
          <div class="series-cinematic-hero__meta" aria-label="معلومات المسلسل">
            ${heroMeta.map((item) => `<span>${esc(String(item))}</span>`).join("")}
          </div>
          <div class="series-cinematic-hero__actions">
            ${primarySeason
              ? `<a class="btn btn--primary" href="#episodes" data-first-season="${primarySeason.id}"><span aria-hidden="true">▶</span> ${watchLabel}</a>`
              : `<a class="btn btn--primary" href="#episodes"><span aria-hidden="true">▶</span> قريبًا</a>`}
            <button class="btn btn--ghost series-bookmark ${hasSaved ? "is-saved" : ""}" id="series-bookmark" type="button" aria-pressed="${hasSaved}">
              <span aria-hidden="true">${hasSaved ? "✓" : "🔖"}</span>
              <span>${hasSaved ? "أضيفت إلى قائمتي" : "قائمتي"}</span>
            </button>
          </div>
        </div>
      </div>
    </section>

    <nav class="series-anchor-tabs" aria-label="أقسام المحتوى">
      <a href="#episodes" class="is-active">الحلقات</a>
      <a href="#overview">تفاصيل</a>
      <a href="#similar">مشابه</a>
    </nav>

    <div class="series-content">
      <section class="series-overview" id="overview" aria-labelledby="overview-title">
        <div class="series-overview__copy">
          <h2 class="series-overview__title" id="overview-title">${summaryTitle}</h2>
          <p class="series-overview__description">${safeDescription}</p>
        </div>
        <div class="series-facts" aria-label="تفاصيل المسلسل">
          <div class="series-fact"><span class="series-fact__label">النوع</span><span class="series-fact__value">${contentLabel}</span></div>
          <div class="series-fact"><span class="series-fact__label">التصنيفات</span><span class="series-fact__value">${esc(categoryLabel)}</span></div>
          <div class="series-fact"><span class="series-fact__label">سنة الإنتاج</span><span class="series-fact__value">${cartoon.release_year || "—"}</span></div>
          <div class="series-fact"><span class="series-fact__label">الحالة</span><span class="series-fact__value">${esc(cartoon.status || "—")}</span></div>
          <div class="series-fact"><span class="series-fact__label">${cartoon.content_type === "movie" ? "المصادر" : "المواسم"}</span><span class="series-fact__value">${seasons.length || 0} ${cartoon.content_type === "movie" ? "موسم" : "موسم"}</span></div>
        </div>
      </section>

      ${mediaImages.length ? `
          <section class="series-gallery" aria-label="صور من ${contentLabel}">
          ${mediaImages.map((image, index) => `
            <div class="series-gallery__item">
              <img src="${esc(image)}" alt="صورة ${index + 1} من ${safeTitle}" loading="lazy" onerror="handleImageError(this)">
            </div>`).join("")}
        </section>` : ""}

      <section class="series-episodes" id="episodes" aria-labelledby="episodes-title">
        <div class="series-episodes__head">
          <div>
            <h2 class="series-episodes__title" id="episodes-title">${cartoon.content_type === "movie" ? "المشاهدة" : (seasons.length === 1 ? (primarySeason?.title || "موسم واحد") : "المواسم والحلقات")}</h2>
          </div>
          <span class="series-episodes__count">${seasons.length ? `${seasons.length} موسم` : "لا توجد مواسم"}</span>
        </div>

        ${seasons.length === 0
          ? `            <div class="empty-box">لا توجد حلقات أو مصادر مشاهدة لهذا ${contentLabel} بعد</div>`
          : `
            <div class="seasons-tabs" id="seasons-tabs" role="tablist" aria-label="المواسم">
              ${seasons.map((season, index) => `
                <button class="season-tab ${index === 0 ? "is-active" : ""}" type="button" role="tab" aria-selected="${index === 0}" data-id="${season.id}">
                  ${esc(season.title || `الموسم ${season.season_number}`)}
                </button>`).join("")}
            </div>
            <div class="season-showcase" id="season-showcase" aria-live="polite"></div>
            <div class="episodes-list" id="episodes-list" aria-live="polite"><div class="spinner"></div></div>`}
      </section>

      <section class="series-similar" id="similar" aria-labelledby="similar-title">
        <div class="series-similar__head">
          <h2 class="series-similar__title" id="similar-title">قد يعجبك أيضًا</h2>
          <a class="section__link" href="search.html?type=${cartoon.content_type === "movie" ? "movies" : "series"}">عرض الكل</a>
        </div>
        <div class="grid series-similar__grid" id="similar-grid" aria-live="polite"><div class="spinner"></div></div>
      </section>
    </div>
  `;

  // ---------- حماية البانر: تُزال أي صورة غير عرضية أو فاشلة ----------
  const cinematicHero = pageEl.querySelector(".series-cinematic-hero");
  const backdropImage = pageEl.querySelector(".series-cinematic-hero__backdrop");
  const enforceLandscapeBackdrop = () => {
    if (!backdropImage) return;
    const ratio = backdropImage.naturalWidth / backdropImage.naturalHeight;
    if (!Number.isFinite(ratio) || ratio < 1.2) {
      cinematicHero?.classList.add("series-cinematic-hero--no-backdrop");
      backdropImage.remove();
    }
  };
  backdropImage?.addEventListener("load", enforceLandscapeBackdrop, { once: true });
  backdropImage?.addEventListener("error", () => {
    cinematicHero?.classList.add("series-cinematic-hero--no-backdrop");
    backdropImage.remove();
  }, { once: true });
  if (backdropImage?.complete) enforceLandscapeBackdrop();

  // ---------- قائمتي: تحفظ على الجهاز وتبقى بعد إغلاق المتصفح ----------
  const bookmarkButton = document.getElementById("series-bookmark");
  const similarGrid = document.getElementById("similar-grid");

  document.querySelectorAll(".series-anchor-tabs a").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".series-anchor-tabs a").forEach((item) => item.classList.remove("is-active"));
      tab.classList.add("is-active");
    });
  });

  bookmarkButton?.addEventListener("click", () => {
    const added = toggleMyList(cartoon);
    bookmarkButton.setAttribute("aria-pressed", String(added));
    bookmarkButton.classList.toggle("is-saved", added);
    bookmarkButton.querySelector("span[aria-hidden='true']").textContent = added ? "✓" : "🔖";
    bookmarkButton.querySelector("span:last-child").textContent = added ? "أضيفت إلى قائمتي" : "أضف إلى قائمتي";
  });

  // ---------- محتوى مشابه ----------
  async function loadSimilar() {
    if (!similarGrid) return;
    const { data, error } = await sb
      .from(TABLES.cartoons)
      .select("id, title, poster_url, release_year, status, views, category_id, content_type")
      .eq("content_type", cartoon.content_type || "series")
      .neq("id", cartoonId)
      .order("views", { ascending: false })
      .limit(8);

    if (error || !(data || []).length) {
      similarGrid.innerHTML = `<div class="empty-box">لا يوجد محتوى مشابه متاح حاليًا</div>`;
      return;
    }

    const allCategories = await getCartoonCategories(data);
    const currentCategoryIds = new Set(categories.map((category) => category.id));
    const sorted = [...data].sort((first, second) => {
      const firstScore = (allCategories.get(first.id) || []).filter((category) => currentCategoryIds.has(category.id)).length;
      const secondScore = (allCategories.get(second.id) || []).filter((category) => currentCategoryIds.has(category.id)).length;
      return secondScore - firstScore || (second.views || 0) - (first.views || 0);
    });

    similarGrid.innerHTML = sorted
      .map((item) => cartoonCard(item, allCategories.get(item.id) || []))
      .join("");
  }

  // ---------- تحميل حلقات الموسم ----------
  const episodesList = document.getElementById("episodes-list");

  function renderSeasonShowcase(seasonId) {
    const showcase = document.getElementById("season-showcase");
    const season = seasons.find((item) => item.id === seasonId);
    if (!showcase || !season) return;

    const cover = season.image_url || cartoon.poster_url || cartoon.banner_url || "assets/images/placeholder-poster.svg";
    showcase.innerHTML = `
      <img class="season-showcase__image" src="${esc(cover)}" alt="غلاف ${esc(season.title || `الموسم ${season.season_number}`)}" onerror="handleImageError(this)">
      <div class="season-showcase__copy">
        <span class="season-showcase__eyebrow">غلاف الموسم</span>
        <strong>${esc(season.title || `الموسم ${season.season_number}`)}</strong>
        <span>صورة موحدة لجميع حلقات هذا الموسم</span>
      </div>`;
  }

  async function loadEpisodes(seasonId) {
    if (!episodesList) return;
    const season = seasons.find((item) => item.id === seasonId);
    const seasonCover = season?.image_url || cartoon.poster_url || cartoon.banner_url || "";
    renderSeasonShowcase(seasonId);
    episodesList.innerHTML = `<div class="spinner"></div>`;

    const { data, error } = await sb
      .from(TABLES.episodes)
      .select("id, title, episode_number, views, description")
      .eq("season_id", seasonId)
      .order("episode_number", { ascending: true });

    if (error) {
      episodesList.innerHTML = `<div class="error-box">حدث خطأ أثناء جلب الحلقات</div>`;
      return;
    }

    episodesList.innerHTML = data.map((episode) => episodeRow(episode, seasonCover)).join("")
      || `<div class="empty-box">لا توجد حلقات في هذا الموسم</div>`;
  }

  // ---------- تبديل المواسم ----------
  document.querySelectorAll("#seasons-tabs .season-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll("#seasons-tabs .season-tab").forEach((item) => {
        item.classList.remove("is-active");
        item.setAttribute("aria-selected", "false");
      });
      tab.classList.add("is-active");
      tab.setAttribute("aria-selected", "true");
      loadEpisodes(tab.dataset.id);
    });
  });

  // ---------- تمرير زر المشاهدة إلى الحلقات ----------
  document.querySelector("[data-first-season]")?.addEventListener("click", () => {
    if (primarySeason) loadEpisodes(primarySeason.id);
  });

  // ---------- تحميل المحتوى والحلقات الأولية ----------
  loadSimilar();
  if (primarySeason) loadEpisodes(primarySeason.id);
})();
