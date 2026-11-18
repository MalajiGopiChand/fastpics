export function signupValues(body){
 if(!body||typeof body.email!=='string'||typeof body.password!=='string'||typeof body.studio!=='string')throw new Error('Enter your name, email and password.');
 const email=body.email.trim().toLowerCase(),studio=body.studio.trim();
 if(email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Enter a valid email address.');
 if(body.password.length<12||body.password.length>128)throw new Error('Use a password between 12 and 128 characters.');
 if(!studio||studio.length>80)throw new Error('Enter a studio name up to 80 characters.');
 return {email,password:body.password,email_confirm:true,user_metadata:{studio_name:studio},app_metadata:{fastpics_subscription:{approved:false}}};
}
