/* ============================================================
   app.js  — وظائف مساعدة مشتركة بين صفحات الموقع
   ============================================================ */

// ---------- صورة بديلة عند فشل تحميل الصور ----------
function handleImageError(img) {
  img.onerror = null;
  img.src = "assets/images/placeholder-poster.svg";
}

// ---------- بناء بطاقة مسلسل أو فيلم ----------
function cartoonCard(c, categories = []) {
  const list = Array.isArray(categories) ? categories : (categories ? [categories] : []);
  const categoryLabel = list.length
    ? list.slice(0, 2).map((category) => category.name).filter(Boolean).join(" · ")
    : "—";
  const contentLabel = c.content_type === "movie" ? "فيلم" : "مسلسل";

  return `
    <a class="card" href="series.html?id=${c.id}">
      <div class="card__img-wrap">
        <img class="card__poster" src="${c.poster_url || ""}"
             alt="${esc(c.title)}" loading="lazy"
             onerror="handleImageError(this)">
        <span class="card__badge">${esc(categoryLabel)}</span>
      </div>
      <div class="card__body">
        <h3 class="card__title">${esc(c.title)}</h3>
        <div class="card__meta">
          <span>${contentLabel}</span>
          <span>${c.release_year || "—"}</span>
          <span title="عدد المشاهدات">${fmtNum(c.views)} مشاهدة</span>
        </div>
      </div>
    </a>`;
}

// ---------- بناء بطاقة حلقة (قائمة) ----------
// تستخدم صورة الموسم الموحدة، مع إبقاء الصورة القديمة كخيار توافق فقط.
function episodeRow(ep, seasonImageUrl = "") {
  const artwork = seasonImageUrl || ep.season_image_url || ep.thumbnail_url || "";
  return `
    <a class="episode-row" href="watch.html?id=${ep.id}">
      <img class="episode-row__thumb" src="${esc(artwork)}"
           alt="غلاف ${esc(ep.title || `الحلقة ${ep.episode_number}`)}" loading="lazy"
           onerror="handleImageError(this)">
      <div class="episode-row__info">
        <span class="episode-row__num">الحلقة ${ep.episode_number}</span>
        <h4 class="episode-row__title">${esc(ep.title)}</h4>
        <span class="episode-row__views">${fmtNum(ep.views)} مشاهدة</span>
      </div>
      <span class="episode-row__play" aria-hidden="true">▶</span>
    </a>`;
}

// ---------- حالة التحميل (Skeleton) ----------
function showSkeleton(target, count = 8) {
  target.innerHTML = Array.from(
    { length: count },
    () => `<div class="skeleton-card" aria-hidden="true"></div>`
  ).join("");
}

// ---------- رسالة خطأ ----------
function showError(target, msg) {
  target.innerHTML = `<div class="error-box">${esc(msg)}</div>`;
}

// ---------- تشخيص ترقية الإصدار الثاني ----------
function v2MigrationMessage(error, fallbackMessage) {
  const details = String(error?.message || error?.details || error || "").toLowerCase();
  const isMissingSchema = /content_type|cartoon_categories|schema cache/.test(details);
  return isMissingSchema
    ? "يلزم تنفيذ ملف supabase-v2-migration.sql مرة واحدة في Supabase لتفعيل الأفلام والتصنيفات المتعددة."
    : fallbackMessage;
}

// ---------- أدوات نصية ----------
function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtNum(n) {
  return (Number(n) || 0).toLocaleString("ar-EG");
}

// ---------- جلب التصنيف (Cache بسيط) ----------
let __categoriesCache = null;
async function getCategories() {
  if (__categoriesCache) return __categoriesCache;
  const { data, error } = await sb
    .from(TABLES.categories)
    .select("id, name, slug");
  if (error) return [];
  __categoriesCache = data;
  return data;
}
async function getCategoryName(categoryId) {
  const cats = await getCategories();
  return cats.find((c) => c.id === categoryId);
}

// ---------- ربط المحتوى بتصنيفاته (متوافق مع البيانات السابقة) ----------
async function getCartoonCategories(cartoons) {
  const items = Array.isArray(cartoons) ? cartoons.filter((item) => item?.id) : [];
  const categoryById = new Map((await getCategories()).map((category) => [category.id, category]));
  const result = new Map(items.map((item) => [item.id, []]));
  if (!items.length) return result;

  const { data, error } = await sb
    .from("cartoon_categories")
    .select("cartoon_id, category_id")
    .in("cartoon_id", items.map((item) => item.id));

  if (!error) {
    (data || []).forEach((link) => {
      const category = categoryById.get(link.category_id);
      if (category && result.has(link.cartoon_id)) result.get(link.cartoon_id).push(category);
    });
  }

  items.forEach((item) => {
    const linked = result.get(item.id) || [];
    const primary = categoryById.get(item.category_id);
    if (primary && !linked.some((category) => category.id === primary.id)) linked.unshift(primary);
    result.set(item.id, linked);
  });

  return result;
}

// ---------- قائمتي (محفوظة محليًا في الجهاز) ----------
const MY_LIST_STORAGE_KEY = "alam-alcartoon-my-list-v1";

function getMyListItems() {
  try {
    const parsed = JSON.parse(localStorage.getItem(MY_LIST_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item && item.id) : [];
  } catch {
    return [];
  }
}

function isInMyList(cartoonId) {
  return getMyListItems().some((item) => item.id === cartoonId);
}

function toggleMyList(cartoon) {
  const current = getMyListItems();
  const index = current.findIndex((item) => item.id === cartoon.id);
  if (index >= 0) {
    current.splice(index, 1);
  } else {
    current.unshift({
      id: cartoon.id,
      title: cartoon.title || "",
      poster_url: cartoon.poster_url || "",
      banner_url: cartoon.banner_url || "",
      release_year: cartoon.release_year || null,
      status: cartoon.status || "",
      content_type: cartoon.content_type || "series",
    });
  }
  localStorage.setItem(MY_LIST_STORAGE_KEY, JSON.stringify(current.slice(0, 100)));
  return index < 0;
}

// ---------- عداد المشاهدات (مرّة واحدة لكل جلسة) ----------
const VIEW_KEY = "cartoon_session_key";

function getSessionKey() {
  let key = sessionStorage.getItem(VIEW_KEY);
  if (!key) {
    key = crypto.randomUUID();
    sessionStorage.setItem(VIEW_KEY, key);
  }
  return key;
}

async function incrementEpisodeViews(episodeId) {
  try {
    const { error } = await sb.rpc("increment_views", {
      p_episode_id: episodeId,
      p_session_key: getSessionKey(),
    });
    if (error) console.warn("فشل تحديث المشاهدات:", error.message);
  } catch (e) {
    console.warn("فشل تحديث المشاهدات:", e);
  }
}

// ---------- تنسيق التاريخ ----------
function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}


// ---------- شاشة الترحيب ----------
const WELCOME_SESSION_KEY = "alam-alcartoon-welcome-seen-v1";
const CONTACT_LINKS = {
  instagram: "https://www.instagram.com/m.a.4.w.a.n?igsh=MXQ1ZW5zbmp6Y2w4NA==",
  whatsappSyria: "https://wa.me/963947733035",
  whatsappEgypt: "https://wa.me/201095964960",
};

function hasSeenWelcome() {
  try {
    return window.sessionStorage.getItem(WELCOME_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markWelcomeSeen() {
  try {
    window.sessionStorage.setItem(WELCOME_SESSION_KEY, "1");
  } catch {
    // إذا منع المتصفح sessionStorage، يبقى سلوك الشاشة آمنًا لكنه قد يتكرر بين الصفحات.
  }
}

function initWelcomeScreen() {
  if (!document.body || document.querySelector(".welcome-overlay") || hasSeenWelcome()) return;
  markWelcomeSeen();

  document.body.classList.add("welcome-open");
  document.body.insertAdjacentHTML("afterbegin", `
    <section class="welcome-overlay" aria-label="شاشة الترحيب" role="dialog" aria-modal="true">
      <div class="welcome-overlay__content">
        <div class="welcome-overlay__brand">
          <span class="welcome-overlay__brand-mark" aria-hidden="true">ك</span>
          <span>عالم الكرتون</span>
        </div>

        <p class="welcome-overlay__message">
          <strong>أهلًا بك في عالم الكرتون</strong>
          استمتع بمشاهدة مسلسلاتك وأفلامك الكرتونية المفضلة في مكان واحد.
        </p>

        <div class="welcome-overlay__actions">
          <button class="welcome-overlay__button" type="button" data-welcome-enter>
            الدخول
          </button>
          <button class="welcome-overlay__button welcome-overlay__button--secondary" type="button" data-welcome-contact aria-expanded="false" aria-controls="welcome-contact-options">
            تواصل معي
          </button>
          <div class="welcome-overlay__contact-options" id="welcome-contact-options" hidden>
            <a class="welcome-overlay__contact-link welcome-overlay__contact-link--instagram" href="${CONTACT_LINKS.instagram}" target="_blank" rel="noopener noreferrer">زيارة إنستغرام</a>
            <a class="welcome-overlay__contact-link" href="${CONTACT_LINKS.whatsappSyria}" target="_blank" rel="noopener noreferrer">واتساب المطور <bdi dir="ltr">+963 947 733 035</bdi></a>
            <a class="welcome-overlay__contact-link" href="${CONTACT_LINKS.whatsappEgypt}" target="_blank" rel="noopener noreferrer">واتساب المطور <bdi dir="ltr">+20 10 9596 4960</bdi></a>
          </div>
        </div>
      </div>
    </section>
  `);

  const overlay = document.querySelector(".welcome-overlay");
  const enterButton = overlay?.querySelector("[data-welcome-enter]");
  const contactButton = overlay?.querySelector("[data-welcome-contact]");
  const contactOptions = overlay?.querySelector("#welcome-contact-options");

  const closeWelcome = () => {
    if (!overlay) return;
    overlay.style.opacity = "0";
    overlay.style.pointerEvents = "none";
    document.body.classList.remove("welcome-open");
    window.setTimeout(() => overlay.remove(), 180);
  };

  enterButton?.addEventListener("click", closeWelcome);
  contactButton?.addEventListener("click", () => {
    const willOpen = contactOptions?.hidden !== false;
    if (contactOptions) contactOptions.hidden = !willOpen;
    contactButton.setAttribute("aria-expanded", String(willOpen));
  });
  contactOptions?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => window.setTimeout(closeWelcome, 80));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeWelcome();
  }, { once: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initWelcomeScreen, { once: true });
} else {
  initWelcomeScreen();
}

// ---------- شريط التنقل السفلي لتجربة تطبيق الهاتف ----------
function initAppBottomNav() {
  if (!document.body || document.querySelector(".app-bottom-nav")) return;

  const page = location.pathname.split("/").pop() || "index.html";
  const type = new URLSearchParams(location.search).get("type");
  const active = type === "movies" ? "movies"
    : type === "series" ? "series"
    : type === "my-list" ? "my-list"
    : page === "search.html" ? "search"
    : page === "index.html" ? "home"
    : "";

  const icon = (name) => ({
    home: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.7 12 3l9 7.7v9.8a.5.5 0 0 1-.5.5h-5.2v-6.5H8.7V21H3.5a.5.5 0 0 1-.5-.5z"/></svg>`,
    series: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="m10 8 5 4-5 4z"/></svg>`,
    movies: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><path d="M7 5v14M17 5v14M2 10h20"/></svg>`,
    search: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.2 4.2"/></svg>`,
    list: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h13M6 12h13M6 19h13"/><circle cx="3" cy="5" r="1"/><circle cx="3" cy="12" r="1"/><circle cx="3" cy="19" r="1"/></svg>`,
  })[name];

  const items = [
    { id: "home", label: "الرئيسية", href: "index.html", icon: icon("home") },
    { id: "series", label: "المسلسلات", href: "search.html?type=series", icon: icon("series") },
    { id: "search", label: "البحث", href: "search.html", icon: icon("search") },
    { id: "movies", label: "الأفلام", href: "search.html?type=movies", icon: icon("movies") },
    { id: "my-list", label: "قائمتي", href: "search.html?type=my-list", icon: icon("list") },
  ];

  document.body.insertAdjacentHTML("beforeend", `
    <nav class="app-bottom-nav" aria-label="التنقل الرئيسي">
      ${items.map((item) => `
        <a class="app-bottom-nav__item ${active === item.id ? "is-active" : ""}" href="${item.href}" ${active === item.id ? 'aria-current="page"' : ""}>
          <span class="app-bottom-nav__icon">${item.icon}</span>
          <span class="app-bottom-nav__label">${item.label}</span>
        </a>`).join("")}
    </nav>`);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAppBottomNav, { once: true });
} else {
  initAppBottomNav();
}

// ---------- تحليل روابط الفيديو في الموقع العام ----------
function parseYouTubeReference(input) {
  const value = String(input || "").trim();
  if (!value) return { valid: false, message: "رابط الفيديو مفقود" };
  const stored = value.match(/^youtube:([A-Za-z0-9_-]{11})$/i);
  if (stored) {
    return { valid: true, kind: "youtube", id: stored[1], videoId: stored[1], stored: `youtube:${stored[1]}` };
  }
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) {
    return { valid: true, kind: "youtube", id: value, videoId: value, stored: `youtube:${value}` };
  }
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    let videoId = "";
    if (host === "youtu.be" || host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      if (host === "youtu.be") videoId = url.pathname.split("/").filter(Boolean)[0] || "";
      else videoId = url.searchParams.get("v") || url.pathname.match(/\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/i)?.[1] || "";
    }
    if (/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      return { valid: true, kind: "youtube", id: videoId, videoId, stored: `youtube:${videoId}` };
    }
  } catch {
    // ليس رابط URL صالحًا؛ سيجرب محلل VK الصيغة التالية.
  }
  return { valid: false, message: "ليس رابط YouTube" };
}

function parseMediaReference(input) {
  const youtube = parseYouTubeReference(input);
  if (youtube.valid) return youtube;

  const direct = parseDirectReference(input);
  if (direct.valid) return direct;

  return parseVKReference(input);
}

// ---------- تحليل رابط الفيديو المباشر ----------
function parseDirectReference(input) {
  const original = String(input || "").trim();
  if (!original) return { valid: false, message: "رابط الفيديو مفقود" };

  const explicitlyDirect = /^direct:/i.test(original);
  const value = original.replace(/^direct:/i, "").trim();
  try {
    const url = new URL(value);
    if (!/^https?:$/i.test(url.protocol)) {
      return { valid: false, message: "يجب أن يبدأ الرابط المباشر بـ http أو https" };
    }

    const lowerValue = value.toLowerCase();
    const isHls = /\.m3u8(?:$|[?#])/.test(lowerValue) || /(?:format|type)=.*m3u8/.test(url.search.toLowerCase());
    const isVideoFile = /\.(?:mp4|webm|ogg|ogv|m4v|mov)(?:$|[?#])/.test(lowerValue);
    if (!isHls && !isVideoFile && !explicitlyDirect) {
      return { valid: false, message: "ليس رابط فيديو مباشرًا مدعومًا. استخدم MP4 أو WebM أو رابط HLS بصيغة M3U8، أو ابدأ الرابط الموقع بـ direct:." };
    }

    return {
      valid: true,
      kind: "direct",
      url: url.toString(),
      isHls,
      stored: `direct:${url.toString()}`,
      message: isHls ? "تم التعرف على بث HLS مباشر (M3U8)" : (isVideoFile ? "تم التعرف على ملف فيديو مباشر" : "تم التعرف على رابط مباشر معلن"),
    };
  } catch {
    return { valid: false, message: "رابط الفيديو المباشر غير صالح" };
  }
}

// ---------- تحليل مرجع VK في الموقع العام ----------
// يقرأ القيمة الموثوقة المحفوظة من لوحة التحكم، بما فيها رابط video_ext الكامل.
function parseVKReference(input) {
  const value = String(input || "").trim();
  if (!value) return { valid: false, message: "رابط VK مفقود" };

  const storedEmbed = value.startsWith("embed:") ? value.slice(6) : value;
  const srcMatch = storedEmbed.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  const src = srcMatch ? srcMatch[1] : storedEmbed;
  const extMatch = src.match(/(?:https?:)?\/\/[^\s"']+\/video_ext\.php\?([^\s"']+)/i);
  if (extMatch) {
    const query = new URLSearchParams(extMatch[1].replace(/&amp;/g, "&"));
    const ownerId = query.get("oid");
    const videoId = query.get("id");
    if (ownerId && videoId) {
      return {
        valid: true,
        kind: "video",
        id: `${ownerId}_${videoId}`,
        ownerId,
        videoId,
        embedUrl: `${src.split("?")[0]}?${query.toString()}`,
      };
    }
  }

  const wallStored = value.match(/^wall:(-?\d+)_([0-9]+)(?::([^:]+))?$/i);
  if (wallStored) {
    return {
      valid: Boolean(wallStored[3]),
      kind: "wall",
      id: `${wallStored[1]}_${wallStored[2]}`,
      ownerId: wallStored[1],
      postId: wallStored[2],
      hash: wallStored[3] || "",
      wallUrl: `https://vk.ru/wall${wallStored[1]}_${wallStored[2]}`,
      message: wallStored[3] ? "منشور VK مع hash" : "منشور VK يحتاج hash التضمين",
    };
  }

  const clean = value.replace(/[?#].*$/, "").replace(/\/+$/, "");
  const videoMatch = clean.match(/(?:^|\/)(?:video)(-?\d+)_([0-9]+)$/i);
  if (videoMatch) {
    return {
      valid: true,
      kind: "video",
      id: `${videoMatch[1]}_${videoMatch[2]}`,
      ownerId: videoMatch[1],
      videoId: videoMatch[2],
      embedUrl: `https://vk.ru/video_ext.php?oid=${videoMatch[1]}&id=${videoMatch[2]}`,
    };
  }

  const idMatch = value.match(/^(-?\d+)_([0-9]+)$/);
  if (idMatch) {
    return {
      valid: true,
      kind: "video",
      id: `${idMatch[1]}_${idMatch[2]}`,
      ownerId: idMatch[1],
      videoId: idMatch[2],
      embedUrl: `https://vk.ru/video_ext.php?oid=${idMatch[1]}&id=${idMatch[2]}`,
    };
  }

  return { valid: false, message: "صيغة رابط VK غير معروفة" };
}
