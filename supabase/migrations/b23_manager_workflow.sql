-- Additive pilot candidate. Apply only after schema/mapping and legacy-cutover review.
-- Never infer a vehicle's facility from the first mine or grant organization-wide access.
create schema b23_workflow;
revoke all on schema b23_workflow from public, anon, authenticated;
create table b23_workflow.members (
 employee_id uuid references public.employees(id), mine_id uuid references public.mines(id),
 primary key(employee_id,mine_id)
);
create table b23_workflow.assets (
 id uuid primary key, mine_id uuid not null references public.mines(id),
 kind text not null check(kind in ('vehicle','plant')), code text not null, description text not null
);
create table b23_workflow.inspections (
 id uuid primary key default gen_random_uuid(), reporter_id uuid not null references public.employees(id),
 asset_id uuid not null references b23_workflow.assets(id), request_id uuid not null,
 answers jsonb not null, submitted_at timestamptz not null default clock_timestamp(),
 unique(reporter_id,request_id)
);
create table b23_workflow.findings (
 id uuid primary key default gen_random_uuid(), number bigint generated always as identity,
 source_id uuid unique, inspection_id uuid references b23_workflow.inspections(id),
 reporter_id uuid references public.employees(id), asset_id uuid not null references b23_workflow.assets(id),
 description text not null, severity text not null check(severity in ('moderate','high')),
 state text not null default 'new' check(state in ('new','assigned','awaiting_verification','closed')),
 employee_acknowledged_at timestamptz, acknowledged_by uuid references public.employees(id),
 assigned_to uuid references public.employees(id), completed_by uuid references public.employees(id),
 plan text, controls text, starts_at timestamptz, due_at timestamptz, completion text,
 revision integer not null default 1, work_revision integer not null default 1,
 created_at timestamptz not null default clock_timestamp()
);
create table b23_workflow.comments (
 id bigint generated always as identity primary key, finding_id uuid not null references b23_workflow.findings(id),
 actor_id uuid not null references public.employees(id), body text not null,
 created_at timestamptz not null default clock_timestamp()
);
create table b23_workflow.evidence (
 id uuid primary key default gen_random_uuid(), finding_id uuid not null references b23_workflow.findings(id),
 actor_id uuid not null references public.employees(id), work_revision integer not null,
 kind text not null check(kind in ('before','after')), mime text not null, bytes bytea not null,
 taken_by text not null, note text not null default '', created_at timestamptz not null default clock_timestamp()
);
create table b23_workflow.events (
 id bigint generated always as identity primary key, finding_id uuid not null references b23_workflow.findings(id),
 actor_id uuid not null references public.employees(id), event text not null, detail jsonb not null default '{}',
 created_at timestamptz not null default clock_timestamp()
);
create index on b23_workflow.findings(asset_id,state);
create index on b23_workflow.evidence(finding_id,work_revision);
do $$ declare t text; begin
 foreach t in array array['members','assets','inspections','findings','comments','evidence','events'] loop
  execute format('alter table b23_workflow.%I enable row level security',t);
  execute format('revoke all on b23_workflow.%I from public, anon, authenticated',t);
 end loop;
end $$;
grant usage on schema b23_workflow to service_role;
grant select,insert,update on all tables in schema b23_workflow to service_role;
grant usage,select on all sequences in schema b23_workflow to service_role;
grant select on public.employees,public.mines to service_role;
do $$ begin
 if to_regclass('public.findings') is not null then execute 'grant select,update(status) on public.findings to service_role';end if;
 if to_regclass('public.corrective_actions') is not null then execute 'grant select on public.corrective_actions to service_role';end if;
end $$;

create function b23_workflow.manager(e jsonb) returns boolean language sql immutable as $$
 select coalesce((e->>'is_manager')::boolean and e->>'access_level'='manager'
  and e->>'role' in ('Plant Manager','Rotation Manager','On-Rotation Manager'),false)
$$;
create function b23_workflow.scope(e jsonb, asset uuid) returns boolean language sql stable as $$
 select exists(select 1 from b23_workflow.assets a join public.mines m on m.id=a.mine_id
 join b23_workflow.members s on s.mine_id=m.id and s.employee_id=(e->>'id')::uuid
 where a.id=asset and to_jsonb(m)->>'organization_id'=e->>'organization_id'
 and coalesce((to_jsonb(m)->>'active')::boolean,false))
$$;
create function b23_workflow.photo(data jsonb) returns bytea language plpgsql as $$
declare bytes bytea; begin
 if data->>'mime' is null or data->>'mime' not in ('image/png','image/jpeg') or length(coalesce(data->>'data_base64',''))>2800000 then
  raise exception 'A PNG or JPEG photo up to 2 MB is required'; end if;
 bytes:=decode(data->>'data_base64','base64');
 if bytes is null or octet_length(bytes)>2097152 or not (
  (data->>'mime'='image/png' and octet_length(bytes)>=33 and encode(substring(bytes from 1 for 8),'hex')='89504e470d0a1a0a') or
  (data->>'mime'='image/jpeg' and octet_length(bytes)>=4 and encode(substring(bytes from 1 for 3),'hex')='ffd8ff')) then
  raise exception 'Photo content does not match its type'; end if;
 return bytes;
end $$;
create function b23_workflow.view_finding(f b23_workflow.findings, actor jsonb) returns jsonb language sql stable as $$
 select to_jsonb(f)||jsonb_build_object(
 'asset',(select jsonb_build_object('code',a.code,'description',a.description,'mine_id',a.mine_id,'mine_name',to_jsonb(m)->>'name') from b23_workflow.assets a join public.mines m on m.id=a.mine_id where a.id=f.asset_id),
 'restriction',case when f.state='closed' then 'Verified closed' when f.severity='high' then 'RED — DO NOT OPERATE' else 'Restricted pending corrective review' end,
 'capabilities',jsonb_build_object(
  'ack',b23_workflow.manager(actor) and f.state<>'closed' and f.acknowledged_by is null,
  'assign',b23_workflow.manager(actor) and f.acknowledged_by is not null and f.state in ('new','assigned'),
  'plan',b23_workflow.manager(actor) and f.state='assigned' and f.assigned_to=(actor->>'id')::uuid,
  'complete',b23_workflow.manager(actor) and f.state='assigned' and f.assigned_to=(actor->>'id')::uuid and f.plan is not null,
  'verify',b23_workflow.manager(actor) and f.state='awaiting_verification' and f.completed_by<>(actor->>'id')::uuid,
  'comment',b23_workflow.manager(actor) and f.state<>'closed'),
 'comments',(select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]') from b23_workflow.comments c where c.finding_id=f.id),
 'evidence',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'kind',p.kind,'actor_id',p.actor_id,'taken_by',p.taken_by,'note',p.note,'work_revision',p.work_revision,'mime',p.mime,'data_base64',encode(p.bytes,'base64')) order by p.created_at),'[]') from b23_workflow.evidence p where p.finding_id=f.id),
 'history',(select coalesce(jsonb_agg(to_jsonb(h) order by h.id),'[]') from b23_workflow.events h where h.finding_id=f.id))
$$;

-- Import only explicitly mapped, open legacy findings with no active legacy action.
-- Never invent historical facilities or take over a workflow already in progress.
create function b23_workflow.import_open(actor jsonb) returns integer language plpgsql as $$
declare raw jsonb; a b23_workflow.assets; n integer:=0; busy boolean; inserted uuid;
begin
 if not b23_workflow.manager(actor) then return 0;end if;
 if to_regclass('public.findings') is null or to_regclass('public.corrective_actions') is null then raise exception 'Historical source contract unavailable; action count unavailable';end if;
 for raw in execute 'select to_jsonb(f) from public.findings f' loop
  if raw->>'status' in ('closed','cancelled') then continue;end if;
  if nullif(raw->>'organization_id','') is null then raise exception 'Historical organization data incomplete; action count unavailable';end if;
  if raw->>'organization_id' is distinct from actor->>'organization_id' then continue;end if;
  if nullif(raw->>'status','') is null or nullif(raw->>'id','') is null or nullif(raw->>'description','') is null then raise exception 'Historical source data incomplete; reconcile before use';end if;
  if raw->>'vehicle_asset_id' is not null and raw->>'equipment_id' is not null and raw->>'vehicle_asset_id'<>raw->>'equipment_id' then raise exception 'Historical asset mapping is ambiguous';end if;
  select * into a from b23_workflow.assets where id::text=coalesce(raw->>'vehicle_asset_id',raw->>'equipment_id');
  if not found then raise exception 'Historical facility mapping incomplete; action count unavailable';end if;
  if not b23_workflow.scope(actor,a.id) then continue;end if;
  if raw->>'mine_id' is not null and raw->>'mine_id'<>a.mine_id::text then raise exception 'Historical facility mapping conflicts; reconcile before use';end if;
  if exists(select 1 from b23_workflow.findings f where f.source_id=(raw->>'id')::uuid) then continue;end if;
  if raw->>'status'<>'open' then n:=n+1;continue;end if;
  busy:=false;
  if to_regclass('public.corrective_actions') is not null then
   execute 'select exists(select 1 from public.corrective_actions c where to_jsonb(c)->>''finding_id''=$1 and coalesce(to_jsonb(c)->>''status'','''') not in (''verified'',''closed'',''cancelled''))' into busy using raw->>'id';
  end if;
  if busy then n:=n+1;continue;end if;
  insert into b23_workflow.findings(id,source_id,asset_id,description,severity)
   values((raw->>'id')::uuid,(raw->>'id')::uuid,a.id,coalesce(raw->>'description','Historical deficiency'),
    case when lower(coalesce(raw->>'instruction_level',''))='red' or lower(coalesce(raw->>'current_severity','')) in ('high','critical') then 'high' else 'moderate' end)
   on conflict do nothing returning id into inserted;
  if inserted is not null then insert into b23_workflow.events(finding_id,actor_id,event) values(inserted,(actor->>'id')::uuid,'legacy_intake');end if;
 end loop;
 return n;
end $$;

create function public.b23_manager_workflow(p_action text,p_token text default null,p_data jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor jsonb; target jsonb; f b23_workflow.findings; a b23_workflow.assets;
 i b23_workflow.inspections; answer jsonb; picture bytea; result jsonb; rows jsonb;
 key text; allowed text[]; assigned uuid; start_time timestamptz; finish_time timestamptz; legacy_busy integer; changed_rows integer;
begin
 if jsonb_typeof(p_data) is distinct from 'object' then raise exception 'Object data required'; end if;
 if p_action='login' then return public.b23_onboarding('login',null,p_data); end if;
 select to_jsonb(e) into actor from b23_private.sessions s join public.employees e on e.id=s.employee_id
 where s.token_hash=encode(extensions.digest(coalesce(p_token,''),'sha256'),'hex') and s.expires_at>clock_timestamp() and e.active;
 if actor is null then raise exception using errcode='28000',message='Sign in again'; end if;
 if p_action='logout' then return public.b23_onboarding('logout',p_token,'{}'); end if;
 if nullif(actor->>'organization_id','') is null then raise exception using errcode='42501',message='Organization enrollment required'; end if;
 allowed:=case p_action
  when 'home' then array[]::text[] when 'assets' then array[]::text[]
  when 'submit' then array['asset_id','request_id','answers'] when 'acknowledge' then array['inspection_id']
  when 'get' then array['id'] when 'ack' then array['id','revision']
  when 'comment' then array['id','revision','body'] when 'assign' then array['id','revision','assignee_id','starts_at','due_at']
  when 'plan' then array['id','revision','plan','controls','starts_at','due_at']
  when 'evidence' then array['id','revision','kind','mime','data_base64','taken_by','note']
  when 'complete' then array['id','revision','completion'] when 'verify' then array['id','revision','decision','body']
  else null end;
 if allowed is null then raise exception 'Unknown action'; end if;
 for key in select jsonb_object_keys(p_data) loop
  if not key=any(allowed) then raise exception 'Unexpected field'; end if;
 end loop;
 if p_action='assets' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from b23_workflow.assets x where b23_workflow.scope(actor,x.id);
  return result;
 end if;
 if p_action='submit' then
  select * into a from b23_workflow.assets where id=(p_data->>'asset_id')::uuid and b23_workflow.scope(actor,id);
  if not found then raise exception using errcode='42501',message='Asset unavailable'; end if;
  if jsonb_typeof(p_data->'answers') is distinct from 'array' or jsonb_array_length(p_data->'answers')<>(case when a.kind='vehicle' then 16 else 1 end) then raise exception 'Complete every inspection item'; end if;
  if nullif(p_data->>'request_id','') is null then raise exception 'Submission request ID required';end if;
  perform pg_advisory_xact_lock(hashtextextended((actor->>'id')||((p_data->>'request_id')::uuid)::text,0));
  select * into i from b23_workflow.inspections where reporter_id=(actor->>'id')::uuid and request_id=(p_data->>'request_id')::uuid;
  if found then
   if i.asset_id<>a.id or i.answers<>p_data->'answers' then raise exception 'Submission retry differs'; end if;
  else
   insert into b23_workflow.inspections(reporter_id,asset_id,request_id,answers) values((actor->>'id')::uuid,a.id,(p_data->>'request_id')::uuid,p_data->'answers') returning * into i;
   for answer in select value from jsonb_array_elements(i.answers) loop
    if answer->>'status' not in ('pass','deficient','na') or answer->>'status' is null then raise exception 'Invalid inspection answer'; end if;
    if answer->>'status'='deficient' then
     if length(btrim(coalesce(answer->>'description','')))<1 or length(answer->>'description')>4000 then raise exception 'Deficiency description required'; end if;
     picture:=b23_workflow.photo(answer);
     -- No automated severity downgrade: new deficiencies remain RED until reviewed.
     insert into b23_workflow.findings(inspection_id,reporter_id,asset_id,description,severity)
      values(i.id,i.reporter_id,a.id,answer->>'description','high') returning * into f;
     insert into b23_workflow.evidence(finding_id,actor_id,work_revision,kind,mime,bytes,taken_by)
      values(f.id,i.reporter_id,f.work_revision,'before',answer->>'mime',picture,coalesce(actor->>'first_name','Employee'));
     insert into b23_workflow.events(finding_id,actor_id,event) values(f.id,i.reporter_id,'submitted');
    end if;
   end loop;
  end if;
  return jsonb_build_object('inspection_id',i.id,'findings',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'number',x.number,'description',x.description,'restriction','RED — DO NOT OPERATE')),'[]') from b23_workflow.findings x where x.inspection_id=i.id));
 end if;
 if p_action='acknowledge' then
  select * into i from b23_workflow.inspections where id=(p_data->>'inspection_id')::uuid and reporter_id=(actor->>'id')::uuid and b23_workflow.scope(actor,asset_id) for update;
  if not found then raise exception using errcode='42501',message='Inspection unavailable'; end if;
  for f in select * from b23_workflow.findings where inspection_id=i.id and employee_acknowledged_at is null for update loop
   update b23_workflow.findings set employee_acknowledged_at=clock_timestamp() where id=f.id;
   insert into b23_workflow.events(finding_id,actor_id,event) values(f.id,i.reporter_id,'employee_acknowledged');
  end loop;
  return '{"ok":true}';
 end if;
 if p_action='home' then
  legacy_busy:=b23_workflow.import_open(actor);
  select coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object('asset_code',asset.code) order by x.created_at desc),'[]') into rows
   from b23_workflow.findings x join b23_workflow.assets asset on asset.id=x.asset_id
   where b23_workflow.scope(actor,x.asset_id) and (b23_workflow.manager(actor) or x.reporter_id=(actor->>'id')::uuid);
  return jsonb_build_object('user',jsonb_build_object('id',actor->>'id','name',concat_ws(' ',actor->>'first_name',actor->>'last_name'),'role',actor->>'role','can_manage',b23_workflow.manager(actor)),
   'inspections',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'submitted_at',s.submitted_at,'asset_code',v.code,'finding_count',(select count(*) from b23_workflow.findings history_finding where history_finding.inspection_id=s.id)) order by s.submitted_at desc),'[]') from b23_workflow.inspections s join b23_workflow.assets v on v.id=s.asset_id where b23_workflow.scope(actor,s.asset_id) and (b23_workflow.manager(actor) or s.reporter_id=(actor->>'id')::uuid)),
   'findings',rows,'legacy_reconciliation_required',legacy_busy,'action_required',case when legacy_busy>0 then null else (select count(*) from jsonb_array_elements(rows) x where x->>'state'<>'closed' and b23_workflow.manager(actor) and
    (x->>'state'='new' or x->>'assigned_to'=actor->>'id' and x->>'state'='assigned' or x->>'state'='awaiting_verification' and x->>'completed_by'<>actor->>'id')) end,
   'assignees',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'name',concat_ws(' ',e.first_name,e.last_name),'mine_id',m.mine_id)),'[]') from public.employees e join b23_workflow.members m on m.employee_id=e.id
    where b23_workflow.manager(actor) and e.active and b23_workflow.manager(to_jsonb(e)) and to_jsonb(e)->>'organization_id'=actor->>'organization_id'
     and exists(select 1 from b23_workflow.members own where own.employee_id=(actor->>'id')::uuid and own.mine_id=m.mine_id)));
 end if;
 select * into f from b23_workflow.findings where id=(p_data->>'id')::uuid and b23_workflow.scope(actor,asset_id)
  and (b23_workflow.manager(actor) or reporter_id=(actor->>'id')::uuid) for update;
 if not found then raise exception using errcode='42501',message='Finding unavailable'; end if;
 if p_action='get' then return b23_workflow.view_finding(f,actor); end if;
 if not b23_workflow.manager(actor) then raise exception using errcode='42501',message='Manager authorization required'; end if;
 if f.state='closed' then raise exception 'Closed findings are immutable'; end if;
 if (p_data->>'revision')::integer is distinct from f.revision then raise exception using errcode='40001',message='Finding changed; refresh before editing'; end if;
 if p_action='ack' and f.acknowledged_by is null then
  update b23_workflow.findings set acknowledged_by=(actor->>'id')::uuid where id=f.id;
 elsif p_action='comment' then
  if length(btrim(coalesce(p_data->>'body','')))<1 or length(p_data->>'body')>4000 then raise exception 'Comment required (up to 4000 characters)'; end if;
  insert into b23_workflow.comments(finding_id,actor_id,body) values(f.id,(actor->>'id')::uuid,btrim(p_data->>'body'));
 elsif p_action in ('assign','plan') and f.acknowledged_by is not null and f.state in ('new','assigned') then
  start_time:=(p_data->>'starts_at')::timestamptz; finish_time:=(p_data->>'due_at')::timestamptz;
  if start_time is null or finish_time is null or finish_time<start_time then raise exception 'Valid start and deadline required'; end if;
  if p_action='assign' then
   assigned:=(p_data->>'assignee_id')::uuid;
   select to_jsonb(e) into target from public.employees e where e.id=assigned and e.active and b23_workflow.manager(to_jsonb(e)) and to_jsonb(e)->>'organization_id'=actor->>'organization_id' and b23_workflow.scope(to_jsonb(e),f.asset_id);
   if target is null then raise exception using errcode='42501',message='Assignee is not authorized for this facility'; end if;
   update b23_workflow.findings set assigned_to=assigned,state='assigned',starts_at=start_time,due_at=finish_time,
    work_revision=work_revision+1,plan=null,completion=null,completed_by=null where id=f.id;
  else
   if f.assigned_to is distinct from (actor->>'id')::uuid or nullif(btrim(p_data->>'plan'),'') is null or nullif(btrim(p_data->>'controls'),'') is null then raise exception 'Assigned manager, plan and controls required'; end if;
   if length(p_data->>'plan')>4000 or length(p_data->>'controls')>4000 then raise exception 'Plan too long'; end if;
   update b23_workflow.findings set plan=p_data->>'plan',controls=p_data->>'controls',starts_at=start_time,due_at=finish_time where id=f.id;
  end if;
 elsif p_action='evidence' and f.state='assigned' and f.assigned_to=(actor->>'id')::uuid then
  if p_data->>'kind' not in ('before','after') or nullif(btrim(p_data->>'taken_by'),'') is null then raise exception 'Photo type and photographer required'; end if;
  picture:=b23_workflow.photo(p_data);
  insert into b23_workflow.evidence(finding_id,actor_id,work_revision,kind,mime,bytes,taken_by,note)
   values(f.id,(actor->>'id')::uuid,f.work_revision,p_data->>'kind',p_data->>'mime',picture,p_data->>'taken_by',coalesce(p_data->>'note',''));
 elsif p_action='complete' and f.state='assigned' and f.assigned_to=(actor->>'id')::uuid and f.plan is not null then
  if nullif(btrim(p_data->>'completion'),'') is null then raise exception 'Repair description required'; end if;
  if not exists(select 1 from b23_workflow.evidence e where e.finding_id=f.id and e.work_revision=f.work_revision and e.kind='after' and e.actor_id=f.assigned_to) then raise exception 'Current After Repair photo required'; end if;
  update b23_workflow.findings set state='awaiting_verification',completion=p_data->>'completion',completed_by=(actor->>'id')::uuid where id=f.id;
 elsif p_action='verify' and f.state='awaiting_verification' and f.completed_by<>(actor->>'id')::uuid then
  if p_data->>'decision' not in ('approved','rejected') or nullif(btrim(p_data->>'body'),'') is null then raise exception 'Verification decision and comment required'; end if;
  insert into b23_workflow.comments(finding_id,actor_id,body) values(f.id,(actor->>'id')::uuid,p_data->>'body');
  update b23_workflow.findings set state=case when p_data->>'decision'='approved' then 'closed' else 'assigned' end,
   work_revision=work_revision+case when p_data->>'decision'='rejected' then 1 else 0 end where id=f.id;
 else raise exception using errcode='42501',message='Action unavailable for this manager or state';
 end if;
 update b23_workflow.findings set revision=revision+1 where id=f.id returning * into f;
 if f.source_id is not null then
  execute 'update public.findings set status=(jsonb_populate_record(null::public.findings,$1)).status
   where id=$2 and to_jsonb(findings)->>''organization_id''=$3
   and coalesce(to_jsonb(findings)->>''vehicle_asset_id'',to_jsonb(findings)->>''equipment_id'')=$4
   and to_jsonb(findings)->>''status''<>''closed'''
   using jsonb_build_object('status',case f.state when 'new' then 'open' when 'awaiting_verification' then 'pending_verification' else f.state end),f.source_id,actor->>'organization_id',f.asset_id::text;
  get diagnostics changed_rows = row_count;
  if changed_rows<>1 then raise exception 'Historical finding changed scope or state; reconcile before editing'; end if;
 end if;
 insert into b23_workflow.events(finding_id,actor_id,event,detail) values(f.id,(actor->>'id')::uuid,p_action,p_data-'data_base64');
 return b23_workflow.view_finding(f,actor);
end $$;
revoke all on all functions in schema b23_workflow from public, anon, authenticated;
grant execute on all functions in schema b23_workflow to service_role;
revoke all on function public.b23_manager_workflow(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.b23_manager_workflow(text,text,jsonb) to service_role;
