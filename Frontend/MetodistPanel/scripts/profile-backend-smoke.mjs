// Run only against isolated QA databases. This script creates two accounts and a museum.
import assert from 'node:assert/strict';
const auth = process.env.PROFILE_AUTH_QA_URL;
const artifacts = process.env.PROFILE_ARTIFACTS_QA_URL;
if (!auth || !artifacts) throw new Error('Set PROFILE_AUTH_QA_URL and PROFILE_ARTIFACTS_QA_URL for isolated services');
let calls = 0;
async function request(base,path,{method='GET',body,token,expected=200}={}) {
  const response = await fetch(`${base}/api/v1${path}`,{method,headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const payload = response.status===204 ? null : await response.json();
  assert.equal(response.status,expected,`${method} ${path}: ${JSON.stringify(payload)}`);calls++;return payload;
}
const documents=await request(auth,'/auth/legal-documents');
const consents=documents.filter((doc)=>['personal_data','marketing'].includes(doc.type)).map((doc)=>({type:doc.type,version:doc.version,accepted:doc.type==='personal_data'}));
const run=Date.now();
async function createAccount(suffix) {
  const email=`profile-qa-${run}-${suffix}@example.test`,password='isolated profile test password';
  await request(auth,'/auth/register',{method:'POST',body:{email,password,full_name:`Тест ${suffix}`,consents},expected:201});
  const tokens=await request(auth,'/auth/login',{method:'POST',body:{email,password}});
  const {user}=await request(auth,'/auth/me',{token:tokens.access_token});
  return {user,token:tokens.access_token,email,password};
}
const owner=await createAccount('owner'),member=await createAccount('member');
await request(artifacts,'/museums/profile',{method:'POST',token:owner.token,body:{name:'Музей интеграционного теста',address:'Тестовый адрес'},expected:201});
const initial=await request(auth,`/users/${member.user.id}/museums`,{token:member.token});assert.equal(initial.museums.length,0);
const invitation=await request(auth,'/auth/museums/code',{method:'POST',token:owner.token});
await request(auth,'/auth/museums/join',{method:'POST',token:member.token,body:{museum_id:owner.user.museum_id,code:'wrong'},expected:404});
const joined=await request(auth,'/auth/museums/join',{method:'POST',token:member.token,body:{museum_id:owner.user.museum_id,code:invitation.code}});assert.equal(joined.museums[0].name,'Музей интеграционного теста');
await request(auth,'/auth/museums/join',{method:'POST',token:member.token,body:{museum_id:owner.user.museum_id,code:invitation.code},expected:409});
const selected=await request(auth,'/auth/museums/select',{method:'POST',token:member.token,body:{museum_id:owner.user.museum_id}});member.token=selected.access_token;
const museum=await request(artifacts,'/museums/profile',{token:member.token});assert.equal(museum.museum.museum_id,owner.user.museum_id);
await request(auth,'/auth/museums/code',{method:'POST',token:member.token,expected:403});
await request(auth,`/users/${member.user.id}`,{method:'PATCH',token:member.token,body:{full_name:'Новое Имя',phone:'+7 123 123-45-67',about:'О себе'}});
const emailChange=await request(auth,'/auth/email-change',{method:'POST',token:member.token,body:{email:`profile-new-${run}@example.test`}});
assert.ok(emailChange.debug_token,'QA AuthService must enable debug tokens; never enable this in production');
await request(auth,'/auth/email-change/confirm',{method:'POST',token:member.token,body:{token:emailChange.debug_token}});
const dormant=await request(auth,'/auth/deactivate',{method:'POST',token:member.token});assert.equal(dormant.user.status,'DORMANT');
assert.equal(new Date(dormant.user.scheduled_deletion_at)-new Date(dormant.user.deactivated_at),30*24*3600*1000);
await request(artifacts,'/museums/profile',{method:'PATCH',token:member.token,body:{name:'Запрещённая правка'},expected:403});
await request(auth,`/users/${member.user.id}`,{method:'PATCH',token:member.token,body:{about:'Запрещено'},expected:403});
const retained=await request(artifacts,'/museums/profile',{token:owner.token});assert.equal(retained.museum.name,'Музей интеграционного теста');
await request(auth,'/auth/reactivate',{method:'POST',token:member.token});
await request(artifacts,'/museums/profile',{method:'PATCH',token:member.token,body:{name:'Музей после восстановления'}});
await request(auth,'/auth/museums/code',{method:'DELETE',token:owner.token,expected:204});
await request(auth,'/auth/museums/join',{method:'POST',token:member.token,body:{museum_id:owner.user.museum_id,code:invitation.code},expected:410});
console.log(JSON.stringify({passed:true,requests:calls,checks:['real AuthService + ArtifactsService','PostgreSQL','museum metadata contract','opaque invitation','duplicates','context switch','email confirmation','DORMANT blocks existing token','organization data preserved','reactivation','code revocation']}));
