import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizePublicUrl, routePublicUrl, artifactPublicUrl} from '../components/publication-utils.js';
import {artifactReadiness} from '../features/artifacts/artifact-publication.js';
const origin = 'https://vitrineapp.ru';
const artifact = {id:'a-1',status:'draft',title:'Античный портрет',draft_revision:2,published_revision:0};
const screen = {id:'s-1',type:'text',title:'История',payload:JSON.stringify({content:{body:'Музейный рассказ'}})};

test('only HTTP(S) public URLs are accepted; relative paths become absolute',()=>{
 assert.equal(normalizePublicUrl('/exhibits/code-1',origin),`${origin}/exhibits/code-1`);
 for(const value of ['javascript:alert(1)','data:text/html,example','https://user:pass@example.com/','']) assert.equal(normalizePublicUrl(value,origin),'');
});

test('route QR is unavailable until server confirms a public publication',()=>{
 const route={id:'route-1',status:'published',visibility:'public',serverSaved:true};
 assert.equal(routePublicUrl(route,origin),`${origin}/routes/route-1`);
 for(const patch of [{serverSaved:false},{serverSaved:undefined},{id:''},{status:'draft'},{status:'archived'},{visibility:'team'},{visibility:'private'}]) assert.equal(routePublicUrl({...route,...patch},origin),'');
});

test('artifact public delivery uses the confirmed current object, never another publication',()=>{
 const published={...artifact,status:'published',published_revision:2,public_code:'stable-code'};
 assert.equal(artifactPublicUrl(published,{artifact_id:'a-1',public_url:'/exhibits/actual'},origin),`${origin}/exhibits/actual`);
 assert.equal(artifactPublicUrl(published,{artifact_id:'other',public_url:'/exhibits/other'},origin),`${origin}/exhibits/stable-code`);
 assert.equal(artifactPublicUrl({...published,status:'archived'},null,origin),'');
 assert.equal(artifactPublicUrl({...published,status:'draft'},null,origin),'');
 assert.equal(artifactPublicUrl({...published,published_revision:0},null,origin),'');
 assert.equal(artifactPublicUrl({...published,public_url:'javascript:alert(1)'},null,origin),'');
});

test('publication readiness reflects missing data and unsaved changes',()=>{
 const flow={artifact,draft:{title:artifact.title},screens:[screen],dirty:false};
 assert.equal(artifactReadiness(flow).canPublish,true);
 for(const patch of [{artifact:null},{draft:{title:' '}},{screens:[]},{dirty:true},{artifact:{...artifact,status:'archived'}}]) assert.equal(artifactReadiness({...flow,...patch}).canPublish,false);
});

test('incomplete quiz and model screens block publication until fixed',()=>{
 const flow={artifact,draft:{title:artifact.title}};
 assert.equal(artifactReadiness({...flow,screens:[{type:'model',title:'Модель',payload:'{}'}]}).canPublish,false);
 assert.equal(artifactReadiness({...flow,screens:[{type:'quiz',title:'Вопрос',payload:'{}'}]}).canPublish,false);
 const quiz={type:'quiz',title:'Вопрос',payload:JSON.stringify({content:{options:['Да','Нет'],correct_answer:'Да'}})};
 assert.equal(artifactReadiness({...flow,screens:[quiz]}).canPublish,true);
});

test('an unchanged publication is not published twice, while a newer draft is publishable',()=>{
 const published={...artifact,status:'published',published_revision:2};
 const flow={artifact:published,draft:{title:artifact.title},screens:[screen]};
 assert.equal(artifactReadiness(flow).published,true);
 assert.equal(artifactReadiness(flow).canPublish,false);
 assert.equal(artifactReadiness({...flow,artifact:{...published,draft_revision:3}}).canPublish,true);
});
