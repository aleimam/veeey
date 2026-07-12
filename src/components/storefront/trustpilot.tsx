import { cache } from 'react';
import { getTrustpilotConfig } from '@/lib/trustpilot-service';
import { tpConfigured, tpShows, type TpPlacement } from '@/lib/trustpilot-config';
import { TrustpilotLoader, TrustBox } from '@/components/storefront/trustpilot-client';

// One config read per request (script + up to 3 placements share it).
const config = cache(getTrustpilotConfig);

/** Loads the Trustpilot bootstrap script — only when a Business Unit ID is set. */
export async function TrustpilotScript() {
  const cfg = await config();
  return tpConfigured(cfg) ? <TrustpilotLoader /> : null;
}

/** A TrustBox at the given placement (home / footer / checkout). Renders nothing
 *  until Trustpilot is configured and that placement is enabled in the admin. */
export async function TrustpilotWidget({ placement, className }: { placement: TpPlacement; className?: string }) {
  const cfg = await config();
  if (!tpShows(cfg, placement)) return null;
  const p = cfg[placement];
  return (
    <div className={className}>
      <TrustBox businessUnitId={cfg.businessUnitId} template={p.template} height={p.height} locale={cfg.locale} theme={cfg.theme} domain={cfg.domain} />
    </div>
  );
}
