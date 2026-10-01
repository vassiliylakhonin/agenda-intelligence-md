import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

// Execute production SQL against SQLite rather than mocking query outcomes.
export function memoryD1() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../../migrations/0001_payment_ledger.sql", import.meta.url), "utf8"));
  return { prepare(sql) {
    let values = [];
    const statement = db.prepare(sql);
    return {
      bind(...args) { values = args; return this; },
      async first() { return statement.get(...values) || null; },
      async run() {
        const result = statement.run(...values);
        return { success: true, meta: { changes: Number(result.changes) } };
      }
    };
  } };
}
