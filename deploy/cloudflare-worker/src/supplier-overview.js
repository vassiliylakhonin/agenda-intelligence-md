import {validatePacket,reviewSnapshot} from './supplier-dossier.js';

// View of saved records as of an explicit UTC date; never rewrites assessment
// dates or treats a manual request closure as documentary resolution.
export function dossierOverview(packet,today){
  validatePacket(packet);
  if(!/^\d{4}-\d{2}-\d{2}$/u.test(today)||new Date(today+'T00:00:00Z').toISOString().slice(0,10)!==today)throw Error('Invalid overview date.');
  const s=packet.current,soon=new Date(Date.parse(today+'T00:00:00Z')+30*86400000).toISOString().slice(0,10);
  return {dossier_id:packet.dossier_id,supplier:s.supplier.name,purpose:s.purpose,as_of:today,assessment_date:s.assessment_date,
    expired:s.documents.filter(row=>row.expires_on&&row.expires_on<today).map(row=>({id:row.id,title:row.title,date:row.expires_on})),
    expiring:s.documents.filter(row=>row.expires_on&&row.expires_on>=today&&row.expires_on<=soon).map(row=>({id:row.id,title:row.title,date:row.expires_on})),
    open_requests:s.requests.filter(row=>['draft','requested'].includes(row.status)).map(row=>({id:row.id,owner:row.owner,status:row.status,requirement_id:row.requirement_id})),
    evidence_gaps:reviewSnapshot(s).rows.filter(row=>row.required&&row.status!=='supplied_for_review').length,
    versions:packet.versions.length,last_saved:packet.versions.at(-1)?.saved_at||null,human_review_required:true,authorization_granted:false};
}
