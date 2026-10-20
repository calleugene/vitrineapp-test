// UI fixtures are confined to this test. The application always uses its backend.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseURL = process.env.PROFILE_PREVIEW_URL || 'http://127.0.0.1:15173';
const output = process.env.PROFILE_SCREENSHOT_DIR || 'tmp/profile-qa';
await mkdir(output, {recursive:true});
const browser = await chromium.launch({headless:true, channel:process.env.PROFILE_BROWSER_CHANNEL || 'msedge'});
try {
  const context = await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Europe/Berlin',permissions:['clipboard-read','clipboard-write']});
  let user = {id:'profile-fixture-user',full_name:'Анна Петрова',email:'anna@example.test',phone:'+7 999 123-45-67',about:'Создаю образовательные программы и музейные маршруты.',role:'methodist',museum_id:'museum-a',status:'ACTIVE',registered_at:'2024-09-12T10:00:00Z',last_login_at:'2026-10-17T10:30:00Z'};
  let museums = [{id:'museum-a',name:'Музей истории города',role:'owner'},{id:'museum-b',name:'Художественный музей',role:'methodist'}];
  let saves=0, selects=0, uploads=0;
  await context.addInitScript((session) => sessionStorage.setItem('vira-methodist-session',JSON.stringify(session)),{accessToken:'test-fixture-access',refreshToken:'test-fixture-refresh',user});
  await context.route('**/api/v1/**',async (route) => {
    const req=route.request(),url=new URL(req.url()),path=url.pathname;
    const body=req.postDataJSON?.bind(req);
    const send=(value,status=200) => route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
    if (path.endsWith('/auth/me')) return send({user});
    if (path.endsWith('/auth/deactivate')) {user={...user,status:'DORMANT',deactivated_at:'2026-10-17T10:00:00Z',scheduled_deletion_at:'2026-11-16T10:00:00Z'}; return send({user});}
    if (path.endsWith('/auth/reactivate')) {user={...user,status:'ACTIVE',deactivated_at:null,scheduled_deletion_at:null}; return send({user});}
    if (path.endsWith('/auth/museums/join')) {if (body().code!=='valid-test-token' || body().museum_id!=='museum-c') return send({error:'code_not_found'},404); museums=[...museums,{id:'museum-c',name:'Музей науки',role:'methodist'}];return send({museums});}
    if (path.endsWith('/auth/museums/select')) {selects++;user={...user,museum_id:body().museum_id};return send({user,access_token:'test-fixture-selected'});}
    if (path.endsWith('/auth/email-change/confirm')) {user={...user,email:'new@example.test'};return send({user});}
    if (path.endsWith('/auth/email-change')) return send({message:'email_confirmation_sent'});
    if (path.endsWith('/avatar')) {uploads++;user={...user,avatar_url:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9xkAAAAASUVORK5CYII='};return send({user});}
    if (path.endsWith('/users/profile-fixture-user/museums')) return send({museums});
    if (path.endsWith('/users/profile-fixture-user')) {if(req.method()==='PATCH'){saves++;user={...user,...body()};}return send({user});}
    if (path.endsWith('/museums/profile')) return send({museum:{id:user.museum_id,name:museums.find((m)=>m.id===user.museum_id)?.name || 'Музей',address:'Москва',logo_url:''}});
    if (path.endsWith('/artifacts')) return send({artifacts:[]});
    return send({});
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',(error)=>errors.push(error.message));
  await page.goto(`${baseURL}/user-profile`);
  await page.getByRole('heading',{name:'Редактирование профиля'}).waitFor();
  const save=page.getByRole('button',{name:'Сохранить изменения',exact:true});assert.equal(await save.isDisabled(),true);
  await page.screenshot({animations:'disabled',path:`${output}/desktop.png`,fullPage:true});
  await page.getByLabel('Имя *',{exact:true}).fill('Елена');assert.equal(saves,0);
  await save.click();await page.getByText('Изменения сохранены',{exact:true}).waitFor();assert.equal(saves,1);
  await page.getByLabel('Email *',{exact:true}).fill('new@example.test');await save.click();await page.getByRole('dialog').waitFor();
  assert.equal(user.email,'anna@example.test');await page.getByLabel('Код из письма').fill('confirmation-fixture-token');await page.getByRole('button',{name:'Подтвердить',exact:true}).click();await page.getByText('Новый email подтверждён',{exact:true}).waitFor();assert.equal(user.email,'new@example.test');
  await page.getByRole('button',{name:'Скопировать ID пользователя'}).click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),user.id);
  await page.getByLabel('Фотография профиля').setInputFiles({name:'avatar.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9xkAAAAASUVORK5CYII=','base64')});
  assert.equal(uploads,0);await page.getByRole('button',{name:'Сохранить фото',exact:true}).click();await page.getByText('Фото профиля обновлено',{exact:true}).waitFor();assert.equal(uploads,1);assert.equal(await page.locator('.account-trigger img').count(),1);
  await page.getByRole('button',{name:'Добавить музей',exact:true}).click();await page.getByLabel('ID музея',{exact:true}).fill('museum-c');await page.getByLabel('Код подключения музея').fill('invalid');await page.getByRole('button',{name:'Подключиться',exact:true}).click();await page.getByText('Код не найден.',{exact:false}).waitFor();
  await page.getByLabel('Код подключения музея').fill('valid-test-token');await page.getByRole('button',{name:'Подключиться',exact:true}).click();await page.getByRole('button',{name:'Музей науки Методист'}).waitFor();
  await page.getByRole('button',{name:/Переключить музей/}).click();await page.getByRole('menuitem',{name:/Музей науки/}).waitFor();await page.screenshot({animations:'disabled',path:`${output}/museum-switcher.png`});await page.keyboard.press('Escape');
  await page.getByText('Музей успешно подключён',{exact:true}).waitFor({state:'hidden'});await page.setViewportSize({width:390,height:844});await page.screenshot({animations:'disabled',path:`${output}/mobile.png`,fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth),true,'mobile page overflows');
  await page.getByRole('button',{name:'Открыть меню',exact:true}).click();await page.getByRole('button',{name:/Переключить музей/}).click();await page.getByRole('menuitem',{name:/Музей науки/}).waitFor();await page.screenshot({animations:'disabled',path:`${output}/museum-switcher-mobile.png`});await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Деактивировать аккаунт',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Деактивировать аккаунт',exact:true}).click();
  await page.getByRole('heading',{name:'Аккаунт деактивирован'}).waitFor();await page.screenshot({animations:'disabled',path:`${output}/recovery.png`,fullPage:true});
  await page.reload();await page.getByRole('heading',{name:'Аккаунт деактивирован'}).waitFor();assert.equal(user.status,'DORMANT');
  await page.getByRole('button',{name:'Активировать аккаунт',exact:true}).click();await page.waitForURL('**/dashboard');assert.equal(user.status,'ACTIVE');
  await page.goto(`${baseURL}/user-profile`);await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:/Переключить музей/}).click();await page.getByRole('menuitem',{name:/Художественный музей/}).click();await page.waitForURL('**/museum');assert.equal(user.museum_id,'museum-b');assert.equal(selects,1);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,checks:['explicit save','email confirmation','avatar upload and header','copy user ID','invalid/valid invitation','mobile layout','deactivation','dormant reload','reactivation','sidebar context switch','joined museum appears in sidebar'],saves,selects,uploads,screenshots:output}));
  await context.close();
} finally {await browser.close();}


