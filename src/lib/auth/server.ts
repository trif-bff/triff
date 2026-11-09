import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    // Password reset needs an email provider (Resend/SMTP). Until configured the
    // link is logged server-side in development only; never in production.
    sendResetPassword: async ({ user, url }) => {
      if (process.env.NODE_ENV !== "production") console.info(`[auth] reset link for ${user.email}: ${url}`);
    },
  },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "student", input: false },
    },
  },
  session: { expiresIn: 60 * 60 * 24 * 14, updateAge: 60 * 60 * 24 },
  // Brute-force protection. AUTH_RATE_LIMIT=off exists ONLY for the E2E test server,
  // which registers many accounts from one IP; never set it in production.
  rateLimit: { enabled: process.env.AUTH_RATE_LIMIT !== "off", window: 60, max: 30, storage: "memory" },
  advanced: { useSecureCookies: process.env.NODE_ENV === "production" },
  plugins: [nextCookies()],
});
