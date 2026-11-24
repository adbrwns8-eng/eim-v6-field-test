// Session-derived, site-scoped Build 23 API. No fallback to anonymous legacy writes.
type Options = {project: string; serviceKey: string; transport?: typeof fetch; allowedOrigin?: string};
export function createHandler({project, serviceKey, transport = fetch, allowedOrigin = 'https://adbrwns8-eng.github.io'}: Options) {
  if (!project || !serviceKey) throw new Error('Workflow service configuration required');
  return async (req: Request) => {
    const headers = {'Content-Type':'application/json','Cache-Control':'no-store',
      'Access-Control-Allow-Origin':allowedOrigin,'Vary':'Origin',
      'Access-Control-Allow-Headers':'content-type,authorization','Access-Control-Allow-Methods':'POST,OPTIONS'};
    const reply = (body: unknown, status = 200) => Response.json(body, {status, headers});
    if (req.headers.get('Origin') && req.headers.get('Origin') !== allowedOrigin) return reply({error:'Origin not allowed'},403);
    if (req.method === 'OPTIONS') return new Response(null,{status:204,headers});
    if (req.method !== 'POST') return reply({error:'POST required'},405);
    try {
      if (Number(req.headers.get('Content-Length')) > 8000000) return reply({error:'Request too large'},413);
      const text = await req.text();
      if (new TextEncoder().encode(text).length > 8000000) return reply({error:'Request too large'},413);
      const body = JSON.parse(text);
      const actions = new Set(['login','logout','home','assets','submit','acknowledge','get','ack','comment','assign','plan','evidence','complete','verify']);
      if (!actions.has(body.action) || body.data === null || Array.isArray(body.data) || (body.data !== undefined && typeof body.data !== 'object')) return reply({error:'Invalid request'},400);
      let data = body.data || {};
      const token = req.headers.get('Authorization')?.replace(/^Bearer /i,'') || '';
      if (body.action !== 'login' && !token) return reply({error:'Sign in again'},401);
      if (body.action === 'login') {
        if (Object.keys(data).some(key=>key!=='pin')) return reply({error:'Unexpected field'},400);
        const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('');
        data = {pin:String(data.pin || ''),fingerprint:await hash('b23-network:'+(req.headers.get('x-forwarded-for') || 'unknown').split(',')[0]),credential_fingerprint:await hash('b23-pin:'+String(data.pin || ''))};
      }
      const response = await transport(project+'/rest/v1/rpc/b23_manager_workflow',{
        method:'POST',headers:{'Content-Type':'application/json',apikey:serviceKey,Authorization:'Bearer '+serviceKey},
        body:JSON.stringify({p_action:body.action,p_token:token,p_data:data})});
      const result = await response.json();
      if (!response.ok) {
        const statuses: Record<string, number> = { '28000':401, '42501':403, '40001':409, 'P0001':400, '22P02':400, '22007':400, '22023':400 };
        const status = statuses[result.code] || 500;
        return reply({error:status === 500 ? 'Unable to process request' : (result.code==='P0001'||result.code==='40001' ? result.message : status===401 ? 'Sign in again' : status===403 ? 'Access denied' : 'Invalid value')},status);
      }
      return reply(result,typeof result.status === 'number' ? result.status : 200);
    } catch { return reply({error:'Unable to process request'},400); }
  };
}
if (typeof Deno !== 'undefined') Deno.serve(createHandler({project:Deno.env.get('SUPABASE_URL')!,serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}));
