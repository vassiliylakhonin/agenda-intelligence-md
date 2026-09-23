import { readdirSync, readFileSync, writeFileSync } from "node:fs";
const dir = new URL("../../../schemas/v1/", import.meta.url);
const schemas = Object.fromEntries(readdirSync(dir).filter(n => n.endsWith(".json")).sort().map(n => [`schemas/v1/${n}`, JSON.parse(readFileSync(new URL(n, dir), "utf8"))]));
const output = new URL("../src/public-schemas.js", import.meta.url);
const expected = "// Generated from schemas/v1 by scripts/generate-public-schemas.js.\nexport const PUBLIC_SCHEMAS = " + JSON.stringify(schemas) + ";\n";
if (process.argv.includes("--check")) {
  if (readFileSync(output, "utf8") !== expected) {
    console.error("Public schemas are stale; run node scripts/generate-public-schemas.js");
    process.exitCode = 1;
  }
} else {
  writeFileSync(output, expected);
}
