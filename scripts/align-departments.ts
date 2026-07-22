import 'dotenv/config';
import { prisma } from '@/lib/prisma';
import { ROLE_DEFINITIONS, permissionsForRole } from '@/lib/permissions';
import { SYNCED_DEPARTMENTS } from '@/lib/staff-sync-logic';

/**
 * Bring the live departments in line with the 1:1 mapping (owner, 2026-07-22).
 *
 *   npx tsx scripts/align-departments.ts            # DRY RUN
 *   npx tsx scripts/align-departments.ts --commit
 *
 * Three changes, all reversible by hand:
 *   `courier`    → renamed `couriers`, matching the YeldnIN team.
 *   `pharmacist` → MERGED into `sales`: its permissions union onto sales, its
 *                  members move across, then it is deleted. The order-handler
 *                  picker already keyed off `sales`, so nothing loses a home.
 *   `logistics`, `purchasing`, `development` → created with NO permissions, so
 *                  membership mirrors YeldnIN while authority stays the owner's
 *                  to define per store.
 *
 * `super_admin` is untouched and stays out of the sync — it alone holds
 * `rbac.manage`, and no pipeline should be able to grant that.
 */
async function main() {
  const commit = process.argv.includes('--commit');
  console.log(`\n=== align departments — ${commit ? 'COMMIT' : 'DRY RUN (no writes)'} ===\n`);

  const before = await prisma.department.findMany({
    include: { permissions: { select: { key: true } }, _count: { select: { members: true } } },
    orderBy: { key: 'asc' },
  });
  const by = new Map(before.map((d) => [d.key, d]));
  console.log('  current: ' + before.map((d) => `${d.key}(${d._count.members}m/${d.permissions.length}p)`).join(' ') + '\n');

  // 1. courier → couriers
  if (by.has('courier') && !by.has('couriers')) {
    console.log(`  RENAME  courier → couriers  (${by.get('courier')!._count.members} member(s) follow)`);
    if (commit) await prisma.department.update({ where: { key: 'courier' }, data: { key: 'couriers', nameEn: 'Couriers' } });
  }

  // 2. pharmacist → sales
  const ph = by.get('pharmacist');
  const sales = by.get('sales');
  if (ph && sales) {
    const merged = [...new Set([...ph.permissions.map((p) => p.key), ...sales.permissions.map((p) => p.key)])];
    console.log(`  MERGE   pharmacist(${ph._count.members}m/${ph.permissions.length}p) → sales(${sales._count.members}m/${sales.permissions.length}p) ⇒ sales gets ${merged.length}p`);
    if (commit) {
      await prisma.department.update({
        where: { id: sales.id },
        data: { nameEn: 'Sales', permissions: { set: merged.map((key) => ({ key })) } },
      });
      // Move members that aren't already in sales, then drop the department.
      const phMembers = await prisma.departmentMember.findMany({ where: { departmentId: ph.id }, select: { userId: true } });
      for (const m of phMembers) {
        await prisma.departmentMember.createMany({ data: [{ departmentId: sales.id, userId: m.userId }], skipDuplicates: true });
      }
      await prisma.departmentMember.deleteMany({ where: { departmentId: ph.id } });
      await prisma.department.delete({ where: { id: ph.id } });
    }
  }

  // 3. Any synced department that doesn't exist yet, from the code definitions.
  for (const key of SYNCED_DEPARTMENTS) {
    if (by.has(key) || (key === 'couriers' && by.has('courier')) || (key === 'sales' && sales)) continue;
    const def = ROLE_DEFINITIONS.find((r) => r.key === key);
    const perms = def ? permissionsForRole(def) : [];
    console.log(`  CREATE  ${key.padEnd(12)} ${perms.length} permission(s)${perms.length ? ` — ${perms.join(', ')}` : ' — grants nothing until the owner tunes it'}`);
    if (commit) {
      await prisma.department.create({
        data: { key, nameEn: def?.name ?? key, permissions: { connect: perms.map((p) => ({ key: p })) } },
      });
    }
  }

  const after = await prisma.department.findMany({
    include: { permissions: { select: { key: true } }, _count: { select: { members: true } } },
    orderBy: { key: 'asc' },
  });
  console.log('\n  ' + (commit ? 'now:     ' : 'unchanged (dry run): ') + after.map((d) => `${d.key}(${d._count.members}m/${d.permissions.length}p)`).join(' '));
  console.log(commit ? '\n✅ applied. Members re-reconcile on the next staff sync.\n' : '\nℹ️ DRY RUN — nothing written.\n');
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
