# Weir — in progress

Every change moves through three stages:

- **Waiting on Tyrus** — built and handed over, not yet tried
- **Approved, checks owed** — Tyrus is happy; permanent checks and suites still to run
- **Done** — checks written and passing, then removed from this log

Tyrus commits changes to the **live** repo (`Weir`) and tests there. **Weir-Beta** is kept for the beta testers and is updated only when Tyrus chooses.

**Style rule:** everything seen follows `style-guide.md` in the project files. Read it before building anything visible. Reuse what exists; no colour literals; one primary button per card; no one-off styles. **Windows close only from their own buttons** — never from a click outside them (the website also ignores backdrop clicks page-wide, so a new window can't slip).

**Testing note:** new companies start with the pool after photo required for Everyone. Every suite's pages start as a company with nothing ticked for Everyone (`weir:photoEveryone` = `{}`), so visits that take no photos still save; the starting setting is tested on its own. The `send-report` function must sit beside the tests (`functions/send-report/`), or the visit photo and report email suites stop early.

**Database rule (Supabase, from Oct 30, 2026):** new tables in `public` no longer get Data API access automatically. Every snippet that creates a table must grant access in the same snippet: `authenticated` for what the app does, `service_role` only if an Edge Function reads that table with the service key, and **nothing to `anon`** (Weir removes anon access on purpose). The existing snippets already do this; existing tables are unaffected.

Last updated: Sept 27, 2026

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

**1cq. One phone app for technicians and admins** — *suite-tested Sept 27; not yet tried on a phone*
*(Files: `app.html` (new), `technician-app.html` and `admin-readings-app.html` (now forwarding pages), `index.html`, `sw.js`; tests: `phone-app.js` (new helper), every suite's first line, `audit.py`, `behaviour-test-1.js`, `visit-flow-test.js`, `error-test.js`)*
1cq.1. `app.html` is the one phone app. Everyone signs in the same way; someone with admin access also gets the Technicians, Customer and Report tabs, the admin settings (voice button, Technicians tab) and Save report. A technician gets Today, Serviced and Settings with the Voice entry mode switch, as before. The header reads just "Weir"; the sign-in card "Weir — Sign in to see your route." **Tyrus tested Sept 29 ✓**
1cq.2. Where the two apps behaved differently, each keeps its own: report heading / email subject and HIGH/LOW tags, servicing or starting a job on another day, voice entry, the Equipment tab, filter cleans on other days and their FILTER CLEAN tag, "Carry on with this report", Serviced as its own tab vs inside Report, and the route order bar (a technician's order stays on the phone; an admin's Every week is the company order).
1cq.3. Fixes that existed in one app only now apply to both: signing out with changes not yet at the office asks first (was technician only); coming back to Today refreshes it and closes an open briefing (a typo stopped this in the admin app); a finished report can't be undone by a later cancel (was technician only); an extra body of water with a custom setup reads its own fields (was admin only). **Tyrus tested Sept 30 ✓**
1cq.4. Admin access switched on or off at the office: the phone picks it up at the next sync or when the app comes back to the front, and the tabs change without signing out (an admin on an admin-only tab lands on Today). Before, a demoted admin was signed out. **Tyrus tested Sept 29 ✓**
1cq.9. *(Sept 29)* Admin access is now checked with every sync, as well as when the app comes back to the front and when signal returns, and the tabs switch the moment the answer comes back (it used to look 1.5 seconds later, often before the check had finished, and a sync didn't check at all). Turning admin access on or off at the office shows on the phone at its next sync, with no reload. *Not yet tested.* **Tyrus tested Sept 29 ✓**
1cq.5. Phones move over by themselves: the sign-in page sends everyone to `app.html`; the old two addresses forward there, keeping anything after the ? (setup links); the offline copy is renamed (`weir-cache-v9`) so every phone takes the new files. Both old apps already kept everything in the same place on the phone, so nothing waiting to send is lost.
1cq.6. Suites: the old file names now load `app.html` as a technician or an admin (`phone-app.js`), so every existing check runs against the merged app. New checks in part 1 (what each person sees, Serviced for a technician, losing and regaining admin access, sign-out asking, the forwarding pages, sign-in and offline copy). Updated: the build stamp (`app-…`), three visit-flow source checks, visit-flow's "yesterday" check (wrong on a Sunday, on any version), and part 4's sign-in checks (a technician or a demoted admin now gets in with the technician's tabs instead of being refused; the landing page sends both to `app.html`; admin access switched off and on changes the tabs without signing out).
1cq.8. *(Reported Sept 27)* Every week on Today put the moved customers straight back, while Just today kept them. Cause: the day's saved route order still listed those customers under another route too (e.g. Unassigned, from before they were given to a technician); that older copy was read first. Every week now removes the moved customers from every other route that day. Reproduced (fails on the live app, passes now) in visit-flow and, through a real sync against the practice server, in part 4.
1cq.7. Full run on the final files, every suite passing: part 1 333, part 2 226, part 3 345, part 4 902, visit-flow 588, offline 328, customer customization 222, deep 402, reportemail 126, email 116, visitphoto 89, lsi 84, error 78, package 68, draft 54, back 32, clip 24, dosescale 23, retention 20, photo 11; audit clean. Part 4 and offline share the practice database, so run them one after the other, not side by side.

**1cr. Extra service days in the app's Customer tab** — *suite-checked Sept 29 (part 1); not yet tried on a phone or in a browser*
*(File: `app.html`)*
1cr.1. Under Service day, a new "Extra days" row shows the other six days as buttons; tap one to add it, tap again to take it off. Picking a main day that was an extra takes it off the extras. Saved as the customer's extraDays, the same as the website's "+ Add a day", so it reaches the office and the website shows it. **Tyrus tested Sept 29 ✓**

**1cs. Backup & restore moved to Settings in the app** — *suite-checked Sept 29 (part 1); not yet tried on a phone or in a browser*
*(File: `app.html`)*
1cs.1. The Backup & restore card (Download backup, Restore from backup) moved from the Customer tab to Settings, at the end of the admin settings. Admins only, as before (technicians never had it). Buttons and what they do are unchanged. **Tyrus tested Sept 29 ✓**
1cs.2. Settings now opens with Signed in (Sign out) at the top, then Office sync, then Backup & restore (admins only), then the rest as before.

**1ct. The × on the same line as its field (app, Customer tab)** — *suite-checked Sept 29 (part 1); not yet tried on a phone or in a browser*
*(File: `app.html`)*
1ct.1. In the customer form, each dog and each extra body of water had its × drop below the field. The app never had the website's layout for these rows; it now does (field and × on one line, × in the website's red). The app's other × buttons were already on their own line. **Tyrus tested Sept 29 ✓**

**1cu. "On my way goes to" shows text or email (website, customer profile)** — *suite-checked Sept 29 (part 1); not yet tried on a phone or in a browser*
*(File: `customer-intake.html`)*
1cu.1. The closed row now starts with how the message goes: "Text message", "Email", or "Text or email, asked each time" (both on file, nothing chosen), then who: "The customer" or the other contact. Worked out the same way the app decides when it sends. For someone else, it shows their email when it goes by email and their phone when by text (before, always the phone). Nothing on file at all still shows the grey placeholder.
1cu.2. *(Sept 29)* The "On my way goes to" phone number is shown, typed and saved as (623) 555-0142, the same as the customer's own phone. Numbers saved before show that way too. *Suite-checked Sept 29.* **Tyrus tested Sept 29 ✓**

**1cv. Unskip a skipped body of water (app, during a visit)** — *suite-checked Sept 29 (part 1); not yet tried on a phone or in a browser*
*(File: `app.html`)*
1cv.1. With more than one body of water, going back to the tab of one already skipped and pressing its Skip button now asks "Unskip it?". Yes puts it back on the service report, opens it at its first step (before photo, when that step is on), and drops the skip's photo and note if one was asked for. Cancel leaves it skipped. Once every body is done or skipped the report goes, so the last one can't be unskipped this way. **Tyrus tested Sept 29 ✓** (skip photo and note part too)

**1cw. Seasons for dosage rules and quick buttons** — *suite-checked Sept 29 (part 1); not yet tried on a phone or in a browser*
*(Files: `customer-intake.html`, `app.html`, `sw.js` (cache v10))*
1cw.1. Website, Readings and dosages: on the Restore default labels line, far right, an Add season button (the calendar button beside it was removed Sept 29). Both open an "Add a season" window (name, From and To dates; the year doesn't matter, it repeats every year); the calendar opens straight onto picking the first day, then the last. Closes from its own buttons only. Up to four seasons; dates can't overlap another season; a season can run over New Year. **Tyrus tested Sept 29 ✓**
1cw.2. A new season starts as a copy of the year-round dosage rules and quick buttons. Once there is a season, a Seasons strip appears (Year-round and each season, the one in use today marked "now"). Choosing a season shows and edits its dosage rules and quick buttons; labels, units and which chemicals and dosages are recorded stay shared. "Remove this season" deletes it. Leaving the page comes back on Year-round. **Tyrus tested Sept 29 ✓**
1cw.4. *(Sept 29)* "Edit this season" (dark teal) sits left of Add season while a season is chosen in the Seasons strip (hidden on Year-round). It opens the same window filled in with that season's name and dates, titled Edit <name>, with Save changes; it changes only the name and dates (its rules and buttons are kept), checks the name and overlaps against the other seasons, and doesn't count toward the four. *Suite-checked Sept 29.* **Tyrus tested Sept 29 ✓**
1cw.5. *(Sept 29)* Each season now has its own whole setup, not only its own rules and buttons: its own chemicals and dosages, labels and units. Taking a chemical off Summer, adding one, renaming one or changing a unit changes Summer only; year-round and the other seasons keep theirs. A new season starts as a full copy of year-round. The app uses the season's own lists on its days. Seasons saved before still work (year-round with their rules and buttons laid over) and become their own full copy the first time they're changed. "Apply to all bodies of water" while a season is showing applies within that season. *Not yet tested.* **Tyrus tested Sept 29 ✓**
1cw.6. *(Sept 29)* Changes on Year-round are carried into every season too (never the other way): a chemical or dosage added, taken off or moved, and anything changed on one (name, unit, required tick, dosage rules, quick buttons), and anything on the body of water itself. Only what changed is carried, so whatever a season set differently on everything else stays. A chemical a season took off itself isn't put back by a change to it on Year-round (only by adding it anew). The Year-round note on the page says so. *Not yet tested.* **Tyrus tested Sept 29 ✓**
1cw.3. The app uses the season covering today whenever it loads the setup (start, every visit, and when a change arrives from the office); any other day the year-round ones. Seasons sync like the rest of the setup (`chemSeasons`). Customers with their own custom setup keep their own rules and buttons; where they fall back to the standard lists, they get the season's. **Tyrus tested Sept 29 ✓**

**1cx. Technicians tab: opening a technician crashed** — *suite-checked Sept 29 (part 1); not yet tried on a phone or in a browser*
*(File: `app.html`)*
1cx.1. *(Reported)* Tapping a technician gave "Something went wrong … orders[techRouteDay].filter is not a function". The office's weekly route order for a day is kept per technician (Monday → each technician's list), and this screen read it as one list, so any day with a saved order crashed it (Every week on a phone saves one). It now reads that technician's own list, still accepts the older single-list form, and treats anything else as no order.

**1cy. Technicians tab: a dragged route order now saves and reaches everyone** — *suite-checked Sept 29 (part 1); not yet tried on a phone or in a browser*
*(Files: `app.html`, `sw.js` (cache v11))*
1cy.1. *(Reported)* Reordering a technician's customers on the Technicians tab didn't save. It was written to a key on that phone only, which nothing else reads and the next sync from the office wiped. It now saves as the office's weekly order for that technician's day (the same one the website's Routes page and Every week use), and goes to the office straight away, or with the next sync without signal. The Technicians tab now shows that office order first.
1cy.2. On the technician's phone: when the office's weekly order for one of their days changes, it replaces any every-week order they had saved on the phone for that day, so the newer order wins. A Just today order stays for that day. Nothing is dropped the first time the office's orders arrive on a phone.

**1cz. Move on a technician's route: another technician too** — *suite-checked Sept 29 (part 1); not yet tried on a phone or in a browser*
*(File: `app.html`)*
1cz.1. Technicians tab, a technician's route, Move: the window now has a Technician list under New date (their own technician first, marked "(assigned)"; Sept 29, was "(as now)"). Pick a date, another technician, or both.
1cz.2. Just this once: the visit goes to that date (the same day if no date is picked) on the chosen technician's route, for that one visit only (the move carries technicianId). It shows on that technician's Today and their route on the Technicians tab, marked Moved here, and leaves the regular technician's.
1cz.3. Change their regular day: a date changes their regular day; a technician makes them that technician's customer from now on (both if both are picked). Asks first. **Tyrus tested Sept 29 ✓**
1cz.5. *(Sept 29)* Move's New date starts on today's date, like Reschedule on Today already did. Picking only another technician (leaving the date alone) still keeps the day they're on; changing the date, or not picking a technician, uses the date shown. *Suite-checked Sept 29.* **Tyrus tested Sept 29 ✓**
1cz.7. *(Sept 29)* Move (Technicians tab) and Reschedule (Today) now start with the date box empty, waiting for a date, instead of today's date. Picking only another technician keeps the day they're on. An admin's Reschedule no longer pops the calendar open over the window (it can be a technician-only move); a technician's date-only Reschedule still opens the calendar first, empty. *Not yet tested.* **Tyrus tested Sept 29 ✓**
1cz.6. *(Sept 29)* Move on a technician's route answers a press anywhere within 10px of it, not only on the button itself. *Not yet tested.*
1cz.8. *(Sept 29)* Move's press area now runs the full height of the row, top to bottom, out to the row's right edge and 10px left of the button (replacing the 10px margin). The button looks the same. *Not yet tested.* **Tyrus tested Sept 29 ✓**
1cz.9. *(Sept 29)* The Technicians tab's Move button now says Reschedule, and its window is titled Reschedule <name> (the same as Today and the website). *Not yet tested.* **Tyrus tested Sept 29 ✓**
1cz.4. *(Sept 29)* Move stays pressable on a customer who has already been serviced (it used to grey out), so they can still be moved to any date or technician. *Suite-checked Sept 29.* **Tyrus tested Sept 29 ✓**

**1da. Today opens on today when coming back from another tab** — *suite-checked Sept 29 (part 1); not yet tried on a phone or in a browser*
*(File: `app.html`)*
1da.1. Picking another day on Today (day buttons, arrows or the calendar), going to another tab, then back to Today now shows today's list, this week. Coming back from a visit keeps the day that visit was on, so finishing a stop on another day doesn't jump away from it.

**1db. Today's date arrows side by side** — *suite-checked Sept 29 (part 1); not yet tried on a phone or in a browser*
*(File: `app.html`)*
1db.2. *(Sept 29)* The date is now centred in the space between the left edge of the bar and the ‹ arrow (not the middle of the whole bar). **Tyrus tested Sept 29 ✓**
1db.3. *(Sept 29)* The calendar button moved to just left of the ‹ arrow: the date (centred in the space left of the calendar), then the calendar, then ‹ ›. *Suite-checked Sept 29.* **Tyrus tested Sept 29 ✓**
1db.1. On Today, the ‹ arrow moved from the left end to just left of the › arrow, so both sit together on the right before the calendar button. The date now starts at the left instead of sitting in the middle. The arrows work as before.

**1dc. Technician page like a customer's profile; stronger row headers; keys** — *suite-checked Sept 29 (part 1); not yet tried on a phone or in a browser*
*(File: `customer-intake.html`)*
1dc.1. Technicians list: the Edit button is gone; clicking anywhere on a row (not the grip or Delete) opens the technician. The Add technician form is unchanged.
1dc.2. The technician page is laid out like a customer's profile: a card with Back to Technicians and Previous / Next technician (list order; greyed at the ends), a card with the name large and the Profile / Customers tabs, then the Profile card (name, customer count, "Tap any field to edit it", then Name, Email, Phone, Username, Password as tap-to-edit rows that save as you leave them). The three tick boxes (Admin access, Can rearrange their route, Equipment photo access) show what they do underneath instead of on hover, save when ticked, and Admin access still ticks and locks the other two. Admin access's description now says the admin tabs in the app (there is no separate admin app). The empty "What this technician must do" heading is gone. The Customers tab is unchanged.
1dc.3. Row headers on customer and technician profiles are larger and bolder, in the lighter teal (Sept 29: first the darker teal, which looked too close to the near-black value under it). **Tyrus tested Sept 29 ✓**
1dc.4. Keys: on a technician's page, Left / Right go to the previous / next technician (staying on the same tab) and Escape goes back to Technicians. On a customer's profile, Escape goes back to the customer list (Left / Right already stepped between customers). None of these act while typing in a field or while a window is open.
1dc.5. Technicians page order: Signing in on a phone first, then the Technicians / Photo requirements tabs, then + Add technician. Signing in on a phone now shows on both tabs (before, only on Technicians).

**1dd. Website side menu order** — *suite-checked Sept 29 (part 1); not yet tried on a phone or in a browser*
*(File: `customer-intake.html`)*
1dd.1. The left-hand tabs now run Customers, Technicians, Customer Customization, Route Scheduling, then Readings and Dosages, Products and Services, WorkCenter, History / Billing, Settings as before.
1dd.2. The down and up arrow keys go to the next and previous tab in the left menu (stopping at Settings and at Customers). Not while typing in a field, with Ctrl/Alt/Shift held, or while a window is open. The up and down arrows no longer scroll the page.
1dc.6. Previous / Next (buttons or ← →) on a customer's profile or a technician's page now keeps the page where it's scrolled to, instead of jumping back to the top. Opening a customer or technician from the list still starts at the top.
1dc.7. A customer's profile: the top line now has a small note between Back to Customer List and Previous / Next: "Use the ← → arrow keys to scroll between customers".
1dc.8. The same note on a technician's page, between Back to Technicians and Previous / Next: "Use the ← → arrow keys to scroll between technicians". *Suite-checked Sept 29.*
1dc.9. *(Reported Sept 29)* On a technician's profile, clicking one field and then another stuttered and needed a second click. Closing a field redrew the whole profile, which could throw away the field just opened (always a risk with Username and Password, which finish only after the office answers). Now, if another field is already open, only the closed row is put back; and a row no longer reopens itself on the next redraw. *Suite-checked Sept 29; not reproduced by hand.* **Tyrus tested Sept 29 ✓**
1dc.10. *(Reported Sept 29)* A customer's profile could have several rows open at once: the rows with a Done button (address, On my way goes to, bodies of water, sizes, dogs) stayed open when another row was clicked. Now clicking any row first saves and closes whatever is open (pressing its Done, or leaving its box), then opens the clicked row with that one click, ready to type in. *Suite-checked Sept 29.* **Tyrus tested Sept 29 ✓**
1dc.11. *(Reported Sept 29)* Clicking another row always closed the open one but didn't always open the one clicked. Cause: the page-wide "one click leaves a field" helper closes the open field at the first instant of the press (pointerdown), which saves and redraws the profile before the pressed row had noted itself (it waited for mousedown), so the redrawn row didn't open. The pressed row is now noted at pointerdown, before that helper runs. Applies to customer and technician profiles (likely the technician stutter too). *Suite-checked Sept 29.* **Tyrus tested Sept 29 ✓**
1dc.12. *(Reported Sept 29)* Clicking between fields on a customer's profile jumped the page: every save redrew the profile and scrolled it back into view. Redraws from inside the profile (a row saving or another opening, the name, service day, extra days and technician pickers) now keep the page exactly where it is. The technician profile's redraw keeps it still too. Opening a customer from the list still brings their profile into view. *Suite-checked Sept 29.* **Tyrus tested Sept 29 ✓**

**Sept 29 check run.** Every suite passes on the files as handed over: part 1 431 (99 new checks for 1cr–1dd), part 2 226, part 3 345, part 4 908, visit-flow 590, offline 328, customer customization 222, deep 402, reportemail 126, email 116, visitphoto 89, lsi 84, error 78, package 68, draft 54, back 32, clip 24, dosescale 23, retention 20, photo 11; audit clean. Checks changed because the behaviour was meant to change: part 3's menu position of Customer Customization, part 4's technician tick-box rows, visit-flow's Technicians-tab order (it tested for the old phone-only save), part 1's offline cache name. Still needs eyes: how the × rows, the date arrows and the stronger headers look; the date pickers opening; a real backup download; orders and one-off moves reaching another phone through a real sync.

**1de. Today's top section fixed to the top; the Weir bar gone on phones** — *suite-checked Sept 29 (part 1); not yet tried on a phone or in a browser*
*(File: `app.html`)*
1de.1. The day of the week, Reverse route order, the stops and jobs counts, the date, the arrows and the calendar are now their own card, which stays fixed at the top while the customers scroll under it. The route (and Jobs for today) is a separate card below. Before, the one card held the route too, so it was as tall as the list and never stayed put. **Tyrus tested Sept 29 ✓**
1de.2. On a phone, the teal bar at the very top with the Weir logo is gone, giving the route more room; the bottom bar does the navigating. On a computer the bar stays (it holds the tabs), and the fixed card, the visit's body-of-water tabs and the Serviced / Reports switch now sit just under it instead of sliding behind it.
1de.3. The same on the Technicians tab, a technician's route: the stops and jobs counts, their name, Back, the date, arrows and calendar are their own card fixed at the top; their customers scroll under it in a card below. **Tyrus tested Sept 29 ✓**
1de.4. *(Reported Sept 29)* The fixed top section shifted a little as scrolling began, and the customers showed through the gap above it. It is now held exactly where it starts (it slid up the 12px of page padding before sticking), and a page-coloured backing fills the gap above and beside it down to its bottom edge, so the customers disappear as they pass under the bottom of it. Same on a technician's route. *Suite-checked Sept 29.* **Tyrus tested Sept 29 ✓**
1de.5. *(Sept 29)* Bigger now there's room, on Today and on a technician's route (Technicians tab): the stops / jobs numbers 14 → 20 and their words 11.5 → 13, the date 14 → 16, the ‹ › arrows larger (21, more padding), the calendar button larger (20 icon). Today's two counters get a little more space between and above them. *Suite-checked Sept 29.* **Tyrus tested Sept 29 ✓**
1de.6. *(Sept 29)* Today's stops left numbers are ocean blue (#1565C0; forest green before, changed Sept 29) and jobs left numbers amber (#D97706); the words stay grey. Twice the space (16px) between the day / Reverse route order row and the counters. Technicians tab route unchanged. *Suite-checked Sept 29.* **Tyrus tested Sept 29 ✓**
1de.7. *(Sept 29)* The fixed top section's page-coloured backing now stops where its bottom corners begin to curve, so the list is cut off on that line and the corner cut-outs show no extra page-coloured space. Today and a technician's route alike. *Not yet tested.* **Tyrus tested Sept 29 ✓**

**1df. Reschedule opens the calendar straight away** — *suite-checked Sept 29 (part 1); not yet tried on a phone or in a browser*
*(File: `app.html`)*
1df.1. Pressing Reschedule on a customer on Today now opens the phone's calendar picker at once, on today's date, over the Reschedule window. Where a browser can't open it by itself, the date box is ready to tap.
1df.2. For an admin, Reschedule on Today opens the same window as Move on the Technicians tab (New date plus the Technician list, Just this once / Change their regular day), titled Reschedule, for the day on screen, with the calendar opening first. Technicians keep the date-only Reschedule window.

**1dg. A technician's Serviced tab shows only their own pools** — *suite-checked Sept 29 (part 1); not yet tried on a phone or in a browser*
*(File: `app.html`)*
1dg.1. *(Reported)* The Serviced tab on a technician's phone listed every pool the company serviced that day, other technicians' included. It now lists only pools assigned to that technician, plus any moved to them just for that day. An admin's Serviced (inside Report) still shows everyone's. **Tyrus tested Sept 29 ✓**
1dg.2. *(Reported Sept 29)* Today's "x of y stops left" counted every technician's customers serviced that day as finished stops, so a technician with no customers saw e.g. "0 of 20". Now only their own customers count; with none, the count is blank. The same fix on an admin's Today: finished stops count only the route being looked at (everyone's under All customers). **Tyrus tested Sept 29 ✓**
1dg.3. *(Sept 29)* The stop count on Today always shows, "0 of 0 stops left" included (before, it hid when there were no stops). Admin and technician alike. The jobs count already always showed. *Not yet tested.* **Tyrus tested Sept 29 ✓**

**1dh. New dosage rules start with "by pool size" ticked** — *suite-checked Sept 29 (part 1); not yet tried on a phone or in a browser*
*(File: `customer-intake.html`)*
1dh.1. On Readings and dosages (and Customer Customization, which uses the same rule editor), + Add rule now starts the rule with "by pool size" ticked: its amount is per 10,000 gallons and scaled to each pool's own size. Rules already written are left exactly as they are (ticked or not), so no dose changes by itself. **Tyrus tested Sept 29 ✓**

**Sept 29 afternoon check run.** Every suite passes on the files as handed over: part 1 478 (47 new checks for 1cz.4–1dh), part 2 226, part 3 345, part 4 908, visit-flow 590, offline 328, customer customization 222, deep 402, reportemail 126, email 116, visitphoto 89, lsi 84, error 78, package 68, draft 54, back 32, clip 24, dosescale 23, retention 20, photo 11; audit clean. Checks changed because the behaviour was meant to change: visit-flow's Reschedule checks now accept the Move window an admin gets; part 1's Move date check picks the date the way a person does. Offline's "could not reach the server" check failed once with every suite running at once and passed alone. Still needs eyes: the fixed top section not moving while scrolling on a real phone, the colours and sizes, the calendar opening by itself.

**1di. The app always opens on Today's list** — *not yet tested (Sept 29)*
*(File: `app.html`)*
1di.1. *(Reported)* Signing out (from Settings) and back in left you on Settings. Signing in now always lands on Today, on today's list. **Tyrus tested Sept 29 ✓**
1di.2. Coming back to the app (reopening it, switching back to it, turning the screen back on) also goes to Today, on today's list, unless something is being worked on: a report open, a customer or technician being edited, a window up, or nobody signed in. That keeps a trip to the camera from throwing away a visit or an edit. A fresh start already opened on Today. **Tyrus tested Sept 29 ✓**
1di.3. *(Sept 29)* An open report always comes back. If a report was open when another tab was pressed (even with nothing typed yet), pressing Today goes back into that report, and so does coming back to the app, both at the page it was on. Only finishing it, cancelling it or leaving it for the route (Return to route) lets Today show the list again. *Not yet tested.* **Tyrus tested Sept 29 ✓**

**1dj. Phones follow the website's technician order** — *not yet tested (Sept 29)*
*(Files: `customer-intake.html`, `app.html`)*
1dj.1. Reordering the Technicians list on the website now also saves the order as `technicianOrder`, which syncs with the rest of the setup (each technician travels on their own, so the order never used to reach the phones). The app lists technicians in that order on the Technicians tab, in Move / Reschedule's technician list, the customer form's technician list and the admin's technician picker; anyone not in the order yet goes at the end. A new order redraws the phone's Technicians list if it's showing. Another computer with the website open follows a reorder too. The order is first sent the next time the list is saved (a reorder, or adding / editing a technician).
1dj.2. *(Sept 29)* The drag grip on the website's Technicians list is gone: technicians can no longer be reordered by dragging. The order they're in stays, and still reaches the phones whenever the list is saved (adding or editing a technician). **Tyrus tested Sept 29 ✓**
1dj.3. *(Sept 29)* Technicians are now always in alphabetical order, on the website and in the app: every list and dropdown, the website's Previous / Next technician, the Reschedule windows, the customer form, the admin's pickers. A new or renamed technician takes their place in the order. The website-order setting (technicianOrder) no longer changes anything. *Not yet tested.* **Tyrus tested Sept 29 ✓**

**1dk. Technicians tab tidy-up (app)** — *not yet tested (Sept 29)*
*(File: `app.html`)*
1dk.1. ~~The technician list shows each technician's email on the name's line~~ Taken back off Sept 29: the technician list shows name, then customer count and phone, as before. **Tyrus tested Sept 29 ✓**
1dk.2. A technician's route: the name, phone and email are gone from the fixed top section. Its date row now matches Today's: the date centred in its space, then the calendar button, then ‹ ›. **Tyrus tested Sept 29 ✓**
1dk.3. A technician's route: stops left numbers ocean blue and jobs left amber, the same as Today. **Tyrus tested Sept 29 ✓**
1dk.5. *(Sept 29)* The stops left and jobs left numbers are now both amber (#D97706), on Today and on a technician's route (the stops numbers were ocean blue). *Not yet tested.* **Tyrus tested Sept 29 ✓**
1dk.6. *(Sept 29)* Opening a technician's route on the app's Technicians tab always starts on today (it used to keep the last day looked at). Coming back to the tab within 30 seconds still shows the route as it was left. *Not yet tested.* **Tyrus tested Sept 30 ✓**
1dk.4. *(Sept 29)* The app's technician list no longer shows each technician's phone. When a technician has customers moved to them just once (today or later, someone else's customers), their row starts with that count, e.g. "2 temporary customers · 14 customers"; otherwise just "14 customers". *Not yet tested.* **Tyrus tested Sept 29 ✓**

**1dl. Technicians tab: dragging a route asks Just today / Every week / Remove changes** — *not yet tested (Sept 29)*
*(Files: `app.html`; `tests/behaviour-test-1.js` updated, not run)*
1dl.1. Dragging a customer on a technician's route no longer saves straight away as every week. The new order shows, and the same bar as on Today asks: Just today, Every week, or Remove changes (each asks to confirm, as on Today). **Tyrus tested Sept 29 ✓**
1dl.2. Every week: the office's weekly order for that technician's day, as before (the website shows it, their phone follows it); it also clears any Just today for that date. **Tyrus tested Sept 29 ✓**
1dl.3. Just today: the office's one-off order for that technician and date only, kept in a new synced setting `routeOrdersOnce` and sent up the same way as the weekly order (owners and admins). Their phone uses it for that date, ahead of their own weekly order; a newer one from the office replaces a Just today they set themselves for that date. An admin looking at that technician's route on Today sees it too. Old dates are dropped as new ones are saved. The website doesn't show it (it has no per-date route order). **Tyrus tested Sept 29 ✓**
1dl.4. Remove changes puts the route back as it was before the drag. Going to another day, another technician, Back or another tab lets an unanswered drag go. **Tyrus tested Sept 29 ✓**

**1dm. Full-size photo: no black band behind "Tap the photo to close"** — *not yet tested (Sept 29)*
*(File: `app.html`)*
1dm.1. Opening a photo full size in the app: the "Tap the photo to close" grey bubble now sits on the dimmed screen, with no thick black band around it. **Tyrus tested Sept 29 ✓**
1dm.2. *(Sept 29)* The "Tap the photo to close" bubble is now solid grey (#3E4746, the shade it looked before) with white text; nothing shows through it. *Not yet tested.* **Tyrus tested Sept 29 ✓**

**1dn. A skipped body of water shows a Skipped screen** — *not yet tested (Sept 29)*
*(File: `app.html`)*
1dn.1. Going back to the tab of a skipped body of water shows a Skipped screen instead of its readings: "Skipped", a line saying there are no readings or photos for it on this visit, and one Unskip button (one tap, no extra question) that puts it back on the report at its first step. The tab reads "Pool · skipped" (etc.) instead of "✓ Pool". **Tyrus tested Sept 29 ✓**
1dn.2. When it was skipped with a photo and note (required), the screen also shows the photo small (like other report photos, tap for full size) with Retake photo / Remove photo, and the note, editable, saving as it's typed. **Tyrus tested Sept 29 ✓**
1dn.3. With the photo removed or the note emptied: the other tabs won't open, and the report won't send, until both are there again or it's unskipped; a message says so. **Tyrus tested Sept 29 ✓**
1dn.4. *(Reported Sept 29)* Taking the skip photo (when skipping, and Take / Retake photo on the Skipped screen) used the phone's camera app, which asks for a tick before handing the photo back. It now uses the app's own camera like every other photo: one tap of the shutter and it's straight back with Remove photo. The phone's camera app is only used if the app's can't open. *Not yet tested.* **Tyrus tested Sept 29 ✓**

**1do. Serviced's day row like Today's** — *not yet tested (Sept 29)*
*(File: `app.html`)*
1do.1. On Serviced, the ‹ arrow moved next to the › arrow on the right, and the day (Today, Yesterday, a date) is centred in the space to their left. It's the same Serviced list an admin sees inside Report, so it changes there too. **Tyrus tested Sept 29 ✓**

**1dp. A pool moved "just once" to another technician: server snippet 18** — *proven on the practice server Sept 29; needs running on the real server*
*(Files: `tests/sql/18 - moved customers.sql` (new — run it in Supabase's SQL Editor), `tests/sync-test-setup.sh`, `tests/behaviour-test-4.js`. No app or website change.)*
1dp.1. *(Reported)* A technician (not an admin) servicing a pool moved to them just once from another technician: it came back on Today and never showed on Serviced. The office server only let a technician see and save customers assigned to them, so the "serviced" mark was refused and lost at the next sync; on a phone only ever used by that technician, the moved customer never arrived at all. **Tyrus tested Sept 29 ✓**
1dp.2. Snippet 18: while a move to them is current (its date no more than two days ago), that technician can see the move and the customer, and save only the service details (lastServicedDate, lastServicedAt, lastServiceDurationMs, servicedFor, pendingRedo). Nothing else on that customer, and no other customer. Everything else is as in 06 and 09. **Tyrus tested Sept 29 ✓**
1dp.3. Proven in part 4 against the practice server: without 18 the moved customer never reaches the technician's phone (reproduced); with 18 it arrives, shows on Today, the service is accepted by the office, it leaves Today and shows on Serviced after syncing, and changing its name or servicing a customer not moved to them is refused. Part 4: 916 pass with 18; the one other failure was a text-distance check pushed out by 1dj (the technician order), now widened. **Tyrus tested Sept 29 ✓**

**1dq. Website: a Today's Route sub-tab on a technician's page** — *not yet tested (Sept 29)*
*(File: `customer-intake.html`)*
1dq.1. Technicians → a technician: new sub-tab "Today's Route" between Profile and Customers. It shows that technician's route for a day the way their phone has it (their customers on that day, minus any moved off it, plus any moved to them), in their order, with DONE on stops serviced that day and MOVED HERE on ones moved in, and "x of y stops left". The date, then a date picker, then ‹ › step the day; it opens on today for each technician. **Tyrus tested Sept 29 ✓**
1dq.2. Drag to reorder (grip on the left): a bar asks Just today / Every week / Remove changes. Every week saves that technician's weekly order for the day (what the app and Route Scheduling use); Just today saves the office's one-off order for that date (routeOrdersOnce, now also sent from the website), which their phone uses that day only. **Tyrus tested Sept 29 ✓**
1dq.3. Move on each row: the same window as the app (New date empty, Technician list with their own marked "(assigned)"; Just this once / Change their regular day / Cancel; closes only from its buttons). A move to another technician just once needs snippet 18 on the server for their phone to get it. **Tyrus tested Sept 29 ✓**
1dq.4. *(Sept 29)* Today's Route restyled for the desk: the date as a heading on the left with "x of y done · z left" under it, the date picker and ‹ › on the right, then a plain table (grip, stop number, customer, address, status, Move) with column headings, one line per stop. Status is a small "To do" or green-outlined "Done" with the time, plus "Moved" for stops moved in. Clicking a stop (not the grip or Move) opens that customer's Service reports on the Customers page, on that day's report when there is one. *Not yet tested.* **Tyrus tested Sept 29 ✓**
1dq.5. *(Sept 29)* Today's Route: customer names in normal-weight black (were bold); the "x of y done · z left" count sits to the left of the date on the same line; each row's Move button now says Reschedule (and its window is titled Reschedule <name>). *Not yet tested.* **Tyrus tested Sept 29 ✓**
1dq.6. *(Sept 29)* Clicking a stop on Today's Route opens the customer's Service reports with every report listed (no date filter) and the report for that day opened, on whichever page of the list it's on. With no report that day, all their reports show, none opened, and a note says so. *Not yet tested.* **Tyrus tested Sept 30 ✓**
1dq.7. *(Sept 29)* Today's Route top row: the date and day in the exact middle, the done / left count on the left, the date picker and ‹ › on the right; about twice the space between that row and the table's headings. *Not yet tested.* **Tyrus tested Sept 29 ✓**
1dq.8. *(Reported Sept 29)* Reschedule → Change their regular day on Today's Route just darkened the screen: the Reschedule window sat on a higher layer (320) than the "are you sure?" question it asks (300), so the question opened behind it. The window is now below the question (260). *Not yet tested.* **Tyrus tested Sept 30 ✓**
1dq.9. *(Sept 29)* On Today's Route, Previous / Next technician (and the ← → keys) keep the date that's showing instead of going back to today. Opening a technician from the list still starts on today. *Not yet tested.* **Tyrus tested Sept 30 ✓**
1dq.10. *(Sept 30)* Today's Route: the date truly centred (the side columns can no longer push it off-centre; the date box is narrower), in the site's heading font (Space Grotesk) at 18px. A stop that's Done now has Reservice instead of Reschedule: it asks whose Today list it should go on (the route's technician chosen to start), keeps the report as it is, takes that day's service off, and puts the stop on that technician's Today just for today (marked as a reservice, so it says Just today). *Not yet tested.* **Tyrus tested Sept 30 ✓**
1dq.11. *(Reported Sept 30)* On Today's Route a stop that was Done and moved in showed "Done 9:14 AM…" with the Just today badge cut off. The Status column is now wide enough (220px, the address column a little narrower) for Done with its time and Just today side by side. *Not yet tested.* **Tyrus tested Sept 30 ✓**
1dq.12. *(Sept 30)* Today's Route: a dark teal Today button between the date box and the ‹ › arrows jumps straight back to today. *Not yet tested.* **Tyrus tested Sept 30 ✓**

**1dr. Serviced by technician; an admin's Reservice goes on their own Today** — *not yet tested (Sept 29)*
*(File: `app.html`)*
1dr.1. Each service now notes who did it (the signed-in technician). Serviced shows each technician the pools they serviced themselves; services noted before this (no name on them) go by the customer's technician, or whoever the pool was moved to that day. **Tyrus tested Sept 29 ✓**
1dr.2. An admin's Serviced (in Report) has a technician list under the day row: Everyone, or one technician (in the website's order). It starts on the admin themselves. **Tyrus tested Sept 29 ✓**
1dr.3. Reservice pressed by an admin puts the pool on the admin's own Today list, just for today (a one-off move to them), not back with the technician who sent the report. A technician's Reservice, or an admin's on their own customer, works as before.
1dr.4. *(Reported Sept 29)* Reservice sometimes needed pressing several times. A sync replaces every customer with a fresh copy, and the Serviced row still held the copy it was drawn with, so the press changed a copy that isn't saved. Reservice now always acts on the customer as they are in the list at that moment. *Not yet tested.* **Tyrus tested Sept 29 ✓**
1dr.5. *(Reported Sept 29)* A pool serviced by one technician also showed on Serviced under the technician it's assigned to. A fallback meant only for records from before each service noted who did it ("serviced today") also caught pools serviced today by someone else. It now applies only when there's no record of today's service at all, so each pool shows only under whoever serviced it. *Not yet tested.* **Tyrus tested Sept 30 ✓**
1dr.6. *(Reported Sept 29)* An admin's Reservice didn't put the pool on their own Today when the pool was the admin's own customer but had been moved "just today" to another technician: no move was made, so the old move sent it back to that technician. Now an admin's Reservice always ends on their own Today: unless it's already naturally theirs today (their customer, their day, nothing moving it), it replaces any move touching today with a "just today" move to the admin. *Not yet tested.* **Tyrus tested Sept 30 ✓**
1dr.7. *(Sept 29, clarified)* An admin's Reservice now always makes a "just today" move to that admin for today, whoever's customer it is (their own included), replacing any move touching today. The move is marked as a reservice, so the pool shows JUST TODAY on their Today even when it's their own customer on their own day. *Not yet tested.* **Tyrus tested Sept 30 ✓**

**1ds. "JUST TODAY" on a customer moved to another technician for the day** — *not yet tested (Sept 29)*
*(Files: `app.html`, `customer-intake.html`)*
1ds.1. A customer moved to another technician just for that date shows a gold JUST TODAY tag: on that technician's Today (technician and admin), on their route in the app's Technicians tab (instead of MOVED HERE), and on the website's Today's Route ("Just today" instead of "Moved"). A move to another day with the same technician keeps its MOVED HERE / Moved tag.
1ds.2. *(Sept 29)* Every one-off move now says JUST TODAY (website: "Just today"), a move to another day with the same technician as well as a move to another technician: on Today (technician and admin), on a technician's route in the app's Technicians tab, and on the website's Today's Route. "MOVED HERE" / "Moved" are gone. *Not yet tested.* **Tyrus tested Sept 30 ✓**
1ds.3. *(Sept 29)* Website, Today's Route: clicking a "Just today" badge asks "Put <name> back on their usual day (<day>) with <technician>?" — Put back removes the one-off move onto that date, so they're back where they normally are. *Not yet tested.* **Tyrus tested Sept 30 ✓**

**1dt. "This route is for another day" asked once per report** — *not yet tested (Sept 29)*
*(File: `app.html`)*
1dt.1. *(Reported)* An admin starting a report on another day's route is asked once whether to service it anyway. Going back into that same report later (another tab, then Today, or coming back to the app) no longer asks again. It asks again only after the report is cancelled or finished and a new one is started. **Tyrus tested Sept 29 ✓**

**1du. Admin bottom bar: Report before Customer** — *not yet tested (Sept 29)*
*(File: `app.html`)*
1du.1. On the app's bottom bar (admins), Report and Customer swapped places: Today, Techs, Report, Customer, Settings. The tabs across the top on a computer are unchanged. **Tyrus tested Sept 29 ✓**

**1dv. The website's Back and Forward buttons** — *not yet tested (Sept 29)*
*(File: `customer-intake.html`)*
1dv.1. The browser's Back button used to do nothing on the website. Every place visited now goes into the browser's history, and Back goes to exactly where you were before (Forward returns): the menu page; on Customers, which customer was open and which of their tabs (Profile, Equipment, Service Reports, Quotes & Orders); a technician's page and its tab (Profile, Today's Route, Customers); the Technicians page's tab (Technicians / Photo requirements); Readings and Dosages' body of water and season; the WorkCenter's section. Back only goes back; it doesn't undo anything done there. With a window open, Back does nothing (windows close only from their own buttons). **Tyrus tested Sept 30 ✓**

**1dw. App: add or remove a technician's customers from Edit** — *not yet tested (Sept 29)*
*(File: `app.html`)*
1dw.1. Technicians tab → Edit on a technician: a Customers section shows how many customers are on their route, with an "Add or remove customers" button. It opens a window listing every customer (theirs first, then alphabetical) with a search box. Ticking one puts them on this technician's route (from whoever had them; the row says whose they are now); unticking takes them off, leaving them unassigned. Each tick saves straight away; Done closes it (it doesn't close from a tap outside). **Tyrus tested Sept 29 ✓**

**1dx. App tabs come back as they were left, for 30 seconds** — *not yet tested (Sept 29)*
*(File: `app.html`)*
1dx.1. Every tab except Today (and the report itself, which already always comes back) keeps what it was showing for 30 seconds after you leave it: Serviced (its day), Technicians (a technician's route or the list), Customer (a customer open, a search typed), Report (the customer and report on screen, and Serviced / Reports), Settings, and the scroll position. Back within 30 seconds: exactly as left (a technician's route is drawn again from what's saved). After 30 seconds, each opens as it normally does. Opening a particular report from elsewhere still shows that report. **Tyrus tested Sept 30 ✓**
1dx.3. *(Sept 30)* When a tab opens fresh (after the 30 seconds), Customer's search box is emptied and Report's customer search is emptied with no customer chosen (they used to keep what was typed). Within 30 seconds both still come back as left. *Not yet tested.* **Tyrus tested Sept 30 ✓**
1dx.4. *(Reported Sept 30)* Report after the 30 seconds cleared the customer's name but left their report showing. Now it goes back to how the page starts: no customer, no dates, no report, no report buttons. *Not yet tested.* **Tyrus tested Sept 30 ✓**
1dx.2. Some older checks switch tabs quickly and may expect the fresh page; they'd need a 30-second wait or a note. Not run.

**1dy. Moving an already-moved customer again, just once** — *not yet tested (Sept 29)*
*(Files: `customer-intake.html`, `app.html`)*
1dy.1. *(Reported)* A customer moved just once (Monday → Wednesday) and then moved again from Wednesday (→ Friday) came back as a copy on Monday: the second move replaced the first and only said "off Wednesday". Now, when a customer is only on a day because of an earlier move, the new move starts from their usual day and replaces the earlier one (Monday → Friday). Moving them back to their usual day with their own technician just removes the move ("back on their usual day"). Same on the website's Today's Route and in the app (Reschedule on Today, and on the Technicians tab). **Tyrus tested Sept 29 ✓**

**1dz. Website pages come back as they were left: 30 seconds (WorkCenter 20)** — *not yet tested (Sept 29)*
*(File: `customer-intake.html`)*
1dz.1. Every page in the website's menu, opened again within 30 seconds of leaving it, is exactly as it was left: Customers (a customer open, their tab, the search, the page of the list), Technicians (a technician's page and its tab, Today's Route's date; or the Photo requirements tab), Readings and Dosages (the body of water and the season), Customer Customization (the customer loaded), Route Scheduling (the day and route), History / Billing (filters, page), Products and Services, Account, Settings, and the scroll position. After 30 seconds each opens as it normally does. **Tyrus tested Sept 30 ✓**
1dz.2. The WorkCenter: 20 seconds, for coming back to the page as it was and for its own holds (the Quote / Work Order / Task form's typing, and the filter clean groups), which were a minute. **Tyrus tested Sept 30 ✓**
1dz.3. Readings and Dosages still goes back to Year-round while you're on other pages (so nothing else reads a season's setup), and puts the season back if you return within the time. Opening Readings and Dosages right after Customer Customization (the same screen) starts fresh. **Tyrus tested Sept 30 ✓**

**1ea. The last 4 weeks' readings on the readings page** — *not yet tested (Sept 29)*
*(File: `app.html`)*
1ea.1. On a visit's chemical readings page (pool, spa and each extra body), a "Last 4 weeks" table sits above today's fields: one column per visit in the last 28 days, newest on the left, one row per reading the setup records (the same order as the fields). It scrolls sideways with the reading names pinned on the left; a reading not taken shows a dash; "swipe for more →" shows with more than three visits. Nothing shows when there were no visits in that time. **Tyrus tested Sept 30 ✓**
1ea.2. *(Sept 30)* Settings has a "Previous readings on visits" switch, on the website and in the app (admins only there), on by default. Off hides the Last 4 weeks table on every visit's readings page. It's a company setting, so it syncs to everyone (`showRecentReadings`). *Not yet tested.* **Tyrus tested Sept 30 ✓**

**1eb. A customer's drop-down on Today stays open through a redraw** — *not yet tested (Sept 29)*
*(File: `app.html`)*
1eb.1. *(Reported)* Right after signing in, a customer's drop-down on Today kept closing itself, then settled. Just after signing in the list is drawn several times over (the first syncs landing, Today opening on today, the access check), and each redraw threw the open drop-down away. Now an open drop-down is opened again straight after a redraw, with no slide-in, as long as that customer is still on the list. Not reproduced here (the tester couldn't make it happen again either). **Tyrus tested Sept 30 ✓**

**1ec. Beta set up (Sept 30)**
1ec.1. Beta server (weir-beta, `mjjgvpejbibybhsmrdno`): resumed from pause; snippets 16, 17, 18, 19 run and checked; `quote-response` deployed (Verify JWT off); Site URL `…/Weir-Beta/customer-intake.html`, redirect `…/Weir-Beta/*` (the `<beta-repo>` placeholder removed); companies A Squared Pool Service, Affinity Pools, Jackrabbit Pools LLC, Ryan the Pool Guy (owners made with snippet 12), and Triffic Pool and Spa (renamed from "Your Company"). Live server: snippet 19 run and checked. Both on Supabase's free plan (beta pauses after about a week unused).
1ec.2. Beta website files: the live files as of Sept 30 (sw v30 build), with the beta's own `sw.js` (`weir-beta-cache-v2`, and it now clears only the beta's own old copies, so it no longer wipes the live app's offline copy on the same device). Beta smoke test still to do (checklist). **Tyrus tested Sept 30 ✓**
1ec.3. Not done (optional, offered): removing the extra table permissions Supabase's defaults added (row rules already block them).

**1ed. Website: Export customers** — *not yet tested (Sept 30)*
*(File: `customer-intake.html`)*
1ed.1. Customers page: an **Export customers** button to the left of Restore customers downloads `weir-customers-<date>.csv` (opens in Excel / Google Sheets), one row per customer, A–Z: name, address, city, state, ZIP, phone, email, service day, extra days, technician, active, pool and size, spa and size, other bodies of water with sizes, dogs, yard and neighborhood gate codes, access notes, On my way (who, how, automatic). Deleted customers are left out. The columns match Import customers, so the file can be imported again. **Tyrus tested Sept 30 ✓**

**1ee. Website: + Add technician on the All technicians row** — *not yet tested (Sept 30)*
*(File: `customer-intake.html`)*
1ee.1. The separate card holding + Add technician is gone; the button sits at the top right of the All technicians card, on the heading's row, with the technician count just left of it. **Tyrus tested Sept 30 ✓**
1ee.2. *(Sept 30)* The counts sit right beside their headings: "All technicians  2 technicians" with + Add technician at the far right, and "All customers  60 customers" (was at the far right). *Not yet tested.*

**1ef. Save report beside Back** — *not yet tested (Sept 30)*
*(File: `app.html`)*
1ef.1. On the last page of a visit (the after photos page, admins), Save report now sits right beside Back on the heading's row, instead of in the middle. With Skip on the same row too, all three buttons sit together on the right. **Tyrus tested Sept 30 ✓**

**1eg. Quotes: how many days until they expire** — *not yet tested (Sept 30); snippet 20 run and the function redeployed on live and beta (Verify JWT still off), checked*
*(Files: `customer-intake.html`, `tests/sql/20 - quote expiry days.sql`, `functions/quote-response/index.ts`)*
1eg.1. Quote form (only): "Expires in [30] days" right of the date box, 1 to 365. Cleared back to 30 with the form, held with the rest for the WorkCenter's 20 seconds, loaded on Edit & resend, saved on the quote. **Tyrus tested Sept 30 ✓**
1eg.2. The email says "This quote expires in N days, on <weekday, month day, year>." above Approve / Decline (and the plain-text copy says it too). **Tyrus tested Sept 30 ✓**
1eg.3. The website moves an unanswered quote to History as EXPIRED after its own days (30 for older quotes). The days are saved with the quote's answer code (`expires_days`, snippet 20), and the quote-response function refuses answers after them ("sent more than N days ago"). A quote sent before snippet 20 is on the server would go without its Approve / Decline buttons, so the server goes first. **Tyrus tested Sept 30 ✓**

**1eh. Website: one company's data per browser** — *not yet tested (Sept 30) — MUST go to live and beta before testers sign in*
*(File: `customer-intake.html`)*
1eh.1. *(Reported)* Signing in to the beta website as Michael (Affinity Pools) on the browser where Triffic's beta had 60 test customers put those 60 customers, 2 technicians and 6 settings into Affinity on the server (checked: Affinity 60 / 2 / 6 at 23:10 UTC, ten minutes after Triffic's import; the other companies empty). The server kept companies apart; the website's local copy isn't tied to a company, and its sync sent the old copy up into the new company (the phone app already guards against this; the website didn't).
1eh.2. Now the website marks its local copy with its company. Signing in as a different company (or opening the site while signed in as one) clears the copy (keeping only how the browser is signed in) and reloads, so the new company starts fresh from the server. If the previous company still has changes that haven't gone up, the sign-in is refused with a message to sign in as that company first. A browser with only its own company's data just gets the mark. **Tyrus tested Sept 30 ✓**
1eh.3. Done Sept 30 (Tyrus's OK): removed from Affinity Pools on the beta server the 60 copied customers, 8 records (2 technicians, company details, 5 setup) and 2 saved versions; its 2 quote answers left. Proved first that the server keeps companies apart (signed in as A Squared: 0 customers; as Michael: only Affinity's rows, which were copies with Triffic's ids). Checked again afterwards: Affinity 0 / 0.
1eh.4. *(Reported Sept 30)* After deleting John Tyrus Tyler, adding a technician with his username said it was taken. His sign-in (`john.tyler`, Triffic, Sept 22) was still active on the beta server with no technician profile: the John deleted on the website was the stray copy in Affinity Pools, and Delete only stops a sign-in in the signed-in company. Removed his sign-in on the server as Delete does (removed_at set, 23:38 UTC), which frees the username. Open question for Tyrus: should the Technicians page list a sign-in that has no technician profile, so it can be deleted from the website?

**1ei. Deleting a technician removes them completely** — *not yet tested (Sept 30); snippet 21 run and checked on live and beta*
*(Files: `customer-intake.html`, `tests/sql/21 - delete technicians completely.sql`)*
1ei.1. Tyrus: no archiving. Delete on the Technicians page now always asks the server (whether or not the website knew of a sign-in), and the server removes the sign-in account itself (username free at once), the membership, the profile's contents (left as an empty deleted marker only so other devices drop it) and its earlier versions. The 7-day upload grace for a removed technician's phone is gone. Service reports they submitted stay with the customers. The confirm reads: "Their sign-in and profile are removed completely, straight away. Service reports they submitted stay with the customers." **Tyrus tested Sept 30 ✓**
1ei.2. John Tyrus Tyler's switched-off sign-in removed completely on beta; live had none left.
1ei.3. *(Reported Sept 30)* The beta app still listed John Tyrus Tyler (not on the website): an old copy of his profile (`tech_1790110530531`) held on the phone since Sept 22 that the server never had, so no deletion could reach it. Added an empty deleted marker for that id on the beta server (Triffic) so phones drop it at their next sync. Neither server has a John Tyrus Tyler otherwise.

**1ej. Website: the 30-second page memory taken out** — *not yet tested (Sept 30)*
*(File: `customer-intake.html`)*
1ej.1. Tyrus: too odd. Every website page opens as it normally does again (1dz undone). The WorkCenter's Quote / Work Order / Task form holds what was typed for a minute again (was cut to 20 seconds by 1dz), and filter clean groups close after a minute away again (also cut to 20 seconds). Browser Back / Forward (1dv) is unchanged. **Tyrus tested Sept 30 ✓**
1ej.2. *(Sept 30)* The WorkCenter form's hold (Quote / Work Order / Task, what was typed) is now 30 seconds. Filter clean groups still close after a minute away. *Not yet tested.*

**1ek. Quote Current: Resend** — *not yet tested (Sept 30)*
*(File: `customer-intake.html`)*
1ek.1. Each quote in WorkCenter → Quote → Current has **Resend** (left of Mark approved). One press emails the customer the quote again, exactly as first sent: same number, same Approve / Decline buttons (still answering the same quote), same expiry date. Shows "Sending…" while it goes, then "Quote resent to <email>"; the quote stays in Current. A quote sent before copies were kept is rebuilt from today's template without the buttons. No email on file says so. **Tyrus tested Sept 30 ✓**

**1el. App: tap-to-talk microphone on every note box** — *not yet tested (Sept 30)*
*(File: `app.html`)*
1el.1. Every note box in the app (visit notes for pool / spa / others, skip reason and skip note, access and equipment notes, job notes, and any made later) gets a small round microphone at its bottom right. One tap starts voice-to-text (no holding); the words are added to the end of the note and saved as if typed. It keeps listening while it hears speech, restarting itself through the phone's own pauses, and stops after 6 seconds with nothing heard, on a second tap, when the note box goes away, or when the app is left. Separate from the hold-to-talk readings button (it won't start while that one is listening). Needs the browser's speech recognition (Chrome on Android; Safari on iPhone — may not be available inside an iPhone home-screen app).

**1em. Visit video (office only, kept 7 days)** — *not yet tested (Sept 30); snippet 22 run and checked on live and beta (push_photo takes 'video', videos office only, clean-up includes videos over 7 days, bucket 10 MB)*
*(Files: `app.html`, `customer-intake.html`, `tests/sql/22 - visit videos.sql`)*
1em.1. Website → Technicians → Photo requirements: a **Video** row between After photo and Closed gate photo, with the note "Optional, up to 15 seconds, one per visit. Seen by the office only, never sent to the customer. Videos delete themselves after 7 days to save storage." One tick per technician (and Everyone), no Optional or Required: a tick lets them take one (`allowVideo` on the technician; Everyone = photoEveryone.video.video). Its count reads "N technicians can".
1em.2. App: on the last body of water's after-photos page, under the after photo, a blue "Video (optional)" box with the same note and **Record video** (the app's own recorder, 15 s hard stop, recorded at ~1.2 Mbit/s so 15 s is about 2–3 MB; over 9.5 MB is refused). One video: once recorded it shows with **Remove video**. Not on filter cleans. Saved with the last report as `video`, uploaded like a photo (kind 'video'), never inside the visit; the phone lets its copy go 7 days after uploading.
1em.3. Owners and admins see **▶ Watch video** on the report (app Report tab, admin version only; website service report), played from the phone's copy or fetched from the office; after 7 days it reads "Video deleted after 7 days". Never in the customer's email (the email's photo list doesn't include it). Technicians can't see videos on the server (snippet 22's read rule).
1em.4. Server (snippet 22): push_photo accepts kind 'video'; videos readable by owners/admins only; photos_past_keeping lists videos over 7 days old, so the office website's daily clean-up deletes them from storage; the bucket limit is 10 MB (was 5 MB). The clean-up runs when the office website is open (once a day).
1em.5. *(Sept 30)* Up to **3 videos** per visit, numbered in the order recorded: each shows with its own Remove; the button reads "Record another (2 of 3)" and goes at 3. Saved as `video` + `videoMore`, uploaded as their own videos a second apart (order kept). Reports show "Watch video 1 / 2 / 3" (just "Watch video" for one). The Photo requirements note and the app's box say "up to 3 videos of 15 seconds each". *Not yet tested.*

**1en. Equipment: backwashed / salt cell cleaned on a date** — *not yet tested (Sept 30)*
*(Files: `customer-intake.html`, `app.html`)*
1en.1. Website → customer → Equipment: a Sand or DE filter gets a **Backwashed** button, and a Chlorination set to Salt Cell a **Cleaned** button, between its choice buttons and the Type box. It reads "Backwashed Sep 28" (the later of the date set here and the last visit a technician ticked it on) or "Backwashed: set date". Pressing it asks for the day (today to start, no future dates): Save, Clear date, Cancel. Kept on the equipment item (`lastBackwashed`, `saltCellCleanedOn`).
1en.2. App: the visit's "Filter backwashed" / "Salt cell cleaned" buttons say "Last done …" from the later of that office date and the last visit it was ticked on.

**1eo. Website: ← → between customers on every customer tab** — *not yet tested (Sept 30)*
*(File: `customer-intake.html`)*
1eo.1. *(Reported)* The left and right arrow keys only stepped between customers on the Profile tab: they waited for the profile card, which only shows there. Now they work on Profile, Equipment, Service Reports and Quotes and Orders (anywhere the Back / Previous / Next bar shows), staying on the same tab. Still not while typing or with a window open.

**1ep. Website: a picture closes on an outside click or Escape** — *not yet tested (Sept 30)*
*(File: `customer-intake.html`)*
1ep.1. Tyrus asked: the photo window (a report's photos, or an equipment photo full size) closes from Close, a click anywhere outside it, or Escape. An exception to "windows close only from their buttons"; every other window is unchanged.

**1eq. Up to three photos per before / after / closed gate step** — *not yet tested (Sept 30)*
*(Files: `app.html`, `customer-intake.html`)*
1eq.1. App: every before, after and closed gate step takes up to 3 photos. They show as thumbnails numbered 1–3 in the order taken (no number with just one), each with its own × to remove it; the button reads "Take another (2 of 3)" and disappears at 3. Required photos still need just one.
1eq.2. The first stays in the step's usual field (`photo`, `beforePhoto`, `gatePhoto`); 2 and 3 go in `photoMore` / `beforePhotoMore` / `gatePhotoMore`, kept in the photo database, restored when a report is reopened (and when moving between extra bodies of water), and uploaded as their own photos of the same kind, a second and two apart so the office keeps their order.
1eq.3. The customer's email: the same labels, numbered in the order taken ("Pool after 1", "Pool after 2", "Gate 1"…); one photo keeps its plain label. The email now carries up to 15 photos (was 10); any past that go as links, as before.
1eq.4. The app's report shows all after photos (numbered when more than one). The website's service reports and photo window show every before and after photo, numbered ("Before 1", "After 2"), rebuilt in order from what the phones uploaded.

**1er. One body of water reads the pool's photo requirements** — *not yet tested (Sept 30)*
*(File: `app.html`)*
1er.1. *(Reported)* A spa-only customer wasn't asked for an after photo when only pools had it ticked. Now a customer with exactly one body of water (just a spa, or just one extra) is asked for photos as a pool would be: the Photo requirements ticks (each technician's and Everyone's), the company's own photos, and Readings and Dosages' require-photo settings all read the pool's. The visit is still labelled Spa / the extra's own name. Customers with two or more bodies of water are unchanged.

**1es. App: photos are removed from the full-size view** — *not yet tested (Sept 30)*
*(File: `app.html`)*
1es.1. No more Remove photo buttons (or the × on thumbnails). To remove a photo: tap it to open it full size, then **Delete photo**, a rust button just above the "Tap the photo to close" bubble. It closes the view, removes that one photo and says "Photo deleted". Covers the before / after / closed gate photos (each of up to three), the company's own photos, a job's photo, the skip window's photo and the skipped screen's photo. Tapping the photo still just closes it. Equipment photo galleries keep their own Remove.
1es.2. *(Sept 30)* Every photo step's subtext now reads "Tap a photo to access the delete button.": before and after photos (pool, spa, extras, and the filter-clean wording) and the closed gate photo. *Not yet tested.*

**1et. App: left-handed mode** — *not yet tested (Sept 30)*
*(File: `app.html`)*
1et.1. Settings → **Left-handed mode** (everyone, this phone only; `appSettings.leftHanded`, not a company setting). When on:
- Today: Reverse route order on the left, the day heading on the right; the counts stay centred; the date row is ‹ › then the calendar on the left, with the date centred in the space to their right.
- A technician's route (Techs tab): ← Back on the left, the stops left / jobs left on the right; the same date row as Today.
- Serviced (an admin's Report tab, a technician's Serviced Pools): ‹ › on the left, the day centred to their right.
- Every visit step on every body of water: Return to route / Back on the left and the heading on the right (with Skip still in the middle, and an admin's Save report still beside Back).
- Customer rows are unchanged (On my way stays on the right). Done with CSS on a class on the page, so nothing else changes.
1et.2. *(Sept 30)* Turning left-handed mode on puts the voice entry microphone on the left of the step button (Voice entry → Left of button); it can be switched back to Right of button with left-handed mode still on. Turning left-handed mode off puts it back on the right. Left-handed mode is kept with this phone's own settings (like the microphone's side). *Not yet tested.*

**1eu. App: Skip button** — *not yet tested (Sept 30)*
*(File: `app.html`)*
1eu.1. "Skip this pool / spa / fountain" now just says **Skip**, and sits right beside Return to route / Back on the readings step's heading row (it was centred). In left-handed mode it stays beside them, on the left.

**1ev. App: a visit reads as one card** — *not yet tested (Sept 30)*
*(File: `app.html`)*
1ev.1. The Pool / Spa / Fountain / Equipment tabs card joins onto whatever is showing below it (the step, the equipment page, the skipped screen), and on the last step the service notes and Submit join onto the after photos: square where they meet, a thin line between parts, rounded only at the very top and bottom. Follows every change of step or tab by itself (it watches which cards are showing). The tabs still stay at the top while scrolling.

**1ew. Voice entry setting's wording** — *not yet tested (Sept 30)*
*(Files: `app.html`, `customer-intake.html`)*
1ew.1. The Voice entry description in Settings (app and website) now says to **hold** the microphone and speak readings **and** dosages, and that it only listens while it's held (it said tap / or / while speaking).

**1ex. App: "Return to pool / spa" on later bodies of water** — *not yet tested (Sept 30)*
*(File: `app.html`)*
1ex.1. *(Reported)* After submitting the pool, the spa's first step said "Return to route". Now only the first body of water's first step says Return to route; every later one says "← Return to pool", "← Return to spa", or the extra's own name (the body of water before it in the visit's order) and goes back to that body of water where it was left. The phone's own Back on that step does the same.

**1ey. App: counts read "5/8 stops", "1/2 jobs"** — *not yet tested (Sept 30)*
*(File: `app.html`)*
1ey.1. On Today and a technician's route (Techs tab) the counts read left / the day's total with a slash ("0/0", "5/8 stops", "1/2 jobs") instead of "5 of 8 stops left". The total is the day's whole count (left + done), so it holds while the first number counts down. The website's Today's Route keeps its own wording.
1ey.2. *(Sept 30)* Those counts are dark teal now (#114B4F, the app's dark teal), not amber. *Not yet tested.*

**1ez. Website: On my way message on the profile** — *not yet tested (Sept 30)*
*(File: `customer-intake.html`)*
1ez.1. The customer profile's "On my way goes to" is now **On my way message**, and its row also says "Automatic, 2 stops before" when that's on. Its editor has, on the same line as "Tell them by", **Automatic on my way message** with a switch; turned on, a "N stops before" picker (1–5, 2 to start) appears beside it. Saved with Done, with the rest. The Automatic on my way card is gone from Customer Customization (same setting, `autoNotify` / `autoNotifyLead`, so nothing set before is lost).

**1fa. App: quick buttons on one line** — *not yet tested (Sept 30)*
*(File: `app.html`)*
1fa.1. The quick buttons under each reading and dosage on a visit sit on a single line; when there are more than fit, the line swipes sideways to the rest (no scrollbar shown). Each button keeps its own width.

**1fb. App: automatic On my way texts** — *not yet tested (Sept 30)*
*(File: `app.html`)*
1fb.1. *(Reported)* Finishing the stop two before a customer set for automatic On my way didn't open the text. Two causes: (a) a phone only lets a web app open Messages straight after a tap, and by the time the report finished saving the Submit tap was too old, so the opening was quietly refused; (b) "2 stops away" was counted along the whole route order, so stops done out of order could make it miss.
1fb.2. Now: after each finished stop, the stops still to do are listed in route order, and the first customer set for automatic who is now within their number of stops (e.g. the next 2) and hasn't had one today gets it. A text comes up as a window — "Automatic On my way · <name> is 2 stops away / your next stop" — with **Open text message** (opens Messages with the text ready) and **Not now**. An email (customer set to email) still goes from the office by itself. Each customer is told once a day.

**1fc. Skipped bodies of water and skipped visits on the reports and in the history** — *not yet tested (Sept 30)*
*(Files: `app.html`, `customer-intake.html`)*
1fc.1. *(Reported)* A body of water skipped on a visit left no trace: no reading was saved and the report left it out, and its note and photo were never kept. Now, when the visit finishes, each skipped body is saved as a "skipped" reading (with the technician's note, and the photo kept with it as its own photo, not emailed), so:
- the app's report shows that body with "Skipped this visit" and the reason (marked internal); the customer's email shows the body with "Skipped this visit" and no reason;
- the visit's Reading history shows a "Skipped" row, and the Last 4 weeks table a column marked Skipped;
- the website's service report for it has a red Skipped badge and "Spa skipped on this visit" with the reason; the visit's row says "Spa (skipped)", and History / Billing "· skipped".
1fc.2. A whole visit skipped (Skip Service) now also shows: a "Service skipped" row in the app's Reading history and a Skipped column in the Last 4 weeks table, and on the website a "Service skipped" report in the customer's Service reports (with the reason), without a Delete button (undone with Reservice on the phone).

**1fd. App: readings history table — 3 months, fixed window, chemicals added option** — *not yet tested (Sept 30)*
*(Files: `app.html`, `customer-intake.html`)*
1fd.1. The table above a visit's readings is now **Last 3 months** (was 4 weeks). It's a fixed window showing the dates and three rows; it scrolls down for the rest of the rows and sideways for older dates, with the dates and the row names held in place while scrolling.
1fd.2. New company setting **Show chemicals added too** (website Settings, and admins in the app, under Previous readings on visits; off to start; `showRecentDosages`). When on, a "Chemicals added" section under the readings lists what was put in at each of those visits, with units; — where nothing was added.

**1fe. Quick buttons in number order** — *not yet tested (Sept 30)*
*(Files: `customer-intake.html`, `app.html`)*
1fe.1. On Readings and Dosages and Customer Customization (and seasons), a field's quick buttons run lowest to highest: top to bottom in the website's Quick buttons window, left to right in the app. A changed number moves to its place when you leave the box; a new button (0) goes into place once its number is typed. Dragging a list into an order of its own marks it (`buttonsOrdered`) and that order is kept as it is, everywhere; **Sort low to high** in the window puts it back in number order. Lists set before this show sorted until someone drags them.

**1ff. Website: quick button colours in one go** — *not yet tested (Sept 30)*
*(File: `customer-intake.html`)*
1ff.1. Each Quick buttons window (Readings and Dosages, Customer Customization, seasons) has **All colors** at the far right of the + Add button row: pick a colour and every button in that list takes it.
1ff.2. Beside **+ Add chemical**: **All quick button colors**. Pick a colour and every quick button on this body of water (its chemicals and its dosages) takes it; tick **Apply to all bodies of water** in the chooser to do pool, spa and extras together. On Customer Customization, "all" covers that customer's own setups (bodies still following the company's setup aren't changed).

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
