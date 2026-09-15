import {fmt,remaining,spot,direction} from './engine.js';
export function headerField(s){
 const x=p=>20+p*2.8;
 return `<div class="match-field"><svg viewBox="0 0 320 92" role="img" aria-label="Field diagram, not camera tracking. Ball ${spot(s.position)}, line to gain ${spot(s.lineToGain)}, ${s.possession} moving ${direction(s)>0?'right':'left'}"><rect x="1" y="1" width="318" height="90" rx="9" fill="#141923" stroke="#ffffff36"/><path d="M20 1V91M300 1V91" stroke="#ffffff66"/>${Array.from({length:9},(_,i)=>{const p=(i+1)*10;return `<path d="M${x(p)} 2V90" stroke="#ffffff26"/><text x="${x(p)}" y="18" text-anchor="middle" fill="#c4c6d1" font-size="7">${p<=50?p:100-p}</text>`;}).join('')}<path d="M20 34H300M20 58H300" stroke="#ffffff25" stroke-dasharray="1 6"/><path d="M${x(s.lineToGain)} 22V89" stroke="#faf4f6" stroke-dasharray="4 4" stroke-width="1.5"/><path d="M${x(s.position)} 22V89" stroke="#ff526c" stroke-width="2"/><ellipse cx="${x(s.position)}" cy="46" rx="5" ry="3.5" fill="#fff" stroke="#ff526c" stroke-width="2"/><path d="M${x(s.position)+direction(s)*8} 46h${direction(s)*16}l${direction(s)*-4} -4m${direction(s)*4} 4l${direction(s)*-4} 4" fill="none" stroke="#ff8094" stroke-width="1.5"/></svg><div class="match-field-caption"><span>${s.possession} ${direction(s)>0?'→':'←'} possession</span><span>Solid: ball · dashed: line to gain</span></div></div>`;
}
const icons={ref:'M4 21V3m0 1c5-4 9 4 16 0v10c-7 4-11-4-16 0',keeper:'M5 4h14v17H5zM9 1v6m6-6v6M8 11h8m-8 5h5',reports:'M4 20h17M7 16v-5m5 5V5m5 11V8'};
export function mobileConsole(s,tab){
 const board=document.querySelector('.scoreboard');
 board.innerHTML=`<div class="match-meta"><span>FOOTBALL / Q${s.quarter}</span><span>${s.phase==='live'?'● LIVE BALL':'○ DEAD BALL'}</span></div><div class="match-team"><span class="match-avatar">N</span><b>Northview</b><small>${s.timeouts.Northview} timeouts ${s.possession==='Northview'?'· BALL':''}</small></div><div class="match-result"><div>${s.score.Northview}<span>:</span>${s.score.Central}</div><strong data-game-clock>${fmt(remaining(s.game))}</strong><small>Reference clock</small></div><div class="match-team"><span class="match-avatar away">C</span><b>Central</b><small>${s.timeouts.Central} timeouts ${s.possession==='Central'?'· BALL':''}</small></div><div class="match-footer"><span><b>${s.down}</b> DOWN</span><span><b>${Math.abs(s.lineToGain-s.position)}</b> TO GO</span><span><b>${spot(s.position)}</b> BALL SPOT</span></div>`;
 board.querySelector('.match-result strong').remove();
 board.querySelector('.match-result>small').remove();
 board.querySelector('.match-footer').insertAdjacentHTML('beforebegin',headerField(s));
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
   const field=document.querySelector('.console-pitch');
   const details=document.createElement('details');details.className='field-disclosure';
   details.innerHTML='<summary>Field & crew positioning <span>View diagram ↗</span></summary>';
   field.before(details);details.append(field);
  }else{
   const main=quick.querySelector('[data-action=snap],[data-action=kick-touch]');
   if(main)quick.querySelector('.card-head').after(main);
   const result=quick.querySelector('#quick-result-form'),markers=quick.querySelector('.action-grid');
   if(result&&markers)result.after(markers);
  }
 }
 document.querySelector('.under-score')?.setAttribute('hidden','');
 document.querySelector('.brand-sub').textContent='GAME DAY, UNDER CONTROL';
}
