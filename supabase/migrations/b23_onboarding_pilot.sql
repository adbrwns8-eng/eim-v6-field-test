-- Additive test-only onboarding. Existing pilot tables and functions are unchanged.
create schema b23_private;
revoke all on schema b23_private from public, anon, authenticated;
grant usage on schema b23_private, extensions to service_role;
create table b23_private.sessions (
 token_hash text primary key, employee_id uuid not null references public.employees(id),
 expires_at timestamptz not null default now()+interval '8 hours', created_at timestamptz not null default now()
);
create table b23_private.login_windows (
 fingerprint text primary key, attempts integer not null, started_at timestamptz not null
);
create table b23_private.records (
 id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.employees(id),
 trainer_id uuid not null references public.employees(id), request_id uuid not null unique,
 status text not null default 'draft' check(status in ('draft','awaiting_signatures','pending_review','approved')),
 revision integer not null default 1, document jsonb not null, document_hash text,
 employee_signature jsonb, trainer_signature jsonb, approval jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 test_only boolean not null default true check(test_only)
);
create table b23_private.audit (
 id bigint generated always as identity primary key, record_id uuid references b23_private.records(id),
 actor_id uuid not null references public.employees(id), event text not null, occurred_at timestamptz not null default now(), detail jsonb not null default '{}'
);
create index b23_sessions_employee_idx on b23_private.sessions(employee_id);
create index b23_records_employee_idx on b23_private.records(employee_id,updated_at desc);
create index b23_records_trainer_idx on b23_private.records(trainer_id,updated_at desc);
create index b23_audit_record_idx on b23_private.audit(record_id,id);
alter table b23_private.sessions enable row level security;
alter table b23_private.login_windows enable row level security;
alter table b23_private.records enable row level security;
alter table b23_private.audit enable row level security;
revoke all on all tables in schema b23_private from public,anon,authenticated;
grant select,insert,update,delete on b23_private.sessions,b23_private.login_windows to service_role;
grant select,insert,update on b23_private.records to service_role;
grant select,insert on b23_private.audit to service_role;
grant usage,select on all sequences in schema b23_private to service_role;
create function public.b23_onboarding(p_action text,p_token text default null,p_data jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 actor public.employees; trainee public.employees; rec b23_private.records;
 tok text; login_fp text; attempts integer; s jsonb; doc jsonb; subjects jsonb; output jsonb;
 record_id_input uuid; expected integer; sig jsonb; who text; stamp timestamptz:=clock_timestamp();
begin
 if p_action='login' then
  -- Edge supplies hashes for network and credential throttles; no PINs enter logs.
  insert into b23_private.login_windows values('global',1,stamp)
  on conflict (fingerprint) do update set
   attempts=case when b23_private.login_windows.started_at < stamp-interval '15 minutes' then 1 else b23_private.login_windows.attempts+1 end,
   started_at=case when b23_private.login_windows.started_at < stamp-interval '15 minutes' then stamp else b23_private.login_windows.started_at end
  returning login_windows.attempts into attempts;
  if attempts>60 then return jsonb_build_object('error','Pilot login limit reached. Wait 15 minutes.','status',429); end if;
  login_fp:=p_data->>'fingerprint';
  if login_fp is null or login_fp !~ '^[0-9a-f]{64}$' then raise exception 'Invalid login request'; end if;
  insert into b23_private.login_windows values(login_fp,1,stamp)
  on conflict (fingerprint) do update set
   attempts=case when b23_private.login_windows.started_at < stamp-interval '15 minutes' then 1 else b23_private.login_windows.attempts+1 end,
   started_at=case when b23_private.login_windows.started_at < stamp-interval '15 minutes' then stamp else b23_private.login_windows.started_at end
  returning login_windows.attempts into attempts;
  if attempts>10 then return jsonb_build_object('error','Too many attempts. Wait 15 minutes.','status',429); end if;
  login_fp:=p_data->>'credential_fingerprint';
  if login_fp is null or login_fp !~ '^[0-9a-f]{64}$' then raise exception 'Invalid credential request'; end if;
  insert into b23_private.login_windows values(login_fp,1,stamp)
  on conflict (fingerprint) do update set
   attempts=case when b23_private.login_windows.started_at < stamp-interval '15 minutes' then 1 else b23_private.login_windows.attempts+1 end,
   started_at=case when b23_private.login_windows.started_at < stamp-interval '15 minutes' then stamp else b23_private.login_windows.started_at end
  returning login_windows.attempts into attempts;
  if attempts>5 then return jsonb_build_object('error','Too many attempts. Wait 15 minutes.','status',429); end if;
  if coalesce(p_data->>'pin','') !~ '^[0-9]{4,12}$' then return jsonb_build_object('error','PIN not recognized','status',401); end if;
  if (select count(*) from public.employees where active and pin=p_data->>'pin')<>1 then return jsonb_build_object('error','PIN not recognized or not unique. Contact the pilot manager.','status',401); end if;
  select * into actor from public.employees where active and pin=p_data->>'pin';
  if actor.id is null then return jsonb_build_object('error','PIN not recognized','status',401); end if;
  delete from b23_private.login_windows where login_windows.fingerprint=p_data->>'credential_fingerprint';
  delete from b23_private.sessions where expires_at<stamp;
  tok:=encode(extensions.gen_random_bytes(32),'hex');
  insert into b23_private.sessions(token_hash,employee_id) values(encode(extensions.digest(tok,'sha256'),'hex'),actor.id);
  return jsonb_build_object('token',tok,'user',jsonb_build_object('id',actor.id,'name',actor.first_name||' '||actor.last_name,'manager',actor.is_manager),'test_only',true);
 end if;
 select e.* into actor from b23_private.sessions t join public.employees e on e.id=t.employee_id
 where t.token_hash=encode(extensions.digest(coalesce(p_token,''),'sha256'),'hex') and t.expires_at>stamp and e.active;
 if actor.id is null then return jsonb_build_object('error','Sign in again','status',401); end if;
 if p_action='logout' then delete from b23_private.sessions where token_hash=encode(extensions.digest(p_token,'sha256'),'hex'); return '{"ok":true}'; end if;
 if p_action='home' then
  return jsonb_build_object('user',jsonb_build_object('id',actor.id,'name',actor.first_name||' '||actor.last_name,'manager',actor.is_manager),
   'employees',case when actor.is_manager then (select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'name',e.first_name||' '||e.last_name) order by e.first_name),'[]') from public.employees e where e.active) else '[]'::jsonb end,
   'records',(select coalesce(jsonb_agg(to_jsonb(r)-'employee_signature'-'trainer_signature' order by r.updated_at desc),'[]') from b23_private.records r where actor.is_manager or r.employee_id=actor.id or r.trainer_id=actor.id),
   'test_only',true);
 end if;
 if p_action='create' then
  if not actor.is_manager then raise exception 'Only an authorized pilot manager can record training'; end if;
  select * into trainee from public.employees where id=(p_data->>'employee_id')::uuid and active;
  if trainee.id is null then raise exception 'Select an active employee'; end if;
  if trainee.id=actor.id then raise exception 'Select a different employee to train'; end if;
  record_id_input:=(p_data->>'request_id')::uuid;
  select * into rec from b23_private.records where request_id=record_id_input;
  if rec.id is not null then
   if rec.trainer_id<>actor.id then raise exception 'Request belongs to another trainer'; end if;
   return to_jsonb(rec);
  end if;
  subjects:='[]';
  doc:=jsonb_build_object('test_only',true,'source_revision','EIM packets uploaded 2026-10-28 / pilot 1','employee_name',trainee.first_name||' '||trainee.last_name,'trainer_name',actor.first_name||' '||actor.last_name,'certifier_name',actor.first_name||' '||actor.last_name,'site','Borland','mine_id','41-05712','location','9018 ECR 120, Midland TX 79706','training_date',null,'subjects',subjects);
  insert into b23_private.records(employee_id,trainer_id,request_id,document) values(trainee.id,actor.id,record_id_input,doc) returning * into rec;
  insert into b23_private.audit(record_id,actor_id,event) values(rec.id,actor.id,'draft_created');
  return to_jsonb(rec);
 end if;
 record_id_input:=(p_data->>'id')::uuid;
 select * into rec from b23_private.records where records.id=record_id_input for update;
 if rec.id is null or not(actor.is_manager or rec.employee_id=actor.id or rec.trainer_id=actor.id) then raise exception 'Record unavailable'; end if;
 if p_action='get' then
  return to_jsonb(rec)||jsonb_build_object('audit',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]') from b23_private.audit a where a.record_id=rec.id));
 end if;
 if p_action in ('save','submit') then
  if actor.id<>rec.trainer_id or not actor.is_manager or rec.status<>'draft' then raise exception 'Only the assigned trainer can edit an unsigned draft'; end if;
  expected:=(p_data->>'revision')::integer;
  if expected is null or expected<>rec.revision then raise exception 'Record changed. Reload before editing'; end if;
  if p_data->>'site' not in ('Borland','JK Farms') or p_data->>'site' is null then raise exception 'Select a site'; end if;
  if p_data->>'training_date' is not null and p_data->>'training_date'<>'' then
   if (p_data->>'training_date')::date > (stamp at time zone 'America/Chicago')::date then raise exception 'Actual training date cannot be in the future'; end if;
  end if;
  subjects:='[]';
  if jsonb_typeof(p_data->'subjects') is distinct from 'array' or jsonb_array_length(p_data->'subjects')>2 then raise exception 'Invalid subject list'; end if;
  for s in select value from jsonb_array_elements(p_data->'subjects') loop
   if s->>'code' not in ('site_specific','first_aid_awareness') or s->>'code' is null then raise exception 'Unknown subject'; end if;
   if (s->>'minutes') is null or (s->>'minutes') !~ '^[0-9]{1,4}$' or (s->>'minutes')::integer not between 1 and 1440 then raise exception 'Enter actual whole minutes for each subject'; end if;
   if exists(select 1 from jsonb_array_elements(subjects) v where v->>'code'=s->>'code') then raise exception 'Duplicate subject'; end if;
   subjects:=subjects||jsonb_build_array(jsonb_build_object('code',s->>'code','minutes',(s->>'minutes')::integer,'title',case when s->>'code'='site_specific' then 'Site-specific hazard awareness training' else 'First Aid CPR AED awareness' end,
    'content',case when s->>'code'='site_specific' then jsonb_build_array('SITE-SPECIFIC HAZARD AWARENESS TRAINING RECORD/CERTIFICATE','Miner initials acknowledge receipt of the site-specific training recorded here.','False certification is punishable under section 110 (a) and (f) of the Federal Mine Safety and Health Act. I certify that the above training has been completed.','This pilot records delivery. It does not supply or replace the site-specific hazard instruction.')
    else jsonb_build_array('Recognizing a medical emergency and immediately notifying supervision / emergency services','Scene safety and use of appropriate PPE / universal precautions before providing assistance','Location and proper use of first aid kits and emergency equipment','Basic response to bleeding, shock, burns, eye injuries, and other common workplace injuries','Recognizing signs of cardiac arrest and the importance of early CPR','Basic CPR awareness: check responsiveness, activate emergency response, and begin compressions when trained','Location and basic awareness of AED equipment and following the AED voice/visual prompts','Never exceed the employee level of training; continue care until relieved by qualified responders','This page documents awareness training and does not certify an employee as a First Aid CPR or AED provider. In an emergency contact 911 or the site designated response system.','Employee acknowledgment: I received awareness training, understand the reviewed emergency response expectations and know where emergency equipment is located.') end));
  end loop;
  if p_action='submit' and (jsonb_array_length(subjects)=0 or nullif(p_data->>'training_date','') is null) then raise exception 'Training date and at least one completed subject are required'; end if;
  if (select coalesce(sum((v->>'minutes')::integer),0) from jsonb_array_elements(subjects) v)>1440 then raise exception 'Total duration cannot exceed 24 hours for one date'; end if;
  doc:=rec.document||jsonb_build_object('site',p_data->>'site','mine_id',case when p_data->>'site'='Borland' then '41-05712' else '41-05759' end,'location',case when p_data->>'site'='Borland' then '9018 ECR 120, Midland TX 79706' else '5020 Hwy 349, Martin County, Texas 79331' end,'training_date',nullif(p_data->>'training_date',''),'subjects',subjects);
  update b23_private.records set document=doc,revision=revision+1,updated_at=stamp,
   status=case when p_action='submit' then 'awaiting_signatures' else 'draft' end,
   document_hash=case when p_action='submit' then encode(extensions.digest(doc::text,'sha256'),'hex') else null end
  where records.id=rec.id returning * into rec;
  insert into b23_private.audit(record_id,actor_id,event,detail) values(rec.id,actor.id,case when p_action='submit' then 'submitted_for_signatures' else 'draft_saved' end,jsonb_build_object('revision',rec.revision));
 elsif p_action='sign' then
  if p_data->>'document_hash' is distinct from rec.document_hash or rec.status not in ('awaiting_signatures','pending_review') then raise exception 'Review the current submitted record before signing'; end if;
  if p_data->'acknowledged' is distinct from 'true'::jsonb then raise exception 'Acknowledgment is required'; end if;
  who:=p_data->>'signer_role';
  if who='employee' and actor.id<>rec.employee_id then raise exception 'Employee must sign using their own session'; end if;
  if who='trainer' and (actor.id<>rec.trainer_id or not actor.is_manager) then raise exception 'Assigned trainer must sign using their own session'; end if;
  if who not in ('employee','trainer') or who is null then raise exception 'Invalid signing role'; end if;
  if (who='employee' and rec.employee_signature is not null) or (who='trainer' and rec.trainer_signature is not null) then return to_jsonb(rec); end if;
  if length(coalesce(p_data->>'image','')) not between 100 and 180000 or p_data->>'image' !~ '^data:image/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$' then raise exception 'A drawn PNG signature is required'; end if;
  sig:=jsonb_build_object('signer_id',actor.id,'name',actor.first_name||' '||actor.last_name,'role',who,'signed_at',stamp,'document_hash',rec.document_hash,'revision',rec.revision,'image',p_data->>'image');
  update b23_private.records set employee_signature=case when who='employee' then sig else employee_signature end,
   trainer_signature=case when who='trainer' then sig else trainer_signature end,updated_at=stamp where records.id=rec.id returning * into rec;
  if rec.employee_signature is not null and rec.trainer_signature is not null then update b23_private.records set status='pending_review' where records.id=rec.id returning * into rec; end if;
  insert into b23_private.audit(record_id,actor_id,event,detail) values(rec.id,actor.id,who||'_signed',jsonb_build_object('document_hash',rec.document_hash,'revision',rec.revision));
 elsif p_action='approve' then
  if not actor.is_manager then raise exception 'Manager approval required'; end if;
  if rec.status='approved' then return to_jsonb(rec); end if;
  if rec.status<>'pending_review' or rec.employee_signature is null or rec.trainer_signature is null or p_data->>'document_hash' is distinct from rec.document_hash or p_data->'acknowledged' is distinct from 'true'::jsonb then raise exception 'Review the signed record before approval'; end if;
  update b23_private.records set status='approved',updated_at=stamp,approval=jsonb_build_object('manager_id',actor.id,'name',actor.first_name||' '||actor.last_name,'approved_at',stamp,'document_hash',rec.document_hash) where records.id=rec.id returning * into rec;
  insert into b23_private.audit(record_id,actor_id,event) values(rec.id,actor.id,'manager_approved');
 else raise exception 'Unknown action';
 end if;
 return to_jsonb(rec);
end;
$$;
revoke all on function public.b23_onboarding(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.b23_onboarding(text,text,jsonb) to service_role;
