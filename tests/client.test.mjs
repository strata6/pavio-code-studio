import {test} from 'node:test';import assert from 'node:assert/strict';import {StudioClient,generateCode,hashCode,formatCode,plans} from '../client.mjs';
const user={id:'fixture',app_metadata:{application:'vex',username:'fixture'}};
const auth={user,access_token:'fixture-token',refresh_token:'fixture-refresh',expires_at:Date.now()/1000+3600};
const response=(data,status=200)=>new Response(status===204?null:JSON.stringify(data),{status});
test('fetch keeps the browser global receiver instead of the client instance',async()=>{
  const c=new StudioClient(function(){assert.equal(this,globalThis);return Promise.resolve(response({ok:true}));});
  assert.equal((await c.request('/test',{})).ok,true);
});
test('sign-in network errors do not suggest generating or checking a code',async()=>{
  const c=new StudioClient(async()=>{throw new TypeError('Failed to fetch');});
  await assert.rejects(()=>c.signIn('fixture','password'),e=>e.code==='network'&&e.message.startsWith('Sign-in')&&!e.message.includes('generation'));
});
test('timeout and pre-send browser errors are distinguishable without secrets',async()=>{
  const c=new StudioClient(async()=>{throw new DOMException('Timed out','TimeoutError');});
  await assert.rejects(()=>c.request('/test',{p_action:'issue'}),e=>e.uncertain===true&&e.code==='timeout'&&e.message.includes('same generation'));
  c.fetch=()=>{throw new TypeError('Illegal invocation');};
  await assert.rejects(()=>c.request('/test',{p_action:'issue'}),e=>e.uncertain===false&&e.code==='browser_request');
});
test('codes have 24 digits, preserve leading zero and reject modulo-bias bytes',async()=>{
  const source={getRandomValues:a=>{a.set(Array.from({length:a.length},(_,i)=>[255,250,0,249,248,7][i%6]));return a;}};
  assert.match(generateCode(source),/^09870987/);const all=new Set();for(let i=0;i<1000;i++){const c=generateCode();assert.match(c,/^\d{24}$/);all.add(c);}assert.equal(all.size,1000);
  assert.equal(formatCode('000012345678901234567890'),'0000-1234-5678-9012-3456-7890');assert.equal((await hashCode('0'.repeat(24))).length,64);
});
test('all six prices match the specified plans',()=>assert.deepEqual(Object.values(plans).map(p=>[p[1],p[12]]),[[2,10],[4,20],[8,40]]));
test('login checks server authorization, does not trust username alone',async()=>{
  const calls=[],client=new StudioClient(async(u,o)=>{calls.push({u,...o});return response(u.includes('/token')?auth:{admin:true,username:'fixture'});});
  await client.signIn('Fixture','password');assert.equal(calls.length,2);assert.equal(JSON.parse(calls[0].body).email,'vex-fixture@accounts.invalid');assert.equal(calls[1].headers.Authorization,'Bearer fixture-token');assert.equal(calls[1].credentials,'omit');
});
test('non-admin is rejected and its local session cleared',async()=>{
  const c=new StudioClient(async u=>response(u.includes('/token')?auth:u.includes('/logout')?{}:{error:'forbidden'}));await assert.rejects(()=>c.signIn('other','password'),/not authorized/);assert.equal(c.session,null);
});
test('missing admin flag is denied even without a business error',async()=>{
  const c=new StudioClient(async u=>response(u.includes('/token')?auth:{}));await assert.rejects(()=>c.signIn('fixture','password'),/not authorized/);assert.equal(c.session,null);
});
test('account change before dispatch prevents the request entirely',async()=>{
  let calls=0;const c=new StudioClient(async()=>{calls++;return response({});});c.token=async()=>{c.epoch++;return 'old-token';};await assert.rejects(()=>c.rpc({p_action:'issue'}),/Account changed/);assert.equal(calls,0);
});
test('network failures stay uncertain instead of silently retrying issuance',async()=>{
  let calls=0;const c=new StudioClient(async()=>{calls++;throw Error('offline');});c.session={token:'token',expires:Date.now()/1000+3600};await assert.rejects(()=>c.rpc({p_action:'issue'}),e=>e.uncertain===true);assert.equal(calls,1);
});
test('logout accepts 204 and removes tokens',async()=>{const c=new StudioClient(async()=>response(null,204));c.session={token:'token'};await c.signOut();assert.equal(c.session,null);});
test('a reply from a logged-out account cannot update the new session',async()=>{
  let resolve;const c=new StudioClient(()=>new Promise(r=>resolve=r));c.session={token:'token',expires:Date.now()/1000+3600};const job=c.rpc({p_action:'list'});await new Promise(r=>setImmediate(r));c.epoch++;c.session=null;resolve(response({rows:[]}));await assert.rejects(()=>job,/Account changed/);
});
test('HTTP 500 is an unconfirmed operation; business errors are definitive',async()=>{
  const c=new StudioClient(async()=>response({},500));c.session={token:'token',expires:Date.now()/1000+3600};await assert.rejects(()=>c.rpc({p_action:'issue'}),e=>e.uncertain===true);
  c.fetch=async()=>response({error:'rate_limit'});await assert.rejects(()=>c.rpc({p_action:'issue'}),e=>e.code==='rate_limit');
});
