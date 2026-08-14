/* ============================================================
   cartoons.js — إدارة المحتوى (مسلسلات وأفلام + تصنيفات متعددة)
   ============================================================ */

(async function () {
  const adminSession = await window.adminAuthReady;
  if (!adminSession) return;

  const tableArea = document.getElementById("table-area");
  const searchInput = document.getElementById("search-input");
  const addBtn = document.getElementById("add-btn");
  const modal = document.getElementById("cartoon-modal");
  const form = document.getElementById("cartoon-form");
  const modalTitle = document.getElementById("modal-title");
  const categoriesSelect = document.getElementById("f-categories");

  let allCartoons = [];
  let allCategories = [];
  let categoryLinksByCartoon = new Map();
  let editingId = null;

  const backendOk = await checkSupabase();
  if (!backendOk) showConnectionWarning();

  // ---------- تحميل البيانات ----------
  async function load() {
    try {
      const [cartoons, categories, linksResult] = await Promise.all([
        API.get("cartoons"),
        API.get("categories"),
        sb.from("cartoon_categories").select("cartoon_id, category_id"),
      ]);

      allCartoons = cartoons;
      allCategories = categories;
      categoryLinksByCartoon = new Map();
      (linksResult.data || []).forEach((link) => {
        const existing = categoryLinksByCartoon.get(link.cartoon_id) || [];
        existing.push(link.category_id);
        categoryLinksByCartoon.set(link.cartoon_id, existing);
      });

      // يبقى التصنيف الأساسي ظاهرًا للمحتوى القديم قبل تنفيذ ترحيل SQL.
      if (linksResult.error) console.warn("تعذر تحميل التصنيفات المتعددة:", linksResult.error.message);
      fillCategorySelect();
      render();
    } catch (err) {
      tableArea.innerHTML = `<div class="error-box">حدث خطأ: ${esc(err.message)}</div>`;
    }
  }

  // ---------- التصنيفات ----------
  function categoryIdsFor(cartoon) {
    const linked = categoryLinksByCartoon.get(cartoon.id) || [];
    return [...new Set([...linked, cartoon.category_id].filter(Boolean))];
  }

  function categoryNamesFor(cartoon) {
    const ids = categoryIdsFor(cartoon);
    const names = allCategories
      .filter((category) => ids.includes(category.id))
      .map((category) => category.name);
    return names.length ? names.join("، ") : "—";
  }

  function fillCategorySelect() {
    categoriesSelect.innerHTML = allCategories
      .map((category) => `<option value="${category.id}">${esc(category.name)}</option>`)
      .join("");
  }

  function setSelectedCategories(ids) {
    const selected = new Set(ids || []);
    Array.from(categoriesSelect.options).forEach((option) => {
      option.selected = selected.has(option.value);
    });
  }

  function readSelectedCategories() {
    return Array.from(categoriesSelect.selectedOptions)
      .map((option) => option.value)
      .filter(Boolean);
  }

  async function ensureMultiCategoriesReady() {
    const { error } = await sb.from("cartoon_categories").select("cartoon_id").limit(1);
    if (error) {
      throw new Error("يلزم تنفيذ ملف supabase-v2-migration.sql في Supabase أولًا لتفعيل الأفلام والتصنيفات المتعددة.");
    }
  }

  async function syncCategoryLinks(cartoonId, categoryIds) {
    const { error: deleteError } = await sb
      .from("cartoon_categories")
      .delete()
      .eq("cartoon_id", cartoonId);
    if (deleteError) throw new Error(deleteError.message || "تعذر تحديث التصنيفات");

    const { error: insertError } = await sb
      .from("cartoon_categories")
      .insert(categoryIds.map((categoryId) => ({ cartoon_id: cartoonId, category_id: categoryId })));
    if (insertError) throw new Error(insertError.message || "تعذر حفظ التصنيفات");
  }

  // ---------- عرض الجدول ----------
  function render() {
    const q = searchInput.value.trim().toLowerCase();
    const filtered = allCartoons.filter((cartoon) =>
      cartoon.title.toLowerCase().includes(q)
    );

    if (!filtered.length) {
      tableArea.innerHTML = `<div class="empty-box">
        ${allCartoons.length ? "لا توجد نتائج مطابقة" : "لا يوجد محتوى — أضف أول مسلسل أو فيلم!"}
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
              <th>النوع</th>
              <th>التصنيفات</th>
              <th>السنة</th>
              <th>الحالة</th>
              <th>المشاهدات</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((cartoon) => `
              <tr>
                <td><img class="tbl-img" src="${cartoon.poster_url || ""}" alt="" onerror="this.style.visibility='hidden'"></td>
                <td>${esc(cartoon.title)}</td>
                <td>${cartoon.content_type === "movie" ? "فيلم" : "مسلسل"}</td>
                <td>${esc(categoryNamesFor(cartoon))}</td>
                <td>${cartoon.release_year || "—"}</td>
                <td>${esc(cartoon.status)}</td>
                <td>${fmtNum(cartoon.views)}</td>
                <td>
                  <button class="btn btn--ghost btn--sm" data-edit="${cartoon.id}">تعديل</button>
                  <button class="btn btn--danger btn--sm" data-del="${cartoon.id}">حذف</button>
                </td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;

    tableArea.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => openEdit(btn.dataset.edit));
    });
    tableArea.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", () => deleteCartoon(btn.dataset.del));
    });
  }

  searchInput.addEventListener("input", render);

  // ---------- الإضافة والتعديل ----------
  function resetForm() {
    form.reset();
    document.getElementById("cartoon-id").value = "";
    document.getElementById("f-poster-url").value = "";
    document.getElementById("f-banner-url").value = "";
    document.getElementById("f-poster-preview").style.display = "none";
    document.getElementById("f-banner-preview").style.display = "none";
    document.getElementById("f-content-type").value = "series";
    setSelectedCategories([]);
    editingId = null;
    modalTitle.textContent = "إضافة محتوى";
  }

  addBtn.addEventListener("click", () => {
    resetForm();
    openModal(modal);
  });

  function openEdit(id) {
    const cartoon = allCartoons.find((item) => item.id === id);
    if (!cartoon) return;

    resetForm();
    editingId = id;
    modalTitle.textContent = "تعديل المحتوى";
    document.getElementById("cartoon-id").value = id;
    document.getElementById("f-title").value = cartoon.title || "";
    document.getElementById("f-desc").value = cartoon.description || "";
    document.getElementById("f-content-type").value = cartoon.content_type || "series";
    setSelectedCategories(categoryIdsFor(cartoon));
    document.getElementById("f-year").value = cartoon.release_year || "";
    document.getElementById("f-status").value = cartoon.status || "مستمر";

    if (cartoon.poster_url) {
      document.getElementById("f-poster-url").value = cartoon.poster_url;
      const preview = document.getElementById("f-poster-preview");
      preview.src = cartoon.poster_url;
      preview.style.display = "block";
    }
    if (cartoon.banner_url) {
      document.getElementById("f-banner-url").value = cartoon.banner_url;
      const preview = document.getElementById("f-banner-preview");
      preview.src = cartoon.banner_url;
      preview.style.display = "block";
    }

    openModal(modal);
  }

  // ---------- معاينة ورفع الصور ----------
  document.getElementById("f-poster-file").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const preview = document.getElementById("f-poster-preview");
    preview.src = URL.createObjectURL(file);
    preview.style.display = "block";
  });

  document.getElementById("f-banner-file").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const preview = document.getElementById("f-banner-preview");
    preview.src = URL.createObjectURL(file);
    preview.style.display = "block";
  });

  async function uploadFile(fileInputId, folder) {
    const input = document.getElementById(fileInputId);
    if (!input.files[0]) return null;
    return API.uploadImage({
      base64: await fileToBase64(input.files[0]),
      folder,
      fileName: `${folder}-${Date.now()}`,
    });
  }

  // ---------- الحفظ ----------
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const saveBtn = document.getElementById("save-btn");
    saveBtn.disabled = true;
    saveBtn.textContent = "جارٍ الحفظ...";

    try {
      const categoryIds = readSelectedCategories();
      if (!categoryIds.length) throw new Error("اختر تصنيفًا واحدًا على الأقل");
      await ensureMultiCategoriesReady();

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
        content_type: document.getElementById("f-content-type").value,
        // يبقى التصنيف الأول متوافقًا مع المحتوى القديم واستعلامات الواجهة السابقة.
        category_id: categoryIds[0],
        release_year: document.getElementById("f-year").value
          ? Number.parseInt(document.getElementById("f-year").value, 10)
          : null,
        status: document.getElementById("f-status").value,
        poster_url: posterUrl,
        banner_url: bannerUrl,
      };

      const isNewMovie = !editingId && body.content_type === "movie";
      const saved = editingId
        ? await API.update("cartoons", editingId, body)
        : await API.create("cartoons", body);
      await syncCategoryLinks(saved.id, categoryIds);

      // يحتاج المشغل إلى حلقة؛ لذلك ننشئ مصدرًا واحدًا افتراضيًا للفيلم الجديد.
      if (isNewMovie) {
        await API.create("seasons", {
          cartoon_id: saved.id,
          season_number: 1,
          title: "الفيلم",
        });
      }

      toast(isNewMovie
        ? "تمت إضافة الفيلم. أضف رابط المشاهدة في الحلقة الأولى."
        : (editingId ? "تم تعديل المحتوى بنجاح" : "تمت إضافة المحتوى بنجاح"));
      closeModal(modal);
      await load();
    } catch (err) {
      toast("فشل الحفظ: " + (err.message || "تعذر حفظ المحتوى"), true);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "حفظ";
    }
  });

  // ---------- الحذف ----------
  async function deleteCartoon(id) {
    const cartoon = allCartoons.find((item) => item.id === id);
    if (!cartoon) return;
    const label = cartoon.content_type === "movie" ? "الفيلم" : "المسلسل";
    if (!confirm(`هل أنت متأكد من حذف ${label} "${cartoon.title}"؟\nسيتم حذف مواسمه وحلقاته أيضًا.`)) return;

    try {
      await API.remove("cartoons", id);
      toast("تم حذف المحتوى");
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
