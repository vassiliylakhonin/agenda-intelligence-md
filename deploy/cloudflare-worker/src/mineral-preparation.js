import { MINERALS_TAXONOMY } from './critical_minerals_taxonomy.js';

// Keyword selection only. Never extract or invent dossier facts from prose.
export function mineralPreparationPlan(text) {
  if (!/(?:mineral|offtake|lithium|uranium|rare earth|минерал|оффтейк|литий|уран)/iu.test(text)) return null;
  return {profile:'critical_minerals_due_diligence',status:'preparation_only',evaluation_performed:false,
    authorization_granted:false,human_review_required:true,trial_attempt_consumed:false,
    missing_fields:['project_name','commodity','origin_jurisdiction','decision_stage','assessment_date','target_market','supplied_sources'],
    documents_by_stage:MINERALS_TAXONOMY,
    blank_request_template:{project_name:'',commodity:'',origin_jurisdiction:'',decision_stage:'',assessment_date:'',target_market:'',supplied_sources:[]},
    blank_source_template:{source_type:'',title:'',issuing_authority:'',date:'',valid_until:'',document_id:'',url:'',excerpt:'',
      scope:{project_name:'',commodity:'',origin_jurisdiction:''}},
    next_action:'Choose the actual decision stage, obtain authorized dated documents from their owners, and fill the blank fields. Read the specialist input schema before submitting an evaluation. Blank templates are not valid evidence or a completed audit.',
    limitations:'No facts extracted or inferred from the question. This is a list of fields to collect, not an assessment of which documents you already have, source verification, clearance or a specialist evaluation.'};
}
