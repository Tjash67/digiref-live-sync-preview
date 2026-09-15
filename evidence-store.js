// MediaRecorder chunks form one ordered recording; individual chunks are NOT clips.
export function clipWindow(at, duration, pre=15, post=10) {
  if (![at,duration,pre,post].every(Number.isFinite) || Math.min(at,duration,pre,post)<0) throw Error('Invalid video times.');
  return {start:Math.max(0,at-pre),end:Math.min(duration,at+post),missingPre:at<pre,missingPost:duration<at+post};
}
let connection;
export function database(){
  if(!connection)connection=new Promise((resolve,reject)=>{
    const request=indexedDB.open('digiref-video-evidence',2);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains('sessions'))db.createObjectStore('sessions',{keyPath:'id'});
      if(!db.objectStoreNames.contains('chunks')){const chunks=db.createObjectStore('chunks',{keyPath:['sessionId','sequence']});chunks.createIndex('sessionId','sessionId');}
      if(!db.objectStoreNames.contains('markers')){const markers=db.createObjectStore('markers',{keyPath:'id'});markers.createIndex('sessionId','sessionId');}
      if(!db.objectStoreNames.contains('reviews')){const reviews=db.createObjectStore('reviews',{keyPath:'id'});reviews.createIndex('sessionId','sessionId');}
    };
    request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();connection=null;};resolve(request.result);};
    request.onblocked=()=>reject(Error('Close other DigiRef tabs, then reload to upgrade video storage.'));
    request.onerror=()=>reject(request.error);
  });
  return connection;
}
export async function write(store,value){
  if(store==='reviews')throw Error('Use appendReview to preserve review history.');
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);
    tx.oncomplete=()=>resolve(value);tx.onabort=()=>reject(tx.error||Error('Video storage failed.'));tx.onerror=()=>{};
  });
}
export async function appendReview(review){
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(['markers','reviews'],'readwrite'),table=tx.objectStore('reviews');
    let failure;
    const markerRequest=tx.objectStore('markers').get(review.markerId);
    markerRequest.onsuccess=()=>{
      if(markerRequest.result?.sessionId!==review.sessionId){failure=Error('Review marker is missing.');tx.abort();return;}
      const rows=table.index('sessionId').getAll(review.sessionId);
      rows.onsuccess=()=>{
        const chain=rows.result.filter(row=>row.markerId===review.markerId&&row.reviewerId===review.reviewerId);
        const latest=chain.sort((a,b)=>b.revision-a.revision)[0];
        if((latest?.id||null)!==review.supersedes||review.revision!==(latest?.revision||0)+1){failure=Error('This review changed in another tab. Reopen the moment before saving.');tx.abort();return;}
        table.add(review);
      };
    };
    tx.oncomplete=()=>resolve(review);tx.onabort=()=>reject(failure||tx.error||Error('Review was not saved.'));tx.onerror=()=>{};
  });
}
export async function readAll(store,sessionId){
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(store,'readonly'),table=tx.objectStore(store);
    const request=sessionId?table.index('sessionId').getAll(sessionId):table.getAll();
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
}
export async function recordingBlob(session){
  const chunks=(await readAll('chunks',session.id)).sort((a,b)=>a.sequence-b.sequence);
  if(!chunks.length)throw Error('No saved video is available.');
  if(chunks.some((chunk,index)=>chunk.sequence!==index))throw Error('Video has a missing chunk. Export/recovery requires investigation.');
  for(const chunk of chunks){if(chunk.checksum&&chunk.checksum!==await checksum(chunk.blob))throw Error('Video integrity check failed.');}
  return new Blob(chunks.map(chunk=>chunk.blob),{type:session.mimeType});
}
export async function checksum(blob){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),value=>value.toString(16).padStart(2,'0')).join('');}
