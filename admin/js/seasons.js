/* ============================================================
   seasons.js  — إدارة المواسم
   ============================================================ */

(async function () {
  /* async IIFE — دعم await داخل script عادي */
  const adminSession = await window.adminAuthReady;
  if (!adminSession) return;
const tableArea = document.getElementById("table-area");
const filterCartoon = document.getElementById("filter-cartoon");
const addBtn = document.getElementById("add-btn");
const modal = document.getElementById("season-modal");
const form = document.getElementById("season-form");
const modalTitle = document.getElementById("modal-title");

let allSeasons = [];
let allCartoons = [];
let editingId = null;

const backendOk = await checkSupabase();
if (!backendOk) showConnectionWarning();

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
  const select = document.getElementById("f-cartoon");
  select.innerHTML =
    `<option value="">— اختر مسلسلًا —</option>` +
    allCartoons.map((c) => `<option value="${c.id}">${esc(c.title)}</option>`).join("");
}

filterCartoon.addEventListener("change", render);

// ---------- عرض الجدول ----------
function render() {
  const filtered = allSeasons.filter(
    (s) => !filterCartoon.value || s.cartoon_id === filterCartoon.value
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
            <th>المسلسل</th>
            <th>رقم الموسم</th>
            <th>اسم الموسم</th>
            <th>تاريخ الإضافة</th>
            <th>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          ${filtered
            .map(
              (s) => `
            <tr>
              <td>${esc(allCartoons.find((c) => c.id === s.cartoon_id)?.title || "—")}</td>
              <td>${s.season_number}</td>
              <td>${esc(s.title)}</td>
              <td>${fmtDate(s.created_at)}</td>
              <td>
                <button class="btn btn--ghost btn--sm" data-edit="${s.id}">تعديل</button>
                <button class="btn btn--danger btn--sm" data-del="${s.id}">حذف</button>
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
    btn.addEventListener("click", () => deleteSeason(btn.dataset.del));
  });
}

// ---------- نافذة الإضافة ----------
function resetForm() {
  form.reset();
  document.getElementById("season-id").value = "";
  editingId = null;
  modalTitle.textContent = "إضافة موسم";
}

addBtn.addEventListener("click", () => {
  resetForm();
  openModal(modal);
});

function openEdit(id) {
  const s = allSeasons.find((x) => x.id === id);
  if (!s) return;
  resetForm();
  editingId = id;
  modalTitle.textContent = "تعديل موسم";
  document.getElementById("season-id").value = id;
  document.getElementById("f-cartoon").value = s.cartoon_id;
  document.getElementById("f-number").value = s.season_number;
  document.getElementById("f-title").value = s.title;
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
      cartoon_id: document.getElementById("f-cartoon").value,
      season_number: parseInt(document.getElementById("f-number").value),
      title: document.getElementById("f-title").value.trim() ||
             `الموسم ${document.getElementById("f-number").value}`,
    };

    if (editingId) {
      await API.update("seasons", editingId, body);
      toast("تم تعديل الموسم بنجاح");
    } else {
      await API.create("seasons", body);
      toast("تمت إضافة الموسم بنجاح");
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

// ---------- حذف موسم ----------
async function deleteSeason(id) {
  const s = allSeasons.find((x) => x.id === id);
  const c = allCartoons.find((c) => c.id === s?.cartoon_id);
  if (!confirm(`هل أنت متأكد من حذف الموسم ${s?.season_number} من "${c?.title || "المسلسل"}"؟\nسيتم حذف حلقاته أيضًا.`)) return;

  try {
    await API.remove("seasons", id);
    toast("تم حذف الموسم");
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
