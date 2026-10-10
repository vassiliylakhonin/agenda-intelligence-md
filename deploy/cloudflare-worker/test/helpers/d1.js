import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
const executeAll = Symbol('executeAll');

// Execute production SQL against SQLite rather than mocking query outcomes.
export function memoryD1() {
  const db = new DatabaseSync(":memory:");
  for (const name of readdirSync(new URL("../../migrations/", import.meta.url)).filter(n => n.endsWith(".sql")).sort()) {
    db.exec(readFileSync(new URL("../../migrations/" + name, import.meta.url), "utf8"));
  }
  return { async batch(statements) {
    db.exec('BEGIN');
    try {
      const results = statements.map(statement => statement[executeAll]());
      db.exec('COMMIT');
      return results;
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }, prepare(sql) {
    let values = [];
    const statement = db.prepare(sql);
    return {
      bind(...args) { values = args; return this; },
      [executeAll]() { return { success: true, results: statement.all(...values) }; },
      async first() { return statement.get(...values) || null; },
      async all() { return { success: true, results: statement.all(...values) }; },
      async run() {
        const result = statement.run(...values);
        return { success: true, meta: { changes: Number(result.changes) } };
      }
    };
  } };
}
