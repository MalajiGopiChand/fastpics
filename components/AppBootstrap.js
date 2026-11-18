'use client';
import {useEffect,useState} from 'react';
import {CloudOff,RefreshCw,ShieldCheck} from 'lucide-react';
import {Brand,Spinner} from './Shared';
import {configureStore} from '../lib/store';
import {isLocalHost} from '../lib/configuration.mjs';
export default function AppBootstrap({children,guest=false}) {
  const [state,setState]=useState(null),[attempt,setAttempt]=useState(0);
  useEffect(()=>{let cancelled=false;setState(null);(async()=>{
    try {
      const response=await fetch('/api/config',{cache:'no-store',signal:AbortSignal.timeout(15000)});
      const config=await response.json();
      if(cancelled)return;
      if(config.ready){configureStore(config.supabase);setState({ready:true});}
      else if(isLocalHost(location.hostname)){configureStore(null);setState({ready:true});}
      else setState(config);
    }catch{if(!cancelled)setState({ready:false,code:'connection_failed'});}
  })();return()=>{cancelled=true;};},[attempt]);
  if(!state)return <div className="loading-screen"><Brand/><Spinner>Connecting to your photo library…</Spinner></div>;
  if(state.ready)return children;
  return <div className="guest-page"><header className="guest-header"><Brand/><span><ShieldCheck size={16}/>Private event galleries</span></header><section className="guest-unavailable setup-required"><CloudOff size={40}/><h1>{guest?'Your gallery isn’t online yet.':'Connect your studio to the cloud.'}</h1><p>{guest?'Your photographer needs to finish the cloud connection before photos can be opened on your phone. A QR code alone cannot transfer photos saved on another device.':'Online uploads and separate user accounts need a connected database. This site will not save new event photos only in this browser.'}</p>{!guest&&<div className="subtle-box">{state.code==='database_unavailable'?'Database connection or schema needs attention. Run schema.sql (new projects) and subscriptions.sql in Supabase, then verify the project keys.':state.code==='connection_failed'?'Could not reach the configuration service. Check your connection and try again.':`Vercel configuration missing: ${(state.missing||[]).join(', ')}`}</div>}<button className="button primary" onClick={()=>setAttempt(v=>v+1)}><RefreshCw size={16}/>Check connection again</button>{!guest&&<a className="text-button" href="https://github.com/MalajiGopiChand/fastpics#configure-supabase" target="_blank" rel="noreferrer">Open setup instructions</a>}</section></div>;
}
