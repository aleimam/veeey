-- Editable homepage testimonials + trust badges.
CREATE TABLE "HomeTestimonial" (
    "id" TEXT NOT NULL,
    "quoteEn" TEXT NOT NULL,
    "quoteAr" TEXT,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HomeTestimonial_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HomeTrustBadge" (
    "id" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "labelAr" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HomeTrustBadge_pkey" PRIMARY KEY ("id")
);
