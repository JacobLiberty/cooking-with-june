import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getEditorByEmail } from "@/sanity/lib/editors";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  trustHost: true,
  callbacks: {
    // Only allowlisted editors may sign in at all.
    async signIn({ user }) {
      const editor = await getEditorByEmail(user.email);
      return editor != null;
    },
    async jwt({ token }) {
      // Resolve editor identity once, on first sign-in (when name/email present).
      if (token.email && token.editorId === undefined) {
        const editor = await getEditorByEmail(token.email);
        token.editorId = editor?._id ?? null;
        token.editorName = editor?.name ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.editorId = (token.editorId as string | null) ?? null;
      session.user.isEditor = Boolean(token.editorId);
      if (token.editorName) session.user.name = token.editorName as string;
      return session;
    },
  },
});
