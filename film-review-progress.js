export const FILM_REVIEW_LABELS=new Set(['review_warranted','no_review','view_unclear']);

export function filmItemId(item){
  if(!item||typeof item.video!=='string'||!Number.isInteger(item.seconds))throw Error('Invalid film item');
  return `${item.video}:${item.seconds}`;
}

export function normalizeFilmLabels(queue,value){
  const allowed=new Set(queue.map(filmItemId));
  if(!value||typeof value!=='object'||Array.isArray(value))return {};
  return Object.fromEntries(Object.entries(value).filter(([id,entry])=>allowed.has(id)&&entry&&FILM_REVIEW_LABELS.has(entry.value)&&typeof entry.labeledAt==='string').map(([id,entry])=>[id,{value:entry.value,labeledAt:entry.labeledAt}]));
}

export function summarizeFilmLabels(queue,labels){
  const safe=normalizeFilmLabels(queue,labels);
  const counts={review_warranted:0,no_review:0,view_unclear:0};
  for(const entry of Object.values(safe))counts[entry.value]++;
  return {total:queue.length,labeled:Object.keys(safe).length,counts};
}

export function nextUnlabeledIndex(queue,labels,after=-1){
  if(!queue.length)return -1;
  const safe=normalizeFilmLabels(queue,labels);
  for(let offset=1;offset<=queue.length;offset++){
    const index=(after+offset)%queue.length;
    if(!safe[filmItemId(queue[index])])return index;
  }
  return -1;
}

export function createFilmReviewExport(queue,labels,sources,exportedAt=new Date().toISOString()){
  const safe=normalizeFilmLabels(queue,labels);
  const titles=Object.fromEntries(sources.map(source=>[source.id,source.title]));
  return {
    format:'digiref-film-review-labels',
    version:1,
    exportedAt,
    summary:summarizeFilmLabels(queue,safe),
    items:queue.map(item=>({id:filmItemId(item),video:item.video,title:titles[item.video]||item.video,cueTime:item.time,cueSeconds:item.seconds,reviewTime:item.reviewTime||item.time,reviewSeconds:item.reviewSeconds??item.seconds,area:item.area,cue:item.cue,humanLabel:safe[filmItemId(item)]||null}))
  };
}
