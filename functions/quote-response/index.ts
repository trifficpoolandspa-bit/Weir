// quote-response: records a customer's answer to a quote (Approve / Deny).
//
// The email's buttons open quote-response.html on the Weir website, which
// sends the answer here straight away and thanks the customer. (Supabase shows
// pages from its own function addresses as plain text, so the thank-you page
// lives on the website.) Buttons in emails sent before that page existed come
// here directly: the answer is recorded and a plain thank-you shown.
// The latest answer counts, so a customer can change their mind.
//
// Talks to the database the same way send-report does (its own keys, straight
// requests), and says why if the database refuses rather than "not found".
//
// Deploy in Supabase (Edge Functions) as "quote-response" with
// "Verify JWT" OFF: the customer isn't signed in.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
const text = (body: string) =>
  new Response(body, { headers: { ...CORS, "content-type": "text/plain; charset=utf-8" } });

const db = async (path: string, init: RequestInit = {}) => {
  const res = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: "Bearer " + SERVICE_KEY,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const body = await res.text();
  let data: unknown = null;
  try { data = body ? JSON.parse(body) : null; } catch (_e) { data = null; }
  return { ok: res.ok, status: res.status, data, body };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const url = new URL(req.url);
  let token = url.searchParams.get("t") || "";
  let action = url.searchParams.get("a") || "";
  const fromOldEmail = req.method === "GET" && !!action;   // a button in an older email
  if (req.method === "POST") {
    try {
      const body = await req.json();
      token = String(body.t || token);
      action = String(body.a || action);
    } catch (_e) { /* keep what the address had */ }
  }
  const outcome = action === "approve" ? "approved" : action === "deny" ? "denied" : null;
  const sorry = "Thank you! We couldn't match this link to a quote. Please reply to the email or give us a call and we'll sort it out.";

  if (!token) return fromOldEmail ? text(sorry) : json({ state: "missing" });

  const found = await db("quote_responses?select=company_id,outcome&token=eq." + encodeURIComponent(token));
  if (!found.ok) {
    // The database refused: say why, rather than "not found"
    return fromOldEmail ? text(sorry) : json({ state: "error", why: found.status + " " + found.body.slice(0, 200) }, 500);
  }
  const row = Array.isArray(found.data) && found.data.length ? found.data[0] as { company_id: string; outcome: string | null } : null;
  if (!row) return fromOldEmail ? text(sorry) : json({ state: "missing" });

  const co = await db("companies?select=name&id=eq." + encodeURIComponent(row.company_id));
  const company = co.ok && Array.isArray(co.data) && co.data.length ? String((co.data[0] as { name?: string }).name || "") : "";

  if (!outcome) return json({ state: row.outcome ? "answered" : "open", outcome: row.outcome, company });

  // The latest answer counts: a customer can change their mind
  const recorded = outcome;
  const saved = await db("quote_responses?token=eq." + encodeURIComponent(token), {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ outcome, responded_at: new Date().toISOString() }),
  });
  if (!saved.ok) {
    return fromOldEmail ? text(sorry) : json({ state: "error", why: saved.status + " " + saved.body.slice(0, 200) }, 500);
  }

  if (fromOldEmail) {
    return text("Thank you for your response! " + (company ? company + " has" : "We have")
      + " your answer and will be in touch soon. You can close this page.");
  }
  return json({ state: "recorded", outcome: recorded, company });
});
