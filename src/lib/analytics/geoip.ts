import path from 'node:path';

/**
 * IP → geo resolver (Analytics P1), backed by a MaxMind GeoLite2-City .mmdb read
 * via memory-mapped lookups (low RAM). The DB file is NOT committed; drop it at
 * `GEOIP_DB_PATH` (or ./geoip/GeoLite2-City.mmdb) and geo lights up automatically.
 * Until then every lookup returns nulls — capture keeps working, just without city.
 */

export type GeoInfo = { country: string | null; region: string | null; city: string | null };
const EMPTY: GeoInfo = { country: null, region: null, city: null };

// Structural shape of a GeoLite2-City record (avoids coupling to maxmind's type names).
type CityRecord = {
  country?: { iso_code?: string };
  registered_country?: { iso_code?: string };
  subdivisions?: { names?: { en?: string } }[];
  city?: { names?: { en?: string } };
};
type MmdbReader = { get(ip: string): CityRecord | null };

let readerPromise: Promise<MmdbReader | null> | null = null;

function dbPath(): string {
  return process.env.GEOIP_DB_PATH || path.join(process.cwd(), 'geoip', 'GeoLite2-City.mmdb');
}

async function getReader(): Promise<MmdbReader | null> {
  if (!readerPromise) {
    readerPromise = (async () => {
      try {
        const { open } = await import('maxmind');
        return (await open(dbPath())) as unknown as MmdbReader;
      } catch {
        return null; // DB missing / unreadable → graceful
      }
    })();
  }
  return readerPromise;
}

/** Resolve country/region/city for an IP; nulls if the GeoIP DB isn't installed. */
export async function lookupGeo(ip: string | null | undefined): Promise<GeoInfo> {
  if (!ip) return EMPTY;
  try {
    const reader = await getReader();
    if (!reader) return EMPTY;
    const r = reader.get(ip);
    if (!r) return EMPTY;
    return {
      country: r.country?.iso_code ?? r.registered_country?.iso_code ?? null,
      region: r.subdivisions?.[0]?.names?.en ?? null,
      city: r.city?.names?.en ?? null,
    };
  } catch {
    return EMPTY;
  }
}
