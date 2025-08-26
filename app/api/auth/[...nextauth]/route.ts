import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "QR Code",
      credentials: {
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials) {
        const validCode = process.env.NEXTAUTH_SECRET;
        if (credentials?.code === validCode) {
          return { id: "1", name: "Invité" };
        }
        return null;
      },
    }),
  ],
  pages: {
    signIn: "/",
  },
});

export { handler as GET, handler as POST };
