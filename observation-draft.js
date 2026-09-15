export function observationDraftNote(observation){
  if(!observation||typeof observation.summary!=='string'||!Number.isFinite(observation.capturedFrom)||!Number.isFinite(observation.capturedTo)||!Array.isArray(observation.evidence)||!Array.isArray(observation.missingFacts))throw Error('Invalid observation draft');
  const areas=Array.isArray(observation.reviewAreas)&&observation.reviewAreas.length?' Review areas: '+observation.reviewAreas.join(', ')+'.':'';
  return 'UNCONFIRMED AI OBSERVATION — crew review required. Camera interval: '+new Date(observation.capturedFrom).toISOString()+' to '+new Date(observation.capturedTo).toISOString()+'. '+observation.summary+areas+' Evidence: '+observation.evidence.join('; ')+' Missing: '+observation.missingFacts.join('; ');
}
