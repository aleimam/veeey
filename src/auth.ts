import NextAuth, { type NextAuthConfig } from 'next-auth';
import type { Provider } from 'next-auth/providers';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import Facebook from 'next-auth/providers/facebook';
import Apple from 'next-auth/providers/apple';
import Twitter from 'next-auth/providers/twitter';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/password';
import { normalizeMobile } from '@/lib/provider-config';
import { verifyOtp } from '@/lib/otp-service';
import { ensureCustomerProfile } from '@/lib/customer';

// Login by email OR phone OR username + password (FR-ACC-01).
const credentialsSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
});
const otpSchema = z.object({ phone: z.string().trim().min(1), code: z.string().trim().min(4) });

/** Resolve a user by any of email / username / phone. */
async function findByIdentifier(identifier: string) {
  const phone = normalizeMobile(identifier);
  return prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: identifier, mode: 'insensitive' } },
        { username: { equals: identifier, mode: 'insensitive' } },
        { phone },
        { phone: identifier },
      ],
    },
  });
}

// Social providers self-configure from AUTH_<PROVIDER>_ID/SECRET env vars. They
// are only added when configured, so the app builds & runs without them (FR-ACC-01).
const providers: Provider[] = [
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
    name: 'Phone OTP',
    credentials: { phone: {}, code: {} },
    authorize: async (raw) => {
      const parsed = otpSchema.safeParse(raw);
      if (!parsed.success) return null;
      const phone = normalizeMobile(parsed.data.phone);
      if (!(await verifyOtp(phone, parsed.data.code))) return null;
      // Find-or-create a user for this phone (phone-first signup).
      let user = await prisma.user.findFirst({ where: { phone } });
      if (!user) {
        user = await prisma.user.create({ data: { phone } });
        await ensureCustomerProfile(user.id);
      }
      return { id: user.id, email: user.email, name: user.name };
    },
  }),
];

if (process.env.AUTH_GOOGLE_ID) providers.push(Google);
if (process.env.AUTH_FACEBOOK_ID) providers.push(Facebook);
if (process.env.AUTH_APPLE_ID) providers.push(Apple);
if (process.env.AUTH_TWITTER_ID) providers.push(Twitter);

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  // JWT strategy is required for the Credentials provider; OAuth still persists
  // users/accounts via the adapter.
  session: { strategy: 'jwt' },
  pages: { signIn: '/en/login' },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      // Only hit the DB at sign-in (when `user` is present); cache RBAC in the token.
      if (user?.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          include: { role: { include: { permissions: true } }, customer: true },
        });
        token.uid = user.id;
        token.roleKey = dbUser?.role?.key ?? null;
        token.permissions = dbUser?.role?.permissions.map((p) => p.key) ?? [];
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

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
