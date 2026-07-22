import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { storeImage } from '@/lib/storage';
import {
  SYNCED_DEPARTMENTS, isExcludedStaff, departmentsForTeams, reconcileDepartments, parseStaffRecord,
  type StaffRecord,
} from '@/lib/staff-sync-logic';

/**
 * Apply a YeldnIN staff roster to this store. One-way; YeldnIN is the source of
 * truth for who works here and on which team.
 *
 * NEVER sets or copies a password. New accounts land password-less and the owner
 * assigns credentials — propagating hashes between systems would mean a breach of
 * one yields working logins on the other.
 *
 * Profile fields of an EXISTING user are left alone. The sync's authority is
 * membership, not identity: renaming someone in YeldnIN shouldn't rewrite the
 * account they log into here. ONE exception (owner 2026-07-22): the AVATAR is
 * mirrored from YeldnIN — content-hashed filenames make the write idempotent,
 * so an unchanged photo is a no-op every hour.
 */

export type SyncOptions = { commit: boolean };
export type SyncChange = { email: string; created: boolean; add: string[]; remove: string[]; skipped?: string };
export type SyncReport = { total: number; excluded: number; created: number; changes: SyncChange[]; warnings: string[] };

export async function syncStaff(raw: unknown[], opts: SyncOptions): Promise<SyncReport> {
  const report: SyncReport = { total: 0, excluded: 0, created: 0, changes: [], warnings: [] };

  const records: StaffRecord[] = [];
  for (const r of raw) {
    const s = parseStaffRecord(r);
    if (!s) { report.warnings.push('dropped an unparseable record (no usable email)'); continue; }
    if (isExcludedStaff(s.teams)) { report.excluded++; continue; }
    records.push(s);
  }
  report.total = records.length;

  const deptByKey = new Map(
    (await prisma.department.findMany({ where: { key: { in: [...SYNCED_DEPARTMENTS] } }, select: { id: true, key: true } }))
      .map((d) => [d.key, d.id]),
  );
  for (const k of SYNCED_DEPARTMENTS) if (!deptByKey.has(k)) report.warnings.push(`department '${k}' does not exist on this store — its grants are skipped`);

  // Lockout guard. Auto-revoke plus one bad edit in YeldnIN could empty the
  // Admin department and leave nobody able to fix it. Count the admins the plan
  // would leave behind and refuse the last removal.
  const adminId = deptByKey.get('admin');
  const adminMemberIds = adminId
    ? new Set((await prisma.departmentMember.findMany({ where: { departmentId: adminId }, select: { userId: true } })).map((m) => m.userId))
    : new Set<string>();

  for (const s of records) {
    const user = await prisma.user.findUnique({
      where: { email: s.email },
      select: { id: true, image: true, departments: { select: { department: { select: { key: true } } } } },
    });

    let userId = user?.id ?? null;
    const created = !user;
    if (created) {
      report.created++;
      if (opts.commit) {
        const clash = s.username ? await prisma.user.findUnique({ where: { username: s.username }, select: { id: true } }) : null;
        const u = await prisma.user.create({
          data: { email: s.email, name: s.name, phone: s.phone, ...(s.username && !clash ? { username: s.username } : {}) },
          select: { id: true },
        });
        userId = u.id;
      }
    }

    const current = user?.departments.map((d) => d.department.key) ?? [];
    const desired = s.active ? departmentsForTeams(s.teams) : [];
    const plan = reconcileDepartments(current, desired);

    // Refuse to remove the final Admin — a store with no admin cannot be repaired
    // from inside it.
    if (plan.remove.includes('admin') && userId && adminMemberIds.has(userId) && adminMemberIds.size <= 1) {
      plan.remove = plan.remove.filter((d) => d !== 'admin');
      report.warnings.push(`${s.email}: kept Admin — it is the last admin on this store, refusing to lock everyone out`);
    }

    if (plan.add.length || plan.remove.length || created) {
      report.changes.push({ email: s.email, created, add: plan.add, remove: plan.remove, ...(s.active ? {} : { skipped: 'inactive → revoked' }) });
    }
    if (!opts.commit || !userId) continue;

    // Avatar mirror (owner 2026-07-22). Content-hash the bytes into the
    // filename: same photo → same URL → skip; changed photo → new file + update.
    // Best-effort — an avatar problem must never break membership sync.
    if (s.avatar) {
      try {
        const bytes = Buffer.from(s.avatar.base64, 'base64');
        const ext = s.avatar.mime === 'image/png' ? 'png' : s.avatar.mime === 'image/webp' ? 'webp' : s.avatar.mime === 'image/gif' ? 'gif' : 'jpg';
        const url = `/uploads/staff-${createHash('sha1').update(bytes).digest('hex').slice(0, 12)}.${ext}`;
        if (user?.image !== url) {
          await storeImage(bytes, url.replace('/uploads/', ''));
          await prisma.user.update({ where: { id: userId }, data: { image: url } });
        }
      } catch (e) {
        report.warnings.push(`${s.email}: avatar mirror failed (${e instanceof Error ? e.message.slice(0, 60) : 'error'})`);
      }
    }

    for (const key of plan.add) {
      const departmentId = deptByKey.get(key);
      if (departmentId) {
        await prisma.departmentMember.createMany({ data: [{ departmentId, userId }], skipDuplicates: true });
        if (key === 'admin') adminMemberIds.add(userId);
      }
    }
    for (const key of plan.remove) {
      const departmentId = deptByKey.get(key);
      if (departmentId) {
        await prisma.departmentMember.deleteMany({ where: { departmentId, userId } });
        if (key === 'admin') adminMemberIds.delete(userId);
      }
    }
  }

  return report;
}
