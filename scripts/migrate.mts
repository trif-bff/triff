import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const url = process.argv[2] ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL requerida");
const pool = new Pool({ connectionString: url });
await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
await pool.end();
console.log("Migraciones aplicadas");
