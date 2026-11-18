import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const owner='00000000-0000-4000-8000-000000000001',client='00000000-0000-4000-8000-000000000002';
test('owner management SQL enforces access, one-time trial and idempotent monthly payments',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
 create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
 create table auth.users(id uuid primary key,email_confirmed_at timestamptz,raw_app_meta_data jsonb,updated_at timestamptz);
 create table auth.audit_log_entries(payload jsonb);
 create table public.photographers(id uuid primary key references auth.users(id));
 create table public.photos(id uuid primary key,owner_id uuid,size bigint);
 insert into auth.users values('${owner}',now(),'{"fastpics_role":"owner"}',now()),('${client}',now(),'{}',now());`);
 await db.exec(await readFile(new URL('../supabase/owner-management.sql',import.meta.url),'utf8'));
 // Migration is repeat-safe.
 await db.exec(await readFile(new URL('../supabase/owner-management.sql',import.meta.url),'utf8'));
 const change=(action,id='00000000-0000-4000-8000-000000000003',actor=owner)=>db.query('select public.owner_change_access($1,$2,$3,$4)',[client,actor,action,id]);
 await assert.rejects(()=>change('approve',undefined,client),/Owner required/);
 await change('approve');
 const getPlan=async()=> (await db.query('select raw_app_meta_data->\'fastpics_subscription\' p from auth.users where id=$1',[client])).rows[0].p;
 const trial=await getPlan();assert.equal(Date.parse(trial.trial_ends_at)-Date.parse(trial.trial_started_at),48*3600000);
 await change('approve');assert.equal((await getPlan()).trial_ends_at,trial.trial_ends_at);
 await change('activate');const first=await getPlan();await change('activate');assert.equal((await getPlan()).paid_until,first.paid_until);
 let metrics=(await db.query('select public.owner_metrics() m')).rows[0].m;assert.equal(metrics.income,500);assert.equal(metrics.paid,1);assert.equal(metrics.clients,1);
 await change('activate','00000000-0000-4000-8000-000000000004');assert.ok(Date.parse((await getPlan()).paid_until)>Date.parse(first.paid_until));
 await change('suspend');metrics=(await db.query('select public.owner_metrics() m')).rows[0].m;assert.equal(metrics.paid,0);assert.equal(metrics.income,1000);
 await db.exec(`create or replace function auth.uid() returns uuid language sql as $$ select '${client}'::uuid $$;`);
 assert.equal((await db.query('select public.is_photographer() allowed')).rows[0].allowed,false);
 await change('resume');assert.equal((await db.query('select public.is_photographer() allowed')).rows[0].allowed,true);
 await db.exec(`create or replace function auth.uid() returns uuid language sql as $$ select '${owner}'::uuid $$;`);
 assert.equal((await db.query('select public.is_photographer() allowed')).rows[0].allowed,false);
 await db.exec(`insert into public.photos values('00000000-0000-4000-8000-000000000005','${client}',1234);insert into auth.audit_log_entries values('{"action":"login","actor_id":"${client}"}');`);
 const usage=(await db.query('select public.owner_client_usage($1::uuid[]) u',[[client]])).rows[0].u;assert.deepEqual(usage[client],{photos:1,bytes:1234,logins:1});
 metrics=(await db.query('select public.owner_metrics() m')).rows[0].m;assert.equal(metrics.income_month,1000);assert.equal(metrics.logins,1);assert.equal(metrics.bytes,1234);
 await db.exec('set role authenticated');await assert.rejects(()=>db.query('select public.owner_metrics()'),/permission denied/);await assert.rejects(()=>db.query('select * from public.subscription_payments'),/permission denied/);
 }finally{await db.close();}
});
