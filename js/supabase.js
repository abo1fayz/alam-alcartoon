/* ============================================================
   supabase.js  — إعداد اتصال Supabase (للموقع العام)
   --------------------------------------------------------------
   استبدل القيم أدناه بمفاتيح مشروعك من:
   Supabase Dashboard > Project Settings > API
     - Project URL      -> SUPABASE_URL
     - anon public key  -> SUPABASE_PUBLISHABLE_KEY
   ============================================================ */

const SUPABASE_URL = "https://uxmwhgfvlwefqxhjwdhb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4bXdoZ2Z2bHdlZnF4aGp3ZGhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MDI2OTcsImV4cCI6MjEwMjE3ODY5N30.iFxVGlDkZSQWrDGAcOnUsFue7DeT13l7lp2iKy1ZyQY";

// تحميل مكتبة Supabase الرسمية من CDN
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
// يجب وضع هذا السطر في HTML قبل هذا الملف

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// أسماء الـ Buckets والجداول (ثوابت مركزية)
const BUCKET = "cartoon-images";

const TABLES = {
  cartoons: "cartoons",
  seasons: "seasons",
  episodes: "episodes",
  categories: "categories",
};
