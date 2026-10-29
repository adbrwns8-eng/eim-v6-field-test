import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
process.on('uncaughtException',e=>{console.error(e.message,e.where||'');process.exit(1)});
const db=new PGlite();
// Local-only pgcrypto stand-ins: tests exercise state and permissions, not cryptography.
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema extensions;
create function extensions.digest(text,text) returns bytea language sql as $$select decode(md5($1)||md5($1),'hex')$$;
create function extensions.gen_random_bytes(integer) returns bytea language sql as $$select decode(string_agg(substr(md5(random()::text),1,2),''),'hex') from generate_series(1,$1)$$;
create table public.employees(id uuid primary key default gen_random_uuid(),pin text,first_name text,last_name text,active boolean default true,is_manager boolean default false);
grant select on public.employees to service_role;
insert into public.employees(id,pin,first_name,last_name,is_manager) values
('00000000-0000-4000-8000-000000000001','111111','Test','Trainer',true),
('00000000-0000-4000-8000-000000000002','222222','Test','Employee',false),
('00000000-0000-4000-8000-000000000003','333333','Test','Manager',true),
('00000000-0000-4000-8000-000000000004','444444','Other','Employee',false);`);
await db.exec(await readFile(new URL('../supabase/migrations/b23_onboarding_pilot.sql',import.meta.url),'utf8'));
let checks=0;const check=(x,m)=>{assert.ok(x,m);checks++};
async function call(action,data={},token='') {return (await db.query('select public.b23_onboarding($1,$2,$3::jsonb) as result',[action,token,JSON.stringify(data)])).rows[0].result;}
async function denied(action,data,token){await assert.rejects(()=>call(action,data,token));checks++;}
for(const role of ['anon','authenticated']){await db.exec(`set role ${role}`);await assert.rejects(()=>call('home'));checks++;await assert.rejects(()=>db.query('select * from b23_private.records'));checks++;await db.exec('reset role');}
await db.exec('set role service_role');
check((await call('home')).status===401,'missing session rejected');
const hash=s=>s.repeat(64).slice(0,64);
async function login(pin,fp){return (await call('login',{pin,fingerprint:hash(fp),credential_fingerprint:hash(fp==='a'?'b':fp==='c'?'d':fp==='e'?'f':'0')})).token;}
const trainer=await login('111111','a'),employee=await login('222222','c'),manager=await login('333333','e'),other=await login('444444','1');
check(trainer&&employee&&manager&&other,'separate sessions');
const employeeID='00000000-0000-4000-8000-000000000002';const req='10000000-0000-4000-8000-000000000001';
let r=await call('create',{employee_id:employeeID,request_id:req},trainer);
check(r.status==='draft'&&r.test_only,'test draft created');
check((await call('create',{employee_id:employeeID,request_id:req},trainer)).id===r.id,'retry does not duplicate');
await denied('create',{employee_id:employeeID,request_id:crypto.randomUUID()},employee);
await denied('get',{id:r.id},other);
await denied('create',{employee_id:'00000000-0000-4000-8000-000000000001',request_id:crypto.randomUUID()},trainer);
const payload=()=>({id:r.id,revision:r.revision,site:'JK Farms',training_date:'2026-10-28',subjects:[{code:'site_specific',minutes:15},{code:'first_aid_awareness',minutes:60}]});
await denied('submit',{...payload(),subjects:[]},trainer);
await denied('save',{...payload(),subjects:[{code:'site_specific',minutes:-1}]},trainer);
await denied('save',{...payload(),revision:999},trainer);
await denied('save',payload(),employee);
r=await call('save',payload(),trainer);check(r.revision===2&&r.document.mine_id==='41-05759','save uses site master data');
r=await call('get',{id:r.id},trainer);check(r.document.subjects.length===2&&r.document.subjects[1].content.length>5,'reopen preserves content');
r=await call('submit',payload(),trainer);check(r.status==='awaiting_signatures'&&r.document_hash,'submission locks reviewed content');
await denied('save',payload(),trainer);
const image='data:image/png;base64,iVBORw0KGgo'+'A'.repeat(100);
const signed=(role)=>({id:r.id,document_hash:r.document_hash,signer_role:role,acknowledged:true,image});
await denied('sign',signed('employee'),trainer);
await denied('sign',{...signed('employee'),document_hash:'wrong'},employee);
await denied('sign',{...signed('employee'),acknowledged:false},employee);
await denied('approve',{id:r.id,document_hash:r.document_hash,acknowledged:true},manager);
r=await call('sign',signed('trainer'),trainer);check(r.status==='awaiting_signatures','one signature is insufficient');
r=await call('sign',signed('employee'),employee);check(r.status==='pending_review','both signatures queue manager review');
const stamp=r.employee_signature.signed_at;
r=await call('sign',signed('employee'),employee);check(r.employee_signature.signed_at===stamp,'signature retry keeps original timestamp');
await denied('approve',{id:r.id,document_hash:r.document_hash,acknowledged:true},employee);
r=await call('approve',{id:r.id,document_hash:r.document_hash,acknowledged:true},manager);check(r.status==='approved','manager approval saved');
r=await call('get',{id:r.id},employee);check(r.audit.length===6&&r.employee_signature.document_hash===r.document_hash,'reopened signatures and audit match content');
check((await call('home',{},other)).records.length===0,'unrelated employee cannot list records');
await call('logout',{},employee);check((await call('get',{id:r.id},employee)).status===401,'logout revokes session');
for(let i=0;i<5;i++)check((await call('login',{pin:'987654',fingerprint:hash('9'),credential_fingerprint:hash('8')})).status===401,'bad PIN denied');
check((await call('login',{pin:'987654',fingerprint:hash('9'),credential_fingerprint:hash('8')})).status===429,'failed login throttle');
await db.exec('reset role');
await db.query("update b23_private.sessions set expires_at=now()-interval '1 second'");
await db.exec('set role service_role');check((await call('home',{},trainer)).status===401,'expired session rejected');
console.log(`${checks} database checks passed (local PostgreSQL; pgcrypto mocked).`);await db.close();
