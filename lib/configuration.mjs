export function publicSupabaseConfig(env) {
  return {url:env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '',anonKey:env.SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''};
}
export function missingConfiguration(env) {
  const publicConfig=publicSupabaseConfig(env),missing=[];
  if(!publicConfig.url)missing.push('SUPABASE_URL');
  if(!publicConfig.anonKey)missing.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  if(!env.SUPABASE_SECRET_KEY&&!env.SUPABASE_SERVICE_ROLE_KEY)missing.push('SUPABASE_SECRET_KEY');
  for(const key of ['IMAGEKIT_PUBLIC_KEY','IMAGEKIT_PRIVATE_KEY','IMAGEKIT_URL_ENDPOINT'])if(!env[key])missing.push(key);
  return missing;
}
export function isLocalHost(hostname) {return ['localhost','127.0.0.1','[::1]','::1'].includes(hostname);}
