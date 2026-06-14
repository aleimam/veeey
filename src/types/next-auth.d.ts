import type { DefaultSession } from 'next-auth';

// Augment the session/JWT with our RBAC context (loaded at sign-in).
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      roleKey: string | null;
      permissions: string[];
      customerId: string | null;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid?: string;
    roleKey?: string | null;
    permissions?: string[];
    customerId?: string | null;
  }
}
