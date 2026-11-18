'use client';
import {useState} from 'react';
import {ArrowRight,ArrowLeft,ShieldCheck} from 'lucide-react';
import {Brand,Spinner} from './Shared';
import {supabase,adminRequest} from '../lib/store';
export default function AuthPanel({owner=false}){
  const [mode,setMode]=useState('signin'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  function change(next){setMode(next);setError('');setMessage('');}
  async function submit(event){
    event.preventDefault();const values=new FormData(event.currentTarget);setBusy(true);setError('');setMessage('');
    try{
      const email=values.get('email').trim(),password=values.get('password');let result;
      if(mode==='forgot'){
        result=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${location.origin}/account/reset`});
        if(result.error)throw result.error;setMessage('If this email has an account, a password reset link is on its way. Check your inbox and spam folder.');
      }else if(mode==='signup'){
        result=await supabase.auth.signUp({email,password,options:{emailRedirectTo:location.origin,data:{studio_name:values.get('studio').trim()}}});
        if(result.error)throw result.error;setMessage('Check your email to confirm your account. The studio owner must approve photographer access before uploads are enabled.');
      }else{
        result=await supabase.auth.signInWithPassword({email,password});if(result.error)throw result.error;const access=await adminRequest('/api/account');if(access.status==='owner'){location.replace('/admin');return;}if(owner){await supabase.auth.signOut();throw new Error('This login is for the platform owner. Use photographer sign in for client accounts.');}
      }
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return <div className="login-page"><div className="login-art"><Brand/><div><span className="eyebrow">{owner?'FASTPICS ADMINISTRATION':'YOUR OWN PHOTOGRAPHY WORKSPACE'}</span><h1>{owner?'Your business. Your control.':<>Every studio has a story.<br/>This space is yours.</>}</h1><p>{owner?'Manage client accounts, approvals, subscriptions, recorded income and storage usage.':'Sign in with your own account. Your events and uploaded photos stay separate from every other photographer.'}</p></div><span><ShieldCheck size={14}/> Private collections. Personal access.</span></div><div className="login-form"><span className="eyebrow">{owner?'OWNER LOGIN':'FASTPICS FOR PHOTOGRAPHERS'}</span><h1>{owner?'Owner sign in':mode==='signup'?'Your studio starts here.':mode==='forgot'?'Let’s get you back in.':'Welcome back.'}</h1><p>{mode==='signup'?'₹500/month. Start with a 2-day free trial after approval.':mode==='forgot'?'We’ll email you a secure password reset link.':owner?'Sign in to your management dashboard.': 'Sign in to manage your own events and photos.'}</p><form onSubmit={submit} key={mode}>{mode==='signup'&&<label className="field">Studio or photographer name<input name="studio" autoComplete="organization" maxLength={80} required/></label>}<label className="field">Email<input name="email" type="email" autoComplete="username" required maxLength={254}/></label>{mode!=='forgot'&&<label className="field">Password<input name="password" type="password" autoComplete={mode==='signup'?'new-password':'current-password'} minLength={mode==='signup'?12:undefined} required/>{mode==='signup'&&<span>Use at least 12 characters.</span>}</label>}{error&&<p className="error-text" role="alert">{error}</p>}{message&&<p className="subtle-box" role="status">{message}</p>}<button className="button primary full-button" disabled={busy}>{busy?<Spinner/>:<>{mode==='signup'?'Create account':mode==='forgot'?'Send reset link':'Sign in'}<ArrowRight size={17}/></>}</button></form><div className="auth-links">{mode==='signin'?<><button onClick={()=>change('forgot')}>Forgot password?</button>{!owner&&<button onClick={()=>change('signup')}>Create a separate account</button>}</>:<button onClick={()=>change('signin')}><ArrowLeft size={14}/>Back to sign in</button>}</div><p className="login-note">{owner?'Owner accounts do not need photographer approval or a subscription.':'Guests don’t need a photographer login. Scan the event QR or open the link provided by your photographer.'}</p><a className="text-button" href={owner?'/':'/admin'}>{owner?'Photographer sign in':'Owner console'}</a></div></div>;
}
export function AccountAccess({user,error,onRetry}){
  return <div className="loading-screen account-access"><Brand/><h1>{error?'Couldn’t verify your account.':'Your account is ready for approval.'}</h1><p>{error||'Confirm your email, then ask the studio owner to approve your photographer account. Your 2-day free trial starts on approval. After that, the plan is ₹500/month, activated by the owner after payment.'}</p><strong>{user.email}</strong><div className="button-row"><button className="button primary" onClick={onRetry}>Check access again</button><button className="button secondary" onClick={async()=>{const result=await supabase.auth.signOut();if(result.error)onRetry();}}>Use another account</button></div></div>;
}
