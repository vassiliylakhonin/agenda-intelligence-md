import {validationCatalog} from './validation-catalog.js';

// Finite operational metadata only. Never persist arguments, findings, field
// names, arbitrary tool names, protocol IDs or a digest of submitted evidence.
const REASONS = new Set(['invalid_validation_request','unknown_validation_tool',
  'validation_body_too_large','validation_complexity_limit','invalid_validation_json',
  'unauthorized','payment_not_applicable','method_not_allowed','protocol_rejected']);
const UTILITIES = new Set(['fleet_directory','decision_policies_list','free_trial_status','free_trial_feedback','validate_input','open_answer_review']);
export function inputValidationObservation(profile, transport, target, status, body) {
  const checked=status===200 && typeof body?.valid==='boolean';
  const published=validationCatalog(profile).some(item=>item.name===target);
  return {agent_profile:profile,validation_transport:transport,
    validation_tool:published?target:null,
    validation_target_kind:published?(UTILITIES.has(target)?'utility':'evaluation'):'unknown',
    validation_outcome:checked?(body.valid?'valid':'invalid'):'rejected',
    validation_reason:checked?(body.valid?'schema_valid':'schema_mismatch'):
      REASONS.has(body?.code)?body.code:'protocol_rejected',
    evaluation_performed:false,attempt_consumed:false};
}
