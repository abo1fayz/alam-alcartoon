-- ============================================================
-- ترقية v3: صورة موحدة لكل موسم
-- عالم الكرتون — Supabase
-- ============================================================
-- نفّذ هذا الملف مرة واحدة في:
-- Supabase Dashboard > SQL Editor > New Query
--
-- يضيف حقل الصورة إلى الموسم، ثم يستفيد من أول صورة حلقة موجودة
-- لكل موسم كصورة موحدة مؤقتة. تظل صور الحلقات القديمة موجودة للتوافق،
-- لكن الموقع ولوحة التحكم سيعتمدان season.image_url فقط.

BEGIN;

ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN public.seasons.image_url IS
  'صورة الغلاف الموحدة للموسم؛ تُستخدم لجميع حلقاته في الموقع';

-- ترحيل آمن للبيانات القديمة: خذ صورة أول حلقة مرتبة في كل موسم.
-- DISTINCT ON يفصل اختيار الحلقة عن UPDATE، لذلك لا توجد إحالة غير مسموحة
-- إلى صف الموسم المستهدف داخل FROM.
UPDATE public.seasons AS season
SET image_url = legacy_image.thumbnail_url
FROM (
  SELECT DISTINCT ON (episode.season_id)
    episode.season_id,
    episode.thumbnail_url
  FROM public.episodes AS episode
  WHERE NULLIF(TRIM(episode.thumbnail_url), '') IS NOT NULL
  ORDER BY episode.season_id, episode.episode_number ASC NULLS LAST, episode.created_at ASC NULLS LAST
) AS legacy_image
WHERE season.id = legacy_image.season_id
  AND NULLIF(TRIM(season.image_url), '') IS NULL;

COMMIT;

-- ملاحظة:
-- لا تُحذف episodes.thumbnail_url هنا لحماية البيانات القديمة.
-- بعد تنفيذ الترقية، أضف أو عدّل صورة كل موسم من لوحة التحكم > المواسم.
