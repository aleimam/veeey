-- Blog cards need thumbnails + author (audit P2 6.3): cover image and
-- pharmacist author name on posts, shown on /blog and the homepage section.
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "coverImage" TEXT;
ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "authorName" TEXT;
