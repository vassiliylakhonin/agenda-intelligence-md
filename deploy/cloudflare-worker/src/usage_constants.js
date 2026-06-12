// Shared usage-tracking constants. Kept out of src/index.js exports because
// workerd treats every named export of the entry module as a worker
// entrypoint and rejects non-function exports at startup (breaks wrangler dev).
export const PROBE_PROMPT_CHAR_THRESHOLD = 24;
