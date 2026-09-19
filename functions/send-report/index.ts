// send-report
//
// Sends a service report, or an "on my way" note, from the office rather than
// from a phone. A phone that is off, out of signal or closed no longer holds up
// somebody's report: the phone hands it over and the server does the sending.
//
// It runs in Supabase (Edge Functions) and sends through Resend, using the key
// stored as RESEND_API_KEY. The key never goes near the apps, which are public
// files anyone can read.
//
// Who may use it: anyone signed in, for a customer in their own company. The
// company name on the email and the address replies go to are read from the
// server, not taken from the caller, so nobody can send as another company.

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SENDING_ADDRESS = 'reports@getweir.com';

// A browser asks first which headers it may send. Anything the app sends that
// is missing from this list makes the browser block the request before it
// leaves, which looks exactly like having no signal.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, accept',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400'
};

function reply(status: number, body: Record<string, unknown>){
  return new Response(JSON.stringify(body), {
    status,
    headers: {...CORS, 'Content-Type': 'application/json'}
  });
}

// Everything the caller is allowed to send as, read from the server
async function whoIsAsking(token: string){
  const ask = async (path: string) => {
    const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
      headers: {apikey: ANON_KEY, Authorization: 'Bearer ' + token}
    });
    return res.ok ? await res.json() : null;
  };
  const membership = await ask('rpc/my_membership');
  if(!membership || !membership.company_id) return null;

  // The company's own details, as the office set them
  const rows = await ask("company_records?select=data&kind=eq.company&id=eq.details");
  const details = Array.isArray(rows) && rows[0] ? rows[0].data || {} : {};
  return {
    companyId: membership.company_id,
    companyName: details.companyName || membership.company_name || 'Your pool service',
    replyTo: details.accountEmail || null,
    technicianId: membership.technician_id || null
  };
}

// Inline images cannot be clicked in most mail apps, so each photo is also
// kept in the company's own folder and linked to. The link lasts a year, which
// outlives the report itself being useful.
async function keepFullSize(companyId: string, id: string, content: string){
  if(!SERVICE_KEY) return '';
  const path = companyId + '/reports/' + id + '.jpg';
  try{
    const bytes = Uint8Array.from(atob(content), c => c.charCodeAt(0));
    const put = await fetch(SUPABASE_URL + '/storage/v1/object/visit-photos/' + path, {
      method: 'POST',
      headers: {apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'image/jpeg'},
      body: bytes
    });
    if(!put.ok && put.status !== 409){
      const said = await put.json().catch(()=> ({}));
      if(String(said.statusCode) !== '409') return '';
    }
    const signed = await fetch(SUPABASE_URL + '/storage/v1/object/sign/visit-photos/' + path, {
      method: 'POST',
      headers: {apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json'},
      body: JSON.stringify({expiresIn: 60 * 60 * 24 * 365})
    });
    if(!signed.ok) return '';
    const out = await signed.json();
    return out.signedURL ? SUPABASE_URL + '/storage/v1' + out.signedURL : '';
  }catch(e){ return ''; }
}

Deno.serve(async (req: Request)=>{
  if(req.method === 'OPTIONS') return new Response('ok', {headers: CORS});
  if(req.method !== 'POST') return reply(405, {error: 'Send it as a POST'});
  if(!RESEND_API_KEY) return reply(500, {error: 'This server has no sending key set up'});

  const auth = req.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if(!token) return reply(401, {error: 'Sign in first'});

  const who = await whoIsAsking(token);
  if(!who) return reply(403, {error: 'That account is not attached to a company'});

  let body: Record<string, any>;
  try{ body = await req.json(); }catch(e){ return reply(400, {error: 'That was not readable'}); }

  const to = String(body.to || '').trim();
  const subject = String(body.subject || '').trim();
  const html = String(body.html || '');
  if(!to || to.indexOf('@') === -1) return reply(400, {error: 'No email address to send to'});
  if(!subject || !html) return reply(400, {error: 'A report needs a subject and a body'});

  // Photos come as data the phone already has. They go inside the report
  // rather than hanging off the bottom of it: each one is referenced from the
  // page by an id, which is what "cid:" means in an email. Anything past what
  // the email service accepts is left out rather than failing the whole send.
  const attachments: Array<Record<string, string>> = [];
  const shown: Array<{id: string, name: string, caption: string, link: string, content: string}> = [];
  let carried = 0;
  (Array.isArray(body.photos) ? body.photos : []).forEach((p: any, i: number)=>{
    if(!p || !p.content) return;
    const size = String(p.content).length * 0.75;
    if(carried + size > 20 * 1024 * 1024) return;
    carried += size;
    const id = 'photo-' + (i + 1);
    attachments.push({
      filename: String(p.filename || ('photo-' + (i + 1) + '.jpg')),
      content: String(p.content),
      content_type: 'image/jpeg',
      content_id: id
    });
    shown.push({id: id, name: String(p.filename || ''), caption: String(p.caption || ''),
                link: '', content: String(p.content)});
  });

  for(const p of shown){
    p.link = await keepFullSize(who.companyId, p.id + '-' + Date.now().toString(36), p.content);
  }

  // The phone says what each photo is — "Pool before", "Spa after" — because
  // only the phone knows which body of water it came from. Older phones send
  // nothing, so the file name is read as a fallback. A file name is never shown
  // as a caption either way.
  const kindOf = (p: {name: string, caption?: string})=>{
    const said = String(p.caption || '').trim();
    if(said) return said.charAt(0).toUpperCase() + said.slice(1);
    const name = String(p.name || '');
    return /before/i.test(name) ? 'Before' : (/after/i.test(name) ? 'After' : '');
  };
  const labelThem = shown.some(p => kindOf(p));

  // A quarter of the width they were: big enough to see what was done, small
  // enough that the report still reads as a report. Mail apps let the reader
  // tap one to see it full size.
  // Wide enough to see the pool, narrow enough that two sit side by side in a
  // 520-wide report. The width is declared on the image itself as well as the
  // cell, because mail apps ignore one or the other.
  const PHOTO_WIDTH = 240;

  function photoCard(p: {id: string, name: string, link: string, caption?: string}, label: string){
    const img = '<img src="cid:' + p.id + '" alt="' + (label || 'Photo from this visit') + '" '
      + 'width="' + PHOTO_WIDTH + '" '
      + 'style="display:block;width:' + PHOTO_WIDTH + 'px;max-width:100%;height:auto;'
      + 'border-radius:8px;border:1px solid #E6E9E8;">';
    // A link to the full-size copy, since an inline image cannot be tapped in
    // most mail apps
    const clickable = p.link
      ? '<a href="' + p.link + '" target="_blank" style="text-decoration:none;">' + img + '</a>'
      : img;
    return clickable
      + (label ? '<div style="font-size:12px;color:#6B7B79;margin-top:5px;">' + label + '</div>' : '');
  }

  function photoSection(){
    if(!shown.length) return '';
    let cards = '';
    if(labelThem && shown.length === 2){
      // Before and after belong next to each other, so the difference is the
      // first thing anyone sees
      cards = '<tr>'
        + '<td valign="top" width="' + PHOTO_WIDTH + '" style="padding:0 12px 14px 0;width:' + PHOTO_WIDTH + 'px;">'
        + photoCard(shown[0], kindOf(shown[0])) + '</td>'
        + '<td valign="top" width="' + PHOTO_WIDTH + '" style="padding:0 0 14px;width:' + PHOTO_WIDTH + 'px;">'
        + photoCard(shown[1], kindOf(shown[1])) + '</td></tr>';
    } else {
      cards = shown.map(p=>
        '<tr><td style="padding:0 0 14px;">' + photoCard(p, kindOf(p)) + '</td></tr>'
      ).join('');
    }
    return '<tr><td style="padding:0 26px 26px;">'
      + '<div style="font-size:13.5px;font-weight:600;color:#16302E;margin:8px 0 12px;">'
      + (shown.length === 1 ? 'Photo from this visit' : 'Photos from this visit') + '</div>'
      + '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;">'
      + cards + '</table></td></tr>';
  }

  // Above the sign-off and the company name, so the report reads: what was
  // done, the photos, then thank you.
  function withPhotos(page: string){
    const section = photoSection();
    if(!section) return page;
    const footer = page.lastIndexOf('<tr><td style="padding:26px;">');
    if(footer !== -1) return page.slice(0, footer) + section + page.slice(footer);
    const at = page.lastIndexOf('</table></td></tr></table>');
    if(at === -1) return page + section;
    return page.slice(0, at) + section + page.slice(at);
  }

  const from = who.companyName.replace(/["<>]/g, '') + ' via Weir <' + SENDING_ADDRESS + '>';
  const payload: Record<string, unknown> = {
    from,
    to: [to],
    subject,
    html: withPhotos(html),
    ...(who.replyTo ? {reply_to: who.replyTo} : {}),
    ...(attachments.length ? {attachments} : {})
  };

  const sent = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {Authorization: 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json'},
    body: JSON.stringify(payload)
  });
  const result = await sent.json().catch(()=> ({}));
  if(!sent.ok){
    return reply(sent.status, {error: result.message || 'The email service refused it', detail: result});
  }
  return reply(200, {sent: true, id: result.id, from: from, replyTo: who.replyTo});
});
