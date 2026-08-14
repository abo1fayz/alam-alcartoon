/* ============================================================
   seasons.js — إدارة المواسم وصورة الغلاف الموحدة
   ============================================================ */

(async function () {
  const adminSession = await window.adminAuthReady;
  if (!adminSession) return;

  const tableArea = document.getElementById("table-area");
  const filterCartoon = document.getElementById("filter-cartoon");
  const addBtn = document.getElementById("add-btn");
  const modal = document.getElementById("season-modal");
  const form = document.getElementById("season-form");
  const modalTitle = document.getElementById("modal-title");
  const imageFile = document.getElementById("f-season-image-file");
  const imageUrl = document.getElementById("f-season-image-url");
  const imagePreview = document.getElementById("f-season-image-preview");

  let allSeasons = [];
  let allCartoons = [];
  let editingId = null;

  const backendOk = await checkSupabase();
  if (!backendOk) showConnectionWarning();

  function migrationMessage(error) {
    const details = String(error?.message || error || "").toLowerCase();
    if (/image_url|schema cache/.test(details)) {
      return "نفّذ ملف supabase-v3-season-images-migration.sql في Supabase مرة واحدة لتفعيل صورة الموسم الموحدة.";
    }
    return error?.message || "تعذر الاتصال بقاعدة البيانات";
  }

  // ---------- تحميل البيانات ----------
  async function load() {
    try {
      [allSeasons, allCartoons] = await Promise.all([
        API.get("seasons"),
        API.get("cartoons"),
      ]);
      fillFilter();
      fillCartoonSelect();
      render();
    } catch (error) {
      tableArea.innerHTML = `<div class="error-box">حدث خطأ: ${esc(migrationMessage(error))}</div>`;
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
    const select = document.getElementById("f-cartoon");
    select.innerHTML =
      `<option value="">— اختر محتوى —</option>` +
      allCartoons.map((cartoon) => `<option value="${cartoon.id}">${esc(cartoon.title)}</option>`).join("");
  }

  filterCartoon.addEventListener("change", render);

  // ---------- معاينة صورة الموسم ----------
  function setImagePreview(src) {
    const value = String(src || "").trim();
    if (!value) {
      imagePreview.removeAttribute("src");
      imagePreview.style.display = "none";
      return;
    }
    imagePreview.src = value;
    imagePreview.style.display = "block";
  }

  imageFile?.addEventListener("change", () => {
    const file = imageFile.files?.[0];
    if (!file) return;
    setImagePreview(URL.createObjectURL(file));
  });

  imageUrl?.addEventListener("change", () => {
    if (!imageFile?.files?.[0]) setImagePreview(imageUrl.value);
  });

  async function uploadSeasonImage() {
    const file = imageFile?.files?.[0];
    if (!file) return null;
    const base64 = await fileToBase64(file);
    return API.uploadImage({
      base64,
      folder: "season-covers",
      fileName: `season-cover-${Date.now()}`,
    });
  }

  // ---------- عرض الجدول ----------
  function render() {
    const filtered = allSeasons.filter(
      (season) => !filterCartoon.value || season.cartoon_id === filterCartoon.value
    );

    if (!filtered.length) {
      tableArea.innerHTML = `<div class="empty-box">
        ${allSeasons.length ? "لا توجد نتائج" : "لا توجد مواسم — أضف أول موسم!"}
      </div>`;
      return;
    }

    tableArea.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>صورة الموسم</th>
              <th>المحتوى</th>
              <th>رقم الموسم</th>
              <th>اسم الموسم</th>
              <th>تاريخ الإضافة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((season) => `
              <tr>
                <td>${season.image_url
                  ? `<img class="preview-thumb preview-thumb--season" src="${esc(season.image_url)}" alt="غلاف ${esc(season.title)}" onerror="this.style.visibility='hidden'">`
                  : "—"}</td>
                <td>${esc(allCartoons.find((cartoon) => cartoon.id === season.cartoon_id)?.title || "—")}</td>
                <td>${season.season_number}</td>
                <td>${esc(season.title)}</td>
                <td>${fmtDate(season.created_at)}</td>
                <td>
                  <button class="btn btn--ghost btn--sm" data-edit="${season.id}">تعديل</button>
                  <button class="btn btn--danger btn--sm" data-del="${season.id}">حذف</button>
                </td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;

    tableArea.querySelectorAll("[data-edit]").forEach((button) => {
      button.addEventListener("click", () => openEdit(button.dataset.edit));
    });
    tableArea.querySelectorAll("[data-del]").forEach((button) => {
      button.addEventListener("click", () => deleteSeason(button.dataset.del));
    });
  }

  // ---------- نافذة الإضافة والتعديل ----------
  function resetForm() {
    form.reset();
    document.getElementById("season-id").value = "";
    if (imageFile) imageFile.value = "";
    if (imageUrl) imageUrl.value = "";
    setImagePreview("");
    editingId = null;
    modalTitle.textContent = "إضافة موسم";
  }

  addBtn.addEventListener("click", () => {
    resetForm();
    openModal(modal);
  });

  function openEdit(id) {
    const season = allSeasons.find((item) => item.id === id);
    if (!season) return;

    resetForm();
    editingId = id;
    modalTitle.textContent = "تعديل موسم";
    document.getElementById("season-id").value = id;
    document.getElementById("f-cartoon").value = season.cartoon_id;
    document.getElementById("f-number").value = season.season_number;
    document.getElementById("f-title").value = season.title;
    if (imageUrl) imageUrl.value = season.image_url || "";
    setImagePreview(season.image_url);
    openModal(modal);
  }

  // ---------- حفظ ----------
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const saveBtn = document.getElementById("save-btn");
    saveBtn.disabled = true;
    saveBtn.textContent = "جارٍ رفع الصورة والحفظ...";

    try {
      const uploadedImage = await uploadSeasonImage();
      const body = {
        cartoon_id: document.getElementById("f-cartoon").value,
        season_number: parseInt(document.getElementById("f-number").value, 10),
        title: document.getElementById("f-title").value.trim() || `الموسم ${document.getElementById("f-number").value}`,
        image_url: uploadedImage || imageUrl?.value.trim() || null,
      };

      if (!body.cartoon_id) throw new Error("اختر المحتوى أولًا");
      if (!Number.isInteger(body.season_number) || body.season_number < 1) {
        throw new Error("أدخل رقم موسم صحيحًا يبدأ من 1");
      }

      if (editingId) {
        await API.update("seasons", editingId, body);
        toast("تم تعديل الموسم وصورته الموحدة بنجاح");
      } else {
        await API.create("seasons", body);
        toast("تمت إضافة الموسم بنجاح");
      }

      closeModal(modal);
      await load();
    } catch (error) {
      toast("فشل الحفظ: " + migrationMessage(error), true);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "حفظ";
    }
  });

  // ---------- حذف موسم ----------
  async function deleteSeason(id) {
    const season = allSeasons.find((item) => item.id === id);
    const cartoon = allCartoons.find((item) => item.id === season?.cartoon_id);
    if (!confirm(`هل أنت متأكد من حذف الموسم ${season?.season_number} من "${cartoon?.title || "المحتوى"}"؟\nسيتم حذف حلقاته أيضًا.`)) return;

    try {
      await API.remove("seasons", id);
      toast("تم حذف الموسم");
      await load();
    } catch (error) {
      toast("فشل الحذف: " + migrationMessage(error), true);
    }
  }

  document.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => closeModal(modal));
  });

  load();
})();
