// Pure reference integrity. No authenticity, recency or factual verification.
export function reviewSourceRecords(sources = [], {dateRequired = true} = {}) {
  const ids = new Map();
  for (const s of sources) {
    if (!s || typeof s !== 'object') continue;
    const id=String(s.id || '').trim();
    if (!ids.has(id)) ids.set(id,new Set());
    ids.get(id).add(String(s.source_type || ''));
  }
  const usable=[],issues=[];
  for (const [index,s] of sources.entries()) {
    if (!s || typeof s !== 'object') continue;
    const reasons=[];
    if (!String(s.id || '').trim() || !String(s.title || '').trim()) reasons.push('Supply a nonblank source ID and title.');
    if (ids.get(String(s.id || '').trim()).size > 1) reasons.push('Source ID has conflicting document types; assign distinct records or resolve the conflict.');
    if (dateRequired || s.date !== undefined) {
      const d=typeof s.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.date) ? new Date(s.date+'T00:00:00Z') : null;
      if (!d || Number.isNaN(d.getTime()) || d.toISOString().slice(0,10)!==s.date || s.date.startsWith('0000')) reasons.push('Supply a real calendar date in YYYY-MM-DD format.');
    }
    for (const issue of reasons) issues.push({source_index:index,source_type:s.source_type || '',issue});
    if (!reasons.length && s.source_type && !usable.includes(s.source_type)) usable.push(s.source_type);
  }
  return {policy_version:'source-records.v1',scope:'reference_metadata_only',source_content_verified:false,freshness_verified:false,usable_source_types:usable,issues,next_action:'Verify source content, issuer, recency and relevance before relying on this reference coverage.'};
}
