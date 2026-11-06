// Isolated Chromium transport regression. No real accounts or backend requests.
const path=require('node:path'),http=require('node:http'),fs=require('node:fs/promises'),assert=require('node:assert/strict');
if(!process.versions.electron){
  const electron=require(process.env.PAVIO_ELECTRON_PATH||path.resolve(__dirname,'../../learning-helper-userscript-github/browser-source/node_modules/electron'));
  const child=require('node:child_process').spawn(electron,[__filename],{stdio:'inherit',windowsHide:true});
  child.on('exit',code=>process.exit(code||0));
}else{
  const {app,BrowserWindow,session}=require('electron');
  app.setPath('userData',path.resolve(__dirname,'../.qa/native-fetch'));
  let server,win,requests=0;
  app.whenReady().then(async()=>{
    const isolated=session.fromPartition('native-fetch-regression');
    await isolated.protocol.handle('https',async req=>{
      assert.ok(req.url.startsWith('https://bescumcfyltymxlkbhqw.supabase.co/'));
      requests++;
      return new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json','access-control-allow-origin':'*'}});
    });
    const source=process.env.PAVIO_STUDIO_CLIENT||path.resolve(__dirname,'../client.mjs');
    server=http.createServer(async(req,res)=>{
      if(req.url==='/client.mjs'){res.writeHead(200,{'Content-Type':'text/javascript'}).end(await fs.readFile(source));return;}
      res.writeHead(200,{'Content-Type':'text/html'}).end('<!doctype html><title>Isolated native fetch test</title>');
    });
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    win=new BrowserWindow({show:false,webPreferences:{session:isolated,nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});
    await win.loadURL('http://127.0.0.1:'+server.address().port+'/');
    const result=await win.webContents.executeJavaScript(`(async()=>{
      const {StudioClient}=await import('/client.mjs');
      const unbound={fetch:window.fetch};let raw;
      try{await unbound.fetch(location.href);raw='accepted';}catch(e){raw=e.name+': '+e.message;}
      try{const data=await new StudioClient().request('/rest/v1/rpc/pavio_code_studio',{p_action:'status'});return {raw,ok:data.ok};}
      catch(e){return {raw,ok:false,error:e.message};}
    })()`);
    console.log(JSON.stringify({result,requests}));
    assert.equal(result.ok,true,'Native browser fetch must be invoked with the proper receiver');
    assert.equal(requests,1,'Exactly one transport request expected');
    console.log('PASS real Chromium native fetch, no transport mocking in client, one isolated request');
  }).catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>{win?.destroy();server?.close();app.exit(process.exitCode||0);});
}
