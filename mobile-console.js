import {fmt,remaining,spot} from './engine.js';
import {field} from './ui.js';
const icons={ref:'M4 21V3m0 1c5-4 9 4 16 0v10c-7 4-11-4-16 0',keeper:'M5 4h14v17H5zM9 1v6m6-6v6M8 11h8m-8 5h5',reports:'M4 20h17M7 16v-5m5 5V5m5 11V8'};
export function mobileConsole(s,tab){
 const board=document.querySelector('.scoreboard');
 board.innerHTML=`<div class="match-meta"><span>FOOTBALL / Q${s.quarter}</span><span>${s.phase==='live'?'● LIVE BALL':'○ DEAD BALL'}</span></div><div class="match-team"><span class="match-avatar">N</span><b>Northview</b><small>${s.timeouts.Northview} timeouts ${s.possession==='Northview'?'· BALL':''}</small></div><div class="match-result"><div>${s.score.Northview}<span>:</span>${s.score.Central}</div><strong data-game-clock>${fmt(remaining(s.game))}</strong><small>Reference clock</small></div><div class="match-team"><span class="match-avatar away">C</span><b>Central</b><small>${s.timeouts.Central} timeouts ${s.possession==='Central'?'· BALL':''}</small></div><div class="match-footer"><span><b>${s.down}</b> DOWN</span><span><b>${Math.abs(s.lineToGain-s.position)}</b> TO GO</span><span><b>${spot(s.position)}</b> BALL SPOT</span></div>`;
 board.querySelector('.match-result strong').remove();
 board.querySelector('.match-result>small').remove();
 const fieldWrap=document.createElement('div');fieldWrap.innerHTML=field(s);
 const fieldEl=fieldWrap.querySelector('.field'),legendEl=fieldWrap.querySelector('.field-legend');
 if(fieldEl)board.querySelector('.match-footer').before(fieldEl);
 if(legendEl)board.querySelector('.match-footer').before(legendEl);
 board.insertAdjacentHTML('afterend',`<section class="glance-clocks" aria-label="Reference clock controls"><button type="button" data-action="game-clock" aria-label="Start or pause reference game clock"><span>GAME CLOCK <i>${s.game.until===null?'PAUSED':'RUNNING'}</i></span><strong data-game-clock>${fmt(remaining(s.game))}</strong><small>Tap to start / pause · reference only</small></button><button type="button" data-action="play-clock" aria-label="Start or pause play clock"><span>PLAY CLOCK <i>${s.play.until===null?'PAUSED':'RUNNING'}</i></span><strong data-play-clock>${Math.ceil(remaining(s.play))}</strong><small data-play-status>Awaiting signal</small></button></section>`);
 document.querySelector('.console-clock')?.remove();
 document.querySelectorAll('.glance-clocks i').forEach((node,index)=>node.dataset.clockState=index===0?'game':'play');
 document.querySelectorAll('.portal-nav button').forEach(button=>{const id=button.dataset.tab;button.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[id]}"/></svg><span>${{ref:'Officiate',keeper:'Track game',reports:'Review'}[id]}</span>`;});
 const quick=document.querySelector('.quick-game');
 if(quick){
  const undo=quick.querySelector('[data-action=undo]');
  if(tab==='ref'){
   const header=document.querySelector('.official-assignment');header.append(undo);
   quick.querySelector('.card-head')?.remove();
   document.querySelector('.console-pitch')?.remove();
  }else{
   const main=quick.querySelector('[data-action=snap],[data-action=kick-touch]');
   if(main)quick.querySelector('.card-head').after(main);
   const result=quick.querySelector('#quick-result-form'),markers=quick.querySelector('.action-grid');
   if(result&&markers)result.after(markers);
  }
 }
 document.querySelectorAll('.field-card').forEach(el=>el.remove());
 document.querySelector('.under-score')?.setAttribute('hidden','');
 document.querySelector('.brand-sub').textContent='GAME DAY, UNDER CONTROL';
}
