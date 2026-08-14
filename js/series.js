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
    .select("id, season_number, title")
    .eq("cartoon_id", cartoonId)
    .order("season_number", { ascending: true });

  if (seasonsError) {
    pageEl.className = "container";
    pageEl.innerHTML = `<div class="error-box">حدث خطأ أثناء جلب المواسم</div>`;
    throw seasonsError;
  }

  const safeTitle = esc(cartoon.title || "محتوى كرتوني");
  const safeDescription = esc(cartoon.description || "لا يتوفر ملخص لهذا المحتوى بعد.");
  const backdrop = cartoon.banner_url || cartoon.poster_url || "assets/images/placeholder-poster.svg";
  const mediaImages = [...new Set([cartoon.banner_url, cartoon.poster_url].filter(Boolean))];
  const hasSaved = isInMyList(cartoonId);
  const primarySeason = seasons?.[0];
  const watchLabel = cartoon.content_type === "movie" ? "شاهد الآن" : "شاهد الحلقات";

  // ---------- بناء الصفحة ----------
  pageEl.className = "series-page";
  pageEl.innerHTML = `
    <section class="series-cinematic-hero" aria-labelledby="series-title">
      <img class="series-cinematic-hero__backdrop" src="${esc(backdrop)}" alt="" onerror="handleImageError(this)">
      <div class="series-cinematic-hero__shade"></div>
      <div class="series-cinematic-hero__vignette"></div>

      <div class="series-cinematic-hero__inner">
        <div class="series-cinematic-hero__content">
          <p class="series-cinematic-hero__eyebrow">${esc(contentLabel)} · ${esc(categoryLabel)}</p>
          <h1 class="series-cinematic-hero__title" id="series-title">${safeTitle}</h1>
          <div class="series-cinematic-hero__meta" aria-label="معلومات المسلسل">
            <span>${cartoon.release_year || "سنة غير محددة"}</span>
            <span>${esc(cartoon.status || "متاح")}</span>
            <span>${fmtNum(cartoon.views || 0)} مشاهدة</span>
          </div>
          <div class="series-cinematic-hero__actions">
            ${primarySeason
              ? `<a class="btn btn--primary" href="#episodes" data-first-season="${primarySeason.id}"><span aria-hidden="true">▶</span> ${watchLabel}</a>`
              : `<a class="btn btn--primary" href="#episodes"><span aria-hidden="true">▶</span> قريبًا</a>`}
            <button class="btn btn--ghost series-bookmark ${hasSaved ? "is-saved" : ""}" id="series-bookmark" type="button" aria-pressed="${hasSaved}">
              <span aria-hidden="true">${hasSaved ? "✓" : "🔖"}</span>
              <span>${hasSaved ? "أضيفت إلى قائمتي" : "أضف إلى قائمتي"}</span>
            </button>
          </div>
        </div>
      </div>
    </section>

    <div class="series-content">
      <section class="series-overview" aria-labelledby="overview-title">
        <div class="series-overview__copy">
          <p class="series-section-kicker">عن ${contentLabel}</p>
          <h2 class="series-overview__title" id="overview-title">ملخص ${contentLabel}</h2>
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
            <p class="series-section-kicker">تابع الآن</p>
            <h2 class="series-episodes__title" id="episodes-title">${cartoon.content_type === "movie" ? "المشاهدة" : (seasons.length === 1 ? "الموسم الأول" : "المواسم والحلقات")}</h2>
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
            <div class="episodes-list" id="episodes-list" aria-live="polite"><div class="spinner"></div></div>`}
      </section>
    </div>
  `;

  // ---------- قائمتي: تحفظ على الجهاز وتبقى بعد إغلاق المتصفح ----------
  const bookmarkButton = document.getElementById("series-bookmark");
  bookmarkButton?.addEventListener("click", () => {
    const added = toggleMyList(cartoon);
    bookmarkButton.setAttribute("aria-pressed", String(added));
    bookmarkButton.classList.toggle("is-saved", added);
    bookmarkButton.querySelector("span[aria-hidden='true']").textContent = added ? "✓" : "🔖";
    bookmarkButton.querySelector("span:last-child").textContent = added ? "أضيفت إلى قائمتي" : "أضف إلى قائمتي";
  });

  // ---------- تحميل حلقات الموسم ----------
  const episodesList = document.getElementById("episodes-list");

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

    episodesList.innerHTML = data.map((episode) => episodeRow(episode)).join("")
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

  // ---------- تحميل حلقات أول موسم ----------
  if (primarySeason) loadEpisodes(primarySeason.id);
})();
