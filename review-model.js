export const outcomes=['CONFIRMED','STANDS','OVERTURNED','INCONCLUSIVE','NO REVIEW'];
export const assessments=['UNASSESSED','CORRECT CALL','INCORRECT CALL','CORRECT NO-CALL','POSSIBLE MISSED CALL','MECHANICS','INSUFFICIENT VIEW'];
const required=(value,max)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw Error('Complete the reviewer name and required review fields.');return value.trim();};
export function createReview(input,marker,previous=null){
  if(!marker?.id||!marker.sessionId)throw Error('Select an existing moment.');
  if(!outcomes.includes(input.outcome)||!assessments.includes(input.assessment))throw Error('Choose a supported outcome and assessment.');
  const reviewerId=required(input.reviewerId,100),reviewer=required(input.reviewer,100);
  if(previous&&(previous.markerId!==marker.id||previous.reviewerId!==reviewerId))throw Error('Review history does not match this reviewer and moment.');
  const start=Number(input.start),end=Number(input.end);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start)throw Error('Review end must be later than its start.');
  return {id:crypto.randomUUID(),schema:'digiref-evaluator-review',version:1,sessionId:marker.sessionId,markerId:marker.id,eventId:marker.eventId||null,reviewerId,reviewer,identity:'self-reported local evaluator',outcome:input.outcome,assessment:input.assessment,note:required(input.note,4000),ruleReference:String(input.ruleReference||'').slice(0,300),start,end,createdAt:new Date().toISOString(),revision:(previous?.revision||0)+1,supersedes:previous?.id||null,trainingEligible:false};
}
export function latestReviews(rows){
  const map=new Map();for(const row of rows){const key=JSON.stringify([row.markerId,row.reviewerId]);if(!map.has(key)||map.get(key).revision<row.revision)map.set(key,row);}return [...map.values()];
}
export function reviewSummary(markers,rows){
  const latest=latestReviews(rows),reviewed=new Set(latest.map(row=>row.markerId)),counts={};
  for(const row of latest)counts[row.assessment]=(counts[row.assessment]||0)+1;
  const disagreements=markers.filter(marker=>new Set(latest.filter(row=>row.markerId===marker.id).map(row=>row.assessment)).size>1).length;
  return {moments:markers.length,reviewedMoments:reviewed.size,unreviewedMoments:markers.filter(row=>!reviewed.has(row.id)).length,reviewRevisions:rows.length,disagreements,assessments:counts};
}
