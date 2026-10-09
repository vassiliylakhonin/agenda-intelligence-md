import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { INTAKE_CLIENT_SCRIPT } from '../src/intake-editor.js';
import { WORKED_EXAMPLES } from '../src/worked-examples.js';
import { handleRequest } from '../src/index.js';

class Element {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.style = {}; this.children = []; this.value = ''; }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.children = children; }
  addEventListener(name, listener) { this['on' + name] = listener; }
  setCustomValidity(message) { this.validationMessage = message; }
  find(id) { return this.id === id ? this : this.children.map(child => child.find(id)).find(Boolean); }
  controls() { return [this, ...this.children.flatMap(child => child.controls())]; }
}

test('field editor preserves every seeded request, unknown fields and literal content without sending it', () => {
  for (const [profile, example] of Object.entries(WORKED_EXAMPLES)) {
    const template = structuredClone(example.request.request || example.request);
    template.custom_caller_note = '<script>not executable</script>';
    const box = new Element('textarea'); box.value = JSON.stringify(template);
    const root = new Element('div');
    const context = {document:{createElement:tag => new Element(tag)}};
    vm.runInNewContext(INTAKE_CLIENT_SCRIPT, context);
    context.mountIntakeEditor(root, box, template, {});
    assert.deepEqual(JSON.parse(box.value), template, profile);
    const note = root.find('intake-custom_caller_note');
    assert.equal(note.value, template.custom_caller_note);
    note.value = 'Edited redacted file'; note.oninput();
    assert.equal(JSON.parse(box.value).custom_caller_note, 'Edited redacted file');
    box.value = JSON.stringify({...JSON.parse(box.value), additional_unknown_field:'preserve me'});
    box.onchange();
    root.find('intake-additional_unknown_field').value = 'still present';
    root.find('intake-additional_unknown_field').oninput();
    assert.equal(JSON.parse(box.value).additional_unknown_field, 'still present');
  }
});

test('blank requests retain numeric input types and new records are empty rather than invented', () => {
  const template = {amount:150,dated_sources:[{id:'example',source_type:'example',title:'Synthetic example',date:'2026-10-08'}]};
  const box = new Element('textarea'); box.value = JSON.stringify(template);
  const root = new Element('div');
  const context = {document:{createElement:tag => new Element(tag)}};
  vm.runInNewContext(INTAKE_CLIENT_SCRIPT, context);
  context.mountIntakeEditor(root, box, template, {});
  root.startBlank();
  const amount = root.find('intake-amount');
  assert.equal(amount.type, 'number'); amount.value = '125.5'; amount.oninput();
  root.controls().find(node => node.textContent === 'Add dated sources item').onclick();
  assert.deepEqual(JSON.parse(box.value), {amount:125.5,dated_sources:[{id:'',source_type:'',title:'',date:''}]});
  box.value = '{broken'; box.onchange();
  assert.equal(box.value, '{broken');
  assert.match(root.children[0].textContent, /Correct Structured request JSON/);
});

test('schema enum choices and optional JSON values preserve the actual request contract', () => {
  const template = {dated_sources:[{source_type:'registry',title:'Supplied record'}],specification:{}};
  const schema = {properties:{dated_sources:{items:{$ref:'#/$defs/source'}}},$defs:{source:{properties:{source_type:{enum:['registry','ownership']}}}}};
  const box = new Element('textarea'); box.value = JSON.stringify(template);
  const root = new Element('div');
  const context = {document:{createElement:tag => new Element(tag)}};
  vm.runInNewContext(INTAKE_CLIENT_SCRIPT, context);
  context.mountIntakeEditor(root, box, template, {schema,optional:[{path:'specification.expected_schema',label:'Expected schema',json:true}]});
  const source = root.find('intake-dated_sources.0.source_type');
  assert.equal(source.tagName, 'SELECT');
  assert.ok(source.children.some(option => option.value === 'ownership'));
  source.value = 'ownership'; source.oninput();
  const optional = root.find('intake-specification.expected_schema');
  optional.value = '{bad'; optional.oninput();
  assert.ok(optional.validationMessage);
  assert.deepEqual(JSON.parse(box.value).specification, {});
  optional.value = '{"type":"object"}'; optional.oninput();
  assert.equal(optional.validationMessage, '');
  assert.deepEqual(JSON.parse(box.value), {dated_sources:[{source_type:'ownership',title:'Supplied record'}],specification:{expected_schema:{type:'object'}}});
});

test('edited form requests still reach existing validators for all twelve products', async () => {
  const original = console.log; console.log = () => {};
  try {
    for (const [profile, example] of Object.entries(WORKED_EXAMPLES)) {
      const template = structuredClone(example.request.request || example.request);
      const box = new Element('textarea'); box.value = JSON.stringify(template);
      const root = new Element('div');
      const context = {document:{createElement:tag => new Element(tag)}};
      vm.runInNewContext(INTAKE_CLIENT_SCRIPT, context);
      context.mountIntakeEditor(root, box, template, {});
      const control = root.controls().find(node => ['INPUT','TEXTAREA'].includes(node.tagName) && !node.id.endsWith('date') && node.type !== 'number');
      // Editing a field to the same value must not coerce or lose other inputs.
      control.oninput();
      const path = profile === 'agent_output_verification' ? '/v1/agent-output/trial' : '/v1/trial';
      const response = await handleRequest(new Request('https://example.test'+path, {method:'POST',headers:{'content-type':'application/json'},body:box.value}),
        {AGENT_PROFILE:profile,WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call',VIZIER_DISABLED:'1'});
      assert.equal(response.status, 503, profile+' valid request reaches absent trial storage, not a validation error');
      assert.equal((await response.json()).code, 'trial_unavailable');
    }
  } finally { console.log = original; }
});
