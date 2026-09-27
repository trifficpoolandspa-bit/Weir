# Weir — in progress

Every change moves through three stages:

- **Waiting on Tyrus** — built and handed over, not yet tried
- **Approved, checks owed** — Tyrus is happy; permanent checks and suites still to run
- **Done** — checks written and passing, then removed from this log

Tyrus commits changes to the **live** repo (`Weir`) and tests there. **Weir-Beta** is kept for the beta testers and is updated only when Tyrus chooses.

**Style rule:** everything seen follows `style-guide.md` in the project files. Read it before building anything visible. Reuse what exists; no colour literals; one primary button per card; no one-off styles. **Windows close only from their own buttons** — never from a click outside them (the website also ignores backdrop clicks page-wide, so a new window can't slip).

**Testing note:** new companies start with the pool after photo required for Everyone. Every suite's pages start as a company with nothing ticked for Everyone (`weir:photoEveryone` = `{}`), so visits that take no photos still save; the starting setting is tested on its own. The `send-report` function must sit beside the tests (`functions/send-report/`), or the visit photo and report email suites stop early.

**Database rule (Supabase, from Oct 30, 2026):** new tables in `public` no longer get Data API access automatically. Every snippet that creates a table must grant access in the same snippet: `authenticated` for what the app does, `service_role` only if an Edge Function reads that table with the service key, and **nothing to `anon`** (Weir removes anon access on purpose). The existing snippets already do this; existing tables are unaffected.

Last updated: Sept 24, 2026

---

## Waiting on Tyrus

**1. Carried over from the last session: built and committed, never tried**
1.1. Customer groups: members share an edited setup; outsiders untouched; removing someone returns them to defaults; adding someone with their own setup warns first.

**Sept 24–25 work, suite-tested — still to try on a real phone / the website:**
- **1w.** "Every week" with part of the day done keeps the rest of the route in place
- **1as.** Phones: a rescheduled customer only shows for their own technician
- **1au.** WorkCenter: no "Editing…" heading
*(A line on each is under Done — Sept 25 below.)*

**1ba. A customer on two days: each day's visit is its own** — *taken off Tyrus's checklist Sept 26*
*(Files: `technician-app.html`, `admin-readings-app.html`)*
1ba.1. Servicing a customer who's on two days (an extra day, or John Tyler's Wednesday and Thursday) clears only that day's visit; the other day still shows. Reservice brings back only the latest service's day.
1ba.2. Cause: each customer had one "last serviced" date, and a day hid the customer if that date was on or after it — so servicing one of two days hid both, and Reservice brought both back.
1ba.3. Each service now notes which day's visit it was for. A later service on a day that isn't one of the customer's own days still counts as a catch-up for the missed day, as before. Customers without the new note keep the old rule until their next service.

**1bb. Technicians in A–Z order** — *taken off Tyrus's checklist Sept 26*
*(File: `customer-intake.html`)*
1bb.1. The Saved technician window (Work Order, Task, Quote) lists technicians alphabetically, ignoring capitals; Unassigned, where offered, stays at the top.

**1bc. Work orders: History only once submitted; Edit from Current** — *taken off Tyrus's checklist Sept 26*
*(Not yet tried in real use; existing suites pass. File: `customer-intake.html`)*
1bc.1. A finalized work order appears under Work Order → Current only. Work Order → History shows only work orders submitted in the field (the "Work orders finalized" list is gone). Tasks already worked this way.
1bc.2. Work Order → Current has no heading or grey note, just the list. (Task and Quote Current keep theirs — ask if they should go too.)
1bc.3. **Edit** on each work order in Current opens the Work Order tab with it loaded (not on a visit whose work order was deleted).
1bc.4. **Edit & resend** on each work order submitted in the field (History) does the same. A quote's Edit & resend in Quote History now opens the Quote tab too (it used to load into a form hidden behind History).
1bc.5. Deleting a saved work order is done from the customer's profile (quotes & work orders list), since the finalized list is gone.

**1bd. Readings & dosages: additions on the spa / extra body stay** — *taken off Tyrus's checklist Sept 26*
*(File: `customer-intake.html`)*
1bd.1. Add Sodium Bicarbonate to the Spa and Extra tabs; it's still there the next day, after signing in again, and after opening the website on another computer.
1bd.2. Cause 1: opening the website tidied the lists (filled in missing quick buttons, or used the defaults in a browser with none stored) and *saved* them. Sync saw a newer copy and sent it to the server, replacing the lists with Sodium Bicarbonate. The product starter list did the same to products. Now that tidying happens on the page only and is never stored or sent.
1bd.3. Cause 2: with "use the pool's dosages (or readings) for all" on, any save while the Pool tab was showing copied the pool's list over the spa and extra lists, wiping what only they had. Now the pool's list is copied and the spa's / extra's own additions are kept.
1bd.4. Sodium Bicarbonate needs adding once more after this is live (the server's copy is the one that lost it).

**1be. Skip service acts like a submitted report** — *taken off Tyrus's checklist Sept 26*
*(Files: `technician-app.html`, `admin-readings-app.html`)*
1be.1. Skipping a customer's service takes them off the day it was skipped from (not their other days) and puts them under Serviced today, where Reservice brings the skipped day back. The skip itself is still recorded for the skipped day.
1be.2. Cause: Skip service is pressed from the day's list, where no visit was started, so the "which day" note (1ba) wasn't set and the skip counted for the wrong day. In the admin app the skip also stamped the customer with the skipped day instead of today, so it never showed under Serviced today.

**1bf. Work order Photo required; Delete and Edit & resend on History items** — *taken off Tyrus's checklist Sept 26*
*(Not yet tried in real use; suites pass. Files: all three app files)*
1bf.1. Work Order form only (not Quote — fixed after it wrongly showed on Quote too): **Photo required** tick box right of the scheduled date. Saved on the work order and each of its visits, loaded when editing, cleared with the form. On the phones the visit shows "Photo: Required" and won't submit until a photo is taken.
1bf.2. Work Order History and Task History items each have **Edit & resend** and a red **Delete** (asks first), identical on both tabs. (Delete had gone with the removed "Work orders finalized" list — restored.)
1bf.3. A task's Edit & resend opens it on the Task form (Save changes); saving puts it back out as not done. A work order's opens it on the Work Order tab.

**1bg. Serviced today: one row per serviced day** — *taken off Tyrus's checklist Sept 26*
*(Files: `technician-app.html`, `admin-readings-app.html`)*
1bg.1. A customer serviced for two of their days shows under Serviced today twice, each row saying which day it was for ("For Wed, Sep 23 · address"). Customers with one service show as before (the day shows once any row has one).
1bg.2. Each row's Reservice brings back only its own day; the other stays under Serviced today with its time. Skips count the same way.
1bg.3. Reservice needed two presses (Tyrus): a customer could hold two notes for the same day (serviced, Reserviced and done again, or from both apps), and each press removed only one. Now a day is noted once (a new service replaces its note), one Reservice clears every note for that day, and Serviced today shows each customer and day once. *(Not tested — no suites run, per Tyrus.)*

**1bh. Readings & dosages: moving a row no longer copies it** — *taken off Tyrus's checklist Sept 26*
*(File: `customer-intake.html`)*
1bh.1. Dragging a row in the main Readings & dosages list (desktop website) moves it; no extra copy appears where it's dropped, unit filled in or not.
1bh.2. Likely cause (couldn't be reproduced here): the list redrawn mid-drag (a sync arriving) left an old copy of the row in it, and the drop read the row twice and saved it twice. Now each row counts once on drop and leftovers are removed; the saved order holds each item once and keeps anything missing at the end. (All drag lists on the website share this, so they're covered too.)
1bh.3. Copies already saved show once when the lists load (on the page only); the next real change saves the lists without them. Don't use × on a copied row before this is live — it would remove both.
1bh.4. Found the trigger (Tyrus's error "Cannot read properties of null (reading 'insertBefore')"): a sync — including the website's own change coming back about 2 seconds after adding or changing a row — redrew the list while a row was being dragged. The drag still held the old row: before it lifted, that errored; mid-drag, the old row was dropped back in beside the new ones (the copy).
1bh.5. Now a sync that would redraw these lists waits while a row is being dragged (mouse or touch), and a drag whose row was redrawn anyway stops quietly (drag again) instead of erroring or copying.

**1bi. WorkCenter: no headings on Current and History** — *suite-tested Sept 26*
*(File: `customer-intake.html`)*
1bi.1. No heading (or grey note / count) on Quote Current ("Open quotes"), Quote History ("Quotes sent" — search box stays), Work Order History and Task History ("Submitted from the field"), or Task Current ("Scheduled tasks"). Work Order Current already had none.

**1bj. Website: one click outside a field leaves it** — *suite-tested Sept 26*
*(File: `customer-intake.html`)*
1bj.1. On the Technicians tab (and everywhere on the website), clicking outside a field once takes it out of its clicked state; no second click.
1bj.2. Likely cause: parts of the page stop a press from doing its usual thing (drag grips, rows that shouldn't select text); a first click landing on one left the field active. Now any press outside a field that isn't another field, button, menu, link or label leaves it at once. A drag grip keeps the field (so a drag isn't cut short).
1bj.3. If one spot still needs two clicks, note which (the cause may be something else there).

**1bk. WorkCenter History: search, technician and date** — *suite-tested Sept 26*
*(File: `customer-intake.html`)*
1bk.1. Quote History: a date box beside the search (only quotes dated or made that day).
1bk.2. Work Order History and Task History: one row with a search box (customer, job, notes, technician), a technician menu (All technicians, A–Z) and a date box (submitted that day). They combine; clearing one shows more again; "Nothing matches." when nothing does.
1bk.3. Their search box now reads "Search by customer name, address, phone, or email", like Quote History's, and searches those (plus the job, notes and technician).

**1bl. WorkCenter Current and History: ten a page, arrows in the Select bar** — *suite-tested Sept 26*
*(File: `customer-intake.html`)*
1bl.1. Current and History for Quote, Work Order and Task each show ten rows a page. The page arrows sit in the middle of the Select bar (Select / Select all / Delete stay on the right), only when there's more than one page.
1bl.2. Select all ticks the page shown. Searching, a technician or date, or switching tab or kind starts on page 1. (A customer's Service Reports keep their own arrows at the foot, unchanged.)
1bl.3. On those six lists, Select (and Select all / Delete N selected / Done) sits far left of the bar; page arrows stay in the middle. A customer's Service Reports keep Select on the right.

**1bm. Current: Mark completed / Mark approved** — *suite-tested Sept 26*
*(File: `customer-intake.html`)*
1bm.1. Work Order → Current and Task → Current: each row has **Mark completed** (one press). It's marked done as if submitted in the field and moves to History, "by the office" (still filed under its technician for the technician filter). It leaves the technician's route at the next sync.
1bm.2. Quote → Current: **Mark approved** (replaces ✓ Close). One press moves the quote to History.
1bm.3. Quote History now lists only approved quotes (open ones are in Current); quotes closed earlier with ✓ Close count as approved.
1bm.4. Quote → Current: **Mark denied** to the right of Mark approved, same style; one press moves the quote to History too (saved as denied). Quote History has a menu between the search box and the date box — All / Approved / Denied — to show just one (quotes closed earlier with ✓ Close count as Approved).

**1bn. Readings & dosages: the Spa / Extra tab's own rows keep their place** — *suite-tested Sept 26*
*(File: `customer-intake.html`)*
1bn.1. A row only the Extra (or Spa) tab has, like Sodium Bicarbonate, stays where it was dragged to.
1bn.2. Cause (a side effect of 1bd): with "use the pool's dosages (readings) for all" on, each save on the Pool tab copied the pool's list across and put the tab's own rows back at the end. Now each goes back right after the row it sat under on its own tab (at the top if it was first); the pool's rows keep the pool's order.

**1bo. Customers approve or deny a quote from its email** — *suite-tested Sept 26 (website side); needs snippet 17 and the quote-response function*
*(Files: `customer-intake.html`, `sql/17 - quote responses.sql` + check, `functions/quote-response/index.ts`)*
1bo.1. Set up once: run snippet 17 in Supabase, then its check (every row "ok"); deploy it as an Edge Function named **quote-response** (code: `functions/quote-response/index.ts`, beside `functions/send-report/index.ts`) with **Verify JWT off**.
1bo.2. Each quote email has **Approve** and **Deny** buttons (above the closing). A button opens a page asking the customer to confirm ("Approve this quote" / "Deny this quote"); only pressing that records it — email link-checkers can't answer by accident. The first answer counts; a later press says it's already in.
1bo.3. At each sync (every minute, and on opening the WorkCenter) the website files answered quotes into History as Approved or Denied (the History menu shows them) and takes them off Current.
1bo.4. Each sending (including Edit & resend) gets a fresh code; if the code can't be saved (offline, or before snippet 17), the email goes without the buttons.
1bo.5. Quotes stay in the website's browser storage (not on the server); only the answers are on the server, matched by the quote's id — so answers are picked up by the browser the quote was sent from.
1bo.6. Fixed after Tyrus's try: Supabase shows pages from its function addresses as plain text, so the confirmation page appeared as code and nothing could be pressed (the quote stayed in Current). The page is now `quote-response.html` on the Weir website (main folder); the email's buttons go there (with the quote's code and which server to tell), and the function only records answers (redeploy the new `functions/quote-response/index.ts`). Quotes sent before this fix have dead buttons — resend.
1bo.7. Changed (Tyrus: still saw the code page — the old function was still running, or an older email): pressing Approve or Deny now records the answer straight away, no confirm step, and shows a styled "Thank you for your response! … will be in touch soon" page with an Approved / Declined badge. Buttons in older emails (straight to the function) also record the answer and show a plain thank-you line. **Redeploy the function** with the new `index.ts` — the code page means Supabase still has the old code. Trade-off Tyrus chose: with no confirm step, an email security scanner that runs the page could answer a quote on its own.
1bo.8. "This quote can't be found" (Tyrus): checked on live — the codes are saved correctly (4 rows, all Triffic, the first test email's code among them) and the new function was deployed, yet it answered "missing" for a real code: its database library was failing silently. Rewritten to reach the database exactly as send-report does (its own keys, direct requests), and to report the database's reason instead of "not found". **Redeploy `functions/quote-response/index.ts`**; the updated `quote-response.html` shows "Almost there" if recording ever fails.
1bo.9. Working end to end (Tyrus saw "Quote approved"; the answer was on the server and his Chrome's website had moved the quote to History). Changed: the **latest** press counts (Deny after Approve now records denied, and the website moves the quote to match); no text cursor on the thank-you page; the website checks for answers on opening Current or History and a few seconds after the page opens, as well as every minute. **Redeploy the function** again. Reminder: a quote moves only in the browser it was sent from.

**1bp. Quotes: click a row to see the email the customer got** — *suite-tested Sept 26*
*(File: `customer-intake.html`)*
1bp.1. Clicking a quote's row in Quote Current or Quote History opens a window with the email exactly as sent (template, wording, Approve / Deny buttons), its subject, and when and to whom it went. Close button only. The buttons inside can't be pressed from there.
1bp.2. Each quote now keeps a copy of its email when sent. Quotes sent before this show the email rebuilt with today's template, without the Approve / Deny buttons (the window says so).
1bp.3. Clicking the row's own buttons, or a row while selecting, works as before.

**1bq. Current search matches History's** — *suite-tested Sept 26*
*(File: `customer-intake.html`)*
1bq.1. Quote, Work Order and Task Current: the search box reads "Search by customer name, address, phone, or email" and searches those (plus the work).

**1br. Quote name** — *suite-tested Sept 26*
*(File: `customer-intake.html`)*
1br.1. The Quote form (only) has a **Quote name** box between Scheduled date and Customer. Saved with the quote, filled back in on Edit & resend, cleared with the form, held for a minute with the rest. Not yet shown on the Current / History rows or in the email — ask Tyrus.

**1bs. "Declined", not "Denied"** — *suite-tested Sept 26*
*(File: `customer-intake.html`)*
1bs.1. Quote email button: **Decline** (was Deny). Quote Current: **Mark declined**. Quote History menu: All / Approved / **Declined**. (Emails already sent keep their old "Deny" button; it still works.) Tyrus confirmed quotes move from Current to History on Approve / Deny.

**1bt. Customers can change their answer for 30 days** — *suite-tested Sept 26 (website side); redeploy the function*
*(Files: `functions/quote-response/index.ts`, `quote-response.html`, `customer-intake.html`)*
1bt.1. Within 30 days of sending, pressing Approve or Decline again changes the answer (latest counts), and History moves the quote between Approved and Declined to match.
1bt.2. After 30 days nothing is recorded: the page says "This quote has expired — sent more than 30 days ago, please contact <company> for an updated quote" (older emails show the same as a line of text).
1bt.3. Each sending, including Edit & resend, starts a fresh 30 days (quotes sent before this count from their first sending).

**1bu. Convert a quote to a work order; Photo required starts ticked** — *suite-tested Sept 26*
*(File: `customer-intake.html`)*
1bu.1. Quote History rows: **Convert to work order**, left of Edit & resend. Opens the Work Order tab as a new work order with the quote's customer and line items filled in (date, technician, repeat left to set); the quote stays in History unchanged.
1bu.2. **Photo required** is ticked on every new work order (opening the tab, after finalizing, converting a quote). Editing a saved work order shows what it was saved with. Quotes never carry it.

**1bv. Quote numbers** — *suite-tested Sept 26*
*(File: `customer-intake.html`)*
1bv.1. Each quote sent gets the next number (1, 2, 3...); several customers at once each get their own; Edit & resend is a new sending, so the next number.
1bv.2. Quote form: "Quote #N" (the number the next one will get) at the far right of the date line; moves on after sending. Email: "Quote #N" at the far right of the date line.
1bv.3. The last number used syncs (quoteCounter), so numbering carries on from any computer. Two computers sending in the very same moment could still share a number.
1bv.4. Shown as just the number, four digits, in a small outlined tag (#0007) — on the email's date line and the Quote form — no "Quote" wording.
1bv.5. The number tag is a little bigger and sits about 12px in from the right edge, on the form and in the email.
1bv.6. In the email the number now sits on the top line, just right of the word QUOTE (tag kept); the date line shows only the date. The form keeps it at the right of its date line.
1bv.7. The window from clicking a quote row shows the number on the top line too: quotes sent before 1bv.6 have it moved up beside QUOTE as the window opens (the customer's copy is unchanged); rebuilt older ones get it there as well.

**1bw. Quote History rows: customer — quote name, and an APPROVED / DECLINED tag** — *suite-tested Sept 26*
*(File: `customer-intake.html`)*
1bw.1. Each Quote History row reads "<customer> — <quote name>" (no "Quote —"; just the customer when unnamed), with a bold all-caps tag just right of it: green APPROVED or red DECLINED, the height of the row's buttons (quotes closed with ✓ Close show APPROVED).
1bw.2. Quote Current rows read the same way: "<customer> — <quote name>" (was the customer and the line items); just the customer when unnamed. The search still finds the items.
1bw.3. The APPROVED / DECLINED tag now sits with the row's buttons, just left of Convert to work order, so it stays put whatever the quote's name.
1bw.4. APPROVED and DECLINED tags are the same width (100px), the word centred.

**1bx. Email window without Approve / Decline; rows highlight on hover** — *suite-tested Sept 26*
*(File: `customer-intake.html`)*
1bx.1. The window that opens on clicking a quote row shows the email without its Approve / Decline buttons (they stay in the real email).
1bx.2. Rows in Current and History for Quote, Work Order and Task light up (pale teal) under the pointer.

**1by. Thank-you page: "Close this page"** — *suite-tested Sept 26*
*(File: `quote-response.html`)*
1by.1. The foot of the thank-you page has a clickable **Close this page** (under the company's name) that closes it. Where the browser won't let a page close its own tab, it changes to "You can close this tab now".

**1bz. Unanswered quotes expire after 30 days** — *suite-tested Sept 26*
*(File: `customer-intake.html`)*
1bz.1. A quote sent and not answered within 30 days moves from Current to History by itself, with a **grey EXPIRED** tag (same size and place as APPROVED / DECLINED). Checked on opening Current or History, a few seconds after the page loads, and every minute.
1bz.2. History's menu: All / Approved / Declined / **Expired**. Convert to work order and Edit & resend work on it (Edit & resend = a fresh quote, new 30 days). Unsent drafts don't expire.
1bz.3. An answer given within the 30 days but picked up later still wins over Expired.

**1ca. Work order numbers** — *suite-tested Sept 26*
*(File: `customer-intake.html`)*
1ca.1. Work orders are numbered on their own count from #0001 (separate from quotes): each work order gets the next number on Finalize; several customers at once each get their own.
1ca.2. The Work Order form shows the next number at the right of the date line, in the same tag as quotes. The number is saved on the work order and on each of its visits. The count syncs (workOrderCounter).
1ca.3. Not yet shown anywhere else (Current / History rows, the phones) — ask Tyrus.
1ca.4. Date line fixed: Photo required back right beside the date (12px, as on the Task form), the number at the far right (12px in, the same for quotes and work orders).

**1cb. Buttons centred on Work Order and Task History rows** — *suite-tested Sept 26*
*(File: `customer-intake.html`)*
1cb.1. Edit & resend and Delete (and the Select tick) on Work Order and Task History rows are centred top to bottom (they sat at the top). Current rows were already centred.

**1cc. Filter clean group date: the year can be typed** — *suite-tested Sept 26*
*(File: `customer-intake.html`)*
1cc.1. Typing a date into a filter clean group's date box no longer kicks you out at the year. Cause: each change saved and redrew the group list, and a date counts as complete from the year's first digit, so the box was replaced mid-typing. Now it saves as it changes and redraws only on leaving the box. (It was the only date box on the website doing this.)

**1cd. Filter clean groups can be put in any order** — *suite-tested Sept 26*
*(File: `customer-intake.html`)*
1cd.1. Each filter clean group has a ≡ grip at the left of its heading; drag it to move the group. The order is saved. Pressing the grip doesn't open or close the group.

**1ce. A filter clean group's customers in your order, on the technician's phone** — *suite-tested Sept 26*
*(Files: `customer-intake.html`, `technician-app.html`)*
1ce.1. In an open filter clean group, each customer tag has a ≡ grip: drag them into order; saved with the group.
1ce.2. That order goes with the group's filter cleans; the technician app lists that day's filter cleans in it (after the regular route). Reordering an already scheduled group updates the phones at their next sync. A technician's own rearranging of that day still wins.
1ce.3. The admin app doesn't add filter cleans to a day that isn't the customer's (it only counts them) — unchanged.

**1cf. Search boxes in windows: ready to type, and empty on a click back in** — *suite-tested Sept 26*
*(File: `customer-intake.html`)*
1cf.1. Any window with a search box (filter group / group customer pickers, the photo window's Which customers, a technician's assign list, deleted customers, equipment windows…) opens with the cursor already in its search box — unless something in it already has the cursor.
1cf.2. Clicking back into a window's search box after clicking away empties it, ready for a fresh name; clicking away without typing puts the old text back (as the main customer boxes already did).
1cf.3. Changed (Tyrus): a search box in a window (e.g. + Add customers for a filter group) empties on every click, even with the cursor already in it, and nothing is put back afterwards. The main page's customer boxes keep their put-back rule.
1cf.4. The filter group's + Add customers window also puts the cursor in its search box itself as it opens (not relying on the page-wide rule).
1cf.5. Third report (Tyrus): the filter group's + Add customers window now empties its search box on every press, in the window's own code, and has no × any more. Tried in real Chromium: opens with the cursor in the box; after typing and ticking a customer, clicking the box empties it (all rows back); clicking it while still in it empties it too; nothing is ever put back.
1cf.6. Refined (Tyrus): while the search box is being typed in it's a normal box (clicks move the cursor, drag / double-click highlights); only coming back to it from elsewhere empties it. Same for the page-wide rule on window search boxes. Checked in real Chromium: click inside while typing keeps the text, double-click highlights a word, click away then back empties it.

**1cg. Filter clean groups: rows highlight on hover** — *suite-tested Sept 26*
*(File: `customer-intake.html`)*
1cg.1. Each filter clean group's heading, and each customer row in the window for adding customers to a group, lights up pale teal under the pointer (the WorkCenter rows' colour).

**1ch. Filter clean groups: no Save group button** — *suite-tested Sept 26*
*(File: `customer-intake.html`)*
1ch.1. Save group is gone. Every change to a group already saves as it's made: name, date, technician, adding / removing customers, and both kinds of reordering. The button that sends the filter cleans to the technician is unchanged.

**1ci. Filter clean groups: new subtext** — *suite-tested Sept 26*
*(File: `customer-intake.html`)*
1ci.1. Under the heading: "Group customers together, give the group a date and a technician, then press Schedule to push it onto that technician's route. Customize emails to send to groups individually or all together."

**1cj. Filter clean groups close after a minute away** — *suite-tested Sept 26*
*(File: `customer-intake.html`)*
1cj.1. Leaving the filter clean groups (another WorkCenter tab, another page, or another browser tab / window) for more than a minute: coming back finds every group closed. Back within the minute, they're as left.

**1ck. Filter clean groups: technician menu** — *suite-tested Sept 26*
*(File: `customer-intake.html`)*
1ck.1. A menu beside + New group: All technicians, each technician (A–Z), No technician. Picking one shows only those groups ("No groups for <name>." when there are none); the choice stays while working there.
1ck.2. Dragging groups while one technician is picked swaps only the groups shown; the hidden ones keep their places.

**1cl. No saved emails suggested in search boxes** — *suite-tested Sept 26*
*(File: `customer-intake.html`)*
1cl.1. Chrome was offering Tyrus's saved emails in the filter group's + Add customers search (autocomplete "off" is ignored when a box mentions email). Every search box now carries an autocomplete value Chrome doesn't recognise, its own name, and the password-manager "ignore" marks, so nothing saved is suggested. Weir's own suggestions (line items) are unchanged.

**1cm. Filter group date: one click to move on** — *suite-tested Sept 26*
*(File: `customer-intake.html`)*
1cm.1. After entering a group's date, the next click works first time. Cause (from 1cc): leaving the date box redrew the group list mid-click, replacing whatever was being clicked. Now the date saves as it changes and the heading's date updates in place — no redraw. No other box on the website redraws itself or the next click's target on leaving.

**1cn. Customer searches show the address** — *suite-tested Sept 26*
*(File: `customer-intake.html`)*
1cn.1. Two customers with the same name can be told apart: every customer search list now shows the full address (street, city, state, ZIP as entered) under the name — the Task customer box, the filter group's + Add customers window, email recipients, the photo window's Which customers, Customer groups' picker, and both equipment windows. The main customer search, the Quote / Work Order box, Customer Customization, the technician's assign list and deleted customers already showed it.

**1co. Restore from backup wins everywhere** — *tested on the practice database*
*(File: `customer-intake.html`; check in `behaviour-test-4.js`)*
1co.1. After Restore from backup, everything restored is sent to the server and the phones as the newest version; what the restore took away, and anything added on another computer after the backup (last changed before the restore), is removed there too. Work done after the restore is kept. Once all is sent, syncing carries on as normal. The restore message says it replaces everything here, on the server and on the phones.
1co.2. Found by the practice check and fixed: (a) a background sync running during the restore finished afterwards and wrote over the restored data — a restore now stops syncing and waits for any running sync first; (b) the "send everything restored" mark was dropped whenever the sync's record was loaded — now kept; (c) things added after the backup on another computer survived — now removed (customers, tasks, work orders, filter cleans, reschedules, technicians).
1co.3. Practice check (two computers): A backs up; B renames a customer, changes the email style, adds a customer and a task; A (never seeing those) restores and syncs. The server and B end up with exactly the backup. All 13 checks pass.
1co.4. Also found and fixed: a technician's profile left open while a sync brought technicians in kept editing an old copy, so later edits (e.g. phone) didn't stick — the sync now updates technicians in place.
1co.5. Photos stay out of the backup (Tyrus agreed): kept on the server for three years, shown again with restored reports. Not covered: service reports themselves sync separately.

**1cp. Phones: a cleared move is removed on the server too (the Sunday copy)** — *not tested (no suites run)*
*(Files: `technician-app.html`, `admin-readings-app.html`)*
1cp.1. Cause (checked on live Sept 27): John Tyler's regular day was Friday on the server, but a move 9/26 → 9/27 (made today) was still active there, so he showed on Sunday too. Two older moves (9/23 ↔ 9/24) removed on Sept 26 were active again: a phone still holding them had sent them back. Phones only ever sent moves that exist on them — a move cleared on the phone (by Change their regular day, or Just this once replacing an earlier one) was never removed on the server, and the next sync brought it back ("the Sunday copy pops back up a second later").
1cp.2. Now both phone apps send the removal of a cleared move (moves only; tasks and work orders still can't be deleted from a phone), and don't put a move back from the server while its removal is on its way. The server already allows it (office: any move; technician: moves for their own customers).
1cp.3. Existing leftover moves on the server need clearing once (they'll otherwise keep showing): see the chat — ask Tyrus before removing.

**2. Only a real phone or browser can prove these** *(built, approved and suite-tested)*
2.1. Open in Outlook: does its Bcc line fill in by itself, or does it need pasting? (The addresses are copied either way.)
2.2. On a real route with an extra photo on pool, spa and an extra body: each asks for its own photo and shows only its own. (The suites press these outside a full visit; a full visit swallows the press in the test setup.)

**3. Customer profile: address suggestions — parked**
3.1. The profile's Address editor has Weir's suggestion list and fills city, state and ZIP. The street isn't filled in real use; it couldn't be reproduced in a test browser.
3.2. Suggestions are slow or missing. Cause: they come from OpenStreetMap's Nominatim, whose usage policy forbids suggest-as-you-type and allows about one request a second for the whole app. Its thin US house-number data likely explains the missing street too.
3.3. Decision parked by Tyrus. Options when picked up: Photon (free, built for this, same data gaps) as a stopgap, or a keyed address service (Google Places, Mapbox, Geoapify, LocationIQ) behind a domain-locked key or an Edge Function before launch. Applies to the Add customer form too. No checks written for it yet.

---

## Approved, checks owed

*(Nothing)*

---

## Done — Sept 26

**Everything since the last full run (1cc–1cn), tested:** every suite passing — customer customization 222 (new: filter group date saved in place with no redraw and the next click landing, grips on groups and customers, no Save group, the new subtext, closing after a minute away, the technician menu, scheduled cleans carrying and updating the group's customer order, + Add customers opening ready to type with no ×, clicking back in empties it while clicking during typing doesn't, no browser suggestions, full addresses under same-named customers); visit-flow 588 (new: the technician app lists a day's filter cleans in the group's order); deep 402, reportemail 126, visitphoto 89, package 68, draft 54, lsi 84, error 78, photo 11, back 32, clip 24, dosescale 23; audit clean. Photo retention showed 2 failures only when run alongside every other suite (the app's own daily clean-up got there first on a slowed machine); on its own it passes 20 of 20, twice.


**Restore wins (1co), tested on the practice database:** part 4 898 (new: the two-computer restore check, 13 checks), offline 328, customer customization 198, part 1 303, part 2 226, part 3 345, email 116; audit clean. Test updates: part 4's website server now also serves settings and records (as the real server does); the equipment list check reads names under their new address line; the search-box check accepts the new "weir-search" setting.


**Full run, end of day:** every suite passing — customer customization 198, visit-flow 587, part 4 885, part 3 345, offline 328, deep 402, part 1 303, part 2 226, email 116, reportemail 126, visitphoto 89, lsi 84, error 78, package 68, draft 54, back 32, clip 24, dosescale 23, retention 20, photo 11; audit clean; snippet 17 and its check run clean on the test database (bar its grant to Supabase's own service role, which exists only on the real Supabase).
New checks: quote and work order numbers (each its own count, shown on the form), Quote name on Quote only, Photo required ticked on new work orders and hidden on quotes, quotes expiring after 30 days, Current search by address, Mark approved / declined / completed, History tags and the Approved / Declined / Expired menu, Convert to work order, the technician filter; the quote's answer code saved before its email, the email's Approve / Decline buttons and #0001.
Old checks updated for today's changes: Quote History holding answered quotes only (parts 3 and customer customization), ✓ Close → Mark approved, the synced-settings list (email).
Fixed while testing: the Quote name box showed on the Work Order form too (the form's own show-all step ran after it) — now Quote only.


- Taken off Tyrus's checklist Sept 26: 1af, 1ag, 1ao, 1ap, 1aq, 1ar, 1at, 1av, 1aw, 1ax, 1ay, 1az (and 1aa earlier).

- Decided (Tyrus, Sept 26): Quote and Work Order stay one shared form with separate entries; no rebuild into two forms. Any field meant for one kind only must be shown for that kind only (as Photo required is, Work Order only).

- **1bf**: part 3 345, customer customization 176, visit-flow 587, audit clean.

- **1be** (skip service acts like a submitted report): visit-flow 587, part 4 885, parts 1–2 and deep passing, audit clean.

- **1bd** (lists never overwritten by a page load; pool copy keeps spa/extra additions): customer customization 176, parts 1–3 passing, audit clean.

Tested: visit-flow 579 (new: two independent days, Reservice, catch-up), part 3 345 (new: technicians A–Z), part 4 885, offline 328, customer customization 172, email 116, reportemail 126, visitphoto 89, package 68, draft 54, parts 1–2 and deep passing; audit clean.
Test fix: visit-flow's "tomorrow" checks now use another day in the same week (on a Saturday, tomorrow falls in the next week and those checks failed on any version).

## Done — Sept 25

Details of the Sept 24–25 items still to try:
- **1w.** Choosing Every week with part of the day done only swaps the customers on screen among their own places; everyone else keeps theirs (both apps, company order and each phone's). Friday's route needed putting right once (its last four had moved to the top).
- **1aa.** Admin app: **Save report** between the heading and Back on the last After Photos page of the visit. Asks "This will not send it to the customer…", then finishes the visit exactly like Submit without emailing. Greyed out until that page's photo requirements are met (hover says which). Not shown on the notes page when no after photo is asked for (open question).
- **1af.** Website search boxes show no browser list of past entries (Chrome may occasionally ignore it — note which box). Line items still suggest products.
- **1ag.** Route Scheduling: a route is a technician's customers for the day. Day, then **Technician** dropdown (stays picked when the day changes; Unassigned when a day has unassigned customers). Old named-route orders carried over, split by technician. Named Routes section hidden. Admin app: every drag shows Just today / Every week / Remove changes; Every week becomes the company order.
- **1ao.** Sign-in page back as it was (the app-or-website question was removed). The website's sign-in has **← Back to the app sign-in**.
- **1ap.** Start (report opened) and finish (last page reached) locations saved on every report of the visit. **Show start and end on a map** in the report on the website and both apps: pins, times, distance from the address, time on site, accuracy. Never in the customer's email. Needs real use: the map tiles and the location prompt.
- **1aq.** WorkCenter → Filters: **Filter cleans not in a group on this computer**, with × and Remove all (shows even with no groups).
- **1ar.** Quote / Work Order / Task · **Current** · History. Work Order → Current: scheduled visits (Overdue, "Work order deleted", × / Remove all N, technician filter, search). Task → Current: open tasks (Repeats, × / Remove all N). Quote → Current: open quotes (✓ Close keeps it in History). Deleting a work order always clears its visits.
- **1as.** A rescheduled customer shows only for their own technician (admin app: their technician or All customers).
- **1at.** Select / Select all / Delete N selected / Done in a customer's Service Reports and WorkCenter Current and History.
- **1au.** No "Editing…" heading above the Quote, Work Order or Task form.
- **1av.** Saved tasks: saving a name already used asks to overwrite; the × is the small red square.
- **1aw.** No "Tasks on the schedule" list under the Task form (Current lists them; no Edit for a scheduled task yet — open question).
- **1ax.** A task with no customer is a gold row on its day (no ✓ box), opened and submitted like a job. **Photo required** beside the task date; the phone won't submit such a task without a photo.
- **1ay.** The out-of-date blue note at the top of the website is gone.
- **1az.** **Run snippet 16 in Supabase (and its check) before the app files go live.** Submitting a task or work order visit on the phone marks it done with who, when and the notes; on the website it leaves Current and shows in History → Submitted from the field. The job photo still stays on the phone.

Tested: every suite passing on the final files — visit-flow 573, customer customization 172, part 4 885, part 3 344, offline 328, deep 402, part 1 303, part 2 226, email 116, reportemail 126, visitphoto 89, lsi 84, error 78, package 68, draft 54, back 32, clip 24, dosescale 23, retention 20, photo 11 — audit clean.

New checks today (about 60): jobs and tasks on Today (rows for customer-less tasks, Photo required, submitting marks done with notes, only snippet-16 fields sent), extra service days, reschedules only for their own technician, no duplicate customers from old route orders, Every week partway through a day, rows closing when Today is left, On my way heading, extra photos for chosen customers, start/finish locations on the report and never in the email, the finish always a fresh position, Back on the last page, Return to route cancelling the whole report, Save report waiting for photos, Android portrait lock; website: blue note gone, search boxes without browser suggestions, Back to the app sign-in, technician routes and the one-time split, Day/Technician on the customer row, extra days, Done closing profile fields, borrowed dosage names, syncs waiting while a window is open, Current tabs (visits, tasks, quotes; × and Close; "Work order deleted"), finished work in History with who and notes, Select / Delete selected, deleting a work order clears its visits, no Tasks on the schedule list, no Editing heading, Photo required saved, saved tasks one per name, leftover filter cleans listed.

Old checks rewritten for today's changes: the ✓ task list (now rows), Service Reports by body (now visits), named route orders (now technicians), "Editing…" headings (removed) — in behaviour-test-3, behaviour-test-4 and visit-flow.

Fixed while testing: the leftover filter cleans list didn't appear with no filter groups at all; the typing hold waited on a field on a page not on screen; the website had a second code block (audit) — merged into the main one.

## Done — Sept 24, evening

Confirmed by Tyrus and tested: every suite passing (visit-flow 533, part 4 885, part 3 344, offline 328, customer customization 146, the rest unchanged), audit clean.

- **Admin app route order and the website's route scheduling:** every drag shows the bar; **Just today** keeps it on the phone for that date and leaves the website alone; **Every week** becomes the company's route order, sent to the office (held with no signal, sent at the next sync) and shown on the website's route scheduling; **Remove changes** puts it back and returns to following the company order; without a Just today order the admin app follows the website's changes; hidden customers and other routes keep their places; jobs stay out. The technician app keeps a technician's order to their phone. — `visit-flow-test.js`
- **Dragging reaches the bottom of a list** in all three apps (side by side only when items really share a line). — `visit-flow-test.js`

## Done — Sept 24, afternoon

Approved by Tyrus and tested: every suite passing (visit-flow 512, customer customization 146, part 4 885, part 3 344, offline 328, the rest unchanged), audit clean.

- **Phones — Today's list:** a finished customer leaves Today at once; tasks and work orders are their own items (under their customer's service that day, otherwise at the bottom; never bring or copy a service); the job drop-down with details, Directions and Start job; the job page with photo, notes and Submit (kept on the phone until submissions storage exists); the jobs count counts every job and goes down on submit; jobs survive a service report; grips, On my way and aligned arrows on job rows; admin app can start a job on any day — `visit-flow-test.js`
- **Phones — visits:** extra photos as thumbnails; extra photos named in the report email; the red Skip button; Reschedule starts on today — `visit-flow-test.js`
- **Website — WorkCenter:** Quote / Work Order / Task tabs with separate Histories; entries held for a minute; line items ($, price follows the item, quantity 1); quote emails in the report style through the report function, and Customize email (asks before Reset) — `customconfig-test.js`
- **Website — everywhere:** settings and products from another device reach the page's working copy; drawn, centred × buttons; windows close only from their buttons; customer fields empty on click and come back if nothing's chosen — `customconfig-test.js`
- **Customer Customization:** group members off the custom-setup list; pressing a group opens its customers (five columns) and its setup; switching closes the other; × beside a name takes them out of the group — `customconfig-test.js`

## Done — Sept 23–24

All approved and tested. Suites on the files now live: every suite passing, audit clean.

- **Service Reports in pages of ten** — `behaviour-test-3.js`
- **Email tab** — email app, Gmail and Outlook buttons; Bcc everywhere; batching by the same route; Outlook copies the addresses; the Gmail Send tip; confirmation buttons say "Open Gmail" / "Open Outlook" / "Open email app"; the last one used comes first and filled, kept per computer; coming back to the tab starts with nobody chosen — `email-test.js`
- **WorkCenter technicians** — one "Saved technician" button opening a window (Select all, Clear, Save, Cancel); no Unassigned; a copy per technician for tasks (and their repeats) and a separate job per technician for work orders; nobody chosen is refused; Quote / Work Order / Task dates go back to today on every way in — `behaviour-test-3.js`
- **Customer Customization** — groups show on arrival and follow a sync; spacing matched to "Customers with a custom setup" and 10px taller; ten to a page on both lists with separate page numbers; names in the same dark colour; pale teal hover; "+ New customer setup" removed, "+ New group" the filled button — `customconfig-test.js`
- **Photo requirements** — no Off / Optional / Required on the rows; Optional per technician in its own column, starting off; Everyone as a setting of its own covering new technicians; unticking one person keeps everyone else; the pool after photo required to start; old row settings carried over; row names shortened; the new line under the heading; Before or After, not both; Edit on extra photos; hover — `behaviour-test-4.js`
- **Phones** — extra photos follow Everyone and Optional; a separate extra photo per body of water, each extra body its own; before-only photos only before; the regular before/after photo hidden where nobody asked for it; the gate photo shown to anyone who must or may take it; Everyone read for gate and skip — `visit-flow-test.js`
- **Style pass** — one filled button per card, colour variables, list rows, hover — covered in the suites above
- **Customer Customization lists** — Pool / Spa / Extra above "Chemicals to record", bodies of water kept off Readings & dosages — confirmed by Tyrus in use.
- **Ten-photo cap** — only ten photos go out with a report; confirmed by Tyrus in use.
- **Rescheduling a customer's day on the phone** — confirmed working by Tyrus in use.
- **Yesterday's route clearing** — confirmed working by Tyrus in use.
- **Paging with arrows** — taken off Tyrus's checklist (suites passing).
- **Older checks brought up to date**: the cache name now checks `weir-cache-v8` rather than the pre-rename name.
