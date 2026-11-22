import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fixture } from './fixture.mjs';

const db = await fixture();
try {
  await db.exec(`
    alter table employees add role text, add access_level text, add organization_id uuid;
    create table mines(id uuid primary key, active boolean, organization_id uuid);
    create table vehicle_inspection_assets(id uuid primary key, asset_code text);
    create table findings(id uuid primary key, finding_no bigint, description text, status text,
      current_severity text, instruction_level text, organization_id uuid, vehicle_asset_id uuid,
      reported_at timestamptz default now());
    create table corrective_actions(id uuid primary key default gen_random_uuid(), finding_id uuid,
      assigned_at timestamptz default now(), assigned_to uuid, status text,
      action_plan text, completion_comment text, completion_equipment_status text);
    create table finding_evidence(finding_id uuid, corrective_action_id uuid, evidence_type text);

    -- Stand-ins for the hosted legacy RPCs. The production authorization wrapper is under test.
    create function v6_test_take_ownership(uuid, uuid, text, timestamptz, timestamptz)
      returns jsonb language plpgsql as \$\$
      begin
        insert into corrective_actions(finding_id, assigned_to, status, action_plan)
          values ($2, $1, 'accepted', $3);
        update findings set status='assigned' where id=$2;
        return '{"ok":true}';
      end \$\$;
    create function v6_test_complete_corrective_action(uuid, uuid, text, text, text, boolean)
      returns table(status text) language plpgsql as \$\$
      begin
        if not exists (select 1 from finding_evidence where finding_id=$2) then
          raise exception 'After Repair photo required';
        end if;
        update corrective_actions set status='completed_pending_verification',
          completion_comment=$3, completion_equipment_status=$4 where finding_id=$2;
        update findings set status='pending_verification' where id=$2;
        return query select 'pending_verification'::text;
      end \$\$;
    create function v6_test_verify_corrective_action(uuid, uuid, text, text)
      returns table(finding_status text) language plpgsql as \$\$
      begin
        update corrective_actions set status='verified' where id=$2;
        update findings set status='closed' where id=(select finding_id from corrective_actions where id=$2);
        return query select 'closed'::text;
      end \$\$;
  `);
  const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
  const actor = { planner: id(1), rotation: id(2), verifier: id(3), otherSite: id(4) };
  const mine = id(10), otherMine = id(11), org = id(12), asset = id(13), finding = id(14);
  await db.exec(await readFile(new URL('../supabase/migrations/b23_vehicle_manager_actions.sql', import.meta.url), 'utf8'));
  await db.exec(`
    update employees set is_manager=true, access_level='manager', role='Plant Manager', organization_id='${org}';
    update employees set role='On-Rotation Manager' where id='${actor.rotation}';
    insert into mines values ('${mine}',true,'${org}'), ('${otherMine}',true,'${org}');
    insert into vehicle_inspection_assets values ('${asset}','TEST-TRUCK');
    insert into findings values ('${finding}',100,'Synthetic worn mirror','open','moderate','yellow','${org}','${asset}');
    insert into b23_vehicle_asset_sites values ('${asset}','${mine}');
    insert into b23_vehicle_manager_sites values ('${actor.planner}','${mine}'),
      ('${actor.rotation}','${mine}'), ('${actor.verifier}','${mine}'), ('${actor.otherSite}','${otherMine}');
  `);
  async function session(name, token) {
    await db.query("insert into b23_private.sessions(token_hash,employee_id) values(encode(extensions.digest($1,'sha256'),'hex'),$2)", [token, actor[name]]);
    return token;
  }
  const planner = await session('planner', 'synthetic-planner-session');
  const rotation = await session('rotation', 'synthetic-rotation-session');
  const verifier = await session('verifier', 'synthetic-verifier-session');
  const otherSite = await session('otherSite', 'synthetic-other-site-session');
  async function call(token, action, findingId = null, note = null) {
    const { rows } = await db.query(`select b23_vehicle_manager_actions(
      $1, $2, $3, $4, now(), now() + interval '1 day') as result`, [token, action, findingId, note]);
    return rows[0].result;
  }
  await db.exec('set role anon');
  await assert.rejects(call(planner, 'queue'), /permission denied/);
  await db.exec('set role service_role');
  await assert.rejects(call('invalid-token', 'queue'), /authorization required/);
  assert.equal((await call(planner, 'queue'))[0].finding_id, finding);
  assert.equal((await call(rotation, 'queue'))[0].finding_id, finding);
  assert.deepEqual(await call(otherSite, 'queue'), []);
  await assert.rejects(call(otherSite, 'plan', finding, 'Repair'), /Finding unavailable/);
  await assert.rejects(call(rotation, 'plan', finding, 'Repair'), /Plant Manager required/);
  await call(planner, 'plan', finding, 'Replace mirror');
  await db.exec('reset role');
  const freshPlanner = await session('planner', 'synthetic-fresh-planner-session');
  await db.exec('set role service_role');
  assert.equal((await call(freshPlanner, 'queue'))[0].action_plan, 'Replace mirror');
  await assert.rejects(call(freshPlanner, 'complete', finding, 'Mirror replaced'), /photo required/);
  await db.exec('reset role');
  await db.exec("insert into finding_evidence select finding_id,id,'after' from corrective_actions; set role service_role");
  await call(freshPlanner, 'complete', finding, 'Mirror replaced');
  await assert.rejects(call(freshPlanner, 'verify', finding), /Action unavailable/);
  await assert.rejects(call(rotation, 'verify', finding), /Plant Manager required/);
  assert.equal((await call(verifier, 'queue'))[0].completion_comment, 'Mirror replaced');
  await call(verifier, 'verify', finding, 'Checked replacement');
  await db.exec('reset role');
  const freshVerifier = await session('verifier', 'synthetic-fresh-verifier-session');
  assert.equal((await db.query('select status from findings')).rows[0].status, 'closed');
  assert.deepEqual(await call(freshVerifier, 'queue'), []);
  console.log('Synthetic vehicle queue, plan persistence, scope checks and independent closure passed');
} finally {
  await db.close();
}
