import type { NextAuthConfig } from 'next-auth'

/**
 * Edge-safe auth configuration.
 *
 * This config contains NO Node-only imports (Prisma, bcrypt, …) so it can be
 * loaded inside Next.js middleware, which runs on the Edge runtime. The full
 * configuration — including the Prisma adapter and the Credentials provider —
 * lives in `lib/auth.ts` and is only used in the Node runtime (route handlers).
 */
export const authConfig = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  // Providers are added in the full (Node) config; the edge instance only
  // reads the JWT session, so an empty list is sufficient here.
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        (session.user as any).id = token.id
      }
      return session
    },
  },
} satisfies NextAuthConfig
