import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
let browser;
const db=await fixture();
try {
await db.exec('set role service_role');
const calls=[];let handler;const ENDPOINT='https://abnydnnafyosrakkgajy.supabase.co/functions/v1/b23-onboarding';
globalThis.Deno={env:{get:key=>key==='SUPABASE_URL'?'https://test.local':'test-service-key'},serve:fn=>handler=fn};
globalThis.fetch=async(url,opts)=>{assert.equal(url,'https://test.local/rest/v1/rpc/b23_onboarding');assert.equal(opts.headers.apikey,'test-service-key');const b=JSON.parse(opts.body);calls.push(b.p_action);try{const r=await db.query('select public.b23_onboarding($1,$2,$3::jsonb) as result',[b.p_action,b.p_token,JSON.stringify(b.p_data)]);return Response.json(r.rows[0].result);}catch(e){return Response.json({code:e.code,message:e.message},{status:400});}};
await import('../supabase/functions/b23-onboarding/index.ts');
// API boundary checks use the real Edge handler with a local SQL transport.
assert.equal((await handler(new Request(ENDPOINT,{method:'GET'}))).status,405);
assert.equal((await handler(new Request(ENDPOINT,{method:'POST',headers:{Origin:'https://untrusted.example'},body:'{}'}))).status,403);
assert.equal((await handler(new Request(ENDPOINT,{method:'POST',body:JSON.stringify({action:'home'})}))).status,401);
assert.equal((await handler(new Request(ENDPOINT,{method:'POST',body:JSON.stringify({action:'sign',data:{image:'not-an-image'}})}))).status,400);
// Logical production origins preserve the unmodified application's CORS behavior.
// Every browser request is intercepted; no request may fall through to the network.
const APP='https://adbrwns8-eng.github.io/eim-v6-field-test/';
const assets=new Map([
  ['onboarding-pilot.html','text/html'],
  ['onboarding-pilot.js','text/javascript'],
  ['onboarding-pilot.css','text/css'],
]);
const violations=[],errors=[],mockErrors=[];
const describe=request=>`${request.method()} ${new URL(request.url()).origin} (${request.resourceType()})`;
browser=await chromium.launch({headless:true,...(process.env.BOS_BROWSER_EXECUTABLE?{executablePath:process.env.BOS_BROWSER_EXECUTABLE}:{})});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,serviceWorkers:'block'});
context.setDefaultTimeout(15000);
context.setDefaultNavigationTimeout(15000);
await context.route('**/*',async route=>{
  const request=route.request();
  try {
    const asset=[...assets].find(([name])=>request.url()===APP+name);
    if(request.method()==='GET'&&asset){
      const [name,contentType]=asset;
      return await route.fulfill({contentType,body:await readFile(new URL('../'+name,import.meta.url),'utf8')});
    }
    if(request.url()===ENDPOINT&&request.method()==='POST'){
      const response=await handler(new Request(request.url(),{method:'POST',headers:await request.allHeaders(),body:request.postData()}));
      return await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
    }
    violations.push(describe(request));
  } catch {
    // Never log request bodies, headers, PINs or bearer tokens.
    mockErrors.push(`Mock handler failed: ${describe(request)}`);
  }
  await route.abort('blockedbyclient');
});
await context.routeWebSocket('**/*',socket=>{
  violations.push(`WebSocket ${new URL(socket.url()).origin}`);
  socket.close({code:1008,reason:'External network disabled in synthetic tests'});
});
const page=await context.newPage();
page.on('pageerror',()=>errors.push('Uncaught browser exception (details suppressed to avoid credential logging)'));
try {
  await page.goto(APP+'onboarding-pilot.html');
  // Prove both foreign hosts and same-origin unlisted assets are denied.
  for(const target of ['https://blocked.invalid/probe',APP+'unlisted.js']){
    assert.equal(await page.evaluate(async url=>{try{await fetch(url);return false;}catch{return true;}},target),true);
  }
  assert.equal(violations.length,2,'HTTP isolation probes must reach the deny rule');
  await page.evaluate(()=>new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('WebSocket deny probe timed out')),5000);
    const socket=new WebSocket('wss://blocked.invalid/probe');
    socket.onclose=()=>{clearTimeout(timeout);resolve();};socket.onerror=()=>{clearTimeout(timeout);resolve();};
  }));
  assert.equal(violations.length,3,'WebSocket isolation probe must reach the deny rule');
  violations.length=0; // Only the deliberate probes above are expected.
const click=async name=>{await page.getByRole('button',{name,exact:true}).click();};
const signedIn=async(pin,name)=>{await page.getByLabel('Employee PIN',{exact:true}).fill(pin);await click('Sign in');await page.getByText(name+' · '+(pin==='222222'?'Employee':'Manager / pilot trainer'),{exact:true}).waitFor();};
const signOut=async()=>{await click('Sign out / switch person');await page.getByRole('heading',{name:'Sign in to the training pilot'}).waitFor();};
await signedIn('111111','Test Trainer');await click('New training session');await page.getByLabel('Employee receiving training').selectOption('00000000-0000-4000-8000-000000000002');await click('Create saved draft');await page.locator('#site').selectOption('JK Farms');await page.getByLabel('Actual training date').fill('2026-10-28');await page.getByLabel('Site-specific hazard awareness',{exact:true}).check();await page.getByLabel('Actual minutes').nth(0).fill('15');await page.getByLabel('First Aid CPR AED awareness',{exact:true}).check();await page.getByLabel('Actual minutes').nth(1).fill('60');await click('Save draft');await page.getByText('Draft saved on the server.',{exact:true}).waitFor();
await click('Employee records');await click('Open record');assert.equal(await page.getByLabel('Actual training date').inputValue(),'2026-10-28');assert.equal(await page.getByLabel('Actual minutes').nth(0).inputValue(),'15');
await click('Save and lock for signatures');await page.getByRole('heading',{name:'Sign as trainer'}).waitFor();
// A blank signature is rejected before any API write.
await click('Accept signature and save');await page.getByText('Review the acknowledgment and draw your signature.',{exact:true}).waitFor();
async function drawAndSign(){await page.locator('#ack').check();const box=await page.locator('canvas').boundingBox();await page.mouse.move(box.x+20,box.y+60);await page.mouse.down();await page.mouse.move(box.x+90,box.y+30,{steps:10});await page.mouse.move(box.x+160,box.y+80,{steps:10});await page.mouse.up();await click('Accept signature and save');await page.getByText('Signature saved. Sign out so the other person can sign in with their own PIN.',{exact:true}).waitFor();}
await drawAndSign();await signOut();await signedIn('222222','Test Employee');assert.equal(await page.getByRole('button',{name:'New training session'}).isVisible(),false);await click('Open record');await page.getByRole('heading',{name:'Sign as employee'}).waitFor();await drawAndSign();await signOut();await signedIn('333333','Test Manager');await click('Open record');await page.getByLabel('I reviewed the signed test record and its training details.').check();await click('Approve test record');await page.getByText('Test record approved and saved. It does not grant work authorization.',{exact:true}).waitFor();
await page.reload();await page.getByText('Records loaded from the server.',{exact:true}).waitFor();await click('Open record');await page.getByText(/Approved in test by Test Manager/).waitFor();assert.equal(await page.locator('img.signature').count(),4);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'tests/mobile-qa.png',fullPage:true});
await page.setViewportSize({width:1280,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'tests/desktop-qa.png',fullPage:true});
assert.deepEqual(violations,[],'Unexpected browser network requests were blocked');
assert.deepEqual(mockErrors,[],'Local mock handlers must succeed');
assert.deepEqual(errors,[]);console.log('Browser + Edge + PostgreSQL integration passed: separate signers, draft resume, locked content, approval, refresh persistence, mobile/desktop layout; 4 API boundary checks passed.');console.log('Network isolation passed: foreign HTTP, unlisted same-origin assets and WebSockets denied; zero unexpected requests during application flow.');
} catch(error) {
  console.error('Synthetic browser suite failed:',error.name);
  console.error('UI status:',await page.locator('#message').textContent().catch(()=>'(unavailable)'));
  console.error(JSON.stringify({blockedRequests:violations,mockErrors,pageErrors:errors,apiActions:calls}));
  throw error;
}
} finally {
  await browser?.close();
  await db.close();
}
