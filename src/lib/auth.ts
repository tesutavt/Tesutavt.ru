import NextAuth from "next-auth";
import Twitch from "next-auth/providers/twitch";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

interface TwitchHelixUser {
  id: string;
  login: string;
  display_name: string;
  email?: string;
  profile_image_url: string;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  // За reverse-прокси (nginx/Caddy на VDS) Auth.js по умолчанию не
  // доверяет заголовкам Host/X-Forwarded-* от прокси - без этого сломается
  // редирект OAuth в проде.
  trustHost: true,
  providers: [
    Twitch({
      clientId: process.env.TWITCH_CLIENT_ID,
      clientSecret: process.env.TWITCH_CLIENT_SECRET,
      authorization: {
        params: {
          scope:
            "openid user:read:email moderator:read:followers channel:manage:broadcast channel:manage:moderators channel:read:subscriptions channel:bot channel:read:redemptions channel:manage:redemptions",
          force_verify: "true",
        },
      },
      async profile(_profile, tokens) {
        const res = await fetch("https://api.twitch.tv/helix/users", {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            "Client-Id": process.env.TWITCH_CLIENT_ID!,
          },
        });
        if (!res.ok) {
          throw new Error(`Failed to fetch Twitch user profile: ${res.status}`);
        }
        const { data } = (await res.json()) as { data: TwitchHelixUser[] };
        const user = data[0];

        return {
          id: user.id,
          twitchId: user.id,
          login: user.login,
          displayName: user.display_name,
          avatarUrl: user.profile_image_url,
          email: user.email ?? null,
        };
      },
    }),
  ],
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      session.user.twitchId = user.twitchId ?? "";
      session.user.login = user.login ?? "";
      session.user.displayName = user.displayName ?? "";
      session.user.avatarUrl = user.avatarUrl ?? null;
      return session;
    },
  },
  events: {
    // Auth.js only writes access_token/refresh_token/scope into the Account row on
    // the very first sign-in for a given provider account; returning users just get
    // a new session, leaving stale tokens/scopes behind. Since we keep adding Twitch
    // scopes over time, re-sync the stored tokens on every sign-in so a re-login
    // actually picks up newly granted scopes.
    async signIn({ account }) {
      if (!account || account.provider !== "twitch") return;
      await prisma.account.updateMany({
        where: { provider: "twitch", providerAccountId: account.providerAccountId },
        data: {
          access_token: account.access_token,
          refresh_token: account.refresh_token,
          expires_at: account.expires_at,
          scope: account.scope,
          token_type: account.token_type,
          id_token: account.id_token,
        },
      });
    },
  },
  pages: {
    signIn: "/",
  },
});
