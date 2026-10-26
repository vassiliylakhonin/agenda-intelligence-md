import {emptyArchive} from './document-archive.js';

// Starting questions only. No jurisdictional, legal or documentary adequacy claim.
const starters={
  company:{title:'Company document archive',purpose:'Prepare the supplied business records for an agreed reviewer. Confirm scope, applicable requirements and assessment date.',items:[
    ['profile','Company profile and supplied identity record',true],['agreements','Agreements relevant to this review',true],
    ['renewals','Renewal / expiry records where applicable',false],['prior','Earlier versions needed for comparison',false]]},
  supplier:{title:'Supplier document pack',purpose:'Prepare a supplier handover for procurement review. Agree the supplier, scope and applicable checklist before collecting documents.',items:[
    ['profile','Supplied supplier profile / questionnaire',true],['scope','Contract or proposed supply scope',true],
    ['coverage','Current coverage or certificates required by the reviewer',false],['ownership','Ownership evidence if required by the reviewer',false]]},
  reporting:{title:'Reporting evidence pack',purpose:'Prepare the source records behind an agreed reporting period and set of claims or indicators for human review.',items:[
    ['requirements','Reporting requirements and indicator definitions',true],['sources','Source records for the reported claims / indicators',true],
    ['calculations','Calculation notes and reproducible tables',true],['prior','Previous report or baseline for comparison',false]]}
};
export function archiveTemplate(key,date){
  const starter=starters[key];if(!Object.hasOwn(starters,key))throw Error('Choose a published starting checklist.');
  const packet=emptyArchive(date);packet.title=starter.title;packet.purpose=starter.purpose;
  packet.requirements=starter.items.map(([id,title,required])=>({id,title,owner:'',minimum_files:1,required}));
  return packet;
}
