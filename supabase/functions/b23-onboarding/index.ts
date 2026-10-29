// Separate test-only API. It never invokes the unauthenticated V6 identity RPCs.
const project = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const allowedOrigin = 'https://adbrwns8-eng.github.io';
const actions = new Set(['login','logout','home','create','get','save','submit','sign','approve']);
Deno.serve(async (req: Request) => {
  const headers = {'Content-Type':'application/json','Cache-Control':'no-store',
    'Access-Control-Allow-Origin':allowedOrigin,'Vary':'Origin',
    'Access-Control-Allow-Headers':'content-type,authorization',
    'Access-Control-Allow-Methods':'POST,OPTIONS'};
  const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), {status, headers});
  if (req.method === 'OPTIONS') return new Response(null, {status:204,headers});
  if (req.method !== 'POST') return reply({error:'POST required'},405);
  const origin = req.headers.get('Origin');
  if (origin && origin !== allowedOrigin) return reply({error:'Origin not allowed'},403);
  try {
    const text = await req.text();
    if (text.length > 200000) return reply({error:'Request too large'},413);
    const body = JSON.parse(text);
    if (!actions.has(body.action)) return reply({error:'Unknown action'},400);
    let data = body.data || {};
    if (typeof data !== 'object' || Array.isArray(data)) return reply({error:'Invalid request'},400);
    if (body.action === 'login') {
      const network = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
      const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('');
      // A per-PIN window also prevents parallel guessing from multiple addresses.
      // Keep failure counters in SQL so failures survive requests and deployments.
      data = {pin:String(data.pin || ''),fingerprint:await hash('b23-network:'+network),credential_fingerprint:await hash('b23-pin:'+String(data.pin || ''))};
    }
    if (body.action === 'sign') {
      const image = data.image;
      if (typeof image !== 'string' || !/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$/.test(image)) return reply({error:'PNG signature required'},400);
      const bytes = Uint8Array.from(atob(image.split(',')[1]),c=>c.charCodeAt(0));
      if (bytes.length < 33 || bytes[12]!==73 || bytes[13]!==72 || bytes[14]!==68 || bytes[15]!==82) return reply({error:'Invalid PNG'},400);
      const view = new DataView(bytes.buffer);
      if (view.getUint32(16)>2000 || view.getUint32(20)>1000) return reply({error:'Signature dimensions too large'},400);
    }
    const token = req.headers.get('Authorization')?.replace(/^Bearer /i,'') || '';
    const response = await fetch(project+'/rest/v1/rpc/b23_onboarding', {method:'POST',
      headers:{'Content-Type':'application/json',apikey:serviceKey,Authorization:'Bearer '+serviceKey},
      body:JSON.stringify({p_action:body.action,p_token:token,p_data:data})});
    const result = await response.json();
    if (!response.ok) return reply({error:result.code==='P0001'?result.message:'Unable to process request'},400);
    return reply(result, typeof result.status === 'number' ? result.status : 200);
  } catch { return reply({error:'Unable to process request'},400); }
});
