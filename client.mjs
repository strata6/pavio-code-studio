const origin='https://bescumcfyltymxlkbhqw.supabase.co';
const key='sb_publishable_dlN2AWz8yK4LAWilB9smVg_YJ4fhomK';
export const plans={basic:{name:'Basic',1:2,12:10},plus:{name:'Plus',1:4,12:20},pro:{name:'Pro',1:8,12:40}};
export function generateCode(source=crypto){let digits='';while(digits.length<24){for(const byte of source.getRandomValues(new Uint8Array(40))){if(byte<250)digits+=String(byte%10);if(digits.length===24)break;}}return digits;}
export async function hashCode(code){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code)))].map(v=>v.toString(16).padStart(2,'0')).join('');}
export const formatCode=code=>code.match(/.{4}/g).join('-');
const errors={forbidden:'This Vex account is not authorized to create codes.',session:'Your Vex session has ended. Sign in again.',parameters:'The code settings are invalid.',request_conflict:'This request was already used with different settings. No second code was created.',rate_limit:'The account has reached 100 codes this hour. Try again later.',code_collision:'A code conflict occurred. Clear this generation and create a new code.',already_redeemed:'This code was already redeemed. It cannot be revoked here.',not_found:'That code was not found.'};
export class StudioClient{
  // Native Window.fetch rejects a StudioClient receiver (Illegal invocation).
  constructor(fetchImpl=globalThis.fetch){this.fetch=fetchImpl.bind(globalThis);this.session=null;this.epoch=0;this.refreshing=null;}
  async request(path,body,token){
    const operation=path.includes('pavio_update_admin')?'Update publication':path.includes('grant_type=password')?'Sign-in':path.includes('grant_type=refresh_token')?'Session refresh':body?.p_action==='issue'?'Code generation':body?.p_action==='list'?'Code history':body?.p_action==='revoke'?'Code revocation':'Account connection';
    const retryHint=body?.p_action==='issue'?' Check the same generation before creating another.':path.includes('pavio_update_admin')?' Refresh or retry the same update operation.':' Check your connection and try again.';
    let response;try{response=await this.fetch(origin+path,{method:'POST',credentials:'omit',cache:'no-store',headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});}catch(cause){
      const binding=/illegal invocation/i.test(cause?.message||'');
      const timeout=cause?.name==='TimeoutError'||cause?.name==='AbortError';
      throw Object.assign(Error(binding?'The browser request could not start. Reload the updated page and try again.':operation+(timeout?' timed out after 20 seconds.':' could not reach the server.')+retryHint),{uncertain:!binding,code:binding?'browser_request':timeout?'timeout':'network'});
    }
    // GoTrue logout returns 204, which has no JSON body.
    if(response.status===204)return {};
    let data;try{data=await response.json();}catch{throw Object.assign(Error(operation+' returned an unreadable response.'+retryHint),{uncertain:true,code:'response'});}
    if(!response.ok)throw Object.assign(Error(response.status===429?'Too many requests. Please wait.':response.status===400&&path.startsWith('/auth/')?'Sign-in failed. Check your Vex username and password.':response.status===401?'Your session or sign-in is invalid. Sign in again.':'The server could not confirm this operation.'),{status:response.status,uncertain:response.status>=500});
    return data;
  }
  compact(data){if(data?.user?.app_metadata?.application!=='vex'||!data.access_token||!data.refresh_token||!data.user.id||!Number.isFinite(data.expires_at))throw Error('This is not a valid Vex account session.');return {uid:data.user.id,username:data.user.app_metadata.username,token:data.access_token,refresh:data.refresh_token,expires:data.expires_at};}
  async signIn(username,password){
    username=username.trim().toLowerCase();if(!/^[a-z][a-z0-9_]{2,23}$/.test(username)||!password)throw Error('Enter your Vex username and password.');
    const epoch=++this.epoch;this.session=null;this.refreshing=null;
    const data=await this.request('/auth/v1/token?grant_type=password',{email:'vex-'+username+'@accounts.invalid',password});
    if(epoch!==this.epoch)throw Error('Sign-in was cancelled.');this.session=this.compact(data);
    try{const status=await this.rpc({p_action:'status'});if(status?.admin!==true)throw Error(errors.forbidden);return status;}catch(e){if(epoch===this.epoch)await this.signOut();throw e;}
  }
  async token(){
    if(!this.session)throw Error(errors.session);if(this.session.expires>Date.now()/1000+60)return this.session.token;
    if(this.refreshing)return this.refreshing;
    const epoch=this.epoch,uid=this.session.uid,refresh=this.session.refresh;
    const job=(async()=>{const data=await this.request('/auth/v1/token?grant_type=refresh_token',{refresh_token:refresh});if(epoch!==this.epoch)throw Error('Account changed.');const next=this.compact(data);if(next.uid!==uid)throw Error('Account changed.');this.session=next;return next.token;})();this.refreshing=job;
    try{return await job;}finally{if(this.refreshing===job)this.refreshing=null;}
  }
  async rpc(body,endpoint='pavio_code_studio'){if(!['pavio_code_studio','pavio_update_admin'].includes(endpoint))throw Error('Unknown owner operation.');const epoch=this.epoch,token=await this.token();if(epoch!==this.epoch)throw Error('Account changed.');const data=await this.request('/rest/v1/rpc/'+endpoint,body,token);if(epoch!==this.epoch)throw Error('Account changed.');if(!data||typeof data!=='object')throw Object.assign(Error('The operation could not be confirmed.'),{uncertain:true});if(data.error)throw Object.assign(Error(data.error==='release_changed'?'The published release changed. Refresh before publishing again.':errors[data.error]||'The operation was not authorized.'),{code:data.error});return data;}
  async signOut(){const token=this.session?.token;this.epoch++;this.session=null;this.refreshing=null;if(token)try{await this.request('/auth/v1/logout?scope=local',{},token);}catch{} }
}
