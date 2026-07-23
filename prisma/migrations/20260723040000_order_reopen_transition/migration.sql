-- Owner rule: a Delivered order can't be edited directly, but staff can reopen it
-- (move it back to an open status), edit it, and mark it Delivered again. SHIPPED
-- already allows a reopen to CONFIRMED; DELIVERED did not. Append CONFIRMED to
-- DELIVERED.allowedNext so the reopen path exists. Idempotent: only add when
-- missing, so re-runs and owner customisation in Admin → Statuses are preserved.
UPDATE "OrderStatusConfig"
  SET "allowedNext" = array_append("allowedNext", 'CONFIRMED')
  WHERE "code" = 'DELIVERED' AND NOT ('CONFIRMED' = ANY("allowedNext"));
