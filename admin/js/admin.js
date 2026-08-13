/* ============================================================
   admin.js — وظائف مساعدة مشتركة بين صفحات لوحة التحكم
   ============================================================ */

function toast(msg, isError = false) {
  document.querySelectorAll(".toast").forEach((t) => t.remove());
  const el = document.createElement("div");
  el.className = `toast ${isError ? "toast--error" : ""}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function openModal(modalEl) {
  modalEl.classList.add("is-open");
}

function closeModal(modalEl) {
  modalEl.classList.remove("is-open");
}

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal")) e.target.classList.remove("is-open");
});

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

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function escAttr(str) {
  return esc(str).replace(/"/g, "&quot;");
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function checkSupabase() {
  try {
    const { error } = await sb.from("categories").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}

function showConnectionWarning() {
  const warn = document.createElement("div");
  warn.className = "backend-off";
  warn.innerHTML =
    "⚠️ تعذر الاتصال بـ Supabase. تحقق من رابط المشروع والمفتاح العام وسياسات RLS.";
  const container = document.querySelector(".main");
  if (container) container.prepend(warn);
}

function showTableSkeleton(target, rows = 5) {
  target.innerHTML = `
    <div class="table-wrap">
      <table>
        ${Array.from({ length: rows }, () => `
          <tr>${Array.from({ length: 4 }, () => `
            <td><div class="skeleton-cell"></div></td>`).join("")}</tr>`).join("")}
      </table>
    </div>`;
}


// ---------- تحليل روابط الوسائط ----------
function parseYouTubeReference(input) {
  const value = String(input || "").trim();
  if (!value) return { valid: false, message: "أدخل رابط YouTube أو VK" };
  const stored = value.match(/^youtube:([A-Za-z0-9_-]{11})$/i);
  if (stored) {
    return { valid: true, kind: "youtube", id: stored[1], videoId: stored[1], stored: `youtube:${stored[1]}`, message: `تم استخراج فيديو YouTube: ${stored[1]}` };
  }
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) {
    return { valid: true, kind: "youtube", id: value, videoId: value, stored: `youtube:${value}`, message: `تم استخدام معرّف YouTube: ${value}` };
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
      return { valid: true, kind: "youtube", id: videoId, videoId, stored: `youtube:${videoId}`, message: `تم استخراج فيديو YouTube: ${videoId}` };
    }
  } catch {
    // سيجرب محلل VK الصيغة لاحقًا.
  }
  return { valid: false, message: "ليس رابط YouTube صالحًا" };
}

function parseMediaReference(input) {
  const youtube = parseYouTubeReference(input);
  if (youtube.valid) return youtube;
  return parseVKReference(input);
}

// ---------- تحليل مرجع فيديو VK ----------
// يقبل رابط الفيديو، رابط video_ext الكامل، أو كود التضمين الذي ينسخه المستخدم من VK.
// روابط wall وحدها لا تحتوي hash التضمين، لذلك تُرفض برسالة واضحة بدل تشغيل مشغل معطّل.
function parseVKReference(input) {
  const value = String(input || "").trim();
  if (!value) return { valid: false, message: "أدخل رابط VK أو كود التضمين" };

  const srcMatch = value.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  const src = srcMatch ? srcMatch[1] : value;
  const extMatch = src.match(/(?:https?:)?\/\/[^\s"']+\/video_ext\.php\?([^\s"']+)/i);
  if (extMatch) {
    const query = new URLSearchParams(extMatch[1].replace(/&amp;/g, "&"));
    const ownerId = query.get("oid");
    const videoId = query.get("id");
    if (!ownerId || !videoId) {
      return { valid: false, message: "رابط video_ext لا يحتوي oid و id صحيحين" };
    }
    const embedUrl = buildVKEmbedUrl(src, query);
    const id = `${ownerId}_${videoId}`;
    return {
      valid: true,
      kind: "video",
      id,
      ownerId,
      videoId,
      embedUrl,
      stored: `embed:${embedUrl}`,
      message: `تم استخراج كود تشغيل الفيديو: ${id}${query.get("hash") ? " مع hash" : ""}`,
    };
  }

  const clean = value.replace(/[?#].*$/, "").replace(/\/+$/, "");
  const videoMatch = clean.match(/(?:^|\/)(?:video)(-?\d+)_([0-9]+)$/i);
  if (videoMatch) {
    const id = `${videoMatch[1]}_${videoMatch[2]}`;
    const embedUrl = `https://vk.ru/video_ext.php?oid=${encodeURIComponent(videoMatch[1])}&id=${encodeURIComponent(videoMatch[2])}`;
    return {
      valid: true,
      kind: "video",
      id,
      ownerId: videoMatch[1],
      videoId: videoMatch[2],
      embedUrl,
      stored: `embed:${embedUrl}`,
      message: `تم استخراج الفيديو: ${id}`,
    };
  }

  const wallMatch = clean.match(/(?:^|\/)(?:wall)(-?\d+)_([0-9]+)$/i);
  if (wallMatch) {
    const id = `${wallMatch[1]}_${wallMatch[2]}`;
    return {
      valid: false,
      kind: "wall",
      id,
      message: "رابط wall وحده لا يحتوي hash التضمين. افتح المنشور في VK ثم اختر مشاركة ← تصدير المنشور والصق كود التضمين كاملًا.",
    };
  }

  const postCodeMatch = value.match(/VK\.Widgets\.Post\s*\(\s*["'][^"']+["']\s*,\s*(-?\d+)\s*,\s*(\d+)\s*,\s*["']([^"']+)["']/i);
  if (postCodeMatch) {
    const id = `${postCodeMatch[1]}_${postCodeMatch[2]}`;
    return {
      valid: true,
      kind: "wall",
      id,
      ownerId: postCodeMatch[1],
      postId: postCodeMatch[2],
      hash: postCodeMatch[3],
      stored: `wall:${id}:${postCodeMatch[3]}`,
      message: `تم استخراج منشور VK مع hash: ${id}`,
    };
  }

  const idMatch = value.match(/^(-?\d+)_([0-9]+)$/);
  if (idMatch) {
    const id = `${idMatch[1]}_${idMatch[2]}`;
    const embedUrl = `https://vk.ru/video_ext.php?oid=${encodeURIComponent(idMatch[1])}&id=${encodeURIComponent(idMatch[2])}`;
    return {
      valid: true,
      kind: "video",
      id,
      ownerId: idMatch[1],
      videoId: idMatch[2],
      embedUrl,
      stored: `embed:${embedUrl}`,
      message: `تم استخدام معرّف الفيديو: ${id}`,
    };
  }

  return {
    valid: false,
    message: "الصيغة غير معروفة. الصق رابط الفيديو أو كود التضمين المصدر من VK.",
  };
}

function buildVKEmbedUrl(src, query) {
  const base = src.match(/^https?:\/\/[^/]+\/video_ext\.php/i)?.[0] || "https://vk.ru/video_ext.php";
  const params = new URLSearchParams();
  ["oid", "id", "hash", "hd", "t", "autoplay", "loop", "js_api"].forEach((key) => {
    const value = query.get(key);
    if (value !== null && value !== "") params.set(key, value);
  });
  return `${base}?${params.toString()}`;
}

function vkReferenceToInput(value) {
  const raw = String(value || "").trim();
  if (raw.startsWith("embed:")) return raw.slice(6);
  if (raw.startsWith("wall:")) {
    const [id, hash] = raw.slice(5).split(":");
    return hash ? `VK.Widgets.Post('vk_post_${id}', ${id.split("_")[0]}, ${id.split("_")[1]}, '${hash}', { width: '100%' });` : `https://m.vk.ru/wall${id}`;
  }
  if (/^-?\d+_\d+$/.test(raw)) return `https://vk.ru/video${raw}`;
  return raw;
}
