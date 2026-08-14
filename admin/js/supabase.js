/* ============================================================
   supabase.js — اتصال لوحة التحكم مباشرة بـ Supabase
   ------------------------------------------------------------
   هذه النسخة Frontend فقط ولا تحتاج Node أو Express أو أي خادم وسيط.
   استخدم المفتاح العام anon/publishable فقط داخل المتصفح.
   ============================================================ */

const SUPABASE_URL = "https://uxmwhgfvlwefqxhjwdhb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4bXdoZ2Z2bHdlZnF4aGp3ZGhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MDI2OTcsImV4cCI6MjEwMjE3ODY5N30.iFxVGlDkZSQWrDGAcOnUsFue7DeT13l7lp2iKy1ZyQY";

if (!window.supabase || typeof window.supabase.createClient !== "function") {
  throw new Error("تعذر تحميل مكتبة Supabase من CDN");
}

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const BUCKET = "cartoon-images";

const TABLES = {
  cartoons: "cartoons",
  seasons: "seasons",
  episodes: "episodes",
  categories: "categories",
};

function throwSupabaseError(error, fallback) {
  if (error) throw new Error(error.message || fallback);
}

function safeFileName(name) {
  return String(name || "image")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "image";
}

function base64ToBlob(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("صيغة الصورة غير صحيحة");
  const [, mime, encoded] = match;
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime || "application/octet-stream" });
}

const API = {
  async get(table) {
    if (!Object.values(TABLES).includes(table)) throw new Error("جدول غير صالح");
    const { data, error } = await sb
      .from(table)
      .select("*")
      .order("created_at", { ascending: false });
    throwSupabaseError(error, "فشل جلب البيانات");
    return data || [];
  },

  async create(table, body) {
    const { data, error } = await sb.from(table).insert(body).select().single();
    throwSupabaseError(error, "فشل الحفظ");
    return data;
  },

  async update(table, id, body) {
    const { data, error } = await sb
      .from(table)
      .update(body)
      .eq("id", id)
      .select()
      .single();
    throwSupabaseError(error, "فشل التعديل");
    return data;
  },

  async remove(table, id) {
    const { error } = await sb.from(table).delete().eq("id", id);
    throwSupabaseError(error, "فشل الحذف");
    return true;
  },

  async uploadImage({ base64, folder, fileName }) {
    const blob = base64ToBlob(base64);
    const extension = (blob.type.split("/")[1] || "png").replace(/[^a-z0-9]/gi, "");
    const path = `${folder}/${Date.now()}-${safeFileName(fileName)}.${extension}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, blob, {
      contentType: blob.type || "image/png",
      upsert: false,
      cacheControl: "3600",
    });
    throwSupabaseError(error, "فشل رفع الصورة");
    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  },

  async stats() {
    const [cartoons, seasons, episodes, categories, latestEpisodes, latestCartoons, topEpisodes] = await Promise.all([
      sb.from("cartoons").select("id, views, created_at", { count: "exact" }),
      sb.from("seasons").select("id", { count: "exact", head: true }),
      sb.from("episodes").select("id", { count: "exact", head: true }),
      sb.from("categories").select("id", { count: "exact", head: true }),
      sb
        .from("episodes")
        .select("id, title, episode_number, created_at, seasons!inner (season_number, cartoons!inner(id, title))")
        .order("created_at", { ascending: false })
        .limit(5),
      sb
        .from("cartoons")
        .select("id, title, poster_url, created_at, content_type")
        .order("created_at", { ascending: false })
        .limit(5),
      sb
        .from("episodes")
        .select("id, title, views, seasons!inner (season_number, cartoons!inner(id, title))")
        .order("views", { ascending: false })
        .limit(5),
    ]);

    [cartoons, seasons, episodes, categories, latestEpisodes, latestCartoons, topEpisodes].forEach((result) => {
      throwSupabaseError(result.error, "فشل جلب إحصائيات لوحة التحكم");
    });

    const totalViews = (cartoons.data || []).reduce((sum, cartoon) => sum + (Number(cartoon.views) || 0), 0);
    return {
      cartoonsCount: cartoons.count || 0,
      seasonsCount: seasons.count || 0,
      episodesCount: episodes.count || 0,
      categoriesCount: categories.count || 0,
      totalViews,
      latestEpisodes: latestEpisodes.data || [],
      latestCartoons: latestCartoons.data || [],
      topEpisodes: topEpisodes.data || [],
    };
  },
};
