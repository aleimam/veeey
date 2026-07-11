-- Per-product manual reorder threshold (V4 C12). Null = rely on the automatic
-- sales-window heuristics only. Idempotent.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "reorderPoint" INTEGER;
