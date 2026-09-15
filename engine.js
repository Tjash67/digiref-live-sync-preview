export const VERSION=3;
export const teams=['Northview','Central'];
export const opposite=t=>t===teams[0]?teams[1]:teams[0];
export const copy=o=>JSON.parse(JSON.stringify(o));
export const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
export const fmt=s=>`${Math.floor(Math.max(0,Math.ceil(s))/60)}:${String(Math.max(0,Math.ceil(s))%60).padStart(2,'0')}`;
export const direction=s=>s.possession===teams[0]?s.northDirection:-s.northDirection;
export const spot=x=>x===50?'50':x<50?`NTH ${Number(x.toFixed(2))}`:`CTL ${Number((100-x).toFixed(2))}`;
export const zone=x=>x<=20?'North red zone':x>=80?'Central red zone':'Between 20s';
export const remaining=(c,now=Date.now())=>Math.max(0,c.until===null?c.seconds:(c.until-now)/1000);
const clock=seconds=>({seconds,until:null});
const stop=(c,now)=>{c.seconds=remaining(c,now);c.until=null;};
const run=(c,now)=>{if(c.until===null&&c.seconds>0)c.until=now+c.seconds*1000;};
const setPlay=(s,seconds,now,start=false)=>{s.play=clock(seconds);s.playLimit=seconds;if(start)run(s.play,now);};
export function initial(now=Date.now()) {return {version:VERSION,ruleset:'NFHS',quarter:1,game:clock(720),play:clock(40),playLimit:40,score:{Northview:0,Central:0},timeouts:{Northview:3,Central:3},possession:teams[0],northDirection:1,position:35,lineToGain:45,down:1,phase:'pre',playType:'scrimmage',restart:'snap',untimed:false,twoMinute:false,crewSize:5,crew:{R:'Referee',U:'Umpire',HL:'Head linesman',LJ:'Line judge',BJ:'Back judge',FJ:'Field judge',SJ:'Side judge',CJ:'Center judge'},plays:[],flags:[],admins:[],stoppages:[],corrections:[],enforcements:[],deadSince:now,whistleAt:null,activeAdmin:null,activeStop:null,currentPlay:null,nextPlayId:1,notice:'Ready for the opening play.'};}
export function positions(s){let wing=s.ruleset==='NCAA'?'DJ':'HL';return ['R','U',wing,'LJ',...(s.crewSize===5?['BJ']:s.crewSize>=6?['FJ','SJ',...(s.crewSize>=7?['BJ']:[]),...(s.crewSize===8?['CJ']:[])]:[])];}
export function side(s,team){return team==='Neither'||s.playType!=='scrimmage'?'neither':team===s.possession?'offense':'defense';}
function number(n,min,max,label){n=Number(n);if(!Number.isFinite(n)||n<min||n>max)throw Error(`${label} must be between ${min} and ${max}.`);return n;}
function endStop(s,now){if(s.activeStop){s.stoppages.push({...s.activeStop,end:now,duration:(now-s.activeStop.start)/1000});s.activeStop=null;}}
function whistle(s,now){stop(s.game,now);stop(s.play,now);if(s.phase==='live'){s.phase='dead';s.whistleAt=now;s.deadSince=now;if(s.currentPlay){s.currentPlay.end=now;s.currentPlay.endGame=remaining(s.game,now);}}else if(s.whistleAt===null)s.whistleAt=now;
 if(s.flags.some(f=>f.outcome==='pending')&&s.activeAdmin===null)s.activeAdmin=s.whistleAt;
 s.notice='Whistle recorded. Game clock stopped.';}
function series(s){s.down=1;s.lineToGain=clamp(s.position+10*direction(s),0,100);}
function changePossession(s){s.possession=opposite(s.possession);series(s);}
function finishPlay(s,now,result,noPlay=false){if(!s.currentPlay)return;s.currentPlay.end=s.currentPlay.end??now;s.plays.push({...s.currentPlay,result,noPlay,endPosition:s.position});s.currentPlay=null;}
export function previewDistance(s,{base,yards,team,half=true}){base=number(base,0,100,'Enforcement spot');yards=number(yards,0,99,'Yards');if(!teams.includes(team))throw Error('Select the offending team.');const attack=team===teams[0]?s.northDirection:-s.northDirection;const toOwnGoal=attack===1?base:100-base;const actual=half?Math.min(yards,toOwnGoal/2):yards;return {position:clamp(base-attack*actual,0,100),yards:actual,half:actual<yards};}
export function reduce(state,action,now=Date.now()) {
 const s=copy(state);let a=action;
 switch(a.type){
 case 'MARK': {
  if(!['MARK','NO-CALL','REVIEW'].includes(a.kind))throw Error('Choose a review marker.');
  if(!a.id||(s.markers||[]).some(m=>m.id===a.id))throw Error('Marker ID must be unique.');
  s.markers=[...(s.markers||[]),{id:a.id,kind:a.kind,at:now,quarter:s.quarter,game:remaining(s.game,now),playId:s.currentPlay?.id??null,position:s.position,status:'unreviewed'}];
  s.notice=`${a.kind} saved for review. No ruling or clock change.`;break;
 }
 case 'SNAP': {
  if(s.phase==='live')throw Error('A play is already live. Record its result first.');
  if(s.flags.some(f=>f.outcome==='pending'))throw Error('Resolve all pending flags before the next legal snap.');
  if(s.currentPlay)throw Error('Record the previous play result or mark it no play.');
  if(s.playType==='kickoff')throw Error('Use Legal kick touch to start a kickoff.');
  if(remaining(s.game,now)===0&&!s.untimed)throw Error('Period expired. Confirm a new period or an untimed down.');
  if(s.activeAdmin!==null){s.admins.push({start:s.activeAdmin,end:now,seconds:(now-s.activeAdmin)/1000,flagIds:s.flags.filter(f=>f.adminStart===s.activeAdmin).map(f=>f.id),quarter:s.quarter});s.activeAdmin=null;}
  endStop(s,now);const previous=s.plays.filter(p=>!p.noPlay).at(-1);
  s.currentPlay={id:s.nextPlayId++,start:now,quarter:s.quarter,game:remaining(s.game,now),down:s.down,position:s.position,lineToGain:s.lineToGain,possession:s.possession,direction:direction(s),type:s.playType,deadSeconds:s.deadSince===null?null:(now-s.deadSince)/1000,snapInterval:previous?(now-previous.start)/1000:null};
  s.phase='live';s.deadSince=null;s.whistleAt=null;setPlay(s,40,now);if(!s.untimed&&s.playType!=='try')run(s.game,now);s.notice='Legal snap recorded.';break;
 }
 case 'WHISTLE':whistle(s,now);s.flags.filter(f=>f.outcome==='pending'&&f.adminStart===null).forEach(f=>f.adminStart=s.activeAdmin);break;
 case 'FLAG': {
  if(s.phase!=='live'){const priorWhistle=s.currentPlay?s.whistleAt:null;whistle(s,now);s.activeAdmin=s.activeAdmin??priorWhistle??now;}
  const id=a.id;
  if(s.flags.some(f=>f.id===id))throw Error('Flag already exists.');
  s.flags.push({id,callId:null,name:'Call not selected',team:a.team||s.possession,side:side(s,a.team||s.possession),possession:s.possession,official:a.official||'R',officialName:s.crew[a.official||'R']||a.official||'Referee',player:'',phase:s.phase==='live'?'live':'dead',reportedAt:now,foulAt:now,game:remaining(s.game,now),quarter:s.quarter,down:s.down,position:s.position,fieldZone:zone(s.position),playId:s.currentPlay?.id??s.nextPlayId,playType:s.playType,afterChange:false,simultaneous:false,note:'',outcome:'pending',adminStart:s.activeAdmin,ruleset:s.ruleset});s.notice='Flag captured. Select the call; live play continues until the whistle.';break;
 }
 case 'EDIT_FLAG': {
  let f=s.flags.find(f=>f.id===a.id);if(!f||f.outcome!=='pending')throw Error('This flag is no longer pending.');
  let allowed=['callId','name','team','official','player','phase','position','note','afterChange','simultaneous','category','citation','validation','foulAt','enforcementSpot','possession'];
  allowed.forEach(k=>{if(a.values[k]!==undefined)f[k]=a.values[k];});
  if(![...teams,'Neither'].includes(f.team))throw Error('Invalid team.');
  f.position=number(f.position,0,100,'Foul position');f.fieldZone=zone(f.position);f.side=f.team==='Neither'||f.playType!=='scrimmage'?'neither':f.team===f.possession?'offense':'defense';f.officialName=s.crew[f.official]||f.official;
  if(!Number.isFinite(f.foulAt)||f.foulAt>now)throw Error('Foul time must be a valid time in the past.');
  if(['dead','nonplayer'].includes(f.phase)&&s.phase==='live'){whistle(s,now);s.flags.filter(x=>x.outcome==='pending').forEach(x=>x.adminStart=s.activeAdmin);}
  s.notice='Flag details saved.';break;
 }
 case 'RESULT': {
  if(!s.currentPlay)throw Error('Record a legal snap or kick touch before a play result.');
  const r=a.result;const allowed=['Run','Complete','Incomplete','Out of bounds','Turnover','Touchdown','Field goal','Safety','Touchback','Try good (1)','Try good (2)','Try no good','No play'];if(!allowed.includes(r))throw Error('Choose a play result.');
  if(a.endPosition!==undefined&&String(a.endPosition).trim()==='')throw Error('Enter the ending yard line.');
  const gain=a.endPosition!==undefined?(number(a.endPosition,0,100,'Ending spot')-s.position)*direction(s):number(a.gain??0,-100,100,'Gain');const oldTeam=s.possession;
  if(a.endPosition!==undefined&&['Run','Complete','Out of bounds','Turnover'].includes(r)&&[0,100].includes(Number(a.endPosition)))throw Error('Goal-line result requires score, safety, or touchback confirmation in advanced controls.');
  s.currentPlay.entryMethod=a.endPosition!==undefined?'ending_spot':'result_form';
  const hadWhistle=s.whistleAt!==null;s.whistleAt=s.whistleAt??now;s.deadSince=s.deadSince??now;s.phase='dead';
  if(!['Incomplete','No play'].includes(r))s.position=clamp(s.position+gain*direction(s),0,100);
  s.restart='ready';
  if(['Incomplete','Turnover','Touchdown','Field goal','Safety','Touchback','Try good (1)','Try good (2)','Try no good'].includes(r)){stop(s.game,now);s.restart='snap';}
  if(r==='Out of bounds'){stop(s.game,now);s.restart=s.ruleset==='NFHS'||s.twoMinute?'snap':'ready';}
  if(r==='No play'){stop(s.game,now);s.notice='Down marked no play.';}
  else if(r==='Turnover'){changePossession(s);s.playType='scrimmage';}
  else if(r==='Touchback'){s.possession=a.receiving||opposite(oldTeam);s.position=number(a.touchbackSpot??(s.possession===teams[0]?20:80),1,99,'Touchback spot');series(s);s.playType='scrimmage';}
  else if(r==='Touchdown'){s.score[oldTeam]+=6;s.playType='try';s.restart='hold';s.untimed=true;}
  else if(r==='Field goal'){s.score[oldTeam]+=3;s.playType='kickoff';s.restart='touch';}
  else if(r==='Safety'){s.score[opposite(oldTeam)]+=2;s.playType='kickoff';s.restart='touch';}
  else if(r.startsWith('Try')){s.score[oldTeam]+=r==='Try good (1)'?1:r==='Try good (2)'?2:0;s.playType='kickoff';s.restart='touch';s.untimed=false;}
  else if((s.lineToGain-s.position)*direction(s)<=0){series(s);if(s.ruleset==='NFHS'||s.twoMinute)stop(s.game,now);}
  else if(s.down===4){stop(s.game,now);changePossession(s);s.restart='snap';}
  else s.down++;
  finishPlay(s,now,r,r==='No play');
  let administrative=['Turnover','Touchdown','Field goal','Safety','Touchback','No play'].includes(r)||r.startsWith('Try')||s.possession!==oldTeam;
  if(s.flags.some(f=>f.outcome==='pending')){whistle(s,now);s.activeAdmin=s.activeAdmin??s.whistleAt;s.flags.filter(f=>f.outcome==='pending').forEach(f=>f.adminStart=s.activeAdmin);administrative=true;}
  const pc=s.ruleset==='NCAA'&&r==='Touchdown'?40:administrative?25:40;setPlay(s,pc,now,!administrative||pc===40);
  if(hadWhistle&&s.restart==='ready')stop(s.game,now);s.notice=`${r} recorded. Game clock: ${s.restart}.`;break;
 }
 case 'READY':if(s.phase==='live'||s.currentPlay)throw Error('Finish the current play first.');if(s.flags.some(f=>f.outcome==='pending'))throw Error('Resolve pending flags first.');endStop(s,now);if(s.restart==='ready'&&!s.untimed)run(s.game,now);run(s.play,now);s.notice='Ready-for-play signal recorded.';break;
 case 'CLOCK':if(a.target==='game'){if(s.untimed||s.playType==='try')throw Error('This is an untimed down.');s.game.until===null?run(s.game,now):stop(s.game,now);}else{s.play.until===null?run(s.play,now):stop(s.play,now);}break;
 case 'CORRECT_CLOCK':{
  const target=a.target==='play'?'play':'game';const value=number(a.seconds,0,target==='play'?99:3600,'Clock seconds');const before=remaining(s[target],now);s[target]=clock(value);s.corrections.push({at:now,quarter:s.quarter,target,before,after:value,reason:String(a.reason||'Operator correction')});if(target==='play')s.playLimit=value;s.notice='Clock corrected and paused.';break;
 }
 case 'STOPPAGE': {
  if(s.phase==='live')throw Error('Whistle the play dead and enter its result first.');
  if(s.activeStop)throw Error('End the current stoppage first.');
  if(a.reason==='Team timeout'){if(!teams.includes(a.team)||s.timeouts[a.team]<=0)throw Error('No charged timeouts remaining for that team.');s.timeouts[a.team]--;}
  whistle(s,now);s.activeStop={start:now,reason:a.reason,team:a.team||'Neither',quarter:s.quarter,game:remaining(s.game,now)};
  if(a.reason==='Two-minute timeout'){if(s.ruleset!=='NCAA'||![2,4].includes(s.quarter)||s.twoMinute)throw Error('Two-minute timeout is available once in NCAA quarters 2 and 4.');s.twoMinute=true;}
  const defensive=a.team===opposite(s.possession)&&['Injury','Equipment'].includes(a.reason);setPlay(s,defensive?40:25,now);
  s.restart=['Team timeout','Two-minute timeout'].includes(a.reason)?'snap':a.restart||s.restart;s.notice=`${a.reason} started. End stoppage when it ends.`;break;
 }
 case 'END_STOPPAGE':if(!s.activeStop)throw Error('No active stoppage.');endStop(s,now);s.notice='Stoppage duration saved. Signal ready when appropriate.';break;
 case 'ENFORCE': {
  if(s.phase==='live')throw Error('Wait for the whistle and the play result.');
  if(s.currentPlay)throw Error('Record the play result or No play before enforcement.');
  const pending=s.flags.filter(f=>f.outcome==='pending');if(!pending.length)throw Error('No pending flags.');
  if(!a.confirmed)throw Error('Referee confirmation is required.');
  if(!a.reason?.trim())throw Error('Enter the ruling and rule reference.');
  for(const f of pending){const outcome=a.outcomes[f.id];if(!['accepted','declined','offsetting','canceled','superseded','kickoff','administrative'].includes(outcome))throw Error('Choose an outcome for every flag.');if(outcome==='accepted'&&!f.callId)throw Error('Choose a call before accepting a flag.');}
  const final=a.final;
  const nextPosition=number(final.position,0,100,'Final ball spot'),ltg=number(final.lineToGain,0,100,'Line to gain'),down=number(final.down,1,4,'Down');if(!Number.isInteger(down))throw Error('Down must be a whole number.');
  if(!teams.includes(final.possession))throw Error('Select possession.');
  const dir=final.possession===teams[0]?s.northDirection:-s.northDirection;
  if((ltg-nextPosition)*dir<0)throw Error('Line to gain must be ahead of the ball.');
  if(!['ready','snap','hold','touch'].includes(final.restart))throw Error('Choose a restart signal.');
  if(![25,40].includes(Number(final.playClock)))throw Error('Choose 25 or 40 seconds.');
  const before={position:s.position,lineToGain:s.lineToGain,down:s.down,possession:s.possession};
  for(const f of pending){f.outcome=a.outcomes[f.id];f.enforcedAt=now;f.ruling=a.reason;f.enforcementSpot=a.base||'Referee-entered final state';}
  s.position=nextPosition;s.lineToGain=ltg;s.down=down;s.possession=final.possession;s.restart=final.restart;stop(s.game,now);setPlay(s,Number(final.playClock),now);s.phase='dead';
  s.enforcements.push({at:now,flagIds:pending.map(f=>f.id),before,after:copy(final),reason:a.reason});s.notice='Confirmed ruling applied. Administration stays open until the next legal snap.';break;
 }
 case 'SET_GAME': {
  if(s.phase==='live')throw Error('Record the play result before editing game state.');
  for(const [k,min,max] of [['position',0,100],['lineToGain',0,100],['down',1,4]])if(a.values[k]!==undefined)s[k]=number(a.values[k],min,max,k);
  if(!Number.isInteger(s.down))throw Error('Down must be a whole number.');
  if(a.values.possession!==undefined){if(!teams.includes(a.values.possession))throw Error('Invalid possession.');s.possession=a.values.possession;}
  if(a.values.northDirection!==undefined)s.northDirection=Number(a.values.northDirection)===-1?-1:1;
  if((s.lineToGain-s.position)*direction(s)<0)throw Error('Line to gain must be ahead of the ball in the possession direction.');
  if(a.values.playType!==undefined){if(!['scrimmage','kickoff','punt','try'].includes(a.values.playType))throw Error('Invalid play type.');s.playType=a.values.playType;}
  if(a.values.restart!==undefined){if(!['ready','snap','touch','hold'].includes(a.values.restart))throw Error('Invalid restart.');s.restart=a.values.restart;}
  if(a.values.untimed!==undefined)s.untimed=!!a.values.untimed;
  if(s.playType==='try'){s.untimed=true;stop(s.game,now);}if(s.untimed)stop(s.game,now);
  s.notice='Game state updated.';break;
 }
 case 'AI_REVIEW':s.aiReviews=[...(s.aiReviews||[]),{at:now,...copy(a.review)}];s.notice='AI proposal saved for referee review. No game ruling applied.';break;
 case 'SCORE':if(!teams.includes(a.team))throw Error('Invalid team.');s.score[a.team]=number(a.score,0,199,'Score');if(a.count!==undefined)s.timeouts[a.team]=number(a.count,0,3,'Timeouts');s.notice='Score and timeout count saved.';break;
 case 'LIVE_POSSESSION':if(s.phase!=='live')throw Error('No live play.');changePossession(s);s.currentPlay.possessionChanges=[...(s.currentPlay.possessionChanges||[]),{at:now,position:s.position,possession:s.possession}];s.notice='Live possession changed. Flag context follows the new possession.';break;
 case 'CARRYOVER':{const f=s.flags.find(f=>f.id===a.id);if(!f||f.outcome!=='kickoff')throw Error('No kickoff carryover to review.');f.outcome='pending';s.activeAdmin=s.activeAdmin??now;f.adminStart=s.activeAdmin;s.notice='Kickoff carryover reopened for confirmed enforcement.';break;}
 case 'TIMEOUTS':if(!teams.includes(a.team))throw Error('Invalid team.');s.timeouts[a.team]=number(a.count,0,3,'Timeouts');break;
 case 'PERIOD': {
  if(s.phase==='live'||s.currentPlay||s.flags.some(f=>f.outcome==='pending'))throw Error('Complete the play and pending rulings before ending the period.');
  if(s.quarter>=4)throw Error('Regulation complete. Overtime requires the adopted competition procedure and manual setup.');
  if(!a.confirmed)throw Error('Confirm the referee has ended the period.');
  stop(s.game,now);s.quarter++;s.northDirection*=-1;s.position=100-s.position;s.lineToGain=100-s.lineToGain;s.game=clock(s.ruleset==='NFHS'?720:900);setPlay(s,25,now);s.twoMinute=false;s.untimed=false;s.restart='snap';s.whistleAt=null;s.deadSince=now;
  if(s.quarter===3){s.timeouts={Northview:3,Central:3};s.playType='kickoff';s.restart='touch';}
  s.notice=`Period ${s.quarter}. Confirm kickoff or scrimmage setup before restarting.`;break;
 }
 case 'SETUP': {
  if(a.ruleset&&a.ruleset!==s.ruleset){if(s.flags.length||s.plays.length||s.currentPlay)throw Error('Reset the demo before changing rule editions.');s.ruleset=a.ruleset==='NCAA'?'NCAA':'NFHS';s.game=clock(s.ruleset==='NCAA'?900:720);}
  if(a.crewSize!==undefined){s.crewSize=number(a.crewSize,4,8,'Crew size');if(!Number.isInteger(s.crewSize))throw Error('Choose a whole crew size.');}
  if(a.crew)Object.entries(a.crew).forEach(([k,v])=>s.crew[k]=String(v).slice(0,80));s.notice='Crew setup saved.';break;
 }
 case 'KICK_TOUCH':{
  if(s.playType!=='kickoff'||s.phase==='live')throw Error('Set the play type to kickoff first.');
  if(s.currentPlay||s.flags.some(f=>['pending','kickoff'].includes(f.outcome)))throw Error('Finish the preceding play and all kickoff carryover rulings first.');
  endStop(s,now);s.phase='live';s.deadSince=null;s.whistleAt=null;s.untimed=false;run(s.game,now);setPlay(s,40,now);s.currentPlay={id:s.nextPlayId++,start:now,quarter:s.quarter,game:remaining(s.game,now),down:s.down,position:s.position,lineToGain:s.lineToGain,possession:s.possession,direction:direction(s),type:'kickoff',deadSeconds:null,snapInterval:null};s.notice='Legal kick touch recorded. Game clock running.';break;
 }
 default:throw Error('Unknown action.');
 }
 return s;
}
export function envelope(now=Date.now()){return {version:VERSION,revision:0,state:initial(now),undo:[],redo:[],audit:[]};}
function paused(s,now){s=copy(s);stop(s.game,now);stop(s.play,now);return s;}
export function commit(doc,a,now=Date.now()){
 if(a.expectedRevision!==undefined&&a.expectedRevision!==doc.revision)throw Error('The game changed while this form was open. Reopen and review the current state.');
 const d=copy(doc);let before=paused(d.state,now);
 if(a.type==='UNDO'||a.type==='REDO'){
  let from=a.type==='UNDO'?d.undo:d.redo,to=a.type==='UNDO'?d.redo:d.undo;if(!from.length)throw Error('Nothing to '+a.type.toLowerCase()+'.');to.push(before);d.state=from.pop();d.state.notice=`${a.type==='UNDO'?'Undone':'Redone'}. Clocks paused; verify before restarting.`;
 }else if(a.type==='RESET'){d.undo.push(before);d.redo=[];d.state=initial(now);}
 else{d.state=reduce(d.state,a,now);d.undo.push(before);d.redo=[];}
 d.undo=d.undo.slice(-60);d.revision++;d.audit.push({id:d.revision,at:now,type:a.type,action:copy(a),quarter:d.state.quarter,game:remaining(d.state.game,now),description:d.state.notice});return d;
}
export function statistics(s,filters={}){
 const flags=s.flags.filter(f=>Object.entries(filters).every(([k,v])=>!v||String(f[k])===String(v)));
 const ids=new Set(flags.map(f=>f.id)),admins=s.admins.filter(a=>a.flagIds.some(id=>ids.has(id)));
 const plays=s.plays.filter(p=>!p.noPlay&&(!filters.quarter||String(p.quarter)===filters.quarter));
 const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
 const outcomes={pending:0,accepted:0,declined:0,offsetting:0,canceled:0,superseded:0,kickoff:0,administrative:0};flags.forEach(f=>outcomes[f.outcome]++);
 const groups=k=>Object.entries(flags.reduce((o,f)=>(o[f[k]||'Unspecified']=(o[f[k]||'Unspecified']||0)+1,o),{})).sort((a,b)=>b[1]-a[1]);
 return {flags,plays,admins,outcomes,adminAverage:avg(admins.map(a=>a.seconds)),deadAverage:avg(plays.map(p=>p.deadSeconds).filter(Number.isFinite)),snapAverage:avg(plays.map(p=>p.snapInterval).filter(Number.isFinite)),timeoutAverage:avg(s.stoppages.filter(t=>t.reason==='Team timeout'&&(!filters.quarter||String(t.quarter)===filters.quarter)).map(t=>t.duration)),groups};
}
