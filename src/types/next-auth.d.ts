import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      editorId: string | null;
      isEditor: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    editorId?: string | null;
    editorName?: string | null;
  }
}
