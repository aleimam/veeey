import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-guards';
import { fetchShipmentPhoto, shipmentPhotoExists } from '@/lib/incoming-shipment-service';

/**
 * Serve a shipment photo to the admin browser. The bytes live in YeldnIN behind
 * an HMAC-only endpoint, so the browser can't fetch them directly — this signs
 * the request server-side and streams the result back.
 *
 * Two gates, both required:
 *  1. `inventory.manage` — the same permission as the review screen itself.
 *  2. the assetId must already be attached to a shipment WE hold, so this can't
 *     be used to pull arbitrary YeldnIN assets through Veeey's session.
 */
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ assetId: string }> }) {
  await requirePermission('inventory.manage');
  const { assetId } = await params;

  if (!(await shipmentPhotoExists(assetId))) return new NextResponse('Not found', { status: 404 });

  const photo = await fetchShipmentPhoto(assetId);
  if (!photo) return new NextResponse('Not found', { status: 404 });

  return new NextResponse(photo.body, {
    headers: {
      'Content-Type': photo.contentType,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
