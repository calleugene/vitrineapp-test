import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Buffer} from 'node:buffer';
import test from 'node:test';

const source = await readFile(new URL('../api.js', import.meta.url), 'utf8');
const config = `const API_PREFIX='/api/v1';const SESSION_STORAGE_KEY='test';const DEFAULT_MUSEUM_ID='museum-a';const DEFAULT_USER_ID='legacy-user';const API_URLS={auth:'/api/auth',artifacts:'/api/artifacts',routes:'/api/route',dashboard:'/api/dashboard',analytics:'/api/analytics',feedback:'/api/feedback',notifications:'/api/notification'};`;
const original = {accessToken:'old-access',refreshToken:'old-refresh',tokenType:'Bearer',user:{id:'user-a',museum_id:'museum-a'}};
const rotated = {access_token:'new-access',refresh_token:'new-refresh',token_type:'Bearer',expires_in:900};
const unauthorized = () => Response.json({error:{code:'unauthorized'}},{status:401});
const isRefresh = (url) => url.endsWith('/auth/refresh');
let sequence = 0;

async function fixture(t, handler) {
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  let session = structuredClone(original);
  const calls = [];
  globalThis.window = {sessionStorage:{
    getItem:() => session ? JSON.stringify(session) : null,
    setItem:(_key,value) => {session=JSON.parse(value);},
    removeItem:() => {session=null;},
  }};
  globalThis.fetch = async (url,options) => {calls.push({url,...options});return handler(url,options,calls);};
  t.after(() => {globalThis.window=previousWindow;globalThis.fetch=previousFetch;});
  const moduleSource = source.replace(/^import[^\n]+\n/,config+'\n')+`\n// fixture ${sequence++}`;
  const api = await import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString('base64')}`);
  return {api,calls,getSession:()=>session,setSession:(value)=>{session=value;}};
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => {resolve=done;});
  return {promise,resolve};
}

 test('expired token rotates both credentials and retries PATCH with identical body and museum', async (t) => {
  const f = await fixture(t,async (url,options) => {
    if(isRefresh(url)) {assert.deepEqual(JSON.parse(options.body),{refresh_token:'old-refresh'});assert.equal(options.headers.Authorization,undefined);return Response.json(rotated);}
    if(options.headers.Authorization==='Bearer old-access') return unauthorized();
    assert.equal(options.headers.Authorization,'Bearer new-access');
    return Response.json({ok:true});
  });
  const changes=[];const unsubscribe=f.api.subscribeSessionRefresh((value)=>changes.push(value));
  await f.api.routeApi.update('route-1',{title:'Музейный маршрут'});
  assert.equal(f.calls.length,3);
  assert.equal(f.calls[0].body,f.calls[2].body);
  assert.equal(f.calls[2].method,'PATCH');
  assert.equal(f.calls[2].headers['X-Museum-ID'],'museum-a');
  assert.equal(f.getSession().refreshToken,'new-refresh');
  assert.equal(changes.length,1);
  assert.equal(changes[0].accessToken,'new-access');
  const reconciled=f.api.reconcileRefreshedSession({...original,user:{...original.user,full_name:'Updated'}});
  assert.equal(reconciled.accessToken,'new-access');assert.equal(reconciled.refreshToken,'new-refresh');assert.equal(reconciled.user.full_name,'Updated');
  // Museum selection issues a distinct access token but must retain the rotated refresh token.
  assert.equal(f.api.reconcileRefreshedSession({...original,accessToken:'selected-museum-token'}).refreshToken,'new-refresh');
  unsubscribe();
});

test('concurrent protected requests share one refresh', async (t) => {
  const gate=deferred();const started=deferred();let refreshes=0;
  const f=await fixture(t,async (url,options)=>{
    if(isRefresh(url)){refreshes++;started.resolve();await gate.promise;return Response.json(rotated);}
    return options.headers.Authorization==='Bearer old-access'?unauthorized():Response.json({user:original.user,artifacts:[]});
  });
  const requests=Promise.all([f.api.authApi.me('old-access'),f.api.artifactsApi.list(),f.api.dashboardApi.summary()]);
  await started.promise;gate.resolve();await requests;
  assert.equal(refreshes,1);
  assert.equal(f.calls.filter(c=>c.headers.Authorization==='Bearer new-access').length,3);
});

test('a delayed 401 reuses completed rotation without spending refresh token twice', async (t)=>{
  const late=deferred();const started=deferred();let refreshes=0;
  const f=await fixture(t,async(url,options)=>{
    if(isRefresh(url)){refreshes++;return Response.json(rotated);}
    if(url.includes('/dashboard/')&&options.headers.Authorization==='Bearer old-access'){started.resolve();await late.promise;return unauthorized();}
    return options.headers.Authorization==='Bearer old-access'?unauthorized():Response.json({user:original.user});
  });
  const delayed=f.api.dashboardApi.summary();await started.promise;
  await f.api.authApi.me('old-access');late.resolve();await delayed;
  assert.equal(refreshes,1);
  // A caller holding old React state also uses the already rotated token immediately.
  await f.api.authApi.me('old-access');assert.equal(refreshes,1);
  assert.equal(f.calls.at(-1).headers.Authorization,'Bearer new-access');
});

for(const status of [401,403]) test(`refresh ${status} ends the session without replay`,async(t)=>{
  const f=await fixture(t,async(url)=>isRefresh(url)?Response.json({error:{code:'unauthorized'}},{status}):unauthorized());
  const changes=[];f.api.subscribeSessionRefresh(s=>changes.push(s));
  await assert.rejects(f.api.authApi.me('old-access'),e=>e.status===status);
  assert.equal(f.getSession(),null);assert.deepEqual(changes,[null]);assert.equal(f.calls.length,2);
});

for(const failure of ['network','server','invalid-payload']) test(`temporary ${failure} refresh failure retains credentials and allows a later attempt`,async(t)=>{
  let attempts=0;
  const f=await fixture(t,async(url,options)=>{
    if(isRefresh(url)){
      if(attempts++===0){if(failure==='network')throw new TypeError('offline');return failure==='server'?Response.json({error:{code:'service_unavailable'}},{status:503}):Response.json({});}
      return Response.json(rotated);
    }
    return options.headers.Authorization==='Bearer old-access'?unauthorized():Response.json({user:original.user});
  });
  await assert.rejects(f.api.authApi.me('old-access'));
  assert.deepEqual(f.getSession(),original);
  await f.api.authApi.me('old-access');assert.equal(f.getSession().accessToken,'new-access');assert.equal(attempts,2);
});

test('a second protected 401 stops after one retry and ends the current session',async(t)=>{
  const f=await fixture(t,async(url)=>isRefresh(url)?Response.json(rotated):unauthorized());
  await assert.rejects(f.api.artifactsApi.list(),e=>e.status===401);
  assert.equal(f.calls.length,3);assert.equal(f.getSession(),null);
});

for(const change of ['logout','login','museum']) test(`${change} while refresh is pending cannot be overwritten or replayed`,async(t)=>{
  const gate=deferred();const started=deferred();
  const f=await fixture(t,async(url)=>{
    if(isRefresh(url)){started.resolve();await gate.promise;return Response.json(rotated);}
    return unauthorized();
  });
  const request=f.api.authApi.me('old-access');const rejected=assert.rejects(request,e=>e.status===401);
  await started.promise;
  const replacement=change==='logout'?null:{...original,accessToken:'other-access',refreshToken:change==='login'?'other-refresh':original.refreshToken,user:{id:change==='login'?'user-b':'user-a',museum_id:'museum-b'}};
  f.setSession(replacement);gate.resolve();await rejected;
  assert.deepEqual(f.getSession(),replacement);assert.equal(f.calls.length,2);
});

test('ordinary forbidden response never refreshes or clears the session',async(t)=>{
  const f=await fixture(t,async()=>Response.json({error:{code:'forbidden'}},{status:403}));
  await assert.rejects(f.api.artifactsApi.list(),e=>e.status===403);
  assert.equal(f.calls.length,1);assert.deepEqual(f.getSession(),original);
});

test('invalid login and logout never trigger refresh',async(t)=>{
  const f=await fixture(t,async()=>unauthorized());
  await assert.rejects(f.api.authApi.login({email:'name@example.com',password:'wrong'}));
  await assert.rejects(f.api.authApi.logout('old-access','old-refresh'));
  assert.equal(f.calls.length,2);assert.deepEqual(f.getSession(),original);
});

test('QR download retries with a fresh bearer token and returns the binary body',async(t)=>{
  const f=await fixture(t,async(url,options)=>{
    if(isRefresh(url))return Response.json(rotated);
    return options.headers.Authorization==='Bearer old-access'?unauthorized():new Response('png-data',{headers:{'Content-Type':'image/png'}});
  });
  const blob=await f.api.artifactsApi.getQRCode('artifact-1');
  assert.equal(await blob.text(),'png-data');assert.equal(f.calls.length,3);
});

test('multipart retry preserves FormData and lets the browser set its boundary',async(t)=>{
  const f=await fixture(t,async(url,options)=>isRefresh(url)?Response.json(rotated):options.headers.Authorization==='Bearer old-access'?unauthorized():Response.json({ok:true}));
  await f.api.artifactsApi.uploadCover('artifact-1',new Blob(['image'],{type:'image/png'}));
  assert.equal(f.calls[0].body,f.calls[2].body);assert.ok(f.calls[2].body instanceof FormData);assert.equal(f.calls[2].headers['Content-Type'],undefined);
});

test('mock sessions and absent sessions do not refresh',async(t)=>{
  const f=await fixture(t,async()=>unauthorized());
  f.setSession({...original,isMock:true});await assert.rejects(f.api.artifactsApi.list());
  f.setSession(null);await assert.rejects(f.api.artifactsApi.list());
  assert.equal(f.calls.length,2);
});

test('a stale profile result cannot restore a session after completed rotation and logout',async(t)=>{
  const f=await fixture(t,async(url,options)=>isRefresh(url)?Response.json(rotated):options.headers.Authorization==='Bearer old-access'?unauthorized():Response.json({user:original.user}));
  await f.api.authApi.me('old-access');f.setSession(null);
  assert.equal(f.api.reconcileRefreshedSession(original),null);
});
