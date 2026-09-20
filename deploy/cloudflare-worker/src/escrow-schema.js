// Deliberately bounded JSON Schema subset for untrusted, caller-supplied schemas.
// Unknown keywords (including $ref and format) are NOT silently ignored: callers
// receive an unverified result and must escalate. No eval, network, or mutation.
import { jcs } from "./jws.js";

const TYPES = ["object", "array", "string", "number", "integer", "boolean", "null"];
const ANNOTATIONS = new Set(["title", "description", "$comment", "default", "examples", "$id"]);
const DIALECTS = new Set(["https://json-schema.org/draft/2020-12/schema", "http://json-schema.org/draft-07/schema#"]);
const COUNTS = new Set(["minLength", "maxLength", "minItems", "maxItems", "minProperties", "maxProperties"]);
const BOUNDS = new Set(["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum"]);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

export function validateEscrowArtifact(schemaInput, artifact, hasArtifact = true) {
  let budget = 10000;
  const tick = (depth) => {
    if (--budget < 0 || depth > 64) throw new Error("Schema validation complexity limit exceeded");
  };
  function inspect(schema, depth = 0) {
    tick(depth);
    if (typeof schema === "boolean") return;
    if (!record(schema)) throw new Error("Schema must be an object or boolean");
    for (const [key, value] of Object.entries(schema)) {
      if (ANNOTATIONS.has(key)) {
        if (["title", "description", "$comment", "$id"].includes(key) && typeof value !== "string")
          throw new Error(`Invalid ${key}`);
        if (key === "examples" && !Array.isArray(value)) throw new Error("Invalid examples");
        continue;
      }
      if (key === "$schema") {
        if (!DIALECTS.has(value)) throw new Error("Unsupported schema dialect");
      } else if (key === "type") {
        const types = Array.isArray(value) ? value : [value];
        if (!types.length || types.some((t) => !TYPES.includes(t)) || new Set(types).size !== types.length)
          throw new Error("Invalid schema type");
      } else if (key === "required") {
        if (!Array.isArray(value) || value.some((v) => typeof v !== "string") || new Set(value).size !== value.length)
          throw new Error("Invalid required list");
      } else if (key === "properties") {
        if (!record(value)) throw new Error("Invalid properties object");
        for (const sub of Object.values(value)) inspect(sub, depth + 1);
      } else if (["items", "additionalProperties", "not"].includes(key)) {
        inspect(value, depth + 1);
      } else if (["allOf", "anyOf", "oneOf"].includes(key)) {
        if (!Array.isArray(value) || !value.length) throw new Error(`Invalid ${key}`);
        for (const sub of value) inspect(sub, depth + 1);
      } else if (key === "enum") {
        if (!Array.isArray(value) || !value.length || new Set(value.map(jcs)).size !== value.length)
          throw new Error("Invalid enum");
      } else if (key === "const") {
        jcs(value);
      } else if (COUNTS.has(key)) {
        if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid ${key}`);
      } else if (BOUNDS.has(key)) {
        if (!Number.isFinite(value)) throw new Error(`Invalid ${key}`);
      } else if (key === "uniqueItems") {
        if (typeof value !== "boolean") throw new Error("Invalid uniqueItems");
      } else {
        throw new Error(`Unsupported schema keyword: ${key}`);
      }
    }
  }
  function matchesType(value, type) {
    if (type === "null") return value === null;
    if (type === "object") return record(value);
    if (type === "array") return Array.isArray(value);
    if (type === "integer") return Number.isInteger(value);
    if (type === "number") return typeof value === "number" && Number.isFinite(value);
    return typeof value === type;
  }
  function valid(schema, value, depth = 0) {
    tick(depth);
    if (typeof schema === "boolean") return schema;
    if (schema.type && !(Array.isArray(schema.type) ? schema.type : [schema.type]).some((t) => matchesType(value, t)))
      return false;
    if (own(schema, "const") && jcs(value) !== jcs(schema.const)) return false;
    if (schema.enum && !schema.enum.some((v) => jcs(value) === jcs(v))) return false;
    if (schema.allOf && !schema.allOf.every((s) => valid(s, value, depth + 1))) return false;
    if (schema.anyOf && !schema.anyOf.some((s) => valid(s, value, depth + 1))) return false;
    if (schema.oneOf && schema.oneOf.filter((s) => valid(s, value, depth + 1)).length !== 1) return false;
    if (own(schema, "not") && valid(schema.not, value, depth + 1)) return false;
    if (record(value)) {
      const keys = Object.keys(value);
      if (keys.length < (schema.minProperties ?? 0) || keys.length > (schema.maxProperties ?? Infinity)) return false;
      if (schema.required?.some((k) => !own(value, k))) return false;
      for (const key of keys) {
        if (schema.properties && own(schema.properties, key)) {
          if (!valid(schema.properties[key], value[key], depth + 1)) return false;
        } else if (own(schema, "additionalProperties") && !valid(schema.additionalProperties, value[key], depth + 1))
          return false;
      }
    }
    if (Array.isArray(value)) {
      if (value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? Infinity)) return false;
      if (schema.uniqueItems && new Set(value.map(jcs)).size !== value.length) return false;
      if (own(schema, "items") && !value.every((v) => valid(schema.items, v, depth + 1))) return false;
    }
    if (typeof value === "string") {
      const length = [...value].length;
      if (length < (schema.minLength ?? 0) || length > (schema.maxLength ?? Infinity)) return false;
    }
    if (typeof value === "number") {
      if (value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity)) return false;
      if (value <= (schema.exclusiveMinimum ?? -Infinity) || value >= (schema.exclusiveMaximum ?? Infinity))
        return false;
    }
    return true;
  }
  try {
    const schema = typeof schemaInput === "string" ? JSON.parse(schemaInput) : schemaInput;
    const size = (value) => {
      const walk = (item, depth = 0) => {
        tick(depth);
        if (typeof item === "number" && (!Number.isFinite(item) || Math.abs(item) > Number.MAX_SAFE_INTEGER)) {
          throw new Error("Numbers outside the interoperable safe range require review");
        }
        if (item && typeof item === "object")
          return 1 + Object.values(item).reduce((n, child) => n + walk(child, depth + 1), 0);
        return 1;
      };
      return walk(value);
    };
    const document = [schema, hasArtifact ? artifact : null];
    if (new TextEncoder().encode(jcs(document)).length > 65536 || size(schema) * size(document[1]) > 10000) {
      throw new Error("Schema validation complexity limit exceeded");
    }
    inspect(schema);
    if (!hasArtifact) throw new Error("Artifact data is required for schema validation; a hash is insufficient");
    const verified = valid(schema, artifact);
    return {
      status: verified ? "valid" : "invalid",
      errors: verified ? [] : ["Artifact does not satisfy expected_schema"]
    };
  } catch (error) {
    return { status: "unverified", errors: [error.message] };
  }
}
