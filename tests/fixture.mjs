import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
export async function fixture(){const db=new PGlite();
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

return db;}
