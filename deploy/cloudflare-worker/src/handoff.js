// Preparation only: copy compatible explicit fields, never infer evidence or
// submit it to another origin. The target's validate_input remains authoritative.
export function projectHandoffValue(value, schema, depth = 0) {
  if (!schema || typeof schema !== 'object') return undefined;
  const type = schema.type;
  if (type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    if (depth > 0 && Object.keys(value).some(key => !Object.hasOwn(schema.properties || {},key))) return undefined;
    const mapped = Object.entries(schema.properties || {}).filter(([key]) => Object.hasOwn(value,key))
      .map(([key,child]) => [key,projectHandoffValue(value[key],child,depth + 1)]);
    if (depth > 0 && mapped.some(([,selected]) => selected === undefined)) return undefined;
    return Object.fromEntries(mapped.filter(([,selected]) => selected !== undefined));
  }
  if (type === 'array') {
    if (!Array.isArray(value)) return undefined;
    const projected = value.map(item => projectHandoffValue(item,schema.items,depth + 1));
    // Never quietly delete incompatible evidence records from a dossier.
    return projected.some(item => item === undefined) ? undefined : projected;
  }
  if (schema.enum && !schema.enum.includes(value)) return undefined;
  if (type === 'string' && typeof value === 'string' && value.trim()) return value;
  if ((type === 'number' || type === 'integer') && typeof value === 'number' && Number.isFinite(value) &&
      (type !== 'integer' || Number.isInteger(value))) return value;
  if (type === 'boolean' && typeof value === 'boolean') return value;
  return undefined;
}
export function prepareHandoff(input, schema) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !schema?.properties) throw Error('A request object and target schema are required.');
  const projected = projectHandoffValue(input,schema);
  // Carry the user's question verbatim, without extracting identities, country
  // codes, amounts or other domain evidence from free prose.
  const question = typeof input.text === 'string' ? input.text : input.question;
  const questionField = ['risk_question','decision_question','decision_context'].find(key => schema.properties[key]?.type === 'string');
  const field_mappings = [];
  if (questionField && !Object.hasOwn(projected,questionField) && typeof question === 'string' && question.trim()) {
    projected[questionField] = question;
    field_mappings.push({from:typeof input.text === 'string' ? 'text' : 'question',to:questionField});
  }
  const copied_fields = Object.keys(projected);
  const required_fields_to_complete = (schema.required || []).filter(key => !Object.hasOwn(projected,key));
  return {input:projected,copied_fields,field_mappings,required_fields_to_complete,
    note:'Prepared locally, no attempt consumed. Check every copied field and complete the target schema. No source authentication or permission is inferred.'};
}
export function handoffHtml(targets, escape) {
  return '<section aria-label="Prepare a specialist handoff"><h2>Prepare the next request — free</h2>' +
    '<p>Choose a specialist. Copy compatible fields from the structured input above into a request you can inspect. Preparation sends nothing to that service and consumes no attempt.</p>' +
    '<label for="handoff-target">Specialist</label><select id="handoff-target" style="display:block;width:100%;margin:8px 0;padding:8px">' + targets.map(target =>
      '<option value="' + escape(target.profile) + '">' + escape(target.name) + '</option>').join('') + '</select> ' +
    '<button type="button" onclick="prepareSpecialistHandoff()">Prepare request from current input</button>' +
    '<p id="handoff-status" role="status"></p><textarea id="handoff-input" aria-label="Prepared specialist JSON" rows="8" style="width:100%;box-sizing:border-box;padding:12px;font:13px/1.5 monospace" hidden></textarea>' +
    '<p><a id="handoff-open" hidden target="_blank" rel="noopener">Open specialist</a></p>' +
    '<p>Your question is copied verbatim into the target question field where available; identities, countries and facts are never inferred from prose. Copy the prepared JSON into the specialist’s advanced input, then update its fields and run free schema preflight. No confidential data is put in a URL or stored between visits. Unmapped fields are not transferred.</p></section>';
}
export const HANDOFF_CLIENT_SCRIPT = String.raw`
function prepareSpecialistHandoff() {
  var status = document.getElementById('handoff-status');
  var output = document.getElementById('handoff-input');
  var open = document.getElementById('handoff-open');
  try {
    var selected = agendaHandoffTargets.find(function(item) { return item.profile === document.getElementById('handoff-target').value; });
    if (!selected) throw Error('Choose a known specialist.');
    var result = prepareHandoff(JSON.parse(document.getElementById('profile-request').value),selected.schema);
    output.value = JSON.stringify(result.input,null,2); output.hidden = false;
    open.href = selected.origin + '/'; open.hidden = false;
    status.textContent = 'Copied fields: ' + (result.copied_fields.join(', ') || 'none; this specialist needs different fields') +
      '. Question mapping: ' + (result.field_mappings.map(function(item) { return item.from + ' → ' + item.to; }).join(', ') || 'none') +
      '. Required top-level fields to complete: ' + (result.required_fields_to_complete.join(', ') || 'none; validate nested fields next') + '. ' + result.note;
  } catch (error) {
    output.hidden = true; open.hidden = true; status.textContent = 'Preparation stopped: ' + error.message + ' Nothing was sent.';
  }
}
`;
