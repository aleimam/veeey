import NextAuth, { type NextAuthConfig } from 'next-auth';
import type { Provider } from 'next-auth/providers';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import Facebook from 'next-auth/providers/facebook';
import Apple from 'next-auth/providers/apple';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/password';
import { normalizeDestination, verifyCode } from '@/lib/otp-service';
import { ensureCustomerProfile } from '@/lib/customer';
import { findByIdentifier } from '@/lib/user-lookup';
import { getSocialAuthConfig, appleClientSecret } from '@/lib/social-auth';

// Login by email OR phone OR username + password (FR-ACC-01).
const credentialsSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
});
// `dest` is an email address OR a phone number — the OTP tab accepts both
// (owner 2026-07-22 #226); it was phone-only before.
const otpSchema = z.object({ dest: z.string().trim().min(1), code: z.string().trim().min(4) });

// Credentials (password) + code-by-SMS-or-email. Social providers are added
// dynamically at runtime from the admin-configured DB credentials (see
// buildProviders()).
const baseProviders: Provider[] = [
  Credentials({
    credentials: { identifier: {}, password: {} },
    authorize: async (raw) => {
      const parsed = credentialsSchema.safeParse(raw);
      if (!parsed.success) return null;
      const user = await findByIdentifier(parsed.data.identifier);
      if (!user?.passwordHash) return null;
      const ok = await verifyPassword(parsed.data.password, user.passwordHash);
      if (!ok) return null;
      return { id: user.id, email: user.email, name: user.name };
    },
  }),
  Credentials({
    id: 'otp',
    name: 'One-time code',
    credentials: { dest: {}, code: {} },
    authorize: async (raw) => {
      const parsed = otpSchema.safeParse(raw);
      if (!parsed.success) return null;
      const norm = normalizeDestination(parsed.data.dest);
      if (!norm) return null;
      if (!(await verifyCode(norm.dest, parsed.data.code))) return null;

      // Find-or-create for this destination. The verified code proves ownership
      // of the channel, so the matching contact column is marked verified.
      if (norm.channel === 'email') {
        let user = await prisma.user.findFirst({ where: { email: { equals: norm.dest, mode: 'insensitive' } } });
        if (!user) {
          user = await prisma.user.create({ data: { email: norm.dest, emailVerified: new Date() } });
          await ensureCustomerProfile(user.id);
        }
        return { id: user.id, email: user.email, name: user.name };
      }
      let user = await prisma.user.findFirst({ where: { phone: norm.dest } });
      if (!user) {
        user = await prisma.user.create({ data: { phone: norm.dest, phoneVerified: new Date() } });
        await ensureCustomerProfile(user.id);
      }
      return { id: user.id, email: user.email, name: user.name };
    },
  }),
];

// Google/Facebook/Apple are built per request from the admin-configured DB
// credentials (Settings `auth.<provider>.*`, env fallback). Apple's client secret
// is a generated ES256 JWT. Disabled/unconfigured providers are simply omitted.
async function buildProviders(): Promise<Provider[]> {
  const cfg = await getSocialAuthConfig();
  const social: Provider[] = [];
  if (cfg.google) social.push(Google({ clientId: cfg.google.clientId, clientSecret: cfg.google.clientSecret }));
  if (cfg.facebook) social.push(Facebook({ clientId: cfg.facebook.clientId, clientSecret: cfg.facebook.clientSecret }));
  if (cfg.apple) {
    const secret = await appleClientSecret(cfg.apple);
    if (secret) social.push(Apple({ clientId: cfg.apple.servicesId, clientSecret: secret }));
  }
  return [...baseProviders, ...social];
}

const baseConfig: Omit<NextAuthConfig, 'providers'> = {
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  // JWT strategy is required for the Credentials provider; OAuth still persists
  // users/accounts via the adapter.
  session: { strategy: 'jwt' },
  pages: { signIn: '/en/login' },
  callbacks: {
    async jwt({ token, user }) {
      // Only hit the DB at sign-in (when `user` is present); cache RBAC in the token.
      if (user?.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          include: {
            departments: { include: { department: { include: { permissions: true } } } },
            role: { include: { permissions: true } }, // legacy fallback (pre-department accounts)
            customer: true,
          },
        });
        // Effective permissions = UNION across department memberships (TEAM
        // epic); accounts without any membership fall back to the legacy role.
        const depts = dbUser?.departments.map((m) => m.department) ?? [];
        const unionPerms = [...new Set(depts.flatMap((d) => d.permissions.map((p) => p.key)))];
        token.uid = user.id;
        token.roleKey = depts.length
          ? depts.map((d) => d.key).join('+')
          : (dbUser?.role?.key ?? null);
        // Gate on MEMBERSHIP (not on the union being non-empty): once a user is
        // in any department, that's the authority — falling back to the legacy
        // role when the departments grant zero permissions would silently
        // un-revoke access stripped by moving someone to a low-permission dept.
        token.permissions = depts.length ? unionPerms : (dbUser?.role?.permissions.map((p) => p.key) ?? []);
        token.customerId = dbUser?.customer?.id ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) ?? session.user.id;
        session.user.roleKey = (token.roleKey as string | null) ?? null;
        session.user.permissions = (token.permissions as string[] | undefined) ?? [];
        session.user.customerId = (token.customerId as string | null) ?? null;
      }
      return session;
    },
  },
  events: {
    // New self-signups (OAuth) get a storefront customer profile + entry tier.
    async createUser({ user }) {
      if (user.id) await ensureCustomerProfile(user.id);
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(async () => ({
  ...baseConfig,
  providers: await buildProviders(),
}));
