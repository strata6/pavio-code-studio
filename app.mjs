import {StudioClient,plans,generateCode,hashCode,formatCode} from './client.mjs?v=1.0.1';
const $=id=>document.getElementById(id),client=new StudioClient();
let owner=null,pending=null,freshCode=null,busy=false,historyJob=null,historyRefreshQueued=false,rows=[],cursor=null,revokeTarget=null,uiEpoch=0;
const date=v=>new Date(v).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
function selection(){return {plan:document.querySelector('[name=plan]:checked').value,months:Number(document.querySelector('[name=term]:checked').value)};}
function update(){const {plan,months}=selection();$('selection-name').textContent=plans[plan].name+' · '+(months===12?'Yearly':'Monthly');$('selection-price').textContent='$'+plans[plan][months];$('generate').disabled=busy||!!pending;$('retry').hidden=!pending;$('retry').disabled=busy;for(const e of document.querySelectorAll('#generate-form input'))e.disabled=busy||!!pending;}
function clearCode(){freshCode=null;$('new-code').value='';$('code-result').hidden=true;$('empty-result').hidden=false;}
function signedIn(value){owner=value;uiEpoch++;busy=false;historyJob=null;historyRefreshQueued=false;$('login-view').hidden=!!value;$('dashboard').hidden=!value;$('signout').hidden=!value;pending=null;rows=[];cursor=null;clearCode();$('revoke-dialog').close();revokeTarget=null;$('owner').textContent='';$('history-rows').replaceChildren();$('history-count').textContent='';$('history-status').textContent='';$('action-status').textContent='';$('load-more').hidden=true;$('confirm-revoke').disabled=false;update();if(value){$('owner').textContent='Signed in · '+value.username;void history(true);}}
$('login-form').onsubmit=async e=>{e.preventDefault();$('login').disabled=true;$('login-status').textContent='Checking your account…';const password=$('password').value;$('password').value='';try{const who=await client.signIn($('username').value,password);if(who.admin!==true)throw Error('This account is not a code issuer.');signedIn(who);$('login-status').textContent='';}catch(err){$('login-status').textContent=err.message;}finally{$('login').disabled=false;}};
$('signout').onclick=async()=>{if((pending||freshCode)&&!confirm('Sign out and clear the code from this screen? Copy it first if you still need it.'))return;signedIn(null);await client.signOut();$('login-status').textContent='Signed out. Your code display and session have been cleared.';};
for(const e of document.querySelectorAll('#generate-form input'))e.onchange=update;
async function issue(){
  if(busy||!owner)return;busy=true;update();const epoch=uiEpoch;
  try{
    if(!pending){const s=selection(),code=generateCode(),hash=await hashCode(code);if(epoch!==uiEpoch)return;pending={code,hash,id:crypto.randomUUID(),...s};}
    const p=pending;$('action-status').textContent='Saving this code securely…';
    const result=await client.rpc({p_action:'issue',p_hash:p.hash,p_request:p.id,p_plan:p.plan,p_months:p.months});
    if(epoch!==uiEpoch)return;
    if(!result.issued||result.code_hash!==p.hash||result.plan!==p.plan||result.months!==p.months)throw Object.assign(Error('Generation could not be confirmed. Check the same generation.'),{uncertain:true});
    freshCode=p.code;pending=null;$('new-code').value=formatCode(freshCode);$('code-plan').textContent=plans[p.plan].name+' · '+(p.months===12?'Yearly':'Monthly');$('code-deadline').textContent='Redeem by '+date(result.redeem_before)+'. Access starts at redemption.';$('empty-result').hidden=true;$('code-result').hidden=false;$('copy').textContent='Copy code';$('action-status').textContent=result.replayed?'Confirmed the original code. No duplicate was created.':'Code created. Copy it and send it privately.';void history(true);
  }catch(e){if(epoch===uiEpoch){$('action-status').textContent=e.message;if(!e.uncertain&&e.code&&e.code!=='session'&&e.code!=='forbidden')pending=null;}}
  finally{if(epoch===uiEpoch){busy=false;update();}}
}
$('generate-form').onsubmit=e=>{e.preventDefault();if(pending||busy)return;if(freshCode&&!confirm('Create another code? The current code will leave this screen, so copy it first.'))return;clearCode();void issue();};
$('retry').onclick=()=>issue();
$('copy').onclick=async()=>{if(!freshCode)return;try{await navigator.clipboard.writeText(formatCode(freshCode));$('copy').textContent='Copied';}catch{$('new-code').focus();$('new-code').select();$('action-status').textContent='Copy permission was unavailable. The code is selected; use your browser’s Copy command.';}};
$('clear-code').onclick=()=>{if(confirm('Clear this code from the screen? It cannot be recovered from the server.'))clearCode();};
async function history(reset){
  if(!owner)return;if(historyJob){if(reset)historyRefreshQueued=true;return;}const job={epoch:uiEpoch};historyJob=job;const epoch=job.epoch;$('refresh-history').disabled=true;$('load-more').disabled=true;$('history-status').textContent='Loading issued codes…';
  try{const before=reset?null:cursor,out=await client.rpc({p_action:'list',...(before?{p_before:before.issued_at,p_before_hash:before.code_hash}:{})});if(epoch!==uiEpoch)return;if(!Array.isArray(out.rows))throw Error('History could not be read.');rows=reset?out.rows:[...rows,...out.rows];cursor=out.rows.at(-1)||null;renderRows();$('load-more').hidden=out.rows.length<50;$('history-status').textContent='';}
  catch(e){if(epoch===uiEpoch)$('history-status').textContent=e.message;}finally{if(historyJob===job){historyJob=null;$('refresh-history').disabled=false;$('load-more').disabled=false;if(historyRefreshQueued){historyRefreshQueued=false;void history(true);}}}
}
function renderRows(){
  $('history-rows').replaceChildren(...rows.map(r=>{const tr=document.createElement('tr');const cell=text=>{const td=document.createElement('td');td.textContent=text;tr.append(td);return td;};cell(r.code_hash.slice(0,12));cell((plans[r.plan]?.name||r.plan)+' / '+(r.months===12?'Yearly':'Monthly'));const status=document.createElement('span');status.className='status '+r.status;status.textContent=r.status;cell('').append(status);cell(date(r.issued_at));cell(date(r.redeem_before));const actions=cell('');if(!r.redeemed_at&&!r.revoked){const b=document.createElement('button');b.textContent='Revoke';b.onclick=()=>{revokeTarget=r;$('revoke-detail').textContent=(plans[r.plan]?.name||r.plan)+' · '+(r.months===12?'Yearly':'Monthly')+' · reference '+r.code_hash.slice(0,12);$('revoke-dialog').showModal();};actions.append(b);}return tr;}));$('history-empty').hidden=rows.length>0;$('history-count').textContent=rows.length+' code'+(rows.length===1?'':'s')+' loaded';
}
$('refresh-history').onclick=()=>history(true);$('load-more').onclick=()=>history(false);$('cancel-revoke').onclick=()=>{$('revoke-dialog').close();revokeTarget=null;};
$('confirm-revoke').onclick=async()=>{if(!revokeTarget||$('confirm-revoke').disabled)return;const target=revokeTarget,epoch=uiEpoch;$('confirm-revoke').disabled=true;try{const result=await client.rpc({p_action:'revoke',p_hash:target.code_hash});if(epoch!==uiEpoch)return;if(result.revoked!==true)throw Error('Revocation could not be confirmed. Refresh the list before trying again.');$('revoke-dialog').close();revokeTarget=null;await history(true);}catch(e){if(epoch===uiEpoch)$('revoke-detail').textContent=e.message;}finally{if(epoch===uiEpoch)$('confirm-revoke').disabled=false;}};
window.addEventListener('beforeunload',event=>{if(pending||freshCode){event.preventDefault();event.returnValue='';}});
update();
