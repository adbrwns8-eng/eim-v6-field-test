import {JSDOM} from 'jsdom';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
const db=await fixture();await db.exec('set role service_role');let handler;
globalThis.Deno={env:{get:key=>key==='SUPABASE_URL'?'https://test.local':'test-service-key'},serve:fn=>handler=fn};
globalThis.fetch=async(url,opts)=>{assert.equal(url,'https://test.local/rest/v1/rpc/b23_onboarding');assert.equal(opts.headers.apikey,'test-service-key');const b=JSON.parse(opts.body);try{const result=await db.query('select public.b23_onboarding($1,$2,$3::jsonb) as result',[b.p_action,b.p_token,JSON.stringify(b.p_data)]);return Response.json(result.rows[0].result);}catch(e){console.error('Test SQL error:',e.code,e.message);return Response.json({code:e.code,message:e.message},{status:400});}};
await import('../supabase/functions/b23-onboarding/index.ts');
const endpoint='https://abnydnnafyosrakkgajy.supabase.co/functions/v1/b23-onboarding';
assert.equal((await handler(new Request(endpoint,{method:'GET'}))).status,405);
assert.equal((await handler(new Request(endpoint,{method:'POST',headers:{Origin:'https://untrusted.example'},body:'{}'}))).status,403);
assert.equal((await handler(new Request(endpoint,{method:'POST',body:JSON.stringify({action:'home'})}))).status,401);
assert.equal((await handler(new Request(endpoint,{method:'POST',body:JSON.stringify({action:'sign',data:{image:'not-an-image'}})}))).status,400);
let dom;
async function loadUI(existingToken=''){
 const instance=new JSDOM(await readFile(new URL('../onboarding-pilot.html',import.meta.url),'utf8'),{url:'https://adbrwns8-eng.github.io/eim-v6-field-test/onboarding-pilot.html',runScripts:'outside-only'});const w=instance.window;
 Object.defineProperty(w.crypto,'randomUUID',{value:randomUUID});
 w.fetch=(url,opts)=>{assert.equal(url,endpoint);return handler(new Request(url,{...opts,headers:{...opts.headers,Origin:'https://adbrwns8-eng.github.io'}}));};
 // Canvas is stubbed for DOM integration. Actual drawing/layout need the browser suite.
 w.HTMLCanvasElement.prototype.getContext=()=>({beginPath(){},moveTo(){},lineTo(){},stroke(){},clearRect(){}});
 w.HTMLCanvasElement.prototype.setPointerCapture=()=>{};
 w.HTMLCanvasElement.prototype.getBoundingClientRect=()=>({left:0,top:0,width:800,height:260});
 w.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6N8AAAAASUVORK5CYII=';
 if(existingToken)w.sessionStorage.setItem('bosB23Token',existingToken);
 w.eval(await readFile(new URL('../onboarding-pilot.js',import.meta.url),'utf8'));return instance;
}
const $=id=>dom.window.document.getElementById(id);
async function settled(){for(let i=0;i<500;i++){if(!Array.from(dom.window.document.querySelectorAll('button')).some(b=>b.disabled))return;await new Promise(r=>setTimeout(r,5));}throw Error('UI action timed out');}
async function click(id){$(id).click();await settled();}
async function login(pin){$('pin').value=pin;$('login-form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await settled();assert.equal($('workspace').hidden,false,$('message').textContent);}
dom=await loadUI();await login('111111');assert.match($('who').textContent,/Test Trainer/);
await click('new-session');$('employee').value='00000000-0000-4000-8000-000000000002';await click('create');assert.ok($('site'),$('message').textContent);$('site').value='JK Farms';$('date').value='2026-10-28';$('site_specific').checked=true;$('site_specific-minutes').value='15';$('first_aid_awareness').checked=true;$('first_aid_awareness-minutes').value='60';await click('save');assert.equal($('message').textContent,'Draft saved on the server.');
await click('overview');dom.window.document.querySelector('.open').click();await settled();assert.equal($('date').value,'2026-10-28');assert.equal($('site_specific-minutes').value,'15');
await click('submit');assert.match($('signing').textContent,/Sign as trainer/);
await click('sign');assert.equal($('message').textContent,'Review the acknowledgment and draw your signature.');
async function sign(){const c=$('pad');$('ack').checked=true;c.onpointerdown({pointerId:1,clientX:20,clientY:30});c.onpointermove({clientX:100,clientY:50,preventDefault(){}});c.onpointerup();await click('sign');assert.match($('message').textContent,/Signature saved/);}
await sign();await click('logout');await login('222222');assert.equal($('new-session').hidden,true);dom.window.document.querySelector('.open').click();await settled();assert.match($('signing').textContent,/Sign as employee/);await sign();await click('logout');await login('333333');dom.window.document.querySelector('.open').click();await settled();$('approve-check').checked=true;await click('approve');assert.match($('message').textContent,/Test record approved and saved/);
const token=dom.window.sessionStorage.getItem('bosB23Token');dom.window.close();dom=await loadUI(token);await settled();dom.window.document.querySelector('.open').click();await settled();assert.match($('view').textContent,/Approved in test by Test Manager/);assert.equal(dom.window.document.querySelectorAll('img.signature').length,4);checkHistory();
function checkHistory(){assert.match($('view').textContent,/employee signed/);assert.match($('view').textContent,/trainer signed/);assert.match($('view').textContent,/manager approved/);}
console.log('DOM + actual Edge handler + local PostgreSQL integration passed: draft resume, distinct signers, signature validation, manager approval and reload persistence; 4 API boundary checks passed. Canvas mocked; no visual/layout claim.');dom.window.close();await db.close();
