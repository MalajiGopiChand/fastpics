export const TRIAL_MS = 48 * 60 * 60 * 1000;
export function accountAccess(user, now=Date.now()) {
  const meta=user?.app_metadata||{};
  if(meta.fastpics_role==='owner')return {allowed:true,status:'owner',expiresAt:null};
  const plan=meta.fastpics_subscription||{};
  if(plan.suspended)return {allowed:false,status:'suspended',expiresAt:null};
  if(!plan.approved)return {allowed:false,status:'pending',expiresAt:null};
  if(Date.parse(plan.paid_until)>now)return {allowed:true,status:'active',expiresAt:plan.paid_until};
  if(Date.parse(plan.trial_ends_at)>now)return {allowed:true,status:'trial',expiresAt:plan.trial_ends_at};
  return {allowed:false,status:'expired',expiresAt:plan.paid_until||plan.trial_ends_at||null};
}
export function changeSubscription(current, action, now=Date.now()) {
  const plan={...current};
  if(action==='approve') {
    plan.approved=true;plan.suspended=false;
    if(!plan.trial_started_at){plan.trial_started_at=new Date(now).toISOString();plan.trial_ends_at=new Date(now+TRIAL_MS).toISOString();}
  }else if(action==='suspend')plan.suspended=true;
  else if(action==='resume')plan.suspended=false;
  else if(action==='activate') {
    const existing=Date.parse(plan.paid_until);
    const start=new Date(Number.isFinite(existing)&&existing>now?existing:now);
    const day=start.getUTCDate();start.setUTCDate(1);start.setUTCMonth(start.getUTCMonth()+1);
    const last=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0)).getUTCDate();
    start.setUTCDate(Math.min(day,last));
    plan.approved=true;plan.suspended=false;plan.paid_until=start.toISOString();
    plan.plan='monthly';plan.amount_inr=500;
  }else if(action==='cancel')plan.paid_until=null;
  else throw new Error('Invalid account action.');
  return plan;
}
