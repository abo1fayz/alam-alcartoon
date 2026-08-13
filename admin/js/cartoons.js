/* ============================================================
   cartoons.js  — إدارة المسلسلات (إضافة/تعديل/حذف + رفع صور)
   ============================================================ */

(async function () {
  /* async IIFE — دعم await داخل script عادي */
  const adminSession = await window.adminAuthReady;
  if (!adminSession) return;
const tableArea = document.getElementById("table-area");
const searchInput = document.getElementById("search-input");
const addBtn = document.getElementById("add-btn");
const modal = document.getElementById("cartoon-modal");
const form = document.getElementById("cartoon-form");
const modalTitle = document.getElementById("modal-title");

let allCartoons = [];
let allCategories = [];
let editingId = null;

// ---------- التحقق من Supabase ----------
const backendOk = await checkSupabase();
if (!backendOk) showConnectionWarning();

// ---------- تحميل البيانات ----------
async function load() {
  try {
    [allCartoons, allCategories] = await Promise.all([
      API.get("cartoons"),
      API.get("categories"),
    ]);
    render();
    fillCategorySelect();
  } catch (err) {
    tableArea.innerHTML = `<div class="error-box">حدث خطأ: ${esc(err.message)}</div>`;
  }
}

// ---------- تعبئة قائمة التصنيفات ----------
function fillCategorySelect() {
  const select = document.getElementById("f-category");
  select.innerHTML =
    `<option value="">— اختر تصنيفًا —</option>` +
    allCategories
      .map((c) => `<option value="${c.id}">${esc(c.name)}</option>`)
      .join("");
}

// ---------- عرض الجدول ----------
function render() {
  const q = searchInput.value.trim().toLowerCase();
  const filtered = allCartoons.filter((c) =>
    c.title.toLowerCase().includes(q)
  );

  if (!filtered.length) {
    tableArea.innerHTML = `<div class="empty-box">
      ${allCartoons.length ? "لا توجد نتائج مطابقة" : "لا توجد مسلسلات — أضف أول مسلسل!"}
    </div>`;
    return;
  }

  tableArea.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>البوستر</th>
            <th>الاسم</th>
            <th>التصنيف</th>
            <th>السنة</th>
            <th>الحالة</th>
            <th>المشاهدات</th>
            <th>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          ${filtered
            .map(
              (c) => `
            <tr>
              <td><img class="tbl-img" src="${c.poster_url || ""}" alt="" onerror="this.style.visibility='hidden'"></td>
              <td>${esc(c.title)}</td>
              <td>${esc(allCategories.find((x) => x.id === c.category_id)?.name || "—")}</td>
              <td>${c.release_year || "—"}</td>
              <td>${esc(c.status)}</td>
              <td>${fmtNum(c.views)}</td>
              <td>
                <button class="btn btn--ghost btn--sm" data-edit="${c.id}">تعديل</button>
                <button class="btn btn--danger btn--sm" data-del="${c.id}">حذف</button>
              </td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`;

  // ربط الأزرار
  tableArea.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => openEdit(btn.dataset.edit));
  });
  tableArea.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => deleteCartoon(btn.dataset.del));
  });
}

searchInput.addEventListener("input", render);

// ---------- فتح نافذة الإضافة ----------
function resetForm() {
  form.reset();
  document.getElementById("cartoon-id").value = "";
  document.getElementById("f-poster-url").value = "";
  document.getElementById("f-banner-url").value = "";
  document.getElementById("f-poster-preview").style.display = "none";
  document.getElementById("f-banner-preview").style.display = "none";
  editingId = null;
  modalTitle.textContent = "إضافة مسلسل";
}

addBtn.addEventListener("click", () => {
  resetForm();
  openModal(modal);
});

// ---------- فتح نافذة التعديل ----------
function openEdit(id) {
  const c = allCartoons.find((x) => x.id === id);
  if (!c) return;

  resetForm();
  editingId = id;
  modalTitle.textContent = "تعديل مسلسل";

  document.getElementById("cartoon-id").value = id;
  document.getElementById("f-title").value = c.title || "";
  document.getElementById("f-desc").value = c.description || "";
  document.getElementById("f-category").value = c.category_id || "";
  document.getElementById("f-year").value = c.release_year || "";
  document.getElementById("f-status").value = c.status || "مستمر";

  if (c.poster_url) {
    document.getElementById("f-poster-url").value = c.poster_url;
    const prev = document.getElementById("f-poster-preview");
    prev.src = c.poster_url;
    prev.style.display = "block";
  }
  if (c.banner_url) {
    document.getElementById("f-banner-url").value = c.banner_url;
    const prev = document.getElementById("f-banner-preview");
    prev.src = c.banner_url;
    prev.style.display = "block";
  }

  openModal(modal);
}

// ---------- معاينة الصور قبل الرفع ----------
document.getElementById("f-poster-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  const prev = document.getElementById("f-poster-preview");
  prev.src = url;
  prev.style.display = "block";
});

document.getElementById("f-banner-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  const prev = document.getElementById("f-banner-preview");
  prev.src = url;
  prev.style.display = "block";
});

// ---------- رفع صورة (إرجاع URL العام) ----------
async function uploadFile(fileInputId, folder) {
  const fileEl = document.getElementById(fileInputId);
  if (!fileEl.files[0]) return null;

  const file = fileEl.files[0];
  const base64 = await fileToBase64(file);
  const publicUrl = await API.uploadImage({
    base64,
    folder,
    fileName: `${folder}-${Date.now()}`,
  });
  return publicUrl;
}

// ---------- حفظ (إضافة أو تعديل) ----------
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const saveBtn = document.getElementById("save-btn");
  saveBtn.disabled = true;
  saveBtn.textContent = "جارٍ الحفظ...";

  try {
    // رفع الصور الجديدة إن وجدت
    const posterUrl =
      (await uploadFile("f-poster-file", "posters")) ||
      document.getElementById("f-poster-url").value ||
      null;
    const bannerUrl =
      (await uploadFile("f-banner-file", "banners")) ||
      document.getElementById("f-banner-url").value ||
      null;

    const body = {
      title: document.getElementById("f-title").value.trim(),
      description: document.getElementById("f-desc").value.trim(),
      category_id: document.getElementById("f-category").value || null,
      release_year: document.getElementById("f-year").value
        ? parseInt(document.getElementById("f-year").value)
        : null,
      status: document.getElementById("f-status").value,
      poster_url: posterUrl,
      banner_url: bannerUrl,
    };

    if (editingId) {
      await API.update("cartoons", editingId, body);
      toast("تم تعديل المسلسل بنجاح");
    } else {
      await API.create("cartoons", body);
      toast("تمت إضافة المسلسل بنجاح");
    }

    closeModal(modal);
    await load();
  } catch (err) {
    toast("فشل الحفظ: " + err.message, true);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "حفظ";
  }
});

// ---------- حذف مسلسل ----------
async function deleteCartoon(id) {
  const c = allCartoons.find((x) => x.id === id);
  if (!c) return;
  if (!confirm(`هل أنت متأكد من حذف مسلسل "${c.title}"؟\nسيتم حذف مواسمه وحلقاته أيضًا.`)) return;

  try {
    await API.remove("cartoons", id);
    toast("تم حذف المسلسل");
    await load();
  } catch (err) {
    toast("فشل الحذف: " + err.message, true);
  }
}

// إغلاق النافذة
document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => closeModal(modal));
});

load();
})();
