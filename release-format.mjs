// Shared by Code Studio and the desktop. Never execute contents of a release file.
export function versionParts(value){
  const m=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-beta\.(0|[1-9]\d*))?$/.exec(value);
  if(!m||value.length>60)throw Error('Unsupported release version.');
  return [Number(m[1]),Number(m[2]),Number(m[3]),m[4]===undefined?Infinity:Number(m[4])];
}
export function compareVersions(a,b){const x=versionParts(a),y=versionParts(b);for(let i=0;i<4;i++)if(x[i]!==y[i])return x[i]>y[i]?1:-1;return 0;}
export function validateRelease(m,trust){
  if(!m||m.schema!==1||m.platform!=='win32-x64'||!['beta','stable'].includes(m.channel))throw Error('Unsupported release format or platform.');
  versionParts(m.version);
  if((m.version.includes('-beta.'))!==(m.channel==='beta'))throw Error('Release channel does not match the version.');
  const expected=`https://github.com/${trust.repository}/releases/download/v${m.version}/Pavio-Setup-${m.version}-x64.exe`;
  if(m.url!==expected)throw Error('The installer is not from the official Pavio release location.');
  if(!/^[a-f0-9]{64}$/.test(m.sha256)||!/^[A-Za-z0-9+/]{86}==$/.test(m.sha512))throw Error('Invalid installer hashes.');
  if(!Number.isSafeInteger(m.size)||m.size<1000000||m.size>2000000000)throw Error('Invalid installer size.');
  if(typeof m.notes!=='string'||m.notes.length>6000||typeof m.createdAt!=='string'||!Number.isFinite(Date.parse(m.createdAt)))throw Error('Invalid release details.');
  return m;
}
export async function verifyRelease(envelope,trust){
  if(!envelope||envelope.keyId!==trust.keyId||typeof envelope.payload!=='string'||new TextEncoder().encode(envelope.payload).length>12000||! /^[A-Za-z0-9+/]{86}==$/.test(envelope.signature))throw Error('Invalid signed release file.');
  const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  const key=await crypto.subtle.importKey('spki',bytes(trust.publicKey),{name:'Ed25519'},false,['verify']);
  if(!await crypto.subtle.verify('Ed25519',key,bytes(envelope.signature),new TextEncoder().encode(envelope.payload)))throw Error('Release signature did not match Pavio’s trusted publisher.');
  let m;try{m=JSON.parse(envelope.payload);}catch{throw Error('Invalid release details.');}
  return validateRelease(m,trust);
}
