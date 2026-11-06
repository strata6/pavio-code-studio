import {verifyRelease,compareVersions} from './release-format.mjs?v=1.1.0';
export function createUpdates(client){
  const $=id=>document.getElementById(id);
  let owner=false,epoch=0,busy=false,feed=null,candidate=null,release=null,pending=null;
  const trust=fetch('./update-trust.json?v=1.1.0',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Publisher verification key could not load.');return r.json();});
  // A failed key request is displayed on first use, not as an unhandled promise.
  trust.catch(()=>{});
  const rpc=body=>client.rpc(body,'pavio_update_admin');
  function controls(){
    $('update-publish').disabled=!owner||busy||!!pending||!feed||!candidate;
    $('update-withdraw').disabled=!owner||busy||!!pending||!feed?.manifest;
    $('release-file').disabled=busy||!!pending;$('release-channel').disabled=busy||!!pending;
    $('update-refresh').disabled=busy||!!pending;$('update-retry').hidden=!pending;$('update-retry').disabled=busy;
  }
  function resetCandidate(){candidate=null;release=null;$('release-preview').textContent='Import a signed .pavioupdate file prepared with the Pavio release tool.';$('release-file').value='';}
  async function refresh(){
    if(!owner||busy||pending)return;busy=true;controls();const e=epoch;
    $('release-status').textContent='Checking the published release…';
    try{const f=await rpc({p_action:'status',p_channel:$('release-channel').value});const m=f.manifest?await verifyRelease(f.manifest,await trust):null;if(e!==epoch)return;feed=f;$('published-release').textContent=m?`${m.version} · published ${new Date(f.published_at).toLocaleString()}`:'No update is published on this channel.';$('release-status').textContent='';}
    catch(err){if(e===epoch){feed=null;$('release-status').textContent=err.message;}}
    finally{if(e===epoch){busy=false;controls();}}
  }
  $('release-file').onchange=async()=>{
    const file=$('release-file').files[0],e=epoch;candidate=null;release=null;if(!file){controls();return;}busy=true;controls();
    try{if(file.size>16000)throw Error('Select the small .pavioupdate file, not the EXE.');const envelope=JSON.parse(await file.text()),m=await verifyRelease(envelope,await trust);if(e!==epoch)return;if(m.channel!==$('release-channel').value)throw Error('Choose the '+m.channel+' channel first.');candidate=envelope;release=m;$('release-preview').textContent=`${m.version} · Windows x64 · ${(m.size/1048576).toFixed(1)} MB\nPublisher signature verified\nSHA-256: ${m.sha256}\n\n${m.notes}`;$('release-status').textContent='Ready to publish. The installer must already be uploaded to the official release repository.';}
    catch(err){if(e===epoch){resetCandidate();$('release-status').textContent=err.message;}}
    finally{if(e===epoch){busy=false;controls();}}
  };
  async function send(){
    if(!owner||busy||!pending)return;busy=true;controls();const e=epoch,p=pending;
    $('release-status').textContent='Confirming the same update operation…';
    try{const f=await rpc(p);if(e!==epoch)return;if(f.revision!==p.p_request||JSON.stringify(f.manifest)!==JSON.stringify(p.p_manifest)){
      // JSONB may reorder envelope properties: compare their signed contents.
      if(f.revision!==p.p_request||f.manifest?.payload!==p.p_manifest?.payload||f.manifest?.signature!==p.p_manifest?.signature)throw Object.assign(Error('Publication could not be confirmed. Retry the same operation.'),{uncertain:true});
    }feed=f;pending=null;$('published-release').textContent=f.manifest?release?.version||'Signed release published':'No update is published on this channel.';$('release-status').textContent=p.p_action==='publish'?'Published. Update-enabled copies of Pavio will discover it on their next check.':'Withdrawn. Pavio will refuse this release before installation. Already-installed copies are not rolled back.';}
    catch(err){if(e===epoch){$('release-status').textContent=err.message;if(!err.uncertain&&err.code){pending=null;feed=null;}}}
    finally{if(e===epoch){busy=false;controls();}}
  }
  $('update-publish').onclick=async()=>{
    if(!candidate||!feed||busy||pending)return;
    if(feed.manifest){const old=await verifyRelease(feed.manifest,await trust);if(compareVersions(release.version,old.version)<=0){$('release-status').textContent='Publish a higher version number. Downgrades and replacements of the same version are not allowed by this UI.';return;}}
    if(!confirm('Publish Pavio '+release.version+' to the '+release.channel+' channel? Installed copies will download it and ask their users to restart.'))return;
    pending={p_action:'publish',p_channel:release.channel,p_manifest:candidate,p_expected:feed.revision,p_request:crypto.randomUUID()};void send();
  };
  $('update-withdraw').onclick=()=>{if(!feed?.manifest||busy||pending||!confirm('Withdraw this release? It will no longer be offered to users. This does not uninstall an update already installed.'))return;pending={p_action:'withdraw',p_channel:$('release-channel').value,p_manifest:null,p_expected:feed.revision,p_request:crypto.randomUUID()};void send();};
  $('update-retry').onclick=send;$('update-refresh').onclick=refresh;
  $('release-channel').onchange=()=>{feed=null;resetCandidate();void refresh();};
  window.addEventListener('beforeunload',e=>{if(pending){e.preventDefault();e.returnValue='';}});
  return {setOwner(value){owner=!!value;epoch++;busy=false;feed=null;pending=null;resetCandidate();$('release-status').textContent='';$('published-release').textContent='';controls();if(owner)void refresh();}};
}
