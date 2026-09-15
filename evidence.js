import {write,readAll,recordingBlob,clipWindow,checksum} from './evidence-store.js';
import {esc} from './ui.js';
import {mountEvaluator,reviewHistoryHTML} from './evaluator.js';

const panel=document.createElement('dialog');
panel.setAttribute('aria-label','Football video evidence');
panel.innerHTML=`<header class="card-head"><h2>Football video evidence</h2><button type="button" data-evidence-close>Close</button></header><p>Record short tests with the camera page open. Video saves in this browser. Download recordings before clearing browser data.</p><p id="evidence-status" role="status"></p><div id="evidence-library"></div>`;
document.body.append(panel);
const cameraPanel=document.querySelector('.camera-dialog');
const controls=document.createElement('section');
controls.innerHTML=`<h3>Record & review</h3><label>Test / game name<input id="evidence-name" maxlength="100" placeholder="Friday practice — first quarter"></label><p>Browser test recorder · video only · keep this page visible. Start recording before the play.</p><div class="toolbar"><button type="button" id="evidence-start">Start recording</button><button type="button" id="evidence-mark" disabled>MARK review moment</button><button type="button" id="evidence-stop" disabled>Stop & save</button><button type="button" data-evidence-open>Saved video</button></div><p id="record-status" role="status">Not recording</p>`;
cameraPanel.querySelector('#camera-help').after(controls);
const q=id=>document.getElementById(id);
let recorder=null,session=null,startTime=0,sequence=0,pending=Promise.resolve(),objectURL=null,stopPromise=null,resolveStop=null,failed=false,wakeLock=null;
const status=message=>{q('record-status').textContent=message;};
function context(){let value={};document.dispatchEvent(new CustomEvent('digiref-live-context-request',{detail:{receive:result=>value=result}}));return value;}
function buttons(active){q('evidence-start').disabled=active;q('evidence-name').disabled=active;q('evidence-mark').disabled=!active;q('evidence-stop').disabled=!active;}
async function start(){
  if(recorder)return;
  const source=document.querySelector('#field-video').srcObject;
  if(!source?.active)return status('Start the rear camera or film share first.');
  if(!globalThis.MediaRecorder)return status('Recording is unavailable in this browser.');
  buttons(true);status('Preparing local storage…');
  try{
    const estimate=await navigator.storage?.estimate?.();
    if(estimate?.quota && estimate.quota-(estimate.usage||0)<150*1024*1024)throw Error('Less than 150 MB available. Free browser storage before recording.');
    const mimeType=['video/mp4','video/webm;codecs=vp8','video/webm'].find(type=>MediaRecorder.isTypeSupported(type));
    if(!mimeType)throw Error('No supported recording format.');
    session={id:crypto.randomUUID(),name:q('evidence-name').value.trim()||'Football test',startedAt:new Date().toISOString(),status:'recording',mimeType,bytes:0,chunks:0,duration:0,context:context(),settings:source.getVideoTracks()[0].getSettings(),clock:'elapsed monotonic browser time; verify video alignment',error:null};
    await write('sessions',session);
    recorder=new MediaRecorder(source,{mimeType,videoBitsPerSecond:6000000});sequence=0;failed=false;pending=Promise.resolve();
    stopPromise=new Promise(resolve=>resolveStop=resolve);
    recorder.ondataavailable=event=>{
      if(!event.data.size)return;
      const chunk={sessionId:session.id,sequence:sequence++,blob:event.data,elapsed:(performance.now()-startTime)/1000};
      pending=pending.then(async()=>{
        if(failed)return;
        chunk.checksum=await checksum(chunk.blob);
        await write('chunks',chunk);session.bytes+=chunk.blob.size;session.chunks++;session.duration=chunk.elapsed;
        await write('sessions',{...session});
        if(recorder?.state==='recording')status(`RECORDING · ${Math.round(chunk.elapsed)}s · ${(session.bytes/1048576).toFixed(1)} MB saved`);
      }).catch(error=>{failed=true;session.error=error.message;status('Recording stopped: '+error.message);stop();});
    };
    recorder.onerror=event=>{failed=true;session.error=event.error?.message||'Recorder failure';stop();};
    recorder.onstop=async()=>{
      await pending;session.status=failed?'incomplete':'saved';session.endedAt=new Date().toISOString();
      try{await write('sessions',{...session});status(`${failed?'Incomplete recording—check playback':'Video saved'} · ${session.chunks} chunks · ${(session.bytes/1048576).toFixed(1)} MB`);}catch(error){status('Could not save recording journal: '+error.message);}
      recorder=null;buttons(false);await wakeLock?.release().catch(()=>{});wakeLock=null;resolveStop?.();
    };
    startTime=performance.now();recorder.start(2000);status('RECORDING · waiting for first saved video chunk');
    try{wakeLock=await navigator.wakeLock?.request('screen');}catch{}
  }catch(error){recorder=null;buttons(false);status(error.message);}
}
function stop(){if(recorder?.state==='recording'){status('Saving final video…');q('evidence-mark').disabled=true;q('evidence-stop').disabled=true;recorder.stop();}return stopPromise||Promise.resolve();}
async function mark(type='MARK',eventId=null){
  if(recorder?.state!=='recording')return;
  const marker={id:crypto.randomUUID(),sessionId:session.id,at:(performance.now()-startTime)/1000,wallClock:new Date().toISOString(),type,eventId,context:context()};
  try{await write('markers',marker);status(`${type} saved at ${marker.at.toFixed(1)}s · recording continues`);navigator.vibrate?.(30);}catch(error){status('Marker could not be saved: '+error.message);}
}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
async function library(){
  if(!panel.open)panel.showModal();q('evidence-status').textContent='Loading saved recordings…';
  try{
    const sessions=(await readAll('sessions')).sort((a,b)=>b.startedAt.localeCompare(a.startedAt));
    q('evidence-library').innerHTML=sessions.map(item=>`<article class="enforce-row"><h3>${esc(item.name)}</h3><p>${esc(new Date(item.startedAt).toLocaleString())} · ${esc(item.status==='recording'&&item.id!==session?.id?'Interrupted—try recovery playback':item.status)} · ${(item.bytes/1048576).toFixed(1)} MB</p><button type="button" data-recording="${item.id}">Open video & markers</button></article>`).join('')||'<p>No saved recordings yet. Open Camera to record a test.</p>';
    q('evidence-status').textContent=recorder?'Recording active. Stop & save before opening playback.':'Saved locally on this device.';
  }catch(error){q('evidence-status').textContent=error.message;}
}
async function openRecording(id){
  if(recorder)return q('evidence-status').textContent='Stop & save the current recording before opening playback.';
  q('evidence-status').textContent='Assembling saved video…';
  try{
    const item=(await readAll('sessions')).find(row=>row.id===id);if(!item)throw Error('Recording not found.');
    const markers=await readAll('markers',id),blob=await recordingBlob(item);
    if(objectURL)URL.revokeObjectURL(objectURL);objectURL=URL.createObjectURL(blob);
    q('evidence-library').innerHTML=`<h3>${esc(item.name)}</h3><video id="evidence-player" controls playsinline style="width:100%;max-height:45vh" src="${objectURL}"></video><p>Marker times use the browser clock. Verify alignment against the video. Missing final chunks may make interrupted recordings unplayable.</p><div class="toolbar"><button type="button" data-rate="0.25">0.25×</button><button type="button" data-rate="0.5">0.5×</button><button type="button" data-rate="1">1×</button><button type="button" id="evidence-video-download">Download video</button><button type="button" id="evidence-index-download">Download evidence report</button></div><h3>Review moments</h3>${markers.map(marker=>{const bounds=clipWindow(marker.at,item.duration);return `<p><button type="button" data-seek="${bounds.start}" data-end="${bounds.end}">${esc(marker.type)} · ${marker.at.toFixed(1)}s · Q${Number(marker.context.quarter||1)}</button> ${bounds.missingPre?'Short pre-roll. ':''}${bounds.missingPost?'Short post-roll.':''}</p>`;}).join('')||'<p>No markers were recorded.</p>'}`;
    q('evidence-status').textContent='Video loaded. Select a marker to play its review window.';
    const filename=`DigiRef-${item.id}.${item.mimeType.includes('mp4')?'mp4':'webm'}`;
    q('evidence-video-download').onclick=()=>download(blob,filename);
    q('evidence-index-download').onclick=async()=>{
      const reviews=await readAll('reviews',id);
      const links=markers.map(marker=>{const bounds=clipWindow(marker.at,item.duration);return `<li><a href="${filename}#t=${bounds.start},${bounds.end}">${esc(marker.type)} at ${marker.at.toFixed(1)}s</a> · Q${Number(marker.context.quarter||1)} · ${esc(marker.wallClock)}${bounds.missingPost?' · incomplete post-roll':''}</li>`;}).join('');
      download(new Blob([`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>DigiRef evidence report</title><body style="font:18px system-ui;max-width:850px;margin:30px auto;padding:20px"><h1>${esc(item.name)}</h1><p>Football evidence · ${esc(item.startedAt)} · ${esc(item.status)}</p><p>Download the video and keep it in the same folder as this report. Links open the corresponding review windows.</p><video controls style="width:100%" src="${filename}"></video><ul>${links||'<li>No markers recorded</li>'}</ul><h2>Evaluator history</h2>${reviewHistoryHTML(reviews)}<p>Timing uses the browser clock; confirm alignment. Human review determines the outcome.</p></body></html>`],{type:'text/html'}),`DigiRef-${item.id}-evidence.html`);
    };
    q('evidence-player').onerror=()=>q('evidence-status').textContent='Browser cannot play this recording. Download it for recovery; interrupted recordings may lack a container footer.';
    await mountEvaluator(q('evidence-library'),item,markers);
  }catch(error){q('evidence-status').textContent=error.message;}
}
q('evidence-start').onclick=start;q('evidence-stop').onclick=stop;q('evidence-mark').onclick=()=>mark();
panel.addEventListener('close',()=>{if(objectURL){URL.revokeObjectURL(objectURL);objectURL=null;}q('evidence-library').innerHTML='';});
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.hasAttribute('data-evidence-open'))library();
  if(button.hasAttribute('data-evidence-close'))panel.close();
  if(button.dataset.recording)openRecording(button.dataset.recording);
  const player=q('evidence-player');
  if(button.dataset.rate&&player)player.playbackRate=Number(button.dataset.rate);
  if(button.dataset.seek&&player){player.currentTime=Number(button.dataset.seek);const end=Number(button.dataset.end);player.ontimeupdate=()=>{if(player.currentTime>=end)player.pause();};player.play().catch(error=>q('evidence-status').textContent=error.message);}
});
document.addEventListener('digiref-evidence-mark',event=>mark(event.detail.type,event.detail.eventId));
document.addEventListener('digiref-before-source-stop',event=>{if(recorder)event.detail.wait(stop());});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&recorder){session.error='Page hidden; recording ended to preserve available evidence.';stop();}});
window.addEventListener('pagehide',()=>{if(recorder)stop();});
