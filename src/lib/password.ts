import bcrypt from 'bcryptjs';

// Password hashing for the credentials provider (FR-ACC-01). Migrated customers
// have no portable password (MIGRATION_FINDINGS §4) and set one via email reset.
const ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
