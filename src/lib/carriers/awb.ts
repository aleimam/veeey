/**
 * The waybill fields staff review and may edit before a courier shipment is
 * created (owner: "show address and AWB details to review and edit, then Create").
 * Pure/shared so the Aramex + SMSA adapters and the server action agree on shape.
 * Any field left undefined falls back to the order's stored value / a default.
 */
export type AwbEdit = {
  name?: string;
  phone?: string;
  governorate?: string;
  city?: string;
  area?: string;
  street?: string;
  pieces?: number;
  weightKg?: number;
  contents?: string;
  codAmount?: number; // EGP; overrides the auto COD (order total when COD, else 0)
};

/** The order's stored delivery-address snapshot (subset the carriers need). */
export type AwbAddr = { name?: string; phone?: string; governorate?: string; city?: string; area?: string; street?: string };

export type ResolvedAwb = {
  name: string; phone: string; city: string; gov: string; street: string;
  pieces: number; weightKg: number; contents: string; cod: number;
};

/**
 * Merge the staff-reviewed edits over the order's stored address plus sensible
 * defaults — the single source of truth both carrier adapters use to build a
 * waybill. Pure, so it's unit-tested. `autoCod` is the COD amount to use when the
 * staff didn't override it (order total for COD orders, else 0).
 */
export function resolveAwb(addr: AwbAddr, edit: AwbEdit | undefined, autoCod: number): ResolvedAwb {
  return {
    name: (edit?.name ?? addr.name)?.trim() || 'Customer',
    phone: (edit?.phone ?? addr.phone)?.trim() || '',
    city: (edit?.city ?? addr.city ?? addr.governorate)?.trim() || '',
    gov: (edit?.governorate ?? addr.governorate)?.trim() || '',
    street: [edit?.street ?? addr.street, edit?.area ?? addr.area].filter(Boolean).join(', ').trim() || '-',
    pieces: edit?.pieces && edit.pieces > 0 ? Math.round(edit.pieces) : 1,
    weightKg: edit?.weightKg && edit.weightKg > 0 ? edit.weightKg : 1,
    contents: edit?.contents?.trim() || 'Health products',
    cod: edit?.codAmount != null ? edit.codAmount : autoCod,
  };
}
