import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    twitchId?: string;
    login?: string;
    displayName?: string;
    avatarUrl?: string | null;
  }

  interface Session {
    user: {
      id: string;
      twitchId: string;
      login: string;
      displayName: string;
      avatarUrl: string | null;
    } & DefaultSession["user"];
  }
}
