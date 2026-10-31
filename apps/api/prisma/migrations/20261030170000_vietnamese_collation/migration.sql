-- Sort Vietnamese names correctly ("Áo" next to "A", not after "Z").
-- The Alpine Postgres image defaults to byte-order collation; ICU knows Vietnamese.
-- Prisma does not model column collations on Postgres, so this lives in SQL only.
CREATE COLLATION IF NOT EXISTS "vi_icu" (provider = icu, locale = 'vi');

ALTER TABLE "Product" ALTER COLUMN "name" TYPE TEXT COLLATE "vi_icu";
ALTER TABLE "Category" ALTER COLUMN "name" TYPE TEXT COLLATE "vi_icu";
ALTER TABLE "Customer" ALTER COLUMN "fullName" TYPE TEXT COLLATE "vi_icu";
ALTER TABLE "Location" ALTER COLUMN "name" TYPE TEXT COLLATE "vi_icu";
