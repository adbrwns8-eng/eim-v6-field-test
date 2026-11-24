import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {workflowFixture,id,photo} from './manager-workflow-fixture.mjs';
const fixture=await workflowFixture();let browser;
const APP='https://adbrwns8-eng.github.io/eim-v6-field-test/';
const ENDPOINT='https://abnydnnafyosrakkgajy.supabase.co/functions/v1/b23-manager-workflow';
const LEGACY='https://abnydnnafyosrakkgajy.supabase.co/functions/v1/v6-test1-api';
const files=new Set(['index.html','manager.html','inspection.html','corrective.html','verify.html','b23-workflow-client.js','manager-v23.js','inspection-v23.js','app-v12.js','morning-v2.js','tab-sync.js']);
const blocked=[],errors=[],mockErrors=[];let checks=0;
const check=(value,message)=>{assert.ok(value,message);checks++;};
try{
 browser=await chromium.launch({headless:true,...(process.env.BOS_BROWSER_EXECUTABLE?{executablePath:process.env.BOS_BROWSER_EXECUTABLE}:{})});
 async function page(){
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
  context.setDefaultTimeout(12000);
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   try{
    if(request.url()===ENDPOINT&&request.method()==='POST'){
     const response=await fixture.handler(new Request(request.url(),{method:'POST',headers:await request.allHeaders(),body:request.postData()}));
     return await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
    }
    if(url.origin===new URL(LEGACY).origin&&url.pathname===new URL(LEGACY).pathname&&request.method()==='POST'){
     // Read-only legacy home response deliberately has zero tasks to reproduce the bad counter.
     const action=url.searchParams.get('a');let response;
     if(action==='login')response={employee_id:id(1),name:'Test Trainer',access_level:'manager',role:'Plant Manager'};
     else if(action==='onboarding_status')response=[{completed:true}];
     else if(action==='home')response={employee:{name:'Test Trainer',role:'Plant Manager'},tasks:[],permissions:{management:true},notice_count:0};
     else throw Error('Legacy writes/unknown routes forbidden');
     return await route.fulfill({json:response});
    }
    if(url.origin===new URL(APP).origin&&request.method()==='GET'){
     const name=url.pathname.slice(new URL(APP).pathname.length)||'index.html';
     if(files.has(name))return await route.fulfill({contentType:name.endsWith('.js')?'text/javascript':'text/html',body:await readFile(new URL('../'+name,import.meta.url),'utf8')});
    }
    blocked.push(url.origin+url.pathname);
   }catch{mockErrors.push('Local handler failed for '+url.pathname);}
   return await route.abort('blockedbyclient');
  });
  await context.routeWebSocket('**/*',socket=>{blocked.push('websocket');socket.close({code:1008,reason:'Synthetic test isolation'});});
  const p=await context.newPage();p.on('pageerror',()=>errors.push('Uncaught browser error'));
  return p;
 }
 const click=async(p,name)=>{await p.getByRole('button',{name,exact:true}).click();await p.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).some(b=>b.disabled));};
 const signin=async(p,pin)=>{await p.locator('#pin').fill(pin);await click(p,'Sign in');await p.locator('#workspace').waitFor();};
 const employee=await page();await employee.goto(APP+'inspection.html?mode=vehicle');
 await employee.locator('#pin').fill('444444');await employee.getByRole('button',{name:'CONTINUE',exact:true}).click();
 await employee.locator('#equipment').selectOption(id(20));await employee.getByRole('button',{name:'BEGIN INSPECTION',exact:true}).click();
 for(let i=0;i<16;i++)await employee.locator('.item').nth(i).getByRole('button',{name:i===3?'DEFICIENT':'PASS',exact:true}).click();
 await employee.locator('.dtext').nth(3).fill('Synthetic loose body guard');
 await employee.locator('.dphoto').nth(3).setInputFiles({name:'before.png',mimeType:'image/png',buffer:Buffer.from(photo.data_base64,'base64')});
 await employee.getByRole('button',{name:'FINISH INSPECTION',exact:true}).click();await employee.locator('#result:not(.hidden)').waitFor();
 await employee.getByRole('button',{name:'I UNDERSTAND',exact:true}).click();await employee.locator('#done:not(.hidden)').waitFor();
 const findingId=(await fixture.db.query('select id from b23_workflow.findings where source_id is null')).rows[0].id;
 check(!!findingId,'Employee browser submission persisted');
 const plant=await page();await plant.goto(APP);
 await plant.locator('#pin').fill('111111');await plant.locator('#go').click();await plant.locator('#app:not(.hidden)').waitFor();
 await plant.waitForFunction(()=>document.getElementById('badge').textContent==='2');
 check(await plant.locator('#badge').textContent()==='2','Home counter includes authoritative new and unassigned legacy findings despite zero legacy tasks');
 const unavailable=route=>route.fulfill({status:503,json:{error:'Synthetic workflow unavailable'}});
 await plant.context().route(ENDPOINT,unavailable);await plant.evaluate(()=>refresh());
 check(await plant.locator('#badge').textContent()==='—','Failed counter request is unavailable, never a false zero');
 await plant.context().unroute(ENDPOINT,unavailable);
 await plant.goto(APP+'manager.html?finding='+findingId);await plant.locator('#detail').waitFor();
 await click(plant,'Acknowledge management responsibility');
 await plant.locator('#starts').fill('2030-01-01T09:00');await plant.locator('#due').fill('2030-01-02T17:00');
 await plant.locator('#assignee').selectOption(id(2));await click(plant,'Assign / route');
 await plant.locator('#comment').fill('<img src=x onerror=alert(1)> use isolation controls');await click(plant,'Save comment');
 check(await plant.locator('#comments img').count()===0,'Comment markup is escaped');
 check(!await plant.locator('#planning').isVisible(),'Unassigned manager cannot edit assignee plan');
 const rotation=await page();await rotation.goto(APP+'manager.html?finding='+findingId);await signin(rotation,'222222');
 await rotation.locator('#controls').fill('Shut down, isolate and lock out');await rotation.locator('#plan').fill('Replace loose guard');await click(rotation,'Save plan and deadline');
 await rotation.locator('#completion-text').fill('Guard replaced and fasteners tested');await click(rotation,'Submit for independent verification');
 await rotation.getByText('Current After Repair photo required',{exact:true}).waitFor();checks++;
 await rotation.locator('#photo').setInputFiles({name:'after.png',mimeType:'image/png',buffer:Buffer.from(photo.data_base64,'base64')});
 await rotation.locator('#taken-by').fill('Synthetic mechanic');await rotation.locator('#photo-note').fill('Fasteners secured');await click(rotation,'Save After Repair photo');
 await rotation.locator('#completion-text').fill('Guard replaced and fasteners tested');await click(rotation,'Submit for independent verification');
 check(await rotation.locator('#state').textContent()==='awaiting_verification','Rotation Manager completed through actual UI');
 check(!await rotation.locator('#verification').isVisible(),'Self-verification controls hidden');
 const selfDenied=await rotation.evaluate(async findingId=>{try{const f=await BOSWorkflow.api('get',{id:findingId});await BOSWorkflow.api('verify',{id:f.id,revision:f.revision,decision:'approved',body:'Bypass'});return false;}catch{return true;}},findingId);
 check(selfDenied,'Direct API self-verification bypass rejected');
 await plant.goto(APP+'manager.html?finding='+findingId);await plant.locator('#verification').waitFor();
 await plant.locator('#verification-comment').fill('Independently inspected guard mounting');await click(plant,'Approve and close');
 check(await plant.locator('#state').textContent()==='closed','Independent Plant Manager closure persisted');
 await plant.reload();await plant.locator('#detail').waitFor();
 check(await plant.locator('#state').textContent()==='closed'&&await plant.locator('#photos img').count()===2,'Closed status and both photos survive reload');
 check(await plant.locator('#history').innerText().then(t=>t.includes('verify')),'Audit history rendered');
 const outsider=await page();await outsider.goto(APP+'manager.html');await signin(outsider,'555555');
 check(await outsider.locator('#queue .open').count()===0,'Other-facility manager sees no restricted findings');
 check(await outsider.evaluate(async findingId=>{try{await BOSWorkflow.api('get',{id:findingId});return false;}catch{return true;}},findingId),'Cross-facility direct read denied');
 check(await employee.evaluate(async findingId=>{try{const f=await BOSWorkflow.api('get',{id:findingId});await BOSWorkflow.api('comment',{id:findingId,revision:f.revision,body:'unauthorized'});return false;}catch{return true;}},findingId),'Employee direct edit denied');
 await employee.goto(APP+'inspection.html?mode=vehicle');await employee.locator('#equipment').selectOption(id(20));await employee.getByRole('button',{name:'BEGIN INSPECTION',exact:true}).click();
 for(let i=0;i<16;i++)await employee.locator('.item').nth(i).getByRole('button',{name:'PASS',exact:true}).click();
 await employee.getByRole('button',{name:'FINISH INSPECTION',exact:true}).click();await employee.getByText('All-pass / N/A inspection saved.',{exact:true}).waitFor();checks++;
 check((await fixture.db.query('select count(*) as n from b23_workflow.inspections')).rows[0].n===2,'All-pass and deficient inspections both persisted');
 await plant.goto(APP+'corrective.html?fid='+findingId);await plant.locator('#detail').waitFor();
 check(new URL(plant.url()).pathname.endsWith('/manager.html'),'Legacy corrective entry redirects to authenticated manager workflow');
 check(await plant.locator('#inspections').innerText().then(t=>t.includes('0 deficiency finding(s)')),'All-pass inspection visible in authorized manager history');
 check(!await plant.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'Mobile layout fits');
 await plant.screenshot({path:'tests/build23-mobile-qa.png',fullPage:true});
 await plant.setViewportSize({width:1280,height:900});check(!await plant.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'Desktop layout fits');
 await plant.screenshot({path:'tests/build23-desktop-qa.png',fullPage:true});
 check(await plant.evaluate(async()=>{try{await fetch('https://blocked.invalid/probe');return false;}catch{return true;}}),'Default-deny HTTP isolation probe blocked');
 assert.deepEqual(blocked,['https://blocked.invalid/probe']);
 check(await plant.evaluate(()=>new Promise(resolve=>{const socket=new WebSocket('wss://blocked.invalid/probe');socket.onclose=()=>resolve(true);socket.onerror=()=>resolve(true);setTimeout(()=>resolve(false),3000);})), 'WebSocket isolation probe blocked');
 assert.deepEqual(blocked,['https://blocked.invalid/probe','websocket']);
 assert.deepEqual(mockErrors,[]);assert.deepEqual(errors,[]);
 console.log(`${checks} Build 23 browser checks passed: employee submit/ack, home count, both manager roles, assignment/deadline, comments, actual photo upload, independent closure, persistence, facility/employee bypass denial, legacy entry redirects and default-deny network isolation.`);
}finally{await browser?.close();await fixture.db.close();}
