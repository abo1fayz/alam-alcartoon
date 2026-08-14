/* ============================================================
   categories.js  — إدارة التصنيفات
   ============================================================ */

(async function () {
  /* async IIFE — دعم await داخل script عادي */
  const adminSession = await window.adminAuthReady;
  if (!adminSession) return;
const tableArea = document.getElementById("table-area");
const addBtn = document.getElementById("add-btn");
const modal = document.getElementById("category-modal");
const form = document.getElementById("category-form");
const modalTitle = document.getElementById("modal-title");

let allCategories = [];
let allCartoons = [];
let categoryLinksByCartoon = new Map();
let editingId = null;

const backendOk = await checkSupabase();
if (!backendOk) showConnectionWarning();

// ---------- تحميل البيانات ----------
async function load() {
  try {
    const [categories, cartoons, linksResult] = await Promise.all([
      API.get("categories"),
      API.get("cartoons"),
      sb.from("cartoon_categories").select("cartoon_id, category_id"),
    ]);
    allCategories = categories;
    allCartoons = cartoons;
    categoryLinksByCartoon = new Map();
    (linksResult.data || []).forEach((link) => {
      const linked = categoryLinksByCartoon.get(link.cartoon_id) || [];
      linked.push(link.category_id);
      categoryLinksByCartoon.set(link.cartoon_id, linked);
    });
    render();
  } catch (err) {
    tableArea.innerHTML = `<div class="error-box">حدث خطأ: ${esc(err.message)}</div>`;
  }
}

// ---------- عرض الجدول ----------
function render() {
  if (!allCategories.length) {
    tableArea.innerHTML = `<div class="empty-box">
      لا توجد تصنيفات — أضف أول تصنيف (مثل: أكشن، مغامرة، تعليمي)
    </div>`;
    return;
  }

  tableArea.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>الاسم</th>
            <th>Slug</th>
            <th>عدد المسلسلات</th>
            <th>تاريخ الإضافة</th>
            <th>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          ${allCategories
            .map(
              (c) => {
                const count = allCartoons.filter((cartoon) => {
                  const ids = new Set([...(categoryLinksByCartoon.get(cartoon.id) || []), cartoon.category_id].filter(Boolean));
                  return ids.has(c.id);
                }).length;
                return `
              <tr>
                <td>${esc(c.name)}</td>
                <td dir="ltr">${esc(c.slug)}</td>
                <td>${count}</td>
                <td>${fmtDate(c.created_at)}</td>
                <td>
                  <button class="btn btn--ghost btn--sm" data-edit="${c.id}">تعديل</button>
                  <button class="btn btn--danger btn--sm" data-del="${c.id}">حذف</button>
                </td>
              </tr>`;
              }
            )
            .join("")}
        </tbody>
      </table>
    </div>`;

  tableArea.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => openEdit(btn.dataset.edit));
  });
  tableArea.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => deleteCategory(btn.dataset.del));
  });
}

// ---------- نافذة الإضافة ----------
function resetForm() {
  form.reset();
  document.getElementById("category-id").value = "";
  editingId = null;
  modalTitle.textContent = "إضافة تصنيف";
}

addBtn.addEventListener("click", () => {
  resetForm();
  openModal(modal);
});

// ---------- نافذة التعديل ----------
function openEdit(id) {
  const c = allCategories.find((x) => x.id === id);
  if (!c) return;
  resetForm();
  editingId = id;
  modalTitle.textContent = "تعديل تصنيف";
  document.getElementById("category-id").value = id;
  document.getElementById("f-name").value = c.name;
  document.getElementById("f-slug").value = c.slug;
  openModal(modal);
}

// ---------- حفظ ----------
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const saveBtn = document.getElementById("save-btn");
  saveBtn.disabled = true;
  saveBtn.textContent = "جارٍ الحفظ...";

  try {
    const body = {
      name: document.getElementById("f-name").value.trim(),
      slug: document.getElementById("f-slug").value.trim().toLowerCase(),
    };

    if (!/^[a-z0-9-]+$/.test(body.slug)) {
      throw new Error("الـ Slug يجب أن يحتوي أحرف إنجليزية صغيرة وأرقام وشرطة فقط");
    }

    if (editingId) {
      await API.update("categories", editingId, body);
      toast("تم تعديل التصنيف بنجاح");
    } else {
      await API.create("categories", body);
      toast("تمت إضافة التصنيف بنجاح");
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

// ---------- حذف تصنيف ----------
async function deleteCategory(id) {
  const c = allCategories.find((x) => x.id === id);
  const count = allCartoons.filter((cartoon) => {
    const ids = new Set([...(categoryLinksByCartoon.get(cartoon.id) || []), cartoon.category_id].filter(Boolean));
    return ids.has(id);
  }).length;
  const msg = count
    ? `هذا التصنيف مربوط بـ ${count} عنصر/عناصر محتوى.\nهل أنت متأكد من حذف التصنيف "${c.name}"؟`
    : `هل أنت متأكد من حذف التصنيف "${c.name}"؟`;
  if (!confirm(msg)) return;

  try {
    await API.remove("categories", id);
    toast("تم حذف التصنيف");
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
