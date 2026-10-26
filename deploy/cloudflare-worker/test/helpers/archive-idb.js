// Minimal transactional IDB double. Writes serialize, and aborted put/delete
// never reach committed rows; the real-browser check exercises native IndexedDB.
export function archiveIDB(){
  const rows=new Map(),control={fail:false},queue=[];let locked=false;
  const db={createObjectStore(){},transaction(_store,mode){
    const tx={};let active=false,started=false,pending=0,timer,aborted=false,working;
    const done=()=>{if(mode==='readwrite'){locked=false;queue.shift();if(queue[0]){locked=true;queue[0]();}}};
    const finish=()=>{clearTimeout(timer);timer=setTimeout(()=>{if(pending||aborted)return;if(control.fail&&mode==='readwrite'){tx.abort();return;}if(mode==='readwrite'){rows.clear();for(const [k,v]of working)rows.set(k,v);}tx.oncomplete?.();done();},0);};
    const begin=()=>{if(started)return;started=true;active=true;working=structuredClone(rows);for(const action of waiting)action();finish();};
    const waiting=[];
    const operation=action=>{const req={};pending++;const run=()=>queueMicrotask(()=>{if(aborted)return;req.result=action();req.onsuccess?.();pending--;finish();});if(active)run();else waiting.push(run);return req;};
    tx.abort=()=>{if(aborted)return;aborted=true;clearTimeout(timer);queueMicrotask(()=>{tx.onabort?.();done();});};
    tx.objectStore=()=>({get:key=>operation(()=>structuredClone(working.get(key))),put:value=>operation(()=>{working.set(value.name,structuredClone(value));}),delete:key=>operation(()=>working.delete(key))});
    if(mode==='readwrite'){queue.push(begin);if(!locked){locked=true;queueMicrotask(begin);}}else queueMicrotask(begin);
    return tx;
  }};
  return {rows,control,indexedDB:{open(){const request={result:db};queueMicrotask(()=>{request.onupgradeneeded?.();request.onsuccess?.();});return request;}}};
}
