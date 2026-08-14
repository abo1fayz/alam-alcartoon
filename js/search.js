/* ============================================================
   search.js — بحث وعرض المحتوى حسب النوع والتصنيفات المتعددة
   ============================================================ */

(async function () {
  const resultsEl = document.getElementById("results");
  const inputEl = document.getElementById("search-input");
  const btnEl = document.getElementById("search-btn");
  const params = new URLSearchParams(location.search);
  const requestedType = params.get("type");
  const contentType = requestedType === "movies" || requestedType === "movie"
    ? "movie"
    : requestedType === "series" ? "series" : null;

  document.getElementById("year").textContent = new Date().getFullYear();

  const menuBtn = document.getElementById("menu-btn");
  const mobileMenu = document.getElementById("mobile-menu");
  menuBtn?.addEventListener("click", () => mobileMenu?.classList.add("is-open"));
  mobileMenu?.addEventListener("click", (event) => {
    if (event.target === mobileMenu) mobileMenu.classList.remove("is-open");
  });

  let debounceTimer = null;

  function contentResult(cartoon, categories, sub) {
    return {
      type: "cartoon",
      contentType: cartoon.content_type || "series",
      id: cartoon.id,
      title: cartoon.title,
      img: cartoon.poster_url,
      sub: sub || `${categories.map((category) => category.name).join(" · ") || "—"} · ${cartoon.release_year || "—"}`,
    };
  }

  function render(results, emptyMessage = "لا توجد نتائج مطابقة لبحثك") {
    if (!results.length) {
      resultsEl.innerHTML = `<div class="empty-box">${emptyMessage}</div>`;
      return;
    }

    resultsEl.innerHTML = results.map((result) => {
      if (result.type === "cartoon") {
        const label = result.contentType === "movie" ? "فيلم" : "مسلسل";
        return `
          <a class="result-item" href="series.html?id=${result.id}">
            <img class="result-item__img" src="${result.img || ""}" alt="${esc(result.title)}" loading="lazy" onerror="handleImageError(this)">
            <div class="result-item__info">
              <span class="result-item__type">${label}</span>
              <div class="result-item__title">${esc(result.title)}</div>
              <div class="result-item__sub">${esc(result.sub)}</div>
            </div>
          </a>`;
      }
      return `
        <a class="result-item" href="watch.html?id=${result.id}">
          <img class="result-item__img" src="${result.img || ""}" alt="${esc(result.title)}" loading="lazy" style="aspect-ratio:16/9" onerror="handleImageError(this)">
          <div class="result-item__info">
            <span class="result-item__type">حلقة</span>
            <div class="result-item__title">${esc(result.title)}</div>
            <div class="result-item__sub">${esc(result.sub)}</div>
          </div>
        </a>`;
    }).join("");
  }

  async function toContentResults(cartoons, buildSub) {
    const categoryMap = await getCartoonCategories(cartoons || []);
    return (cartoons || []).map((cartoon) =>
      contentResult(cartoon, categoryMap.get(cartoon.id) || [], buildSub?.(cartoon, categoryMap.get(cartoon.id) || []))
    );
  }

  function contentQuery(columns) {
    let query = sb.from(TABLES.cartoons).select(columns);
    if (contentType) query = query.eq("content_type", contentType);
    return query;
  }

  // ---------- تنفيذ البحث ----------
  async function runSearch(query) {
    const q = query.trim();
    if (!q) {
      resultsEl.innerHTML = `<div class="empty-box">ابدأ الكتابة للبحث عن المسلسلات والأفلام والتصنيفات</div>`;
      return;
    }

    resultsEl.innerHTML = `<div class="spinner"></div>`;
    const categories = await getCategories();
    const columns = "id, title, poster_url, release_year, category_id, content_type";

    let titleQuery = contentQuery(columns).ilike("title", `%${q}%`).limit(20);
    const matchedCategories = categories.filter((category) => category.name.includes(q));

    const episodeQuery = !contentType
      ? sb.from(TABLES.episodes).select(`
          id, title, thumbnail_url, episode_number,
          seasons!inner ( season_number, cartoons!inner ( id, title ) )
        `).ilike("title", `%${q}%`).limit(15)
      : Promise.resolve({ data: [] });

    const [{ data: titleMatches }, { data: episodes }] = await Promise.all([titleQuery, episodeQuery]);
    let categoryMatches = [];

    if (matchedCategories.length) {
      const categoryIds = matchedCategories.map((category) => category.id);
      const [{ data: primaryMatches }, { data: links }] = await Promise.all([
        contentQuery(columns).in("category_id", categoryIds).limit(30),
        sb.from("cartoon_categories").select("cartoon_id").in("category_id", categoryIds),
      ]);
      const linkedIds = [...new Set((links || []).map((link) => link.cartoon_id))];
      let linkedMatches = [];
      if (linkedIds.length) {
        let linkedQuery = sb.from(TABLES.cartoons).select(columns).in("id", linkedIds);
        if (contentType) linkedQuery = linkedQuery.eq("content_type", contentType);
        const { data } = await linkedQuery;
        linkedMatches = data || [];
      }
      categoryMatches = [...(primaryMatches || []), ...linkedMatches];
    }

    const seen = new Set();
    const cartoons = [...(titleMatches || []), ...categoryMatches].filter((cartoon) => {
      if (seen.has(cartoon.id)) return false;
      seen.add(cartoon.id);
      return true;
    });
    const contentResults = await toContentResults(cartoons);
    const episodeResults = (episodes || []).map((episode) => ({
      type: "episode",
      id: episode.id,
      title: episode.title,
      img: episode.thumbnail_url,
      sub: `${episode.seasons?.cartoons?.title || "مسلسل"} · الموسم ${episode.seasons?.season_number || "—"} · الحلقة ${episode.episode_number}`,
    }));

    render([...contentResults, ...episodeResults]);
  }

  async function loadListing(type) {
    resultsEl.innerHTML = `<div class="spinner"></div>`;
    let query = sb
      .from(TABLES.cartoons)
      .select("id, title, poster_url, release_year, views, status, category_id, content_type, created_at")
      .order(type === "popular" ? "views" : "created_at", { ascending: type !== "popular" })
      .limit(40);

    if (type === "series") query = query.eq("content_type", "series");
    if (type === "movies") query = query.eq("content_type", "movie");

    const { data, error } = await query;
    if (error) {
      showError(resultsEl, v2MigrationMessage(error, "حدث خطأ أثناء جلب المحتوى"));
      return;
    }

    const title = type === "movies" ? "لا توجد أفلام بعد" : type === "series" ? "لا توجد مسلسلات بعد" : "لا يوجد محتوى بعد";
    const results = await toContentResults(data || [], (cartoon, categories) => {
      const details = categories.map((category) => category.name).join(" · ") || "—";
      return type === "popular"
        ? `${details} · ${fmtNum(cartoon.views)} مشاهدة`
        : `${details} · ${fmtDate(cartoon.created_at)}`;
    });
    render(results, title);
  }

  async function loadMyList() {
    resultsEl.innerHTML = `<div class="spinner"></div>`;
    const saved = getMyListItems();
    if (!saved.length) {
      render([], "قائمتك فارغة حاليًا. أضف محتوى من صفحة التفاصيل ليظهر هنا.");
      return;
    }

    const ids = saved.map((item) => item.id);
    const { data, error } = await sb
      .from(TABLES.cartoons)
      .select("id, title, poster_url, release_year, status, views, category_id, content_type")
      .in("id", ids);
    if (error) {
      showError(resultsEl, v2MigrationMessage(error, "تعذر تحميل قائمتك الآن"));
      return;
    }

    const order = new Map(ids.map((id, index) => [id, index]));
    const cartoons = (data || []).sort((a, b) => order.get(a.id) - order.get(b.id));
    const results = await toContentResults(cartoons);
    render(results, "لم يعد المحتوى المحفوظ متاحًا.");
  }

  inputEl.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => runSearch(inputEl.value), 350);
  });
  btnEl.addEventListener("click", () => runSearch(inputEl.value));
  inputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") runSearch(inputEl.value);
  });

  // ---------- تحميل الحالة من الرابط ----------
  const q = params.get("q");
  if (q) {
    inputEl.value = q;
    runSearch(q);
  } else if (requestedType === "my-list") {
    loadMyList();
  } else if (requestedType === "popular") {
    loadListing("popular");
  } else if (contentType === "movie") {
    loadListing("movies");
  } else if (contentType === "series") {
    loadListing("series");
  }
})();
