-- Pilot enrollment is explicit. Vehicle submissions historically use the first mine,
-- so a reviewed asset-to-site mapping is required for existing and new records.
create table public.b23_vehicle_asset_sites (
  asset_id uuid primary key references public.vehicle_inspection_assets(id),
  mine_id uuid not null references public.mines(id)
);
create table public.b23_vehicle_manager_sites (
  employee_id uuid not null references public.employees(id),
  mine_id uuid not null references public.mines(id),
  primary key (employee_id, mine_id)
);
alter table public.b23_vehicle_asset_sites enable row level security;
alter table public.b23_vehicle_manager_sites enable row level security;
revoke all on public.b23_vehicle_asset_sites, public.b23_vehicle_manager_sites
  from public, anon, authenticated;

create function public.b23_vehicle_manager_actions(
  p_token text,
  p_action text,
  p_finding_id uuid default null,
  p_note text default null,
  p_start timestamptz default null,
  p_finish timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  actor public.employees%rowtype;
  finding public.findings%rowtype;
  action public.corrective_actions%rowtype;
  result jsonb;
begin
  select e.* into actor
  from b23_private.sessions s join public.employees e on e.id = s.employee_id
  where s.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and s.expires_at > now() and e.active and e.is_manager
    and e.access_level = 'manager'
    and e.role in ('Plant Manager', 'On-Rotation Manager');
  if not found then raise exception 'Manager authorization required'; end if;

  if p_action = 'queue' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'finding_id', f.id, 'finding_no', f.finding_no,
      'description', f.description, 'status', f.status,
      'severity', f.current_severity, 'asset', v.asset_code,
      'action_plan', ca.action_plan, 'completion_comment', ca.completion_comment
    ) order by f.reported_at desc), '[]'::jsonb) into result
    from public.findings f
    join public.vehicle_inspection_assets v on v.id = f.vehicle_asset_id
    join public.b23_vehicle_asset_sites site on site.asset_id = v.id
    join public.mines m on m.id = site.mine_id and m.active
    join public.b23_vehicle_manager_sites allowed
      on allowed.mine_id = m.id and allowed.employee_id = actor.id
    left join lateral (
      select * from public.corrective_actions c where c.finding_id = f.id
      order by c.assigned_at desc nulls last, c.id desc limit 1
    ) ca on true
    where m.organization_id = actor.organization_id
      and f.organization_id = actor.organization_id
      and ((f.status = 'open' and ca.id is null)
        or (f.status = 'assigned' and ca.assigned_to = actor.id
          and ca.status in ('assigned', 'accepted'))
        or (f.status = 'pending_verification' and ca.assigned_to <> actor.id
          and ca.status = 'completed_pending_verification' and actor.role = 'Plant Manager'));
    return result;
  end if;

  if actor.role <> 'Plant Manager' then raise exception 'Plant Manager required'; end if;
  select f.* into finding
  from public.findings f
  join public.b23_vehicle_asset_sites site on site.asset_id = f.vehicle_asset_id
  join public.mines m on m.id = site.mine_id and m.active
  join public.b23_vehicle_manager_sites allowed
    on allowed.mine_id = m.id and allowed.employee_id = actor.id
  where f.id = p_finding_id and m.organization_id = actor.organization_id
    and f.organization_id = actor.organization_id
  for update of f;
  if not found then raise exception 'Finding unavailable'; end if;

  select c.* into action from public.corrective_actions c
  where c.finding_id = finding.id
  order by c.assigned_at desc nulls last, c.id desc limit 1 for update;

  -- RED work must enter through its existing acknowledgement and response workflow.
  if p_action = 'plan' and finding.status = 'open' and action.id is null
    and lower(coalesce(finding.instruction_level, '')) <> 'red'
    and lower(coalesce(finding.current_severity, '')) not in ('high', 'critical') then
    if nullif(btrim(p_note), '') is null or p_start is null or p_finish is null
      or p_finish < p_start then raise exception 'Enter a plan and valid dates'; end if;
    return public.v6_test_take_ownership(actor.id, finding.id, p_note, p_start, p_finish);
  elsif p_action = 'complete' and finding.status = 'assigned'
    and action.assigned_to = actor.id and action.status in ('assigned', 'accepted') then
    select to_jsonb(c) into result
    from public.v6_test_complete_corrective_action(
      actor.id, finding.id, p_note, 'ready_for_verification', null, true
    ) c;
    return result;
  elsif p_action = 'verify' and finding.status = 'pending_verification'
    and action.status = 'completed_pending_verification'
    and action.assigned_to <> actor.id
    and action.completion_equipment_status = 'ready_for_verification'
    and exists (select 1 from public.finding_evidence e
      where e.finding_id = finding.id and e.corrective_action_id = action.id
        and e.evidence_type in ('after', 'completion_photo')) then
    select to_jsonb(v) into result
    from public.v6_test_verify_corrective_action(actor.id, action.id, 'approved', p_note) v;
    return result;
  end if;
  raise exception 'Action unavailable for this finding';
end;
$$;

revoke all on function public.b23_vehicle_manager_actions(text, text, uuid, text, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.b23_vehicle_manager_actions(text, text, uuid, text, timestamptz, timestamptz)
  to service_role;
