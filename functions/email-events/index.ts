// email-events
//
// Resend calls this when an email it accepted later bounces (the address
// doesn't exist), is marked as spam, or fails. Each one is kept in the
// email_events table for the company that sent it, and the office website
// shows it under Alerts → Emails (Oct 8).
//
// Oct 18: also sent, delivered, delayed and opened, which move the email
// along in email_log for History / Billing → Email history (snippet 35).
//
// Deploy with Verify JWT OFF: Resend has no Supabase sign-in. Instead every
// call is checked against the webhook's signing secret, stored in Supabase as
// RESEND_WEBHOOK_SECRET (Resend shows it as "whsec_…" on the webhook's page).
// A call without a good signature is refused.
//
// The company and customer come from the labels send-report puts on every
// email (tags: company, customer).

const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET') ?? '';

// The events worth an alert
const KEEP: Record<string, string> = {
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
  // Not sent at all: the address bounced or complained before (Oct 18)
  'email.suppressed': 'failed'
};
// Everything that moves an email along in Email history (Oct 18, snippet 35)
const PROGRESS: Record<string, string> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'delayed',
  'email.opened': 'viewed',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
  'email.suppressed': 'failed'
};

// Applies one event to the email's row in email_log. Quiet when the email
// isn't on this server, or was sent before Email history existed.
async function logProgress(emailId: string, step: string, at: string, reason: string){
  if(!emailId) return;
  try{
    await fetch(SUPABASE_URL + '/rest/v1/rpc/email_log_event', {
      method: 'POST',
      headers: {apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json'},
      body: JSON.stringify({p_id: emailId, p_event: step, p_at: at, p_reason: reason})
    });
  }catch(e){ console.log('email_log_event', String(e)); }
}

function reply(status: number, body: Record<string, unknown>){
  return new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
}

// Resend signs with Svix: HMAC-SHA256 of "id.timestamp.body", keyed with the
// secret after "whsec_", base64. The header may carry several "v1,<sig>".
async function signedByResend(req: Request, raw: string){
  if(!SECRET) return false;
  const id = req.headers.get('svix-id') || req.headers.get('webhook-id') || '';
  const ts = req.headers.get('svix-timestamp') || req.headers.get('webhook-timestamp') || '';
  const sigs = req.headers.get('svix-signature') || req.headers.get('webhook-signature') || '';
  if(!id || !ts || !sigs) return false;
  // Not more than five minutes old, so an old call can't be replayed
  const age = Math.abs(Date.now() / 1000 - Number(ts));
  if(!(age < 300)) return false;
  let keyBytes: Uint8Array;
  try{
    const b64 = SECRET.startsWith('whsec_') ? SECRET.slice(6) : SECRET;
    keyBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  }catch(e){ return false; }
  const key = await crypto.subtle.importKey('raw', keyBytes, {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(id + '.' + ts + '.' + raw));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return sigs.split(' ').some(part => {
    const sig = part.includes(',') ? part.split(',')[1] : part;
    if(sig.length !== expected.length) return false;
    let diff = 0;
    for(let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  });
}

// Tags arrive either as {name: value} or as [{name, value}]
function tag(tags: unknown, name: string){
  if(Array.isArray(tags)){
    const t = tags.find((x: any) => x && x.name === name);
    return t ? String(t.value || '') : '';
  }
  if(tags && typeof tags === 'object') return String((tags as Record<string, unknown>)[name] || '');
  return '';
}

Deno.serve(async (req: Request)=>{
  if(req.method !== 'POST') return reply(405, {error: 'Send it as a POST'});
  if(!SERVICE_KEY || !SUPABASE_URL) return reply(500, {error: 'This server is not set up'});

  const raw = await req.text();
  if(!(await signedByResend(req, raw))) return reply(401, {error: 'Not signed by Resend'});

  let event: any;
  try{ event = JSON.parse(raw); }catch(e){ return reply(400, {error: 'That was not readable'}); }
  const type = String(event && event.type || '');
  const kind = KEEP[type];
  const step = PROGRESS[type];
  // Anything else: thanks, nothing to keep (a 200 stops Resend retrying)
  if(!kind && !step) return reply(200, {ignored: true});

  const d = event.data || {};
  const at = String(event.created_at || d.created_at || new Date().toISOString());
  // Not a problem: only Email history wants to know
  if(!kind){
    await logProgress(String(d.email_id || ''), step, at, '');
    return reply(200, {kept: true});
  }
  const company = tag(d.tags, 'company');
  // An email sent before the labels existed can't be matched to a company
  if(!/^[0-9a-f-]{36}$/i.test(company)) return reply(200, {ignored: true, why: 'no company label'});

  const bounce = d.bounce || {};
  const failed = d.failed || {};
  const reason = kind === 'bounced'
    ? (bounce.message || bounce.subType || bounce.type || 'The address does not exist')
    : kind === 'complained' ? 'The customer marked it as spam'
    : type === 'email.suppressed' ? 'Not sent: this address bounced or marked an email as spam before'
    : (failed.reason || d.reason || 'The email service could not deliver it');

  const row = {
    id: String(d.email_id || '') + ':' + kind,
    company_id: company,
    customer_id: tag(d.tags, 'customer') || null,
    to_address: Array.isArray(d.to) ? d.to.join(', ') : String(d.to || ''),
    subject: String(d.subject || ''),
    event: kind,
    reason: String(reason).slice(0, 500),
    happened_at: String(event.created_at || d.created_at || new Date().toISOString())
  };
  await logProgress(String(d.email_id || ''), step, at, row.reason);
  const res = await fetch(SUPABASE_URL + '/rest/v1/email_events', {
    method: 'POST',
    headers: {apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY,
              'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal'},
    body: JSON.stringify(row)
  });
  // A company on the other server (live and beta both hear every email):
  // not ours, so nothing to keep here
  if(res.status === 409) return reply(200, {ignored: true, why: 'not a company on this server'});
  if(!res.ok){
    const said = await res.text().catch(()=> '');
    // A failure here makes Resend try again later
    return reply(500, {error: 'Could not keep it', detail: said.slice(0, 300)});
  }
  return reply(200, {kept: true});
});
