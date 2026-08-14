-- ============================================================
-- عالم الكرتون — ترقية الإصدار 2
-- تضيف: نوع المحتوى (مسلسل/فيلم) + التصنيفات المتعددة
-- شغّل هذا الملف مرة واحدة من:
-- Supabase Dashboard > SQL Editor > New Query
-- ============================================================

BEGIN;

--------------------------------------------------------------
-- 1) تمييز المحتوى: مسلسل أو فيلم
--------------------------------------------------------------
ALTER TABLE public.cartoons
  ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'series';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cartoons_content_type_check'
      AND conrelid = 'public.cartoons'::regclass
  ) THEN
    ALTER TABLE public.cartoons
      ADD CONSTRAINT cartoons_content_type_check
      CHECK (content_type IN ('series', 'movie'));
  END IF;
END $$;

COMMENT ON COLUMN public.cartoons.content_type IS
  'نوع المحتوى: series للمسلسلات أو movie للأفلام';

CREATE INDEX IF NOT EXISTS idx_cartoons_content_type_created_at
  ON public.cartoons (content_type, created_at DESC);

--------------------------------------------------------------
-- 2) جدول الربط للتصنيفات المتعددة
--------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cartoon_categories (
  cartoon_id UUID NOT NULL REFERENCES public.cartoons(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (cartoon_id, category_id)
);

COMMENT ON TABLE public.cartoon_categories IS
  'يربط كل مسلسل أو فيلم بتصنيف واحد أو أكثر';

CREATE INDEX IF NOT EXISTS idx_cartoon_categories_category_id
  ON public.cartoon_categories (category_id);

-- ترحيل التصنيف القديم إلى جدول التصنيفات المتعددة، بدون تكرار.
INSERT INTO public.cartoon_categories (cartoon_id, category_id)
SELECT id, category_id
FROM public.cartoons
WHERE category_id IS NOT NULL
ON CONFLICT (cartoon_id, category_id) DO NOTHING;

--------------------------------------------------------------
-- 3) RLS: قراءة عامة وكتابة للمشرفين المسجلين فقط
--------------------------------------------------------------
ALTER TABLE public.cartoon_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cartoon_categories: select for anyone" ON public.cartoon_categories;
CREATE POLICY "cartoon_categories: select for anyone"
  ON public.cartoon_categories FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "cartoon_categories: insert for authenticated admin" ON public.cartoon_categories;
CREATE POLICY "cartoon_categories: insert for authenticated admin"
  ON public.cartoon_categories FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "cartoon_categories: update for authenticated admin" ON public.cartoon_categories;
CREATE POLICY "cartoon_categories: update for authenticated admin"
  ON public.cartoon_categories FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "cartoon_categories: delete for authenticated admin" ON public.cartoon_categories;
CREATE POLICY "cartoon_categories: delete for authenticated admin"
  ON public.cartoon_categories FOR DELETE TO authenticated
  USING (true);

COMMIT;

-- بعد التنفيذ: حدّث الصفحة ثم أضف النوع والتصنيفات من لوحة التحكم.
-- يبقى category_id القديم محفوظًا كتصنيف أول متوافق مع البيانات والواجهة السابقة.
