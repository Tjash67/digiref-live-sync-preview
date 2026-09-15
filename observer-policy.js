export const REAR_CAMERA='Rear camera';
export const SHARED_FILM='Shared film';

export function stopsWhenHidden(videoSource){
  return videoSource!==SHARED_FILM;
}

export function reviewDelay(value,fallback=12000){
  const delay=Number(value);
  return Number.isFinite(delay)&&delay>=0?delay:fallback;
}
