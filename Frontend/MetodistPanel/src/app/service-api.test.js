import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Buffer} from 'node:buffer';
import test from 'node:test';

test('service mutations retain bearer and museum headers; notifications use the signed session', async () => {
  const source = await readFile(new URL('../api.js',import.meta.url),'utf8');
  const config = `const API_PREFIX='/api/v1';const SESSION_STORAGE_KEY='test';const DEFAULT_MUSEUM_ID='museum-a';const DEFAULT_USER_ID='legacy-user';const API_URLS={auth:'/api/auth',artifacts:'/api/artifacts',routes:'/api/route',dashboard:'/api/dashboard',analytics:'/api/analytics',feedback:'/api/feedback',notifications:'/api/notification'};`;
  const moduleSource = source.replace(/^import[^\n]+\n/,config+'\n');
  const previousWindow=globalThis.window;const previousFetch=globalThis.fetch;const calls=[];
  globalThis.window={sessionStorage:{getItem:()=>JSON.stringify({accessToken:'signed-session',user:{museum_id:'museum-a'}})}};
  globalThis.fetch=async (url,options) => {calls.push({url,...options});return Response.json({items:[]});};
  try {
    const api=await import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString('base64')}`);
    await api.routeApi.create({title:'Route',artifact_ids:['a1']});
    await api.routeApi.update('r1',{status:'published'});
    await api.routeApi.addArtifact('r1',{artifact_id:'a1',order:0});
    await api.routeApi.reorderArtifacts('r1',['a1']);
    await api.feedbackApi.reply('f1','Museum answer','published',1);
    await api.feedbackApi.moderate('f1','published',1);
    for (const call of calls) {
      assert.equal(call.headers.Authorization,'Bearer signed-session',call.url);
      assert.equal(call.headers['X-Museum-ID'],'museum-a',call.url);
      assert.equal(call.headers['Content-Type'],'application/json',call.url);
    }
    await api.notificationApi.list();
    assert.equal(calls.at(-1).headers.Authorization,'Bearer signed-session');
    assert.equal(calls.at(-1).headers['X-User-ID'],undefined);
  } finally {globalThis.window=previousWindow;globalThis.fetch=previousFetch;}
});
