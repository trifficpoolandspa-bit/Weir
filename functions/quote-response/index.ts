// quote-response: records a customer's answer to a quote (Approve / Deny).
//
// The confirmation page the customer sees is quote-response.html on the Weir
// website (Supabase shows pages from its own function addresses as plain
// text, so the page can't live here). That page asks this function about the
// quote (GET) and sends the answer when the customer presses its button
// (POST). Email safety scanners open links but never press buttons, so they
// can't answer by accident. The first answer counts.
//
// Deploy in Supabase (Edge Functions) as "quote-response" with
// "Verify JWT" OFF: the customer isn't signed in.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const url = new URL(req.url);
  let token = url.searchParams.get("t") || "";
  let action = url.searchParams.get("a") || "";
  if (req.method === "POST") {
    try {
      const body = await req.json();
      token = String(body.t || token);
      action = String(body.a || action);
    } catch (_e) { /* keep what the address had */ }
  }
  if (!token) return json({ state: "missing" }, 400);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: row } = await sb.from("quote_responses")
    .select("company_id, outcome").eq("token", token).maybeSingle();
  if (!row) return json({ state: "missing" });
  const { data: co } = await sb.from("companies").select("name").eq("id", row.company_id).maybeSingle();
  const company = co?.name || "";

  if (row.outcome) return json({ state: "answered", outcome: row.outcome, company });
  if (req.method !== "POST") return json({ state: "open", company });

  const outcome = action === "approve" ? "approved" : action === "deny" ? "denied" : null;
  if (!outcome) return json({ state: "missing" }, 400);
  // The first answer counts
  const { data: saved } = await sb.from("quote_responses")
    .update({ outcome, responded_at: new Date().toISOString() })
    .eq("token", token).is("outcome", null).select("outcome");
  if (!saved || !saved.length) {
    const { data: again } = await sb.from("quote_responses").select("outcome").eq("token", token).maybeSingle();
    return json({ state: "answered", outcome: again?.outcome || outcome, company });
  }
  return json({ state: "recorded", outcome, company });
});
