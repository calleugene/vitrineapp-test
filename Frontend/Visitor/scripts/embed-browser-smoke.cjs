const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const http=require('node:http');const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist');
const output=path.resolve(__dirname,'../output/embed-qa');fs.mkdirSync(output,{recursive:true});
let count=0;let mode='ready';let title='История музейного экспоната';const requests=[];
const server=http.createServer((req,res)=>{
 requests.push(req.url);
 if(req.url==='/state'){res.end(JSON.stringify({count,requests}));return;}
 if(req.url?.startsWith('/api/artifacts/api/v1/public/artifacts/')){
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
  if(req.url.endsWith('/embed-opens')){count++;res.writeHead(204).end();return;}
  if(mode!=='ready'){res.writeHead(mode==='error'?503:404).end('{}');return;}
  res.end(JSON.stringify({artifact:{id:'art_001',museum_id:'mus_001',title,short_description:'Описание экспоната'},screens:[{id:'s1',type:'text',title:'Название <span onmouseover="window.__xss=1">экспоната</span>',payload:JSON.stringify({body:'Длинное описание. '.repeat(80)})},{id:'q1',type:'quiz',title:'Проверочный вопрос',content:{options:['Да','Нет'],correct_answer:'Да',explanation:'Верный ответ — Да'}}]}));return;
 }
 const pathname=new URL(req.url,'http://localhost').pathname;
 let file=pathname.startsWith('/embed/')?'embed.html':pathname==='/'?'index.html':pathname.replace(/^\/visitor\//,'').replace(/^\//,'');
 if(pathname==='/host') {res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="ru"><title>HTML — внешний сайт музея</title><h1>Экспонат на сайте музея</h1><iframe id="exhibit" src="http://127.0.0.1:5188/embed/exhibits/AB123" title="Экспонат" width="100%" height="640" style="border:0;display:block" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"></iframe><p><a href="http://127.0.0.1:5188/exhibits/AB123">Открыть отдельно</a></p></html>');return;}
 const full=path.join(root,file);if(!full.startsWith(root)||!fs.existsSync(full)){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');
 if(file==='embed.html'){res.setHeader('Content-Security-Policy','frame-ancestors *');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=(), xr-spatial-tracking=()');}
 res.end(fs.readFileSync(full));
});
(async()=>{
 await new Promise(r=>server.listen(5188,'127.0.0.1',r));
 const host=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><title>Другой origin</title><iframe title="Экспонат" src="http://127.0.0.1:5188/embed/exhibits/AB123" width="100%" height="640" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"></iframe></html>');});
 await new Promise(r=>host.listen(5189,'127.0.0.1',r));
 const browser=await chromium.launch({...(process.env.CHROME_EXECUTABLE ? {executablePath:process.env.CHROME_EXECUTABLE} : {}),headless:true});
 try{
 const context=await browser.newContext();
 await context.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('storage blocked')}});Object.defineProperty(window,'sessionStorage',{get(){throw new Error('storage blocked')}});});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5189');
 let f=page.frameLocator('iframe');await f.locator('.story-slide.is-active').getByRole('heading',{name:'История музейного экспоната'}).waitFor();await page.waitForTimeout(250);assert.equal(count,1,'StrictMode must count once');
 await f.getByRole('button',{name:'Экран 2 из 4',exact:true}).click();await f.locator('.story-slide.is-active').getByRole('heading',{name:'Название экспоната'}).waitFor();
 assert.equal(await page.frames()[1].evaluate(()=>window.__xss),undefined);
 for(const width of [320,375,768,1024]){await page.setViewportSize({width,height:900});assert.equal(await page.frames()[1].evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow ${width}`);await page.screenshot({path:`${output}/embed-${width}.png`,fullPage:true});}
 await f.getByRole('button',{name:'Экран 3 из 4',exact:true}).click();await f.locator('.story-slide.is-active').getByRole('button',{name:'Да',exact:true}).click();await f.getByText('Верный ответ — Да').waitFor();
 await f.getByRole('button',{name:'Продолжить',exact:true}).click();await f.locator('.story-slide.is-active').getByRole('heading',{name:'История пройдена'}).waitFor();assert.equal(await f.getByText('Добавить в коллекцию').count(),0);assert.equal(await f.getByText('Оставить отзыв или задать вопрос').count(),0);
 await f.getByRole('link',{name:'Перейти на сайт Витрины'}).waitFor();assert.equal(count,1);
 const before=count;await page.goto('http://127.0.0.1:5188/embed/exhibits/AB123?preview=1');await page.getByRole('heading',{name:'История музейного экспоната'}).waitFor();assert.equal(count,before,'preview must not count');
 mode='error';await page.reload();await page.getByText('Не удалось загрузить экспонат.').waitFor();mode='ready';await page.getByRole('button',{name:'Повторить',exact:true}).click();await page.getByRole('heading',{name:'История музейного экспоната'}).waitFor();
 mode='unavailable';await page.reload();await page.getByText('Экспонат недоступен.').waitFor();
 assert.ok(!requests.some(url=>/analytics|collect|feedback|\/start|\/progress/.test(url)),requests.join('\n'));
 assert.deepEqual(errors,[]);
 fs.writeFileSync(`${output}/browser-results.json`,JSON.stringify({result:'PASS',count,widths:[320,375,768,1024],storageBlocked:true,noBehavioralRequests:true,noPageErrors:true,requests},null,2));
 console.log('PASS: cross-origin iframe, blocked storage, StrictMode count, preview exclusion, text/quiz/completion, XSS, four widths, error/retry/unavailable, no behavioral requests.');
 }finally{await browser.close();host.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
