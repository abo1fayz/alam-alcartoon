/* ============================================================
   episodes.js — إدارة الحلقات
   تعتمد صورة الغلاف الموحدة المحفوظة في الموسم.
   ============================================================ */

(async function () {
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
  const mediaInput = document.getElementById("f-vk");
  const mediaStatus = document.getElementById("vk-status");

  let allEpisodes = [];
  let allCartoons = [];
  let allSeasons = [];
  let editingId = null;

  const backendOk = await checkSupabase();
  if (!backendOk) showConnectionWarning();

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
    } catch (error) {
      tableArea.innerHTML = `<div class="error-box">حدث خطأ: ${esc(error.message)}</div>`;
    }
  }

  function fillFilter() {
    const currentValue = filterCartoon.value;
    filterCartoon.innerHTML =
      `<option value="">جميع عناصر المحتوى</option>` +
      allCartoons.map((cartoon) => `<option value="${cartoon.id}">${esc(cartoon.title)}</option>`).join("");
    filterCartoon.value = currentValue;
  }

  function fillCartoonSelect() {
    fCartoon.innerHTML =
      `<option value="">— اختر محتوى —</option>` +
      allCartoons.map((cartoon) => `<option value="${cartoon.id}">${esc(cartoon.title)}</option>`).join("");
  }

  function updateMediaStatus(value) {
    if (!mediaStatus) return { valid: false, message: "حقل الفيديو غير موجود" };
    const parsed = parseMediaReference(value);
    mediaStatus.textContent = parsed.message || "";
    mediaStatus.classList.toggle("is-error", !parsed.valid && Boolean(value));
    mediaStatus.classList.toggle("is-success", parsed.valid);
    return parsed;
  }

  mediaInput?.addEventListener("input", () => updateMediaStatus(mediaInput.value));

  function fillSeasonSelect(cartoonId) {
    const seasons = allSeasons
      .filter((season) => season.cartoon_id === cartoonId)
      .sort((a, b) => a.season_number - b.season_number);

    fSeason.innerHTML =
      `<option value="">— اختر موسمًا —</option>` +
      seasons.map((season) => `<option value="${season.id}">الموسم ${season.season_number}${season.title ? " — " + esc(season.title) : ""}</option>`).join("");
  }

  fCartoon.addEventListener("change", () => fillSeasonSelect(fCartoon.value));
  filterCartoon.addEventListener("change", render);

  // ---------- عرض الجدول ----------
  function render() {
    const enriched = allEpisodes
      .map((episode) => {
        const season = allSeasons.find((item) => item.id === episode.season_id);
        const cartoon = season ? allCartoons.find((item) => item.id === season.cartoon_id) : null;
        return { ...episode, _season: season, _cartoon: cartoon };
      })
      .filter((episode) => !filterCartoon.value || episode._cartoon?.id === filterCartoon.value)
      .sort((a, b) => {
        if (a._cartoon?.id !== b._cartoon?.id) return 0;
        if ((a._season?.season_number || 0) !== (b._season?.season_number || 0)) {
          return (a._season?.season_number || 0) - (b._season?.season_number || 0);
        }
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
              <th>غلاف الموسم</th>
              <th>الحلقة</th>
              <th>المحتوى</th>
              <th>الموسم</th>
              <th>مصدر الفيديو</th>
              <th>المشاهدات</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            ${enriched.map((episode) => `
              <tr>
                <td>${episode._season?.image_url
                  ? `<img class="preview-thumb preview-thumb--season" src="${esc(episode._season.image_url)}" alt="غلاف الموسم" onerror="this.style.visibility='hidden'">`
                  : "—"}</td>
                <td>م${episode._season?.season_number || "?"} ح${episode.episode_number}<br>${esc(episode.title) || `<span style="color:var(--text-dim)">بدون اسم</span>`}</td>
                <td>${esc(episode._cartoon?.title || "—")}</td>
                <td>${episode._season?.season_number || "—"}</td>
                <td dir="ltr" style="font-size:.8rem">${esc(episode.vk_video_id)}</td>
                <td>${fmtNum(episode.views)}</td>
                <td>
                  <button class="btn btn--ghost btn--sm" data-edit="${episode.id}">تعديل</button>
                  <button class="btn btn--danger btn--sm" data-del="${episode.id}">حذف</button>
                </td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;

    tableArea.querySelectorAll("[data-edit]").forEach((button) => {
      button.addEventListener("click", () => openEdit(button.dataset.edit));
    });
    tableArea.querySelectorAll("[data-del]").forEach((button) => {
      button.addEventListener("click", () => deleteEpisode(button.dataset.del));
    });
  }

  // ---------- نافذة الإضافة والتعديل ----------
  function resetForm() {
    form.reset();
    document.getElementById("episode-id").value = "";
    if (mediaStatus) {
      mediaStatus.textContent = "";
      mediaStatus.className = "vk-input-status";
    }
    fSeason.innerHTML = `<option value="">— اختر المحتوى أولًا —</option>`;
    editingId = null;
    modalTitle.textContent = "إضافة حلقة";
  }

  addBtn.addEventListener("click", () => {
    resetForm();
    openModal(modal);
  });

  function openEdit(id) {
    const episode = allEpisodes.find((item) => item.id === id);
    if (!episode) return;
    const season = allSeasons.find((item) => item.id === episode.season_id);

    resetForm();
    editingId = id;
    modalTitle.textContent = "تعديل حلقة";
    document.getElementById("episode-id").value = id;
    fCartoon.value = season?.cartoon_id || "";
    fillSeasonSelect(season?.cartoon_id);
    fSeason.value = episode.season_id;
    document.getElementById("f-number").value = episode.episode_number;
    document.getElementById("f-title").value = episode.title;
    document.getElementById("f-desc").value = episode.description || "";
    mediaInput.value = vkReferenceToInput(episode.vk_video_id);
    updateMediaStatus(mediaInput.value);
    openModal(modal);
  }

  async function ensureEpisodeNumberAvailable(seasonId, episodeNumber, excludeId = null) {
    allEpisodes = await API.get("episodes");
    const duplicate = allEpisodes.find((episode) =>
      episode.season_id === seasonId &&
      Number(episode.episode_number) === episodeNumber &&
      episode.id !== excludeId
    );

    if (!duplicate) return;

    const season = allSeasons.find((item) => item.id === seasonId);
    const seasonLabel = season ? `الموسم ${season.season_number}` : "هذا الموسم";
    const error = new Error(`رقم الحلقة ${episodeNumber} موجود بالفعل في ${seasonLabel}. استخدم رقمًا مختلفًا أو افتح الحلقة الموجودة للتعديل.`);
    error.code = "DUPLICATE_EPISODE";
    throw error;
  }

  // ---------- حفظ ----------
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const saveBtn = document.getElementById("save-btn");
    const episodeNumber = Number(document.getElementById("f-number").value);
    const seasonId = fSeason.value;
    saveBtn.disabled = true;
    saveBtn.textContent = "جارٍ التحقق...";

    try {
      if (!seasonId) throw new Error("اختر الموسم أولًا");
      if (!Number.isInteger(episodeNumber) || episodeNumber < 1) {
        throw new Error("أدخل رقم حلقة صحيحًا يبدأ من 1");
      }

      await ensureEpisodeNumberAvailable(seasonId, episodeNumber, editingId);
      const mediaReference = updateMediaStatus(mediaInput.value);
      if (!mediaReference.valid) throw new Error(mediaReference.message);

      saveBtn.textContent = "جارٍ الحفظ...";
      const body = {
        season_id: seasonId,
        episode_number: episodeNumber,
        title: document.getElementById("f-title").value.trim(),
        description: document.getElementById("f-desc").value.trim(),
        vk_video_id: mediaReference.stored,
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
    } catch (error) {
      const isDuplicate = error?.code === "DUPLICATE_EPISODE" || /duplicate key|unique constraint|episodes_season_id_episode_number_key/i.test(error?.message || "");
      const message = isDuplicate
        ? (error.code === "DUPLICATE_EPISODE" ? error.message : `رقم الحلقة ${episodeNumber} موجود بالفعل في هذا الموسم. استخدم رقمًا مختلفًا.`)
        : (error.message || "تعذر حفظ الحلقة");
      toast(isDuplicate ? message : "فشل الحفظ: " + message, true);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "حفظ";
    }
  });

  // ---------- حذف حلقة ----------
  async function deleteEpisode(id) {
    const episode = allEpisodes.find((item) => item.id === id);
    const season = allSeasons.find((item) => item.id === episode?.season_id);
    const cartoon = allCartoons.find((item) => item.id === season?.cartoon_id);
    if (!confirm(`هل أنت متأكد من حذف الحلقة ${episode?.episode_number} من "${cartoon?.title || "المحتوى"}"؟`)) return;

    try {
      await API.remove("episodes", id);
      toast("تم حذف الحلقة");
      await load();
    } catch (error) {
      toast("فشل الحذف: " + error.message, true);
    }
  }

  document.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => closeModal(modal));
  });

  load();
})();
