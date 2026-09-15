import {readAll,appendReview} from './evidence-store.js';
import {createReview,outcomes,assessments,latestReviews,reviewSummary} from './review-model.js';
import {esc} from './ui.js';
function identity(){const key='digiref-evaluator-id';let id=localStorage.getItem(key);if(!id){id=crypto.randomUUID();localStorage.setItem(key,id);}return id;}
export async function mountEvaluator(host,item,markers){
  const section=document.createElement('section');host.append(section);
  let rows=await readAll('reviews',item.id),selected=null,previous=null;
  const reviewerId=identity();
  const render=()=>{
    const summary=reviewSummary(markers,rows);
    section.innerHTML=`<h3>Evaluator review</h3><p>${summary.reviewedMoments}/${summary.moments} moments reviewed · ${summary.disagreements} disagreements · ${summary.reviewRevisions} saved versions</p><p>Local evaluator names are self-reported. Reviews preserve prior versions and do not change the game ruling.</p><label>Choose a moment<select id="review-moment"><option value="">Choose…</option>${markers.map(marker=>`<option value="${esc(marker.id)}">${esc(marker.type)} · ${marker.at.toFixed(1)}s</option>`).join('')}</select></label><div id="review-edit"></div><div id="review-save-status" role="status"></div><details><summary>Full review history</summary>${reviewHistoryHTML(rows)}</details><button type="button" id="review-export">Download review data</button>`;
    section.querySelector('#review-moment').onchange=event=>{
      selected=markers.find(marker=>marker.id===event.target.value);if(!selected){section.querySelector('#review-edit').innerHTML='';return;}
      previous=latestReviews(rows).find(row=>row.markerId===selected.id&&row.reviewerId===reviewerId)||null;
      section.querySelector('#review-edit').innerHTML=`<form id="evaluator-form" class="form-grid"><label class="wide">Evaluator name<input name="reviewer" required maxlength="100" value="${esc(previous?.reviewer||'')}"></label><label>Review outcome<select name="outcome" required><option value="">Choose an outcome…</option>${outcomes.map(value=>`<option ${previous?.outcome===value?'selected':''}>${value}</option>`).join('')}</select></label><label>Teaching assessment<select name="assessment">${assessments.map(value=>`<option ${previous?.assessment===value?'selected':''}>${value}</option>`).join('')}</select></label><label>Video start (seconds)<input name="start" type="number" min="0" step="0.01" value="${previous?.start??Math.max(0,selected.at-15).toFixed(2)}" required></label><label>Video end (seconds)<input name="end" type="number" min="0" max="${item.duration}" step="0.01" value="${previous?.end??Math.min(item.duration,selected.at+10).toFixed(2)}" required></label><label class="wide">Rule reference<input name="ruleReference" maxlength="300" value="${esc(previous?.ruleReference||'')}"></label><label class="wide">Evidence and teaching notes<textarea name="note" maxlength="4000" required>${esc(previous?.note||'')}</textarea></label><button class="primary wide">Save review version</button></form>`;
      section.querySelector('form').onsubmit=async event=>{
        event.preventDefault();event.stopPropagation();const button=event.target.querySelector('button');button.disabled=true;
        try{const data=Object.fromEntries(new FormData(event.target));if(Number(data.end)>item.duration)throw Error('Review window exceeds saved video.');const review=createReview({...data,reviewerId},selected,previous);await appendReview(review);rows=await readAll('reviews',item.id);render();section.querySelector('#review-save-status').textContent='Review saved. Earlier versions remain in history.';}catch(error){section.querySelector('#review-save-status').textContent=error.message;button.disabled=false;}
      };
    };
    section.querySelector('#review-export').onclick=()=>{
      const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify({schema:'digiref-review-export',version:1,sessionId:item.id,sessionName:item.name,markers,reviews:rows,summary},null,2)],{type:'application/json'}));a.href=url;a.download=`DigiRef-${item.id}-reviews.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
    };
  };render();
}
export function reviewHistoryHTML(rows){return rows.map(row=>`<article><p><b>${esc(row.reviewer)} · version ${row.revision} · ${esc(row.outcome)}</b><br>${esc(row.assessment)} · ${esc(row.createdAt)}</p><p>${esc(row.note)}</p><p>${esc(row.ruleReference)}</p></article>`).join('')||'<p>No evaluator reviews yet.</p>';}
