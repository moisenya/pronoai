import { neon } from "@neondatabase/serverless";

let sql;
export function getSql() {
  if (!sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL manquante");
    sql = neon(url);
  }
  return sql;
}
