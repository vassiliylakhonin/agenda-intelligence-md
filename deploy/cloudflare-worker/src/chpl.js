// Reference snapshot: BIS CHPL, 2024-02-23, checked 2026-10-05.
// Exact HS6 membership is a diversion-review lead, not an ECCN or license decision.
export const CHPL_SOURCE = 'https://www.bis.gov/licensing/country-guidance/common-high-priority-items-list-chpl';
export const CHPL_CODES = Object.freeze({
  'Tier 1': ['854231','854232','854233','854239'],
  'Tier 2': ['851762','852691','853221','853224','854800'],
  'Tier 3.A': ['847150','850440','851769','852589','852910','852990','853669','853690','854110','854121','854129','854130','854149','854151','854159','854160'],
  'Tier 3.B': ['848210','848220','848230','848250','880730','901310','901380','901420','901480'],
  'Tier 4.A': ['847180','848610','848620','848640','853400','854320','902750','903020','903032','903039','903082'],
  'Tier 4.B': ['845710','845811','845891','845961','846693']
});
const DESCRIPTIONS = {
  'Tier 1':'Priority integrated-circuit categories',
  'Tier 2':'Priority electronics categories',
  'Tier 3.A':'Other listed electronic components',
  'Tier 3.B':'Listed mechanical and navigation components',
  'Tier 4.A':'Electronics manufacturing and testing equipment',
  'Tier 4.B':'CNC machine tools and listed components'
};
export function lookupChplTier(raw) {
  const value=String(raw || '').trim();
  const digits=/^[0-9.\s-]+$/.test(value) ? value.replace(/[.\s-]/g,'') : '';
  const code=digits.length>=6 && digits.length<=10 ? digits.slice(0,6) : null;
  const tier=code && Object.keys(CHPL_CODES).find(t=>CHPL_CODES[t].includes(code));
  return {
    prefix:code || digits, hs6:code, source_url:CHPL_SOURCE, snapshot_date:'2024-02-23',
    tier:tier || (code ? 'Non-CHPL in this reference snapshot' : 'Unresolved — supply a valid six-digit HS code'),
    isHighPriority:Boolean(tier),
    recommendation:tier ? 'ENHANCED_DUE_DILIGENCE' : 'STANDARD_REVIEW',
    description:tier ? DESCRIPTIONS[tier] : 'HS membership alone cannot establish export-control classification or permission.',
    risk:tier ? 'Listed category warrants diversion review. Assess product specifications, applicable jurisdiction, end-use, end-user and Russia nexus; no automatic license or sanctions determination.' : 'Not a clearance: items outside this snapshot can still be controlled. Resolve classification and applicable rules with a qualified reviewer.',
    documents:['Product technical specifications and classification rationale','Named end-user and end-use evidence','Destination, transit and applicable-jurisdiction review']
  };
}
