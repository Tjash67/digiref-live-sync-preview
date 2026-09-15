export function selectFrameSamples(buffer,now,{samples=8,windowMs=4500}={}){
  if(!Array.isArray(buffer)||!Number.isFinite(now)||!Number.isInteger(samples)||samples<2||!Number.isFinite(windowMs)||windowMs<=0)return null;
  const recent=buffer.filter(frame=>frame&&Number.isFinite(frame.at)&&typeof frame.image==='string'&&frame.at<=now&&now-frame.at<=windowMs).sort((a,b)=>a.at-b.at);
  if(recent.length<samples)return null;
  const last=recent.length-1;
  const indexes=Array.from({length:samples},(_,index)=>Math.round(index*last/(samples-1)));
  if(new Set(indexes).size!==samples)return recent.slice(-samples);
  return indexes.map(index=>recent[index]);
}
