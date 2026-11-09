/**
 * Grants a role from the server's command line — the only way to create the
 * first administrator (the web UI never lets anyone raise their own role).
 *   pnpm admin:role <email> <student|support|admin>
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import { auditLog, user } from "../src/db/schema";

const [email, role] = process.argv.slice(2);
if (!email || !["student", "support", "admin"].includes(role ?? "")) {
  console.error("Uso: pnpm admin:role <email> <student|support|admin>");
  process.exit(1);
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);
const [u] = await db.update(user).set({ role, updatedAt: new Date() }).where(eq(user.email, email.toLowerCase())).returning({ id: user.id });
if (!u) {
  console.error(`No existe ningún usuario con el correo ${email}`);
  await pool.end();
  process.exit(1);
}
await db.insert(auditLog).values({ userId: null, action: "user.role_changed", target: u.id, meta: { to: role, via: "cli" } });
await pool.end();
console.log(`Rol de ${email} → ${role}`);
