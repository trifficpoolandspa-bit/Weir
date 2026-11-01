// quote-response: records a customer's answer to a quote (Approve / Deny).
//
// The email's buttons open quote-response.html on the Weir website, which
// sends the answer here straight away and thanks the customer. (Supabase shows
// pages from its own function addresses as plain text, so the thank-you page
// lives on the website.) Buttons in emails sent before that page existed come
// here directly: the answer is recorded and a plain thank-you shown.
// The latest answer counts, so a customer can change their mind, for the
// quote's days (30 unless the office set another number when sending it,
// snippet 20) from when it was sent; after that the quote has expired.
//
// Talks to the database the same way send-report does (its own keys, straight
// requests), and says why if the database refuses rather than "not found".
//
// Send a message (Oct 22): a = "message" with m = the customer's words adds
// {at, text} to the row's messages (snippet 37); the office picks them up with
// the answers. Allowed whether or not the quote was answered or has expired.
// A plain look (a = "message", no m) returns the company and quote number.
//
// Approve or Decline on each line (Nov 1): a = "approve" / "deny" with line =
// the line's number (from 0) answers just that line; without line it answers
// every line (Approve all / Decline all). The answers are kept with the
// quote's breakdown as details.answers ('approved', 'denied' or null per
// line), so no new column is needed. The quote's outcome is "approved" when
// any line is approved, otherwise "denied" once any line is declined. The
// reply carries the lines and answers so the page can show them all and let
// the customer change any. Quotes without a breakdown (sent before snippet
// 34) answer as a whole, as before. A line the office unticked (choice: false
// in the breakdown) has no buttons of its own: it takes the quote's answer.
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

const ANSWER_DAYS = 30;

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
  let message = "";
  let lineRaw = url.searchParams.get("line");
  const fromOldEmail = req.method === "GET" && !!action && action !== "message";   // a button in an older email
  if (req.method === "POST") {
    try {
      const body = await req.json();
      token = String(body.t || token);
      action = String(body.a || action);
      message = String(body.m || "").trim().slice(0, 2000);
      if (body.line !== undefined && body.line !== null && body.line !== "") lineRaw = String(body.line);
    } catch (_e) { /* keep what the address had */ }
  }
  const outcome = action === "approve" ? "approved" : action === "deny" ? "denied" : null;
  const sorry = "Thank you! We couldn't match this link to a quote. Please reply to the email or give us a call and we'll sort it out.";

  if (!token) return fromOldEmail ? text(sorry) : json({ state: "missing" });

  const found = await db("quote_responses?select=*&token=eq." + encodeURIComponent(token));
  if (!found.ok) {
    // The database refused: say why, rather than "not found"
    return fromOldEmail ? text(sorry) : json({ state: "error", why: found.status + " " + found.body.slice(0, 200) }, 500);
  }
  const row = Array.isArray(found.data) && found.data.length ? found.data[0] as { company_id: string; outcome: string | null; created_at: string; expires_days?: number | null; messages?: unknown; details?: { number?: string; items?: { description?: string; qty?: number; price?: number; choice?: boolean }[]; answers?: unknown[]; total?: number } | null } : null;
  if (!row) return fromOldEmail ? text(sorry) : json({ state: "missing" });

  const co = await db("companies?select=name&id=eq." + encodeURIComponent(row.company_id));
  const company = co.ok && Array.isArray(co.data) && co.data.length ? String((co.data[0] as { name?: string }).name || "") : "";

  // A message from the customer (Oct 22)
  if (action === "message") {
    const number = row.details && typeof row.details === "object" ? String(row.details.number || "") : "";
    if (!message) return json({ state: "message", company, number });
    const had = Array.isArray(row.messages) ? row.messages as unknown[] : [];
    if (had.length >= 30) return json({ state: "full", company, number });
    const at = new Date().toISOString();
    const put = await db("quote_responses?token=eq." + encodeURIComponent(token), {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ messages: had.concat([{ at, text: message }]) }),
    });
    if (!put.ok) return json({ state: "error", why: put.status + " " + put.body.slice(0, 200), company }, 500);
    return json({ state: "sent", company, number });
  }

  // Past the quote's days from sending (30 unless set): expired, nothing recorded
  const days = Number(row.expires_days) || ANSWER_DAYS;
  const sentAt = new Date(row.created_at).getTime();
  if (sentAt && Date.now() - sentAt > days * 24 * 60 * 60 * 1000) {
    return fromOldEmail
      ? text("This quote has expired. It was sent more than " + days + " days ago — please contact " + (company || "us") + " for an updated quote.")
      : json({ state: "expired", outcome: row.outcome, company, days });
  }

  // The quote's lines and each one's answer, when its breakdown is kept (Nov 1)
  const details = row.details && typeof row.details === "object" ? row.details : null;
  const items = details && Array.isArray(details.items) ? details.items : [];
  const clean = (x: unknown) => (x === "approved" || x === "denied" ? x : null);
  let answers: ("approved" | "denied" | null)[] = items.map((_it, i) =>
    clean(details && Array.isArray(details.answers) ? details.answers[i] : null) ?? (row.outcome && !(details && Array.isArray(details.answers)) ? clean(row.outcome) : null));
  const lines = () => ({
    number: details ? String(details.number || "") : "",
    items: items.map((it) => ({ description: String(it.description || ""), qty: Number(it.qty) || 0, price: Number(it.price) || 0, choice: it.choice !== false })),
    answers,
  });

  if (!outcome) return json({ state: row.outcome ? "answered" : "open", outcome: row.outcome, company, ...lines() });

  // The latest answer counts: a customer can change their mind
  const lineNo = lineRaw !== null && /^\d+$/.test(lineRaw) ? Number(lineRaw) : -1;
  let recorded: string = outcome;
  const patch: Record<string, unknown> = { responded_at: new Date().toISOString() };
  if (items.length) {
    const asks = (i: number) => items[i].choice !== false;
    if (lineNo >= 0 && lineNo < items.length && asks(lineNo)) answers[lineNo] = outcome;
    else answers = items.map(() => outcome);
    // Judged on the lines the customer answers; the rest go along with it
    const own = answers.filter((_a, i) => asks(i));
    recorded = (own.length ? own : answers).includes("approved") ? "approved" : "denied";
    answers = answers.map((a, i) => (asks(i) ? a : (own.some((x) => x) ? recorded as "approved" | "denied" : a)));
    patch.details = { ...details, answers };
  }
  patch.outcome = recorded;
  const saved = await db("quote_responses?token=eq." + encodeURIComponent(token), {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
  if (!saved.ok) {
    return fromOldEmail ? text(sorry) : json({ state: "error", why: saved.status + " " + saved.body.slice(0, 200) }, 500);
  }

  if (fromOldEmail) {
    return text("Thank you for your response! " + (company ? company + " has" : "We have")
      + " your answer and will be in touch soon. You can close this page.");
  }
  return json({ state: "recorded", outcome: recorded, company, line: lineNo >= 0 && lineNo < items.length ? lineNo : null, ...lines() });
});
