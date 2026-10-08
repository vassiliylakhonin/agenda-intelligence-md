import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summarizeSessions} from '../../../examples/product-pilot/summarize-sessions.mjs';

test('pilot readout separates real sessions, practice and unknown measurements', () => {
  const session = {session_label:'private-label',product:'agent_output_verification',utc_date:'2026-10-08',consent_recorded:true,
    owner_practice:false,comparison_method:'counterbalanced',human_confirmed_useful_findings:2,human_confirmed_false_holds:0,
    review_minutes_before:10,review_minutes_assisted:6,finding_changed_output:true};
  const result = summarizeSessions([session,{...session,session_label:'practice',owner_practice:true,human_confirmed_useful_findings:50},
    {...session,session_label:'missing',consent_recorded:null}]);
  assert.equal(result.eligible_sessions,1);
  assert.equal(result.observations.human_confirmed_useful_findings.value,2);
  assert.deepEqual(result.observations.voluntary_repeat_session,{measured_sessions:0,value:null});
  assert.equal(result.paired_review_time.mean_minutes_before,10);
  assert.equal(result.paired_review_time.mean_minutes_assisted,6);
  assert.ok(!JSON.stringify(result).includes('private-label'));
});

test('pilot readout refuses fabricated shapes and never counts missing times as zero', () => {
  const template = JSON.parse(readFileSync(new URL('../../../examples/product-pilot/session-template.json', import.meta.url)));
  assert.equal(summarizeSessions([template]).eligible_sessions,0);
  for (const row of [{prompt:'private'}, {human_confirmed_false_holds:-1}, {human_confirmed_useful_findings:1.5},
    {consent_recorded:'true'}, {product:'invented'}, {utc_date:'2026-02-30'}]) assert.throws(() => summarizeSessions([row]));
  assert.throws(() => summarizeSessions([{session_label:'same'},{session_label:'same'}]), /Duplicate/);
  assert.deepEqual(summarizeSessions([]).paired_review_time,{sessions:0,mean_minutes_before:null,mean_minutes_assisted:null});
});
