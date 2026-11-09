import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { deliver } from "@/lib/email/send";
import { passwordChangedEmail, resetPasswordEmail, verifyEmailEmail } from "@/lib/email/templates";

const RESET_MINUTES = 30;
const appUrl = () => process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: RESET_MINUTES * 60,
    revokeSessionsOnPasswordReset: true,
    // Not awaited: the response time must not reveal whether the account exists.
    sendResetPassword: async ({ user, url }) => {
      void deliver("reset_password", user.email, () => resetPasswordEmail({ name: user.name, url, minutes: RESET_MINUTES }));
    },
    onPasswordReset: async ({ user }) => {
      void deliver("password_changed", user.email, () => passwordChangedEmail({ name: user.name, when: new Date(), supportUrl: `${appUrl()}/forgot-password` }));
    },
  },
  // Verification is encouraged (banner + resend) but not required to sign in:
  // a frictionless start matters, and recovery is the main reason to verify.
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      void deliver("verify_email", user.email, () => verifyEmailEmail({ name: user.name, url }));
    },
  },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "student", input: false },
      plan: { type: "string", defaultValue: "free", input: false },
      banned: { type: "boolean", defaultValue: false, input: false },
    },
  },
  session: { expiresIn: 60 * 60 * 24 * 14, updateAge: 60 * 60 * 24 },
  // Brute-force protection. AUTH_RATE_LIMIT=off exists ONLY for the E2E test server,
  // which registers many accounts from one IP; never set it in production.
  rateLimit: {
    enabled: process.env.AUTH_RATE_LIMIT !== "off",
    window: 60,
    max: 30,
    storage: "memory",
    // Emails cost money and can be used to harass: very low limits per IP.
    customRules: {
      "/request-password-reset": { window: 60 * 15, max: 3 },
      "/send-verification-email": { window: 60 * 15, max: 3 },
    },
  },
  advanced: { useSecureCookies: process.env.NODE_ENV === "production" },
  databaseHooks: {
    session: {
      create: {
        // Suspended users cannot start new sessions.
        before: async (session) => {
          const [u] = await db.select({ banned: schema.user.banned }).from(schema.user).where(eq(schema.user.id, session.userId));
          if (u?.banned) return false;
        },
      },
    },
  },
  plugins: [nextCookies()],
});
