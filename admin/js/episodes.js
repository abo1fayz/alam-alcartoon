/* ============================================================
   episodes.js  — إدارة الحلقات
   ============================================================ */

(async function () {
  /* async IIFE — دعم await داخل script عادي */
  const adminSession = await window.adminAuthReady;
  if (!adminSession) return;
const tableArea = document.getElementById("table-area");
const filterCartoon = document.getElementById("filter-cartoon");
const addBtn = document.getElementById("add-btn");
const modal = document.getElementById("episode-modal");
const form = document.getElementById("episode-form");
const modalTitle = document.getElementById("modal-title");

const fCartoon = document.getElementById("f-cartoon");
const fSeason = document.getElementById("f-season");
const vkInput = document.getElementById("f-vk");
const vkStatus = document.getElementById("vk-status");

let allEpisodes = [];
let allCartoons = [];
let allSeasons = [];
let editingId = null;

const backendOk = await checkSupabase();
if (!backendOk) showConnectionWarning();

// ---------- تحميل البيانات ----------
async function load() {
  try {
    [allEpisodes, allCartoons, allSeasons] = await Promise.all([
      API.get("episodes"),
      API.get("cartoons"),
      API.get("seasons"),
    ]);
    fillFilter();
    fillCartoonSelect();
    render();
  } catch (err) {
    tableArea.innerHTML = `<div class="error-box">حدث خطأ: ${esc(err.message)}</div>`;
  }
}

function fillFilter() {
  filterCartoon.innerHTML =
    `<option value="">جميع المسلسلات</option>` +
    allCartoons.map((c) => `<option value="${c.id}">${esc(c.title)}</option>`).join("");
}

function fillCartoonSelect() {
  fCartoon.innerHTML =
    `<option value="">— اختر مسلسلًا —</option>` +
    allCartoons.map((c) => `<option value="${c.id}">${esc(c.title)}</option>`).join("");
}

// ---------- تحديث قائمة المواسم حسب المسلسل المختار ----------
function updateVKStatus(value) {
  if (!vkStatus) return { valid: false, message: "حقل الفيديو غير موجود" };
  const parsed = parseMediaReference(value);
  vkStatus.textContent = parsed.message || "";
  vkStatus.classList.toggle("is-error", !parsed.valid && Boolean(value));
  vkStatus.classList.toggle("is-success", parsed.valid);
  return parsed;
}

vkInput?.addEventListener("input", () => updateVKStatus(vkInput.value));

function fillSeasonSelect(cartoonId) {
  const seasons = allSeasons
    .filter((s) => s.cartoon_id === cartoonId)
    .sort((a, b) => a.season_number - b.season_number);

  fSeason.innerHTML =
    `<option value="">— اختر موسمًا —</option>` +
    seasons
      .map((s) => `<option value="${s.id}">الموسم ${s.season_number}${s.title ? " — " + esc(s.title) : ""}</option>`)
      .join("");
}

fCartoon.addEventListener("change", () => {
  fillSeasonSelect(fCartoon.value);
});

filterCartoon.addEventListener("change", render);

// ---------- عرض الجدول ----------
function render() {
  // ربط كل حلقة بالمسلسل عبر الموسم
  const enriched = allEpisodes
    .map((ep) => {
      const season = allSeasons.find((s) => s.id === ep.season_id);
      const cartoon = season ? allCartoons.find((c) => c.id === season.cartoon_id) : null;
      return { ...ep, _season: season, _cartoon: cartoon };
    })
    .filter(
      (ep) =>
        !filterCartoon.value || (ep._cartoon && ep._cartoon.id === filterCartoon.value)
    )
    .sort((a, b) => {
      if (a._cartoon?.id !== b._cartoon?.id) return 0;
      if ((a._season?.season_number || 0) !== (b._season?.season_number || 0))
        return (a._season?.season_number || 0) - (b._season?.season_number || 0);
      return a.episode_number - b.episode_number;
    });

  if (!enriched.length) {
    tableArea.innerHTML = `<div class="empty-box">
      ${allEpisodes.length ? "لا توجد نتائج" : "لا توجد حلقات — أضف أول حلقة!"}
    </div>`;
    return;
  }

  tableArea.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>الصورة</th>
            <th>الحلقة</th>
            <th>المسلسل</th>
            <th>الموسم</th>
            <th>VK ID</th>
            <th>المشاهدات</th>
            <th>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          ${enriched
            .map(
              (ep) => `
            <tr>
              <td>
                ${ep.thumbnail_url
                  ? `<img class="preview-thumb" src="${ep.thumbnail_url}" alt="" onerror="this.style.visibility='hidden'">`
                  : "—"}
              </td>
              <td>م${ep._season?.season_number || "?"} ح${ep.episode_number}<br>${esc(ep.title) || `<span style="color:var(--text-dim)">بدون اسم</span>`}</td>
              <td>${esc(ep._cartoon?.title || "—")}</td>
              <td>${ep._season?.season_number || "—"}</td>
              <td dir="ltr" style="font-size:.8rem">${esc(ep.vk_video_id)}</td>
              <td>${fmtNum(ep.views)}</td>
              <td>
                <button class="btn btn--ghost btn--sm" data-edit="${ep.id}">تعديل</button>
                <button class="btn btn--danger btn--sm" data-del="${ep.id}">حذف</button>
              </td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`;

  tableArea.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => openEdit(btn.dataset.edit));
  });
  tableArea.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => deleteEpisode(btn.dataset.del));
  });
}

// ---------- نافذة الإضافة ----------
function resetForm() {
  form.reset();
  document.getElementById("episode-id").value = "";
  document.getElementById("f-thumb-url").value = "";
  document.getElementById("f-thumb-preview").style.display = "none";
  if (vkStatus) {
    vkStatus.textContent = "";
    vkStatus.className = "vk-input-status";
  }
  fSeason.innerHTML = `<option value="">— اختر مسلسلًا أولًا —</option>`;
  editingId = null;
  modalTitle.textContent = "إضافة حلقة";
}

addBtn.addEventListener("click", () => {
  resetForm();
  openModal(modal);
});

// ---------- نافذة التعديل ----------
function openEdit(id) {
  const ep = allEpisodes.find((x) => x.id === id);
  if (!ep) return;
  const season = allSeasons.find((s) => s.id === ep.season_id);

  resetForm();
  editingId = id;
  modalTitle.textContent = "تعديل حلقة";

  document.getElementById("episode-id").value = id;
  fCartoon.value = season?.cartoon_id || "";
  fillSeasonSelect(season?.cartoon_id);
  fSeason.value = ep.season_id;
  document.getElementById("f-number").value = ep.episode_number;
  document.getElementById("f-title").value = ep.title;
  document.getElementById("f-desc").value = ep.description || "";
  vkInput.value = vkReferenceToInput(ep.vk_video_id);
  updateVKStatus(vkInput.value);

  if (ep.thumbnail_url) {
    document.getElementById("f-thumb-url").value = ep.thumbnail_url;
    const prev = document.getElementById("f-thumb-preview");
    prev.src = ep.thumbnail_url;
    prev.style.display = "block";
  }

  openModal(modal);
}

// ---------- معاينة الصورة ----------
document.getElementById("f-thumb-file").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const prev = document.getElementById("f-thumb-preview");
  prev.src = URL.createObjectURL(file);
  prev.style.display = "block";
});

// ---------- رفع صورة ----------
async function uploadFile(fileInputId, folder) {
  const fileEl = document.getElementById(fileInputId);
  if (!fileEl.files[0]) return null;
  const base64 = await fileToBase64(fileEl.files[0]);
  return await API.uploadImage({
    base64,
    folder,
    fileName: `${folder}-${Date.now()}`,
  });
}

// ---------- التحقق من رقم الحلقة قبل الحفظ ----------
async function ensureEpisodeNumberAvailable(seasonId, episodeNumber, excludeId = null) {
  // تحديث القائمة قبل التحقق حتى نلتقط أي حلقة أُضيفت من جلسة أخرى.
  allEpisodes = await API.get("episodes");
  const duplicate = allEpisodes.find(
    (episode) =>
      episode.season_id === seasonId &&
      Number(episode.episode_number) === episodeNumber &&
      episode.id !== excludeId
  );

  if (!duplicate) return;

  const season = allSeasons.find((item) => item.id === seasonId);
  const seasonLabel = season ? `الموسم ${season.season_number}` : "هذا الموسم";
  const error = new Error(
    `رقم الحلقة ${episodeNumber} موجود بالفعل في ${seasonLabel}. استخدم رقمًا مختلفًا أو افتح الحلقة الموجودة للتعديل.`
  );
  error.code = "DUPLICATE_EPISODE";
  throw error;
}

// ---------- حفظ ----------
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const saveBtn = document.getElementById("save-btn");
  const numberInput = document.getElementById("f-number");
  const seasonId = fSeason.value;
  const episodeNumber = Number(numberInput.value);
  saveBtn.disabled = true;
  saveBtn.textContent = "جارٍ التحقق...";

  try {
    if (!seasonId) throw new Error("اختر الموسم أولًا");
    if (!Number.isInteger(episodeNumber) || episodeNumber < 1) {
      throw new Error("أدخل رقم حلقة صحيحًا يبدأ من 1");
    }

    await ensureEpisodeNumberAvailable(seasonId, episodeNumber, editingId);

    const mediaReference = updateVKStatus(vkInput.value);
    if (!mediaReference.valid) throw new Error(mediaReference.message);

    saveBtn.textContent = "جارٍ رفع الصورة والحفظ...";
    const thumbUrl =
      (await uploadFile("f-thumb-file", "thumbnails")) ||
      document.getElementById("f-thumb-url").value ||
      null;

    const body = {
      season_id: seasonId,
      episode_number: episodeNumber,
      title: document.getElementById("f-title").value.trim(),
      description: document.getElementById("f-desc").value.trim(),
      vk_video_id: mediaReference.stored,
      thumbnail_url: thumbUrl,
    };

    if (editingId) {
      await API.update("episodes", editingId, body);
      toast("تم تعديل الحلقة بنجاح");
    } else {
      await API.create("episodes", body);
      toast("تمت إضافة الحلقة بنجاح");
    }

    closeModal(modal);
    await load();
  } catch (err) {
    const isDuplicate =
      err?.code === "DUPLICATE_EPISODE" ||
      /duplicate key|unique constraint|episodes_season_id_episode_number_key/i.test(err?.message || "");
    const message = isDuplicate
      ? err.code === "DUPLICATE_EPISODE"
        ? err.message
        : `رقم الحلقة ${episodeNumber} موجود بالفعل في هذا الموسم. استخدم رقمًا مختلفًا.`
      : err.message || "تعذر حفظ الحلقة";
    toast(isDuplicate ? message : "فشل الحفظ: " + message, true);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "حفظ";
  }
});

// ---------- حذف حلقة ----------
async function deleteEpisode(id) {
  const ep = allEpisodes.find((x) => x.id === id);
  const season = allSeasons.find((s) => s.id === ep?.season_id);
  const cartoon = allCartoons.find((c) => c.id === season?.cartoon_id);
  if (!confirm(`هل أنت متأكد من حذف الحلقة ${ep?.episode_number} من "${cartoon?.title || "المسلسل"}"؟`)) return;

  try {
    await API.remove("episodes", id);
    toast("تم حذف الحلقة");
    await load();
  } catch (err) {
    toast("فشل الحذف: " + err.message, true);
  }
}

document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => closeModal(modal));
});

load();
})();
