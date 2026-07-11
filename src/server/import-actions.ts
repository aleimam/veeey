'use server';

import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { parseCsvObjects } from '@/lib/csv-io';
import { IMPORT_PERMISSION, importEntity, isImportEntity, type ImportReport } from '@/lib/admin-import';

export type ImportState = { report?: ImportReport; error?: 'bad_entity' | 'no_file' | 'too_large' | 'empty' };

export async function importCsvAction(_prev: ImportState, fd: FormData): Promise<ImportState> {
  const entity = String(fd.get('entity') ?? '');
  if (!isImportEntity(entity)) return { error: 'bad_entity' }; // e.g. 'lots' is export-only
  const e = entity;
  const user = await requirePermission(IMPORT_PERMISSION[e]);

  const file = fd.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'no_file' };
  if (file.size > 5_000_000) return { error: 'too_large' };

  const rows = parseCsvObjects(await file.text());
  if (rows.length === 0) return { error: 'empty' };

  const report = await importEntity(e, rows);
  await audit({ actorType: 'USER', actorId: user.id, action: `import.${e}`, entityType: e, data: { created: report.created, skipped: report.skipped, invalid: report.invalid.length } });
  return { report };
}
