const blockedKeys=new Set(['token','crewtoken','digiref_crew_token','image','images','frame','frames','apikey','api_key','authorization']);

function sanitize(value){
  if(Array.isArray(value))return value.map(sanitize);
  if(!value||typeof value!=='object')return value;
  return Object.fromEntries(Object.entries(value).filter(([key])=>!blockedKeys.has(key.toLowerCase())).map(([key,item])=>[key,sanitize(item)]));
}

function countBy(values,key){
  return values.reduce((counts,value)=>{
    const name=key(value);
    counts[name]=(counts[name]||0)+1;
    return counts;
  },{});
}

export function createObserverExport(entries,exportedAt=new Date().toISOString()){
  const safeEntries=sanitize(entries);
  const completed=safeEntries.filter(entry=>entry.type==='review_completed');
  return {
    format:'digiref-live-observer-log',
    version:1,
    exportedAt,
    summary:{
      sessions:safeEntries.filter(entry=>entry.type==='session_started').length,
      reviewsCompleted:completed.length,
      reviewsFailed:safeEntries.filter(entry=>entry.type==='review_failed').length,
      modelStatuses:countBy(completed,entry=>entry.observation.status),
      humanLabels:countBy(completed.filter(entry=>entry.humanLabel),entry=>entry.humanLabel.value)
    },
    entries:safeEntries
  };
}
