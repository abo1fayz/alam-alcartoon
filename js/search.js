/* ============================================================
   search.js  — صفحة البحث
   --------------------------------------------------------------
   البحث عن: اسم المسلسل · اسم الحلقة · التصنيف
   يدعم العربية (ILIKE لا يفرق بين الحروف)
   ============================================================ */

(async function () {
/* async IIFE — ليدعم top-level await في سكربت عادي */
const resultsEl = document.getElementById("results");
const inputEl = document.getElementById("search-input");
const btnEl = document.getElementById("search-btn");
const params = new URLSearchParams(location.search);

document.getElementById("year").textContent = new Date().getFullYear();

// ---------- قائمة الموبايل ----------
const menuBtn = document.getElementById("menu-btn");
const mobileMenu = document.getElementById("mobile-menu");
menuBtn.addEventListener("click", () => mobileMenu.classList.add("is-open"));
mobileMenu.addEventListener("click", (e) => {
  if (e.target === mobileMenu) mobileMenu.classList.remove("is-open");
});

let debounceTimer = null;

// ---------- عرض النتائج ----------
function render(results) {
  if (!results.length) {
    resultsEl.innerHTML = `<div class="empty-box">لا توجد نتائج مطابقة لبحثك</div>`;
    return;
  }

  resultsEl.innerHTML = results
    .map((r) => {
      if (r.type === "cartoon") {
        return `
          <a class="result-item" href="series.html?id=${r.id}">
            <img class="result-item__img" src="${r.img}" alt="${esc(r.title)}" loading="lazy"
                 onerror="handleImageError(this)">
            <div class="result-item__info">
              <span class="result-item__type">مسلسل</span>
              <div class="result-item__title">${esc(r.title)}</div>
              <div class="result-item__sub">${esc(r.sub)}</div>
            </div>
          </a>`;
      }
      return `
        <a class="result-item" href="watch.html?id=${r.id}">
          <img class="result-item__img" src="${r.img}" alt="${esc(r.title)}" loading="lazy"
               style="aspect-ratio:16/9" onerror="handleImageError(this)">
          <div class="result-item__info">
            <span class="result-item__type">حلقة</span>
            <div class="result-item__title">${esc(r.title)}</div>
            <div class="result-item__sub">${esc(r.sub)}</div>
          </div>
        </a>`;
    })
    .join("");
}

// ---------- تنفيذ البحث ----------
async function runSearch(query) {
  const q = query.trim();
  if (!q) {
    resultsEl.innerHTML = `<div class="empty-box">ابدأ الكتابة للبحث عن المسلسلات والحلقات</div>`;
    return;
  }

  resultsEl.innerHTML = `<div class="spinner"></div>`;

  const cats = await getCategories();

  // 1) البحث في المسلسلات (الاسم)
  const { data: cartoons } = await sb
    .from(TABLES.cartoons)
    .select("id, title, poster_url, release_year, category_id")
    .ilike("title", `%${q}%`)
    .limit(10);

  // 2) البحث في الحلقات (الاسم) مع الموسم والمسلسل
  const { data: episodes } = await sb
    .from(TABLES.episodes)
    .select(`
      id, title, thumbnail_url, episode_number,
      seasons!inner ( season_number, cartoons!inner ( id, title ) )
    `)
    .ilike("title", `%${q}%`)
    .limit(15);

  // 3) البحث في التصنيفات (الاسم) — عرض مسلسلات التصنيف
  const matchedCats = cats.filter((c) => c.name.includes(q));
  let extraCartoons = [];
  if (matchedCats.length) {
    const { data } = await sb
      .from(TABLES.cartoons)
      .select("id, title, poster_url, release_year, category_id")
      .in("category_id", matchedCats.map((c) => c.id))
      .limit(10);
    extraCartoons = data || [];
  }

  // دمج وتصفية التكرار
  const seen = new Set();
  const results = [];

  for (const c of [...(cartoons || []), ...extraCartoons]) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    const cat = cats.find((x) => x.id === c.category_id);
    results.push({
      type: "cartoon",
      id: c.id,
      title: c.title,
      img: c.poster_url,
      sub: `${cat?.name || "—"} · ${c.release_year || "—"}`,
    });
  }

  for (const ep of episodes || []) {
    results.push({
      type: "episode",
      id: ep.id,
      title: ep.title,
      img: ep.thumbnail_url,
      sub: `${ep.seasons.cartoons.title} · الموسم ${ep.seasons.season_number} · الحلقة ${ep.episode_number}`,
    });
  }

  render(results);
}

// ---------- البحث عند الكتابة (Debounce) ----------
inputEl.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => runSearch(inputEl.value), 350);
});

btnEl.addEventListener("click", () => runSearch(inputEl.value));

// ---------- تحميل البحث من الرابط: ?q=... ----------
const q = params.get("q");
const type = params.get("type");

if (q) {
  inputEl.value = q;
  runSearch(q);
} else if (type === "popular") {
  // الأكثر مشاهدة
  const { data } = await sb
    .from(TABLES.cartoons)
    .select("id, title, poster_url, release_year, views, category_id")
    .order("views", { ascending: false })
    .limit(20);
  const cats = await getCategories();
  render(
    (data || []).map((c) => {
      const cat = cats.find((x) => x.id === c.category_id);
      return {
        type: "cartoon",
        id: c.id,
        title: c.title,
        img: c.poster_url,
        sub: `${cat?.name || "—"} · ${fmtNum(c.views)} مشاهدة`,
      };
    })
  );
} else if (type === "series") {
  // جميع المسلسلات الأحدث
  const { data } = await sb
    .from(TABLES.cartoons)
    .select("id, title, poster_url, release_year, created_at, category_id")
    .order("created_at", { ascending: false })
    .limit(40);
  const cats = await getCategories();
  render(
    (data || []).map((c) => {
      const cat = cats.find((x) => x.id === c.category_id);
      return {
        type: "cartoon",
        id: c.id,
        title: c.title,
        img: c.poster_url,
        sub: `${cat?.name || "—"} · ${fmtDate(c.created_at)}`,
      };
    })
  );
}

})();
