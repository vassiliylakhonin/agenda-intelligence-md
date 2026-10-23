// One dedicated worker per explicit action. Termination bounds CPU time and keeps
// malformed inputs away from the working dossier and the main UI thread.
export function documentJob(operation,payload,{timeout=45000}={}){
  return new Promise((resolve,reject)=>{
    const worker=new Worker('/supplier-document-worker.js');
    const finish=(error,value)=>{clearTimeout(timer);worker.terminate();error?reject(error):resolve(value);};
    const timer=setTimeout(()=>finish(Error('Document processing timed out. Working changes are retained; use a smaller file or manual excerpt.')),timeout);
    worker.onmessage=({data})=>{if(data?.protocol!=='agenda.document.v1')return;data.ok?finish(null,data.result):finish(Error(data.error||'Document processing failed.'));};
    worker.onerror=()=>finish(Error('Document processor could not run. Keep the original and use a manual excerpt or Markdown export.'));
    worker.postMessage({protocol:'agenda.document.v1',operation,payload});
  });
}
