const FALLBACK_ERROR_NAMES=new Set(['OverconstrainedError','ConstraintNotSatisfiedError','NotFoundError']);

export const rearCameraAttempts=[
  {video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false},
  {video:{facingMode:{ideal:'environment'}},audio:false},
  {video:true,audio:false}
];

export async function requestPhoneCamera(getUserMedia){
  let lastError;
  for(let index=0;index<rearCameraAttempts.length;index++){
    try{return {stream:await getUserMedia(rearCameraAttempts[index]),fallbackLevel:index};}
    catch(error){
      lastError=error;
      if(!FALLBACK_ERROR_NAMES.has(error?.name))throw error;
    }
  }
  throw lastError;
}

export function cameraFailureMessage(error,{secure=true,mediaApi=true,userAgent=''}={}){
  if(!secure)return 'This page is not in a secure camera context. Open the deployed https:// DigiRef link directly in Safari or Chrome.';
  if(!mediaApi)return 'This browser cannot provide camera access here. Open the DigiRef link directly in Safari on iPhone or Chrome on Android—not inside Messages, Facebook, or another app.';
  const name=error?.name||'';
  if(name==='NotAllowedError'||name==='SecurityError'){
    if(/iPhone|iPad|iPod/i.test(userAgent))return 'Camera access is blocked. In iPhone Settings, open Safari → Camera and choose Allow, then return here, reload, and tap Try rear camera again. Also make sure this page is open in Safari—not an in-app browser.';
    if(/Android/i.test(userAgent))return 'Camera access is blocked. In Android Settings, open Apps → Chrome → Permissions → Camera and choose Allow, then return here, reload, and tap Try rear camera again.';
    return 'Camera access is blocked. Allow camera permission for this site in the browser address-bar settings, reload, and try again.';
  }
  if(name==='NotReadableError'||name==='AbortError'||name==='TrackStartError')return 'The camera is allowed but could not start. Close Camera, FaceTime, Zoom, or any other app using it; then lock/unlock the phone, reload this page, and try again.';
  if(name==='NotFoundError'||name==='DevicesNotFoundError')return 'No usable camera was found. Check that the browser has camera permission, remove any device restrictions, reload, and try again.';
  if(name==='OverconstrainedError'||name==='ConstraintNotSatisfiedError')return 'The phone rejected every camera mode DigiRef tried. Reload the page, rotate the phone sideways, and try again in Safari or Chrome.';
  return `Camera could not start${error?.message?`: ${error.message}`:'.'} Reload this page and open it directly in Safari on iPhone or Chrome on Android.`;
}
