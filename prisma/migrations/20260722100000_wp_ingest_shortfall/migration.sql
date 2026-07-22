-- Stage 2 flip: record what an ev.net sale could NOT take off our shelves.
-- ev.net has already handed the goods over, so refusing the movement is not an
-- option; the units we couldn't find are a real discrepancy for the physical
-- count and must be visible rather than absorbed into a silent no-op.
ALTER TABLE "WpStockIngest" ADD COLUMN IF NOT EXISTS "shortfall" INTEGER NOT NULL DEFAULT 0;
