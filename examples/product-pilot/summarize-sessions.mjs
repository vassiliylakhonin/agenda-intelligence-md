/** Local, aggregate-only pilot readout. No network, recruitment or telemetry. */
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {PRODUCT_WORKFLOWS} from '../../deploy/cloudflare-worker/src/product-workflows.js';

const booleans = ['consent_recorded','owner_practice','input_admitted','domain_outcome_observed',
  'paid_completion_observed','finding_changed_output','voluntary_repeat_session'];
const numbers = ['human_confirmed_useful_findings','human_confirmed_false_holds','human_unresolved_findings',
  'review_minutes_before','review_minutes_assisted'];
const strings = ['session_label','product','utc_date','comparison_method'];
const known = new Set([...booleans,...numbers,...strings]);

export function summarizeSessions(records) {
  if (!Array.isArray(records) || records.length > 100) throw Error('Supply an array of at most 100 session records');
  const labels = new Set();
  for (const row of records) {
    if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).some(key => !known.has(key))) throw Error('Use only the session-template fields; keep raw evidence private');
    for (const field of booleans) if (row[field] != null && typeof row[field] !== 'boolean') throw Error('Invalid boolean: '+field);
    for (const field of numbers) if (row[field] != null && (typeof row[field] !== 'number' || !Number.isFinite(row[field]) || row[field] < 0 ||
      (field.startsWith('human_') && !Number.isInteger(row[field])))) throw Error('Invalid measurement: '+field);
    for (const field of strings) if (row[field] != null && (typeof row[field] !== 'string' || !row[field].trim())) throw Error('Invalid text field: '+field);
    if (row.product != null && !Object.hasOwn(PRODUCT_WORKFLOWS, row.product)) throw Error('Unknown product profile');
    if (row.session_label != null) {
      if (labels.has(row.session_label)) throw Error('Duplicate session label');
      labels.add(row.session_label);
    }
    if (row.utc_date != null && (!/^\d{4}-\d{2}-\d{2}$/.test(row.utc_date) ||
      !Number.isFinite(Date.parse(row.utc_date)) || new Date(row.utc_date).toISOString().slice(0,10) !== row.utc_date)) throw Error('Invalid UTC date');
  }
  const eligible = records.filter(row => row.consent_recorded === true && row.owner_practice === false &&
    row.session_label && row.product && row.utc_date);
  const aggregate = field => {
    const measured = eligible.filter(row => row[field] != null);
    return {measured_sessions:measured.length, value:measured.length ? measured.reduce((sum,row) => sum + Number(row[field]),0) : null};
  };
  const paired = eligible.filter(row => row.review_minutes_before != null && row.review_minutes_assisted != null && row.comparison_method);
  return {
    schema_version:1, recorded_sessions:records.length, eligible_sessions:eligible.length,
    excluded_or_incomplete_sessions:records.length-eligible.length,
    products:Object.fromEntries(Object.keys(PRODUCT_WORKFLOWS).map(profile => [profile, eligible.filter(row => row.product===profile).length]).filter(([,count]) => count)),
    observations:Object.fromEntries([...booleans.slice(2),...numbers].map(field => [field,aggregate(field)])),
    paired_review_time:{sessions:paired.length, mean_minutes_before:paired.length ? paired.reduce((n,r) => n+r.review_minutes_before,0)/paired.length : null,
      mean_minutes_assisted:paired.length ? paired.reduce((n,r) => n+r.review_minutes_assisted,0)/paired.length : null},
    note:'Sessions are not unique participants or customers. Unknown measurements remain null. Review comparison methods and individual cases before attributing time savings; a paid completion needs independent payment evidence.'
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) throw Error('Usage: node summarize-sessions.mjs PRIVATE_SESSIONS_JSON');
  console.log(JSON.stringify(summarizeSessions(JSON.parse(await readFile(process.argv[2],'utf8'))),null,2));
}
