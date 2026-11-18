import test from 'node:test';
import assert from 'node:assert/strict';
import {publicSupabaseConfig,missingConfiguration,isLocalHost} from '../lib/configuration.mjs';
const env={NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'server-secret',IMAGEKIT_PUBLIC_KEY:'public',IMAGEKIT_PRIVATE_KEY:'private',IMAGEKIT_URL_ENDPOINT:'https://ik.imagekit.io/test'};
test('publishable and secret keys configure cloud without exposing server secrets',()=>{assert.deepEqual(missingConfiguration(env),[]);assert.deepEqual(publicSupabaseConfig(env),{url:env.NEXT_PUBLIC_SUPABASE_URL,anonKey:env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY});});
test('public credentials alone do not enable guest matching',()=>{assert.ok(missingConfiguration({...env,SUPABASE_SECRET_KEY:''}).includes('SUPABASE_SECRET_KEY'));});
test('legacy keys remain supported',()=>{assert.deepEqual(missingConfiguration({...env,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'',SUPABASE_SECRET_KEY:'',NEXT_PUBLIC_SUPABASE_ANON_KEY:'legacy',SUPABASE_SERVICE_ROLE_KEY:'legacy-server'}),[]);});
test('local demo is not allowed on deployed sites or LAN phones',()=>{assert.equal(isLocalHost('localhost'),true);for(const host of ['fastpics.vercel.app','localhost.evil.com','192.168.1.2'])assert.equal(isLocalHost(host),false);});
