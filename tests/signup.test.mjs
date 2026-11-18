import test from 'node:test';
import assert from 'node:assert/strict';
import {signupValues} from '../lib/signup.mjs';
test('signup skips email confirmation but never accepts owner roles or approvals',()=>{
 const result=signupValues({email:' Test@example.com ',password:'test-password-123',studio:' Test ',app_metadata:{fastpics_role:'owner',fastpics_subscription:{approved:true}}});
 assert.equal(result.email_confirm,true);assert.equal(result.email,'test@example.com');assert.deepEqual(result.app_metadata,{fastpics_subscription:{approved:false}});assert.deepEqual(result.user_metadata,{studio_name:'Test'});
});
test('signup validates input sizes and types',()=>{
 for(const body of [null,{}, {email:'bad',password:'test-password-123',studio:'Test'},{email:'a@b.com',password:'short',studio:'Test'},{email:'a@b.com',password:'x'.repeat(129),studio:'Test'},{email:'a@b.com',password:'test-password-123',studio:' '}])assert.throws(()=>signupValues(body));
});
