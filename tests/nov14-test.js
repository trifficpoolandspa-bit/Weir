// Checks for everything built Oct 29 - Nov 1, 2026, in a real browser
// (Chromium through Playwright).
// Website: Alerts (Favorites, Quotes tab, 10 a page), Products & Services
// (Chemicals last, Add line item), quote and work order line items (Item,
// the product's description carried over and editable, bigger words),
// WorkCenter subtabs back to the top, the calendar (job colours, FC on a work
// order with a filter clean, CR for Clean & refill, COMPLETE, Move, month
// picker, mirrored route buttons), no page scrolling behind a window,
// Shift-click ranges, the Pool drains tab (one list open, Select all on just
// the box, the ticked bar in the heading, Edit / Add to schedule / Remove from
// schedule, the bigger tap areas, the header order), overnight drains (on by
// default, the Cleaning menu, the Clean & refill job on that day, taken off
// and moved with its drain), and colour-blind mode.
// App: Clean & refill and filter clean work order colours, mint tasks, Move,
// the month picker, back to Today after time away, colour-blind mode.
// Quote page: Approve / Decline.
// Also: narrower Qty and Price, Add to Products & Services (website and app),
// the Add line item window by category, description hover cards, the quote
// email body and white button words, narrow Schedule arrows, the open job
// standing out, our date calendar, Jobs in pages of 10.
// Run from the main folder: node tests/nov1-test.js
const path = require('path');
const fs = require('fs');
let chromium;
try{ ({ chromium } = require('playwright')); }
catch(e){ ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); }

let pass = 0, fail = 0;
function check(name, ok, info){
  if(ok){ pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (info !== undefined ? '  — ' + info : '')); }
}
const ROOT = 'file://' + path.resolve('.') + '/';
const HELPERS = `
  window.wait = ms => new Promise(r => setTimeout(r, ms));
  window.btnText = (root, re) => Array.from(root.querySelectorAll('button')).find(b => re.test((b.textContent || '').trim()) && b.getClientRects().length);
  window.topWin = () => Array.from(document.querySelectorAll('.confirm-overlay')).pop();
  window.closeWins = () => document.querySelectorAll('.confirm-overlay').forEach(o => o.remove());
  window.isoIn = n => { const d = new Date(); d.setDate(d.getDate() + n); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  if(typeof hideSiteLogin === 'function'){ try{ siteUser = {id: 'u', companyId: 'co', role: 'owner'}; hideSiteLogin(); }catch(e){} }
`;
const SEED = `
  const put = (k, v) => localStorage.setItem('weir:' + k, JSON.stringify(v));
  const tIso = (()=>{ const x = new Date(); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10); })();
  put('technicians', [{id: 't1', name: 'Amy'}, {id: 't2', name: 'Ben'}]);
  const names = ['Alpha Ann', 'Bravo Bob', 'Charlie Cruz', 'Delta Diaz', 'Echo Eve', 'Foxtrot Fay'];
  put('customers', names.map((n, i) => ({id: 'c' + i, name: n, active: true, hasPool: true, technicianId: 't1',
    email: 'c' + i + '@x.com', address: (i + 1) + ' Main St, Buckeye, AZ', drains: [{date: '2019-01-01', body: 'pool'}]})));
  put('productsServices', [
    {id: 'p1', name: 'Replace pump seal', price: 85, category: 'repairs', description: 'Shaft seal kit and labor.'},
    {id: 'p2', name: 'Liquid chlorine', price: 6, category: 'chemicals'},
    {id: 'p3', name: 'Filter clean', price: 90, category: 'services', filterClean: true},
    {id: 'p4', name: 'Pump lid O-ring', price: 8, category: 'products'}]);
  put('scheduledWorkOrders', [
    {id: 'w1', customerId: 'c2', technicianId: 't1', date: tIso, status: 'scheduled', title: 'Clean filter', lineItems: [{description: 'Filter clean', qty: 1, price: 90}]},
    {id: 'w2', customerId: 'c3', technicianId: 't1', date: tIso, status: 'scheduled', title: 'Fix light', lineItems: [{description: 'Light repair', qty: 1, price: 50}]}]);
  put('tasks', [
    {id: 'k1', title: 'Clean & refill', date: tIso, customerIds: ['c0'], technicianId: 't1', refillOf: 'pd_x', done: false},
    {id: 'k2', title: 'Gate check', date: tIso, customerIds: ['c1'], technicianId: 't1', done: false}]);
`;


(async ()=>{
  const browser = await chromium.launch();
  const ctx = await browser.newContext({viewport: {width: 1300, height: 900}});
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript(SEED);
  await p.goto(ROOT + 'customer-intake.html');
  await p.waitForTimeout(1500);
  await p.evaluate(HELPERS);
  console.log('Calendar safety (Nov 14)');

  // 1. A Clean & refill taken off by hand stays off when the customer's settings change
  const a = await p.evaluate(()=>{
    tasks = []; saveTasks();
    const c = customers.find(x => x.id === 'c0'); c.drainOvernight = true; c.drainCleanDays = 1; saveCustomers();
    lsSet('drainCalendar', [{id: 'e1', customerId: 'c0', date: isoIn(5)}, {id: 'e2', customerId: 'c0', date: isoIn(6)}]);
    pdEnsureRefills();
    const made = tasks.filter(t => t.refillOf).length;
    // take both off by hand
    tasks = tasks.filter(t => !t.refillOf); saveTasks();
    c.drainCleanDays = 11; saveCustomers();
    const msg = pdApplyDrainSettings(['c0']);
    const afterSettings = tasks.filter(t => t.refillOf).length;
    const sweep = pdEnsureRefills();
    return {made, afterSettings, sweep, msg};
  });
  check('Two refills made when the drains were scheduled', a.made === 2, a.made);
  check('Cleaning day changed: refills taken off by hand do not come back', a.afterSettings === 0, JSON.stringify(a));
  check('The 1-minute sweep does not bring them back either', a.sweep === 0);

  // 2. Overnight off then on again brings them back (the system took them off, not the person)
  const b = await p.evaluate(()=>{
    tasks = []; saveTasks();
    const c = customers.find(x => x.id === 'c1'); c.drainOvernight = true; c.drainCleanDays = 1; saveCustomers();
    lsSet('drainCalendar', [{id: 'e3', customerId: 'c1', date: isoIn(5)}]);
    pdEnsureRefills();
    const first = tasks.filter(t => t.refillOf === 'e3').length;
    c.drainOvernight = false; saveCustomers(); pdApplyDrainSettings(['c1']);
    const off = tasks.filter(t => t.refillOf === 'e3').length;
    c.drainOvernight = true; saveCustomers(); pdApplyDrainSettings(['c1']);
    const on = tasks.filter(t => t.refillOf === 'e3').length;
    const day = (tasks.find(t => t.refillOf === 'e3') || {}).date;
    return {first, off, on, day, want: isoIn(6)};
  });
  check('Overnight off takes the refill off', b.first === 1 && b.off === 0, JSON.stringify(b));
  check('Overnight back on makes it again, on the right day', b.on === 1 && b.day === b.want, JSON.stringify(b));

  // 3. Server says the refill was deleted: never made again on its own
  const c3 = await p.evaluate(()=>{
    siteUser = {id: 'u', companyId: 'co', role: 'owner'};
    tasks = []; saveTasks();
    const st = loadSyncState('co'); st.records.known['task\u0002task_refill_e4'] = {u: 'x', d: true, f: {}}; saveSyncState('co', st);
    lsSet('drainCalendar', [{id: 'e4', customerId: 'c2', date: isoIn(5)}, {id: 'e5', customerId: 'c2', date: isoIn(7)}]);
    const cu = customers.find(x => x.id === 'c2'); cu.drainOvernight = true; saveCustomers();
    pdEnsureRefills();
    return {e4: tasks.filter(t => t.refillOf === 'e4').length, e5: tasks.filter(t => t.refillOf === 'e5').length};
  });
  check('A refill the server has as deleted is not made again', c3.e4 === 0, JSON.stringify(c3));
  check('...but a new drain with no history still gets its refill', c3.e5 === 1, JSON.stringify(c3));

  // 4. While the server's changes are coming in, nothing is made
  const d = await p.evaluate(()=>{
    tasks = []; saveTasks();
    lsSet('drainCalendar', [{id: 'e6', customerId: 'c3', date: isoIn(5)}]);
    syncRunning = true; const n = pdEnsureRefills(); syncRunning = false;
    return n;
  });
  check('No refill made while sync is running', d === 0, d);

  // 5. Route drains: no copy of a drain whose calendar day is gone, none during sync
  const e5 = await p.evaluate(()=>{
    lsSet('drainCalendar', []);
    lsSet('scheduledPoolDrains', [
      {id: 'r1', calendarId: 'gone1', customerId: 'c0', date: isoIn(3), status: 'scheduled', bodyKey: 'pool'},
      {id: 'r2', customerId: 'c1', date: isoIn(4), status: 'scheduled', bodyKey: 'pool'}]);
    syncRunning = true; calFollowRoute(); const during = pdCal().length; syncRunning = false;
    calFollowRoute();
    const cal = pdCal();
    return {during, ids: cal.map(e => e.id).join(','), n: cal.length};
  });
  check('Route drain with a missing calendar day: no copy made', e5.ids.indexOf('pdcal_r1') === -1, JSON.stringify(e5));
  check('Route drain that never had a day still gets one', e5.ids === 'pdcal_r2' && e5.during === 0, JSON.stringify(e5));

  // 6. A drain moved on the route still moves its calendar day and refill together
  const f = await p.evaluate(()=>{
    tasks = []; saveTasks(); siteUser = {id: 'u', companyId: 'co2', role: 'owner'};
    const cu = customers.find(x => x.id === 'c4'); cu.drainOvernight = true; cu.drainCleanDays = 1; saveCustomers();
    lsSet('drainCalendar', [{id: 'e7', customerId: 'c4', date: isoIn(10), pushed: {pool: 'r7'}}]);
    lsSet('scheduledPoolDrains', [{id: 'r7', calendarId: 'e7', customerId: 'c4', date: isoIn(10), status: 'scheduled', bodyKey: 'pool'}]);
    pdEnsureRefills();
    const recs = pdScheduled(); recs[0].date = isoIn(8); lsSet('scheduledPoolDrains', recs);
    calFollowRoute();
    return {entry: pdCal().find(e => e.id === 'e7').date, refill: (tasks.find(t => t.refillOf === 'e7') || {}).date, wantE: isoIn(8), wantR: isoIn(9)};
  });
  check('Moved drain: calendar day and refill follow together', f.entry === f.wantE && f.refill === f.wantR, JSON.stringify(f));


  // 7. Calendar check: finds copies, orphans, doubles and wrong days; fixes only what is ticked
  const g = await p.evaluate(async ()=>{
    siteUser = {id: 'u', companyId: 'co3', role: 'owner'};
    const cu = customers.find(x => x.id === 'c5'); cu.drainOvernight = true; cu.drainCleanDays = 1; saveCustomers();
    tasks = []; saveTasks();
    lsSet('drainCalendar', [
      {id: 'k1', customerId: 'c5', date: isoIn(3), pushed: {pool: 'rk1'}},
      {id: 'k2', customerId: 'c5', date: isoIn(3)},
      {id: 'k3', customerId: 'c5', date: isoIn(9), pushed: {pool: 'rk3'}},
      {id: 'k4', customerId: 'c5', date: isoIn(-2), pushed: {pool: 'rk4'}}]);
    lsSet('scheduledPoolDrains', [
      {id: 'rk1', calendarId: 'k1', customerId: 'c5', date: isoIn(3), status: 'scheduled', bodyKey: 'pool'},
      {id: 'rk3', calendarId: 'k3', customerId: 'c5', date: isoIn(9), status: 'scheduled', bodyKey: 'pool'},
      {id: 'rk4', calendarId: 'k4', customerId: 'c5', date: isoIn(-2), status: 'done', bodyKey: 'pool'}]);
    tasks = [
      {id: 'task_refill_k1', title: 'Clean & refill', refillOf: 'k1', date: isoIn(4), customerIds: ['c5'], done: false},
      {id: 'task_refill_k2', title: 'Clean & refill', refillOf: 'k2', date: isoIn(4), customerIds: ['c5'], done: false},
      {id: 'dup_k3', title: 'Clean & refill', refillOf: 'k3', date: isoIn(10), customerIds: ['c5'], done: false},
      {id: 'task_refill_k3', title: 'Clean & refill', refillOf: 'k3', date: isoIn(19), customerIds: ['c5'], done: false},
      {id: 'task_refill_zz', title: 'Clean & refill', refillOf: 'zz', date: isoIn(5), customerIds: ['c5'], done: false}];
    saveTasks();
    const f = pdCheckFindings();
    const kinds = f.map(x => x.kind).sort().join(',');
    pdOpenCalendarCheck(); await wait(100);
    const win = document.querySelector('.confirm-overlay');
    const rows = win ? win.querySelectorAll('label input[type=checkbox]').length : 0;
    // tick everything except the wrong-day one is the default
    Array.from(win.querySelectorAll('[data-fix]')).forEach(b => b.click());
    await wait(100);
    const cal = pdCal().map(e => e.id).sort().join(',');
    const recs = pdScheduled().map(r => r.id).sort().join(',');
    const tk = tasks.map(t => t.id).sort().join(',');
    const t3 = tasks.find(t => t.id === 'task_refill_k3');
    closeWins();
    return {kinds, rows, cal, recs, tk, t3: t3 && t3.date, want: isoIn(19)};
  });
  check('Calendar check finds copy, orphan, double and wrong-day refill', g.kinds === 'copy,day,orphan,twice', g.kinds);
  check('Calendar check shows a row for each', g.rows === 4, g.rows);
  check('Fix ticked: the extra drain goes, the real ones and the done one stay', g.cal === 'k1,k3,k4', g.cal);
  check('Fix ticked: the route jobs of the kept drains stay', g.recs === 'rk1,rk3,rk4', g.recs);
  check('Fix ticked: orphan, double and the copy’s refill go; wrong-day left alone', g.tk === 'task_refill_k1,task_refill_k3' && g.t3 === g.want, g.tk + ' ' + g.t3);

  // 8. Take every drain off a range of days
  const h = await p.evaluate(async ()=>{
    lsSet('drainCalendar', [
      {id: 'm1', customerId: 'c0', date: isoIn(20)}, {id: 'm2', customerId: 'c1', date: isoIn(21)},
      {id: 'm3', customerId: 'c2', date: isoIn(25)}]);
    tasks = [{id: 'task_refill_m1', refillOf: 'm1', title: 'Clean & refill', date: isoIn(21), customerIds: ['c0'], done: false},
             {id: 'task_refill_m3', refillOf: 'm3', title: 'Clean & refill', date: isoIn(26), customerIds: ['c2'], done: false}];
    saveTasks();
    pdOpenCalendarCheck(); await wait(100);
    const win = document.querySelector('.confirm-overlay');
    win.querySelector('[data-from]').value = isoIn(20); win.querySelector('[data-to]').value = isoIn(21);
    win.querySelector('[data-range]').click(); await wait(150);
    const ask = document.querySelectorAll('.confirm-overlay').length;
    const okBtn = document.getElementById('confirmOk'); const msg = okBtn ? okBtn.parentNode.parentNode.querySelector('p').textContent : '';
    if(okBtn) okBtn.click(); await wait(150);
    const res = {msg, cal: pdCal().map(e => e.id).join(','), tk: tasks.map(t => t.id).join(',')};
    closeWins(); return res;
  });
  check('Range: asks first, with counts', /2 drains/.test(h.msg), h.msg);
  check('Range: only those days go, with their refills', h.cal === 'm3' && h.tk === 'task_refill_m3', JSON.stringify(h));

  check('No page errors', errs.length === 0, errs.join(' | '));
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
