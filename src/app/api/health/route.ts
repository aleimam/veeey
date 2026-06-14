import { NextResponse } from 'next/server';

// Liveness probe (used by CI smoke + future uptime monitoring, NFR-08).
export function GET() {
  return NextResponse.json({ status: 'ok', service: 'veeey' });
}
