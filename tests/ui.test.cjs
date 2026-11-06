/* Isolated application fixture. No connection to real accounts or customer codes. */
const path=require('node:path'),fs=require('node:fs/promises'),http=require('node:http');
const assert=require('node:assert/strict');
if(!process.versions.electron){
  const electron=require(process.env.PAVIO_ELECTRON_PATH||path.resolve(__dirname,'../../learning-helper-userscript-github/browser-source/node_modules/electron'));
  const child=require('node:child_process').spawn(electron,[__filename],{stdio:'inherit',windowsHide:true});
  child.on('exit',code=>process.exit(code||0));
}else{
  const {app,BrowserWindow,session}=require('electron');
  app.setPath('userData',path.resolve(__dirname,'../.qa/electron'));
  const origin='https://bescumcfyltymxlkbhqw.supabase.co';
  let server,win,issued=[],requests=[],holdList=false,releaseList=null,failIssue=false,deny=false,listCalls=0,errors=[];
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const run=code=>win.webContents.executeJavaScript(code,true);
  const ready=async(code)=>{for(let i=0;i<100;i++){if(await run(code))return;await wait(30);}throw Error('Timed out: '+code);};
  const click=id=>run(`document.getElementById(${JSON.stringify(id)}).click()`);
  const login=async()=>{await run(`document.getElementById('username').value='fixture';document.getElementById('password').value='fixture-only';document.getElementById('login-form').requestSubmit()`);await ready(`!document.getElementById('dashboard').hidden`);};
  const snapshotRows=()=>issued.map(({code_hash,plan,months,revoked})=>({code_hash,plan,months,revoked,issued_at:'2026-11-05T19:00:00Z',redeem_before:'2027-02-03T19:00:00Z',redeemed_at:null,status:revoked?'revoked':'available'})).reverse();
  const reply=(data,status=200)=>new Response(status===204?null:JSON.stringify(data),{status,headers:{'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'*'}});
  const report=name=>console.log('PASS '+name);
  app.whenReady().then(async()=>{
    const partition=session.fromPartition('code-studio-fixture');
    await partition.protocol.handle('https',async req=>{
      if(!req.url.startsWith(origin+'/'))throw Error('Unexpected external request: '+req.url);
      if(req.method==='OPTIONS')return reply({});
      const body=await req.json();
      if(req.url.includes('/token'))return reply({access_token:'fixture',refresh_token:'fixture-refresh',expires_at:Date.now()/1000+3600,user:{id:'fixture',app_metadata:{application:'vex',username:'fixture'}}});
      if(req.url.includes('/logout'))return reply(null,204);
      requests.push(body);
      if(body.p_action==='status')return reply(deny?{error:'forbidden'}:{admin:true,username:'fixture'});
      if(body.p_action==='list'){
        listCalls++;const rows=snapshotRows();
        if(holdList){holdList=false;await new Promise(r=>releaseList=r);}
        return reply({rows});
      }
      if(body.p_action==='issue'){
        const old=issued.find(r=>r.request===body.p_request);
        if(!old)issued.push({request:body.p_request,code_hash:body.p_hash,plan:body.p_plan,months:body.p_months,revoked:false});
        if(failIssue){failIssue=false;return reply({},503);}
        return reply({issued:true,code_hash:body.p_hash,plan:body.p_plan,months:body.p_months,redeem_before:'2027-02-03T19:00:00Z',replayed:!!old});
      }
      if(body.p_action==='revoke'){issued.find(r=>r.code_hash===body.p_hash).revoked=true;return reply({revoked:true});}
      throw Error('Unknown fixture request');
    });
    server=http.createServer(async(req,res)=>{
      const file=new URL(req.url,'http://fixture').pathname.slice(1)||'index.html';
      if(!['index.html','style.css','client.mjs','app.mjs','logo.png'].includes(file)){res.writeHead(404).end();return;}
      const body=await fs.readFile(path.join(__dirname,'..',file));
      res.writeHead(200,{'Content-Type':file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html'}).end(body);
    });
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    win=new BrowserWindow({width:1280,height:1000,show:false,webPreferences:{session:partition,contextIsolation:true,nodeIntegration:false,sandbox:true,offscreen:true,backgroundThrottling:false}});
    win.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message);});
    await win.loadURL('http://127.0.0.1:'+server.address().port+'/');
    await ready(`typeof document.getElementById('login-form').onsubmit==='function'`);await wait(300);
    await fs.mkdir(path.join(__dirname,'../.qa'),{recursive:true});
    await fs.writeFile(path.join(__dirname,'../.qa/login-desktop.png'),(await win.webContents.capturePage()).toPNG());
    deny=true;await run(`document.getElementById('username').value='fixture';document.getElementById('password').value='fixture-only';document.getElementById('login-form').requestSubmit()`);
    await ready(`document.getElementById('login-status').textContent.includes('not authorized')`);
    assert.equal(await run(`document.getElementById('dashboard').hidden`),true);report('non-admin stays on sign-in');
    deny=false;holdList=true;await login();await ready(`document.getElementById('history-status').textContent.includes('Loading')`);
    for(const [plan,prices] of Object.entries({basic:[2,10],plus:[4,20],pro:[8,40]}))for(const [i,term]of [1,12].entries()){
      await run(`document.querySelector('[name=plan][value=${plan}]').click();document.querySelector('[name=term][value="${term}"]').click()`);
      assert.equal(await run(`document.getElementById('selection-price').textContent`),'$'+prices[i]);
    }report('all six plan/term controls and prices');
    await run(`document.getElementById('generate').click();document.getElementById('generate').click()`);
    await ready(`!document.getElementById('code-result').hidden`);
    assert.equal(issued.length,1);assert.match(await run(`document.getElementById('new-code').value`),/^\d{4}(?:-\d{4}){5}$/);report('double click produces exactly one 24-digit code');
    const oldCount=listCalls;releaseList();await ready(`document.querySelectorAll('#history-rows tr').length===1`);assert.ok(listCalls>oldCount);report('history refresh queued after generation during an older load');
    await run(`window.confirm=()=>true;void 0`);failIssue=true;await click('generate');await ready(`!document.getElementById('retry').hidden&&!document.getElementById('retry').disabled`);
    assert.equal(await run(`document.getElementById('code-result').hidden`),true);
    await click('retry');await ready(`!document.getElementById('code-result').hidden`);
    const issueRequests=requests.filter(r=>r.p_action==='issue');assert.equal(issueRequests.at(-1).p_request,issueRequests.at(-2).p_request);assert.equal(issueRequests.at(-1).p_hash,issueRequests.at(-2).p_hash);assert.equal(issued.length,2);report('uncertain response retries same code and same request');
    await run(`Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw Error('fixture denied')}}});void 0`);await click('copy');await ready(`document.getElementById('action-status').textContent.includes('selected')`);report('clipboard denial provides manual-copy fallback');
    await ready(`document.querySelectorAll('#history-rows tr').length===2`);
    await fs.writeFile(path.join(__dirname,'../.qa/dashboard-desktop.png'),(await win.webContents.capturePage()).toPNG());
    await run(`document.querySelector('#history-rows button').click()`);await ready(`document.getElementById('revoke-dialog').open`);await click('confirm-revoke');await ready(`document.querySelector('#history-rows .revoked')!==null`);report('confirmed unused-code revocation updates history');
    holdList=true;await click('refresh-history');await ready(`document.getElementById('refresh-history').disabled`);
    await click('signout');await ready(`!document.getElementById('login-view').hidden&&!document.getElementById('login').disabled`);
    assert.equal(await run(`document.getElementById('new-code').value`),'');assert.equal(await run(`document.querySelectorAll('#history-rows tr').length`),0);
    await login();await ready(`document.querySelectorAll('#history-rows tr').length===2`);releaseList();await wait(100);report('sign-out clears data; stale history cannot block a new session');
    assert.equal(await run(`localStorage.length+sessionStorage.length`),0);report('no password, code, or token persistence');
    win.setContentSize(390,844);await wait(150);
    await fs.writeFile(path.join(__dirname,'../.qa/dashboard-mobile.png'),(await win.webContents.capturePage()).toPNG());
    assert.equal(await run(`document.documentElement.scrollWidth<=innerWidth`),true,await run(`JSON.stringify({width:innerWidth,overflow:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth).map(e=>({tag:e.tagName,id:e.id,cls:e.className,right:e.getBoundingClientRect().right})).slice(0,20)})`));
    await click('signout');await ready(`!document.getElementById('login-view').hidden`);await fs.writeFile(path.join(__dirname,'../.qa/login-mobile.png'),(await win.webContents.capturePage()).toPNG());report('mobile 390px layout has no page overflow');
    assert.deepEqual(errors,[]);report('no renderer/CSP errors');
    console.log('PASS isolated UI checks; no live backend requests or real codes');
  }).catch(async e=>{console.error(e);console.error('Fixture diagnostics',JSON.stringify({errors,requests,ui:win?await run(`({login:document.getElementById('login-status').textContent,action:document.getElementById('action-status').textContent})`):null}));process.exitCode=1;}).finally(()=>{win?.destroy();server?.close();app.exit(process.exitCode||0);});
}
