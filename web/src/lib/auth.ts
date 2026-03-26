import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { query } from './db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const rows = await query(
          'SELECT id, email, name, password_hash FROM auth_users WHERE email = $1',
          [credentials.email as string],
        );

        const user = rows[0];
        if (!user || !user.password_hash) return null;

        const valid = await compare(
          credentials.password as string,
          user.password_hash as string,
        );
        if (!valid) return null;

        return {
          id: String(user.id),
          email: user.email as string,
          name: (user.name as string) || null,
        };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
