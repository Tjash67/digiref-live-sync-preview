import {createObserverExport} from './observer-log.js';
import {REAR_CAMERA,SHARED_FILM,reviewDelay,stopsWhenHidden} from './observer-policy.js';
import {filmLink,filmReviewQueue,filmSources} from './film-review-queue.js';
import {createFilmReviewExport,filmItemId,nextUnlabeledIndex,normalizeFilmLabels,summarizeFilmLabels} from './film-review-progress.js';
import {selectFrameSamples} from './frame-sampling.js';
import {cameraFailureMessage,requestPhoneCamera} from './phone-camera.js';
import {createFieldCalibration,fieldPosition,project,sceneShift} from './field-calibration.js';

const MAX_REVIEWS=20;
const BUFFER_WINDOW_MS=12000;
const CAPTURE_INTERVAL_MS=500;
const FRAME_SAMPLES=8;

const panel=document.createElement('dialog');
panel.className='camera-dialog';
panel.setAttribute('aria-labelledby','camera-title');
panel.innerHTML=`
  <div class="card-head"><h2 id="camera-title">Field camera</h2><button type="button" id="camera-close">Close</button></div>
  <div id="camera-stage"><video id="field-video" autoplay muted playsinline></video><canvas id="field-overlay" aria-label="Field calibration overlay"></canvas></div>
  <p id="camera-status" role="status">Camera off. Video stays on this device.</p>
  <p class="warning">For the best chance of a useful review: hold the phone sideways, get as elevated as permitted, keep the active matchup large enough to see, follow the action, and tap review immediately after the play. Contact hidden inside a pile cannot be recovered by AI.</p>
  <div class="toolbar"><button id="camera-start" type="button">Start rear camera</button><button id="camera-share" type="button">Share film/game window</button><button id="camera-stop" type="button" disabled>Stop video source</button></div>
  <p id="camera-help" class="muted">Phone only: open this site directly in Safari on iPhone or Chrome on Android, then allow camera access when asked. A computer is not required.</p>
  <section id="field-scan"><h3>Fixed-camera field scan</h3><p id="field-scan-status" class="muted">Start the camera, lock the phone on its mount, then scan the four field corners. This maps the ground plane; it does not automatically locate a hidden ball.</p><div class="toolbar"><button id="field-scan-start" type="button" disabled>Scan field</button><button id="field-spot" type="button" disabled>Mark approximate ball spot</button><button id="field-scan-reset" type="button" disabled>Clear scan</button></div></section>
  <p class="muted" style="margin-top:16px">Use the rear camera on the field. On a desktop, share a permitted browser tab or window to evaluate game film without downloading it. Shared film may keep buffering while DigiRef is in the background; use the browser sharing indicator and stop the source when finished. Only eight selected frames are sent when a review runs.</p>`;
document.body.append(panel);

const video=panel.querySelector('video');
const status=panel.querySelector('#camera-status');
const start=panel.querySelector('#camera-start');
const share=panel.querySelector('#camera-share');
const stop=panel.querySelector('#camera-stop');
const cameraHelp=panel.querySelector('#camera-help');
const cameraStage=panel.querySelector('#camera-stage');
const overlay=panel.querySelector('#field-overlay');
const overlayContext=overlay.getContext('2d');
const scanStart=panel.querySelector('#field-scan-start');
const scanReset=panel.querySelector('#field-scan-reset');
const spotButton=panel.querySelector('#field-spot');
const scanStatus=panel.querySelector('#field-scan-status');
let stream=null;
let generation=0;
let sourceKind='';
let captureTimer=null;
let frameBuffer=[];
const captureCanvas=document.createElement('canvas');
const captureContext=captureCanvas.getContext('2d');
const stabilityCanvas=document.createElement('canvas');
const stabilityContext=stabilityCanvas.getContext('2d',{willReadFrequently:true});
let calibration=null;
let calibrationPoints=[];
let calibrationMode='';
let markedSpot=null;
let stabilityReference=null;
let stabilityTimer=null;
let shiftWarnings=0;

const scanSteps=['near sideline at the left goal line','near sideline at the right goal line','far sideline at the right goal line','far sideline at the left goal line'];

function sizeOverlay(){
  const rect=video.getBoundingClientRect(),ratio=window.devicePixelRatio||1;
  overlay.width=Math.max(1,Math.round(rect.width*ratio));overlay.height=Math.max(1,Math.round(rect.height*ratio));
  overlayContext.setTransform(ratio,0,0,ratio,0,0);drawFieldOverlay();
}

function drawFieldOverlay(){
  const width=overlay.clientWidth,height=overlay.clientHeight;
  overlayContext.clearRect(0,0,width,height);
  const points=calibration?.imagePoints||calibrationPoints;
  if(points.length){
    overlayContext.strokeStyle='#ffd33d';overlayContext.fillStyle='#ffd33d';overlayContext.lineWidth=2;
    overlayContext.beginPath();
    points.forEach((point,index)=>{const x=point.x*width,y=point.y*height;index?overlayContext.lineTo(x,y):overlayContext.moveTo(x,y);overlayContext.beginPath();overlayContext.arc(x,y,6,0,Math.PI*2);overlayContext.fill();});
  }
  if(!calibration)return;
  overlayContext.strokeStyle='rgba(255,255,255,.72)';overlayContext.lineWidth=1;
  for(let yard=0;yard<=100;yard+=10){
    const top=project(calibration.fieldToImage,{x:yard/100,y:0}),bottom=project(calibration.fieldToImage,{x:yard/100,y:1});
    overlayContext.beginPath();overlayContext.moveTo(top.x*width,top.y*height);overlayContext.lineTo(bottom.x*width,bottom.y*height);overlayContext.stroke();
  }
  overlayContext.strokeStyle='#ffd33d';overlayContext.lineWidth=2;overlayContext.beginPath();
  calibration.imagePoints.forEach((point,index)=>index?overlayContext.lineTo(point.x*width,point.y*height):overlayContext.moveTo(point.x*width,point.y*height));overlayContext.closePath();overlayContext.stroke();
  if(markedSpot){overlayContext.fillStyle='#ff3b30';overlayContext.beginPath();overlayContext.arc(markedSpot.x*width,markedSpot.y*height,8,0,Math.PI*2);overlayContext.fill();}
}

function sceneSignature(){
  if(video.readyState<2||!video.videoWidth)return null;
  stabilityCanvas.width=64;stabilityCanvas.height=36;stabilityContext.drawImage(video,0,0,64,36);
  const data=stabilityContext.getImageData(0,0,64,36).data,signature=new Uint8Array(64*36);
  for(let index=0,pixel=0;index<data.length;index+=4,pixel++)signature[pixel]=Math.round(data[index]*.299+data[index+1]*.587+data[index+2]*.114);
  return signature;
}

function stopStabilityCheck(){clearInterval(stabilityTimer);stabilityTimer=null;stabilityReference=null;shiftWarnings=0;}

function startStabilityCheck(){
  stopStabilityCheck();stabilityReference=sceneSignature();
  stabilityTimer=setInterval(()=>{
    if(!calibration||!stabilityReference)return;
    const current=sceneSignature();if(!current)return;
    const score=sceneShift(stabilityReference,current);
    shiftWarnings=score>24?shiftWarnings+1:Math.max(0,shiftWarnings-1);
    if(shiftWarnings>=3)scanStatus.textContent='Camera may have shifted since the field scan. Lock the mount and tap Scan field again before trusting coordinates.';
  },2000);
}

function clearCalibration(message='Field scan cleared.'){
  calibration=null;calibrationPoints=[];calibrationMode='';markedSpot=null;stopStabilityCheck();
  spotButton.disabled=true;scanReset.disabled=!stream;scanStart.textContent='Scan field';scanStatus.textContent=message;drawFieldOverlay();
}

const liveBox=document.createElement('section');
liveBox.innerHTML=`
  <hr>
  <h3>Live AI observer · experimental</h3>
  <p class="muted">Continuously buffers recent frames locally. Each review sends eight samples from roughly the last four seconds to DeepSeek. Cloud results arrive after the action and can miss fouls; this is not a real-time whistle or ruling. Maximum ${MAX_REVIEWS} requests per session; provider charges apply.</p>
  <div id="live-config">
    <label>Session label (optional)<input id="live-label" maxlength="160" placeholder="Game link/name · quarter · film timestamp"></label>
    <label>Crew token<input id="live-token" type="password" autocomplete="off"></label>
    <label>Review pace<select id="live-pace"><option value="0" selected>Game-length trial · tap after suspicious action</option><option value="1">Fastest cloud test · back-to-back (uses 20 quickly)</option><option value="5000">Automatic demo · 5-second pause after each result</option><option value="12000">Automatic demo · 12-second pause after each result</option><option value="30000">Automatic demo · 30-second pause after each result</option></select></label>
    <label class="checkbox"><input id="live-consent" type="checkbox">Send selected images and current game facts to DeepSeek for this trial</label>
  </div>
  <div class="toolbar"><button id="live-check" type="button">Check setup · no charge</button><button id="live-start" type="button">Start live analysis</button><button id="live-review" type="button" disabled>Review last 4 seconds now</button><button id="live-stop" type="button" disabled>Stop analysis</button><button id="live-download" type="button" disabled>Download observer log</button></div>
  <p id="live-status" role="status">Analysis off</p>
  <details><summary>Transcript-suggested film review queue · <span id="film-progress">0/${filmReviewQueue.length}</span></summary><p class="muted">Navigation aids from announcer transcripts—not ground truth. Visually review and independently label every item. Three supplied games had no transcript and require manual scanning.</p><div id="film-queue"></div></details>
  <div id="live-alerts" aria-live="polite"></div>`;
panel.append(liveBox);
const lq=selector=>liveBox.querySelector(selector);

const FILM_LABEL_STORAGE='digiref-film-review-labels-v1';
let filmLabels={};
let currentFilmIndex=0;
let activeFilmId='';
try{filmLabels=normalizeFilmLabels(filmReviewQueue,JSON.parse(localStorage.getItem(FILM_LABEL_STORAGE)||'{}'));}catch{filmLabels={};}

function saveFilmLabel(id,value){
  filmLabels[id]={value,labeledAt:new Date().toISOString()};
  try{localStorage.setItem(FILM_LABEL_STORAGE,JSON.stringify(filmLabels));return true;}
  catch{return false;}
}

function activeFilmCandidate(){
  const index=filmReviewQueue.findIndex(item=>filmItemId(item)===activeFilmId);
  if(index<0)return null;
  const item=filmReviewQueue[index];
  return {id:activeFilmId,index,video:item.video,cueTime:item.time,cueSeconds:item.seconds,reviewTime:item.reviewTime||item.time,reviewSeconds:item.reviewSeconds??item.seconds,area:item.area,cue:item.cue,url:filmLink(item)};
}

function downloadJson(payload,name){
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
  const link=document.createElement('a');
  link.href=url;
  link.download=name;
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function renderFilmQueue(index=currentFilmIndex){
  const container=lq('#film-queue');
  const titles=Object.fromEntries(filmSources.map(source=>[source.id,source.title]));
  const summary=summarizeFilmLabels(filmReviewQueue,filmLabels);
  lq('#film-progress').textContent=`${summary.labeled}/${summary.total}`;
  currentFilmIndex=Math.max(0,Math.min(index,filmReviewQueue.length-1));
  const item=filmReviewQueue[currentFilmIndex];
  const id=filmItemId(item);
  const selected=filmLabels[id]?.value||'';
  container.replaceChildren();
  const row=document.createElement('article');
  row.className='enforce-row';
  const heading=document.createElement('strong');
  heading.textContent=`Candidate ${currentFilmIndex+1} of ${filmReviewQueue.length}`;
  const link=document.createElement('a');
  link.href=filmLink(item);link.target='_blank';link.rel='noopener';
  link.textContent=`Open ${titles[item.video]} · play ${item.reviewTime||item.time}`;
  link.onclick=()=>{
    activeFilmId=id;
    lq('#live-label').value=`${titles[item.video]} · play ${item.reviewTime||item.time} · cue ${item.time}`;
    setTimeout(()=>renderFilmQueue(currentFilmIndex),0);
  };
  const cue=document.createElement('p');cue.className='muted';cue.textContent=`Transcript cue ${item.time}. ${item.cue}`;
  const labelStatus=document.createElement('p');labelStatus.className='muted';labelStatus.textContent=[selected?'Human label saved locally':'Not labeled yet',activeFilmId===id?'selected for the next shared-film AI review':''].filter(Boolean).join(' · ');
  const labels=document.createElement('div');labels.className='toolbar';
  for(const [value,text] of [['review_warranted','Review warranted'],['no_review','No review'],['view_unclear','View unclear']]){
    const button=document.createElement('button');button.type='button';button.textContent=text;button.setAttribute('aria-pressed',String(selected===value));
    button.onclick=()=>{
      saveFilmLabel(id,value);
      renderFilmQueue(currentFilmIndex);
    };
    labels.append(button);
  }
  const navigation=document.createElement('div');navigation.className='toolbar';
  const previous=document.createElement('button');previous.type='button';previous.textContent='Previous';previous.disabled=currentFilmIndex===0;previous.onclick=()=>renderFilmQueue(currentFilmIndex-1);
  const next=document.createElement('button');next.type='button';next.textContent='Next';next.disabled=currentFilmIndex===filmReviewQueue.length-1;next.onclick=()=>renderFilmQueue(currentFilmIndex+1);
  const nextOpen=document.createElement('button');nextOpen.type='button';nextOpen.textContent='Next unlabeled';nextOpen.disabled=nextUnlabeledIndex(filmReviewQueue,filmLabels,currentFilmIndex)<0;nextOpen.onclick=()=>renderFilmQueue(nextUnlabeledIndex(filmReviewQueue,filmLabels,currentFilmIndex));
  const download=document.createElement('button');download.type='button';download.textContent='Download film labels';download.disabled=!summary.labeled;download.onclick=()=>downloadJson(createFilmReviewExport(filmReviewQueue,filmLabels,filmSources),`digiref-film-labels-${new Date().toISOString().slice(0,10)}.json`);
  navigation.append(previous,next,nextOpen,download);
  row.append(heading,document.createElement('br'),link,cue,labelStatus,labels,navigation);
  container.append(row);
}
renderFilmQueue();

let liveGeneration=0;
let liveController=null;
let liveTimer=null;
let liveRunning=false;
let liveBusy=false;
let liveCount=0;
let liveFailures=0;
let liveToken='';
let wakeLock=null;
let observerLog=[];
let sessionId='';

function logObserver(type,details={}){
  const entry={at:new Date().toISOString(),sessionId,type,...details};
  observerLog.push(entry);
  lq('#live-download').disabled=false;
  return entry;
}

async function acquireWakeLock(run){
  try{
    const lock=await navigator.wakeLock?.request('screen');
    if(run!==liveGeneration||!liveRunning){await lock?.release();return;}
    wakeLock=lock||null;
  }catch{wakeLock=null;}
}

function releaseWakeLock(){
  const lock=wakeLock;
  wakeLock=null;
  lock?.release().catch(()=>{});
}

function captureFrame(){
  if(!stream||(document.hidden&&stopsWhenHidden(sourceKind))||video.readyState<2||!video.videoWidth)return;
  captureCanvas.width=640;
  captureCanvas.height=Math.max(1,Math.round(640*video.videoHeight/video.videoWidth));
  captureContext.drawImage(video,0,0,captureCanvas.width,captureCanvas.height);
  const at=Date.now();
  frameBuffer.push({at,image:captureCanvas.toDataURL('image/jpeg',.65)});
  frameBuffer=frameBuffer.filter(frame=>at-frame.at<=BUFFER_WINDOW_MS).slice(-20);
}

function startBuffer(){
  clearInterval(captureTimer);
  frameBuffer=[];
  captureFrame();
  captureTimer=setInterval(captureFrame,CAPTURE_INTERVAL_MS);
}

function stopBuffer(){
  clearInterval(captureTimer);
  captureTimer=null;
  frameBuffer=[];
}

function selectRecentFrames(){
  return selectFrameSamples(frameBuffer,Date.now(),{samples:FRAME_SAMPLES,windowMs:4500});
}

function currentGameContext(){
  let context=null;
  document.dispatchEvent(new CustomEvent('digiref-live-context-request',{detail:{receive:value=>{context=value;}}}));
  return context;
}

function setLiveButtons(){
  liveBox.dataset.running=String(liveRunning);
  lq('#live-check').disabled=liveRunning;
  lq('#live-start').disabled=liveRunning;
  lq('#live-stop').disabled=!liveRunning;
  lq('#live-review').disabled=!liveRunning||liveBusy||liveCount>=MAX_REVIEWS;
}

function stopLive(message='Analysis stopped. Camera preview and local buffer may remain on.'){
  if(liveRunning)logObserver('session_stopped',{message,reviews:liveCount,failures:liveFailures});
  liveGeneration++;
  liveRunning=false;
  liveBusy=false;
  clearTimeout(liveTimer);
  liveTimer=null;
  liveController?.abort();
  liveController=null;
  liveToken='';
  releaseWakeLock();
  lq('#live-token').value='';
  setLiveButtons();
  lq('#live-status').textContent=message;
}

async function shutdown(){
  const waits=[];
  document.dispatchEvent(new CustomEvent('digiref-before-source-stop',{detail:{wait:promise=>waits.push(promise)}}));
  if(waits.length)await Promise.allSettled(waits);
  stopLive('Analysis stopped with the video source.');
  stopBuffer();
  generation++;
  stream?.getTracks().forEach(track=>track.stop());
  stream=null;
  sourceKind='';
  video.srcObject=null;
  scanStart.disabled=true;scanReset.disabled=true;spotButton.disabled=true;
  clearCalibration('Start the camera, lock the phone on its mount, then scan the four field corners.');
  start.disabled=false;
  start.textContent='Start rear camera';
  share.disabled=false;
  stop.disabled=true;
  status.textContent='Camera off. Video stays on this device.';
}

scanStart.onclick=()=>{
  if(!stream)return;
  calibration=null;calibrationPoints=[];markedSpot=null;stopStabilityCheck();calibrationMode='scan';
  scanStart.textContent='Scanning…';spotButton.disabled=true;scanReset.disabled=false;
  scanStatus.textContent=`Tap the ${scanSteps[0]}.`;drawFieldOverlay();
};
scanReset.onclick=()=>clearCalibration();
spotButton.onclick=()=>{
  if(!calibration)return;
  calibrationMode=calibrationMode==='spot'?'':'spot';spotButton.setAttribute('aria-pressed',String(calibrationMode==='spot'));
  scanStatus.textContent=calibrationMode==='spot'?'Tap the visible ground location of the ball.':'Ball-spot marking canceled.';
};
overlay.addEventListener('pointerdown',event=>{
  if(!calibrationMode)return;
  const rect=overlay.getBoundingClientRect(),point={x:(event.clientX-rect.left)/rect.width,y:(event.clientY-rect.top)/rect.height};
  if(calibrationMode==='scan'){
    calibrationPoints.push(point);drawFieldOverlay();
    if(calibrationPoints.length<4){scanStatus.textContent=`Tap the ${scanSteps[calibrationPoints.length]}.`;return;}
    try{
      calibration=createFieldCalibration(calibrationPoints);calibrationMode='';scanStart.textContent='Re-scan field';spotButton.disabled=false;scanReset.disabled=false;
      scanStatus.textContent='Field ground plane mapped. Do not move or zoom the camera.';startStabilityCheck();drawFieldOverlay();
    }catch(error){clearCalibration(error.message);}
    return;
  }
  if(calibrationMode==='spot'){
    const position=fieldPosition(calibration,point);markedSpot=point;calibrationMode='';spotButton.setAttribute('aria-pressed','false');
    scanStatus.textContent=position.inside?`Approximate ground coordinate: ${position.yardLine.toFixed(1)} yards from the left goal line · ${position.widthYards.toFixed(1)} yards from the near sideline. Human confirmation required.`:'The marked point is outside the scanned field.';drawFieldOverlay();
  }
});
new ResizeObserver(sizeOverlay).observe(cameraStage);

function queueReview(run,delay){
  clearTimeout(liveTimer);
  liveTimer=setTimeout(()=>reviewBuffered(run,'automatic'),delay);
}

function addObservation(result,observationId,filmCandidate=null,latencyMs=null){
  const item=document.createElement('article');
  item.className='info';
  item.style.marginTop='12px';
  const title=document.createElement('strong');
  const latency=Number.isFinite(latencyMs)?` · ${(latencyMs/1000).toFixed(1)}s cloud delay`:'';
  title.textContent=(result.observation.status==='review'?'REVIEW SUGGESTED':result.observation.status==='unclear'?'UNCLEAR VIEW':'NO OBSERVATION — not clearance')+' · '+new Date(result.capturedFrom).toLocaleTimeString()+latency;
  item.append(title);
  const detail=document.createElement('p');
  detail.textContent=result.observation.summary;
  item.append(detail);
  if(result.observation.reviewAreas?.length){
    const areaNames={contact_or_restriction:'contact / restriction',ball_arrival_contact:'contact near ball arrival',late_or_out_of_bounds_contact:'late / boundary contact',head_neck_contact:'head / neck contact',formation_or_substitution:'formation / substitution',kick_or_return_contact:'kick / return contact',unclear_other:'other unclear action'};
    const areas=document.createElement('p');
    areas.className='muted';
    areas.textContent='Review areas: '+result.observation.reviewAreas.map(area=>areaNames[area]||area).join(' · ');
    item.append(areas);
  }
  for(const text of [...result.observation.evidence,...result.observation.missingFacts.map(value=>'Missing: '+value)]){
    const paragraph=document.createElement('p');
    paragraph.textContent=text;
    item.append(paragraph);
  }
  const feedbackTitle=document.createElement('p');
  feedbackTitle.className='muted';
  feedbackTitle.textContent='Independent human label (not sent to DeepSeek):';
  item.append(feedbackTitle);
  const feedback=document.createElement('div');
  feedback.className='toolbar';
  const feedbackStatus=document.createElement('span');
  feedbackStatus.className='muted';
  const choices=[['review_warranted','Human: review warranted'],['no_review','Human: no review'],['view_unclear','Human: view unclear']];
  for(const [value,label] of choices){
    const button=document.createElement('button');
    button.type='button';
    button.textContent=label;
    button.setAttribute('aria-pressed','false');
    button.onclick=()=>{
      const entry=observerLog.find(row=>row.type==='review_completed'&&row.observationId===observationId);
      if(!entry)return;
      entry.humanLabel={value,labeledAt:new Date().toISOString()};
      const persisted=filmCandidate?saveFilmLabel(filmCandidate.id,value):true;
      if(filmCandidate)renderFilmQueue(filmCandidate.index);
      for(const candidate of feedback.querySelectorAll('button'))candidate.setAttribute('aria-pressed',String(candidate===button));
      feedbackStatus.textContent=filmCandidate?(persisted?'Saved in observer log and film queue':'Saved in log; local film-label storage unavailable'):'Saved in observer log';
    };
    feedback.append(button);
  }
  feedback.append(feedbackStatus);
  item.append(feedback);
  const actions=document.createElement('div');
  actions.className='toolbar';
  const draft=document.createElement('button');
  draft.type='button';
  draft.textContent='Save unconfirmed flag draft';
  draft.onclick=()=>{
    draft.disabled=true;
    draft.textContent='Unconfirmed draft saved';
    document.dispatchEvent(new CustomEvent('digiref-observation-draft',{detail:{...result.observation,capturedFrom:result.capturedFrom,capturedTo:result.capturedTo,background:true}}));
  };
  const dismiss=document.createElement('button');
  dismiss.type='button';
  dismiss.textContent='Dismiss observation';
  dismiss.onclick=()=>item.remove();
  actions.append(draft,dismiss);
  item.append(actions);
  lq('#live-alerts').prepend(item);
  while(lq('#live-alerts').children.length>8)lq('#live-alerts').lastChild.remove();
}

async function reviewBuffered(run,source){
  if(run!==liveGeneration||!liveRunning||liveBusy)return;
  if(!stream||(document.hidden&&stopsWhenHidden(sourceKind))||!panel.open){stopLive('Analysis stopped: video source or page unavailable.');return;}
  const frames=selectRecentFrames();
  if(!frames){
    lq('#live-status').textContent='Building the local replay buffer… Keep the camera steady.';
    queueReview(run,CAPTURE_INTERVAL_MS);
    return;
  }
  if(liveCount>=MAX_REVIEWS){stopLive(`${MAX_REVIEWS}-request trial limit reached. Review results before starting another session.`);return;}
  liveBusy=true;
  liveCount++;
  const context=currentGameContext();
  const filmCandidate=sourceKind===SHARED_FILM?activeFilmCandidate():null;
  const requestedAt=Date.now();
  logObserver('review_started',{source,review:liveCount,capturedFrom:frames[0].at,capturedTo:frames.at(-1).at,gameContext:context,filmCandidate});
  setLiveButtons();
  lq('#live-status').textContent=`${source==='manual'?'Manual review':'Automatic review'} ${liveCount}/${MAX_REVIEWS} in progress… Camera buffering continues.`;
  liveController=new AbortController();
  const controller=liveController;
  const timeout=setTimeout(()=>controller.abort(),50000);
  try{
    const response=await fetch('/.netlify/functions/live-observe',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+liveToken},body:JSON.stringify({frames,context}),signal:controller.signal});
    let result;
    try{result=await response.json();}catch{throw Error('Live service returned an unreadable response.');}
    if(run!==liveGeneration)return;
    if(!response.ok){
      const error=Error(result.error||'Live analysis unavailable.');
      error.status=response.status;
      throw error;
    }
    liveFailures=0;
    const observationId=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const latencyMs=Date.now()-requestedAt;
    logObserver('review_completed',{observationId,source,review:liveCount,latencyMs,capturedFrom:result.capturedFrom,capturedTo:result.capturedTo,receivedAt:result.receivedAt,model:result.model,observation:result.observation,appliedToGame:result.appliedToGame,humanLabel:null,filmCandidate});
    addObservation(result,observationId,filmCandidate,latencyMs);
    if(filmCandidate){activeFilmId='';renderFilmQueue(filmCandidate.index);}
    if(liveCount>=MAX_REVIEWS){stopLive(`${MAX_REVIEWS}-request trial limit reached. Review results before starting another session.`);return;}
    const delay=reviewDelay(lq('#live-pace').value);
    if(delay===0)lq('#live-status').textContent=`Manual mode · rolling buffer ready · ${liveCount}/${MAX_REVIEWS} reviews`;
    else{
      lq('#live-status').textContent=delay===1?`Fastest cloud loop · starting the next review · ${liveCount}/${MAX_REVIEWS}`:`Monitoring · rolling buffer ready · next automatic review in ${Math.round(delay/1000)} seconds · ${liveCount}/${MAX_REVIEWS}`;
      queueReview(run,delay);
    }
  }catch(error){
    if(run!==liveGeneration)return;
    if(error.status===401||error.status===403||error.status===503){stopLive(error.message);return;}
    liveFailures++;
    logObserver('review_failed',{source,review:liveCount,latencyMs:Date.now()-requestedAt,status:error.status||null,error:error.name==='AbortError'?'Vision request timed out.':error.message,consecutiveFailures:liveFailures});
    if(liveFailures>=3){stopLive('Analysis stopped after three failed reviews. Check the connection and restart.');return;}
    const message=error.name==='AbortError'?'Vision request timed out.':'Review failed: '+error.message;
    lq('#live-status').textContent=`${message} Retrying in 10 seconds (${liveFailures}/3). Camera buffering continues.`;
    queueReview(run,10000);
  }finally{
    clearTimeout(timeout);
    if(run===liveGeneration){liveBusy=false;liveController=null;setLiveButtons();}
  }
}

document.addEventListener('click',event=>{if(event.target.closest('[data-camera-open]'))panel.showModal();});
panel.querySelector('#camera-close').onclick=()=>panel.close();
panel.addEventListener('close',shutdown);
panel.addEventListener('cancel',shutdown);
window.addEventListener('pagehide',shutdown);
stop.onclick=shutdown;

async function attachSource(incoming,request,label){
  if(request!==generation||!panel.open){incoming.getTracks().forEach(track=>track.stop());return;}
  stream=incoming;
  sourceKind=label;
  video.srcObject=stream;
  await video.play();
  startBuffer();
  stop.disabled=false;
  status.textContent=`${label} live · recent frames buffering locally · AI analysis off`;
  const settings=stream.getVideoTracks()[0]?.getSettings?.()||{};
  const dimensions=settings.width&&settings.height?` · ${settings.width}×${settings.height}`:'';
  cameraHelp.textContent=`Camera connected${dimensions}. Keep this page open, hold the phone sideways, and follow the play.`;
  scanStart.disabled=false;scanReset.disabled=false;sizeOverlay();
  stream.getVideoTracks()[0].addEventListener('ended',shutdown);
}

start.onclick=async()=>{
  const request=++generation;
  start.disabled=true;
  start.textContent='Starting camera…';
  share.disabled=true;
  status.textContent='Waiting for camera permission…';
  try{
    if(!isSecureContext||!navigator.mediaDevices?.getUserMedia){
      const unsupported=new Error('Camera API unavailable.');unsupported.name='CameraUnsupportedError';throw unsupported;
    }
    const {stream:incoming,fallbackLevel}=await requestPhoneCamera(constraints=>navigator.mediaDevices.getUserMedia(constraints));
    await attachSource(incoming,request,REAR_CAMERA);
    if(fallbackLevel)cameraHelp.textContent+=' DigiRef used a compatibility camera mode on this phone.';
  }catch(error){
    if(request!==generation)return;
    shutdown();
    start.textContent='Try rear camera again';
    status.textContent='Camera did not start.';
    cameraHelp.textContent=cameraFailureMessage(error,{secure:isSecureContext,mediaApi:Boolean(navigator.mediaDevices?.getUserMedia),userAgent:navigator.userAgent});
  }
};

share.onclick=async()=>{
  const request=++generation;
  start.disabled=true;
  share.disabled=true;
  status.textContent='Choose the permitted game tab or window to share…';
  try{
    if(!isSecureContext||!navigator.mediaDevices?.getDisplayMedia)throw new Error('Window sharing requires a supported desktop browser over HTTPS.');
    const incoming=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:30,max:30}},audio:false});
    await attachSource(incoming,request,SHARED_FILM);
  }catch(error){
    if(request!==generation)return;
    shutdown();
    status.textContent=error.name==='NotAllowedError'?'Film/window sharing was canceled or denied. Choose Share film/game window to try again.':error.message;
  }
};

lq('#live-check').onclick=async()=>{
  const token=lq('#live-token').value.trim();
  if(!token){lq('#live-status').textContent='Enter the crew token before checking setup.';return;}
  lq('#live-check').disabled=true;
  lq('#live-status').textContent='Checking deployed setup… No provider request will be made.';
  try{
    const response=await fetch('/.netlify/functions/live-observe',{headers:{Authorization:'Bearer '+token}});
    let result;try{result=await response.json();}catch{throw Error('Setup service returned an unreadable response.');}
    if(!response.ok)throw Error(result.error||'Setup check failed.');
    lq('#live-status').textContent=`Ready · ${result.model} · ${result.frameSamples}-frame reviews · no provider request made`;
  }catch(error){lq('#live-status').textContent='Setup check failed: '+error.message;}
  finally{lq('#live-check').disabled=liveRunning;}
};

lq('#live-start').onclick=()=>{
  if(!stream){lq('#live-status').textContent='Start the rear camera or share a film/game window first.';return;}
  if(!lq('#live-consent').checked||!lq('#live-token').value.trim()){lq('#live-status').textContent='Enter the crew token and enable image transmission first.';return;}
  liveToken=lq('#live-token').value.trim();
  lq('#live-token').value='';
  liveRunning=true;
  liveBusy=false;
  liveCount=0;
  liveFailures=0;
  sessionId=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const run=++liveGeneration;
  const paceMs=reviewDelay(lq('#live-pace').value);
  logObserver('session_started',{label:lq('#live-label').value.trim(),videoSource:sourceKind,paceMs,maximumReviews:MAX_REVIEWS});
  acquireWakeLock(run);
  setLiveButtons();
  if(paceMs===0)lq('#live-status').textContent='Manual mode · rolling buffer ready · tap Review last 4 seconds now after a play.';
  else{
    lq('#live-status').textContent=paceMs===1?'Fastest cloud loop starting… Results still arrive after provider processing.':'Starting analysis from the local replay buffer…';
    reviewBuffered(run,'automatic');
  }
};

lq('#live-review').onclick=()=>{
  if(!liveRunning||liveBusy)return;
  clearTimeout(liveTimer);
  reviewBuffered(liveGeneration,'manual');
};
lq('#live-stop').onclick=()=>stopLive();
lq('#live-download').onclick=()=>{
  const payload=createObserverExport(observerLog);
  downloadJson(payload,`digiref-observer-${new Date().toISOString().replace(/[:.]/g,'-')}.json`);
};
document.addEventListener('digiref-camera-report-request',event=>{
  if(typeof event.detail?.receive!=='function')return;
  const payload=createObserverExport(observerLog);
  event.detail.receive({
    source:sourceKind||'No video source',
    active:Boolean(stream),
    calibrated:Boolean(calibration),
    calibrationWarning:shiftWarnings>=3?'Camera may have shifted since the field scan.':null,
    observerSummary:payload.summary
  });
});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&liveRunning&&stopsWhenHidden(sourceKind))stopLive('Analysis stopped when the camera page was hidden.');
  else if(!document.hidden&&liveRunning&&!wakeLock)acquireWakeLock(liveGeneration);
});
window.addEventListener('offline',()=>{if(liveRunning)stopLive('Analysis stopped: device went offline. Reconnect and restart when ready.');});
