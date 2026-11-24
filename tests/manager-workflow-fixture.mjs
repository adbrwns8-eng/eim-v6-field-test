import {fixture} from './fixture.mjs';
import {readFile} from 'node:fs/promises';
import {createHandler} from '../supabase/functions/b23-manager-workflow/index.ts';
export const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
export const photo={mime:'image/png',data_base64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6N8AAAAASUVORK5CYII='};
export async function workflowFixture(){
 const db=await fixture();
 await db.exec(`alter table public.employees add role text, add access_level text, add organization_id uuid;
 create table public.mines(id uuid primary key,name text,organization_id uuid,active boolean);
 create table public.findings(id uuid primary key,organization_id uuid,vehicle_asset_id uuid,equipment_id uuid,mine_id uuid,description text,status text,current_severity text,instruction_level text);
 create table public.corrective_actions(id uuid primary key,finding_id uuid,status text);
 update public.employees set organization_id='${id(100)}',access_level='manager',is_manager=true,role='Plant Manager';
 update public.employees set role='On-Rotation Manager' where id='${id(2)}';
 update public.employees set is_manager=false,access_level='employee',role='Employee' where id='${id(4)}';
 insert into public.employees(id,pin,first_name,last_name,active,is_manager,role,access_level,organization_id) values
 ('${id(5)}','555555','Other','Site',true,true,'Plant Manager','manager','${id(100)}'),
 ('${id(6)}','666666','Other','Organization',true,true,'Plant Manager','manager','${id(101)}');
 insert into public.mines values('${id(10)}','Synthetic Plant A','${id(100)}',true),('${id(11)}','Synthetic Plant B','${id(100)}',true),('${id(12)}','Other Organization','${id(101)}',true);`);
 await db.exec(await readFile(new URL('../supabase/migrations/b23_manager_workflow.sql',import.meta.url),'utf8'));
 await db.exec(`insert into b23_workflow.members values('${id(1)}','${id(10)}'),('${id(2)}','${id(10)}'),('${id(3)}','${id(10)}'),('${id(4)}','${id(10)}'),('${id(5)}','${id(11)}'),('${id(6)}','${id(12)}');
 insert into b23_workflow.assets values('${id(20)}','${id(10)}','vehicle','TRUCK-A','Synthetic truck'),('${id(21)}','${id(10)}','plant','PLANT-A','Synthetic conveyor'),('${id(22)}','${id(11)}','vehicle','TRUCK-B','Other site truck'),('${id(23)}','${id(12)}','vehicle','OTHER-ORG','Other organization');
 insert into public.findings values('${id(30)}','${id(100)}','${id(20)}',null,'${id(10)}','Historical unassigned mirror deficiency','open','moderate','yellow');
 set role service_role;`);
 const handler=createHandler({project:'https://synthetic.invalid',serviceKey:'synthetic-not-a-credential',transport:async(url,options)=>{
  if(url!=='https://synthetic.invalid/rest/v1/rpc/b23_manager_workflow')throw Error('Unexpected network target');
  const body=JSON.parse(options.body);
  try{const {rows}=await db.query('select public.b23_manager_workflow($1,$2,$3::jsonb) as value',[body.p_action,body.p_token,JSON.stringify(body.p_data)]);return Response.json(rows[0].value);}
  catch(error){return Response.json({code:error.code,message:error.message},{status:400});}
 }});
 const request=(action,data={},token='')=>handler(new Request('https://adbrwns8-eng.github.io/eim-v6-field-test/b23',{method:'POST',headers:{Origin:'https://adbrwns8-eng.github.io',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({action,data})}));
 const call=async(action,data={},token='')=>{const response=await request(action,data,token);const body=await response.json();if(!response.ok)throw Object.assign(Error(body.error),{status:response.status});return body;};
 return {db,handler,request,call,login:async pin=>(await call('login',{pin})).token};
}
