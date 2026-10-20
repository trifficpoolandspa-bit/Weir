// Checks for everything built on Oct 19, 2026, in a real browser (Chromium
// through Playwright): removed calendar jobs staying removed through a sync,
// bins on every day-window row, done jobs put back in the app as fresh ones,
// work order tags and scrolling names, the sub-tabs going back to the top, the
// customer search's past entries, the Deleted customers window, and the last
// drain and filter clean dates in the app and on the website.
// Run from the main folder: node tests/oct19-test.js
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
  window.iso = n => { const x = new Date(); x.setDate(x.getDate() + n); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  window.btnText = (root, re) => Array.from(root.querySelectorAll('button')).find(b => re.test((b.textContent || '').trim()));
  window.topWin = () => Array.from(document.querySelectorAll('.confirm-overlay')).pop();
  // A real click on the dark area round a window: pressed and let go there
  // The website signed in as the owner, so the sign-in screen isn't in front
  if(typeof hideSiteLogin === 'function'){ try{ siteUser = {id: 'u', companyId: 'co', role: 'owner'}; hideSiteLogin(); }catch(e){} }
  window.clickOutside = el => { el.dispatchEvent(new MouseEvent('mousedown', {bubbles: true})); el.dispatchEvent(new MouseEvent('click', {bubbles: true})); };
`;
// What every website page starts with: two customers (Alpha with a pool and
// a spa), one technician, and on one day a filter clean group of both, a
// drain for Alpha, a work order visit for Bravo and a task for Alpha
const SEED = `
  window.__D = (()=>{ const x = new Date(); x.setDate(x.getDate() + 3); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10); })();
  const put = (k, v) => localStorage.setItem('weir:' + k, JSON.stringify(v));
  put('photoEveryone', {});
  put('technicians', [{id: 't1', name: 'Amy'}]);
  put('customers', [
    {id: 'a', name: 'Alpha Ann', active: true, hasPool: true, hasSpa: true, technicianId: 't1', email: 'a@x.com', address: '1 Main'},
    {id: 'b', name: 'Bravo Bob', active: true, hasPool: true, technicianId: 't1', email: 'b@x.com', address: '2 Main'},
    {id: 'c', name: 'Cora Cole', active: true, hasPool: true, technicianId: 't1', address: '3 Main'}]);
  put('filterGroups', [
    {id: 'g1', name: 'West side', customerIds: ['a', 'b'], date: window.__D, technicianId: 't1', finalized: false, photoRequired: true, emailCustomer: true},
    {id: 'g2', name: 'East side', customerIds: ['c'], date: '', technicianId: 't1', finalized: false, photoRequired: true, emailCustomer: true},
    {id: 'g3', name: 'North side', customerIds: ['a'], date: '', technicianId: 't1', finalized: false, photoRequired: true, emailCustomer: true}]);
  put('drainCalendar', [{id: 'dc1', date: window.__D, customerId: 'a', bodyKind: 'pool', bodyKinds: ['pool', 'spa']}]);
  put('scheduledWorkOrders', [{id: 'j1', workOrderId: 'w1', workOrderNumber: 43, customerId: 'b', technicianId: 't1', date: window.__D,
    title: 'Replace pump seal', lineItems: [{description: 'Replace pump seal', qty: 1, price: 50}], status: 'scheduled'}]);
  put('workOrderCounter', 43);
  put('tasks', [{id: 'k1', title: 'Check timer settings', technicianId: 't1', date: window.__D, customerIds: ['a'], done: false}]);
`;

(async ()=>{
  const browser = await chromium.launch();
  async function open(file, width, init){
    const p = await browser.newPage({viewport: {width: width || (file === 'app.html' ? 400 : 1300), height: 900}});
    p.__errors = [];
    p.on('pageerror', e => p.__errors.push(String(e)));
    if(init) await p.addInitScript(init);
    await p.goto(ROOT + file);
    await p.waitForTimeout(1500);
    await p.evaluate(HELPERS);
    return p;
  }
  async function run(file, name, fn, opts){
    opts = opts || {};
    const p = await open(file, opts.width, opts.init);
    let r;
    try{ r = await p.evaluate(fn); }
    catch(e){ check(name + ' (ran)', false, String(e).slice(0, 300)); await p.close(); return; }
    (r || []).forEach(([n, ok, info]) => check(n, ok, info));
    check(name + ': no page errors', p.__errors.length === 0, p.__errors.join(' | ').slice(0, 300));
    await p.close();
  }
  const SITE = {init: SEED};

  console.log('\n=== Website: a job taken off the calendar stays off after a sync ===');
  await run('customer-intake.html', 'Sync removals', async ()=>{
    const out = [];
    // The server knows a drain day, a filter clean group, a quote and a service
    // call that were just taken off here
    const gone = [['drain_entry', 'dc9', {id: 'dc9', date: window.__D, customerId: 'b'}],
                  ['filter_group', 'g9', {id: 'g9', name: 'Old group', customerIds: ['b'], date: window.__D}],
                  ['quote', 'q9', {id: 'q9', type: 'Quote', customerId: 'b'}],
                  ['service_call', 's9', {id: 's9', customerId: 'b'}]];
    const state = {records: {cursor: '2026-10-01T00:00:00Z', known: {}, seen: {}, edits: {}}};
    gone.forEach(([k, id, data]) => { state.records.known[k + '\u0002' + id] = {u: '2026-10-01T00:00:00Z', d: false, f: syncFieldHashes(data)}; state.records.seen[k + '\u0002' + id] = syncFieldHashes(data); });
    const pushed = [];
    window.syncCall = async (path, opts)=>{
      if(/company_records\?select/.test(path)){
        // The pull's overlap brings them back down
        return {ok: true, status: 200, body: gone.map(([kind, id, data]) => ({kind, id, data, deleted: false, updated_at: '2026-10-01T00:00:00Z'}))};
      }
      if(/push_record_fields/.test(path)){
        const b = JSON.parse(opts.body); pushed.push(b);
        return {ok: true, status: 200, body: {result: 'saved', updated_at: new Date().toISOString(), deleted: !!(b.p_changes._deleted && b.p_changes._deleted.v), data: {}}};
      }
      return {ok: true, status: 200, body: []};
    };
    await syncRecords(state, 'co');
    out.push(['the drain day is not put back', !pdCal().some(e => e.id === 'dc9')]);
    out.push(['the filter clean group is not put back', !(lsGet('filterGroups') || []).some(g => g.id === 'g9')]);
    out.push(['the quote is not put back', !(lsGet('workOrders') || []).some(w => w.id === 'q9')]);
    out.push(['the service call is not put back', !(lsGet('serviceCalls') || []).some(x => x.id === 's9')]);
    const dels = pushed.filter(b => b.p_changes && b.p_changes._deleted && b.p_changes._deleted.v === true).map(b => b.p_kind).sort();
    out.push(['each is deleted on the server', dels.join(',') === 'drain_entry,filter_group,quote,service_call', dels.join(',')]);
    return out;
  }, SITE);

  console.log('\n=== Website: bins, done jobs and tags on the calendar ===');
  await run('customer-intake.html', 'Calendar day window', async ()=>{
    const out = [];
    const D = window.__D;
    window.confirmDialog = ()=> Promise.resolve(true);
    // A work order with a filter clean and a pool drain on it, and one with neither
    const jobs = lsGet('scheduledWorkOrders');
    jobs.push({id: 'j2', workOrderId: 'w2', workOrderNumber: 44, customerId: 'c', technicianId: 't1', date: D, title: 'Filter clean, Pool drain',
      lineItems: [{description: 'Filter clean', qty: 1, price: 90, filterClean: true}, {description: 'Pool drain', qty: 1, price: 300}], status: 'scheduled'});
    lsSet('scheduledWorkOrders', jobs);
    customers.find(x => x.id === 'c').name = 'Castillo-Hernandez Wellington, Raymond and Josephine';
    switchView('workcenter');
    applyWorkCenterMode('calendar');
    openWorkCalendar(D);
    await wait(40);
    btnText(topWin(), /^Close$/).click();
    await wait(300);
    const cell = document.querySelector('#wcCalendarCard [data-cal-day="' + D + '"]');
    const tags = Array.from(cell.querySelectorAll('span[style*="JetBrains"]')).map(x => x.textContent);
    out.push(['a work order with neither shows WO', tags.indexOf('WO') !== -1, tags.join(',')]);
    // The cell shows four; the long-named one is the fifth, so look at its chip on its own
    const chip = calNameChip('Castillo-Hernandez Wellington, Raymond and Josephine', 'app', '', 'WO FC PD');
    chip.style.width = '120px'; cell.appendChild(chip);
    webMarqueeIfCut(chip.querySelector('.cal-chip-name'));
    await wait(80);
    out.push(['the tag sits outside the scrolling name', !chip.querySelector('.cal-chip-name').contains(chip.querySelector('span[style*="JetBrains"]'))]);
    out.push(['a name too long for its badge scrolls', chip.querySelector('.cal-chip-name').classList.contains('marquee-on')]);
    chip.remove();
    // The tag worked out from the work order itself
    const all = Array.from(document.querySelectorAll('#wcCalendarCard [data-cal-day="' + D + '"] div')).filter(x => x.style.background);
    out.push(['(the day is full: + more shown)', /more/.test(cell.textContent)]);
    cell.click();
    await wait(30);
    let w = topWin();
    out.push(['work order and task rows have bins', w.querySelectorAll('[data-x-drawn="bin"]').length >= 7, w.querySelectorAll('[data-x-drawn="bin"]').length]);
    // Mark the drain, the first work order and the task done
    const choose = (sel, v) => { sel.value = v; sel.dispatchEvent(new Event('change', {bubbles: true})); };
    const pickers = ()=> Array.from(topWin().querySelectorAll('select.cal-status-pick'));
    choose(pickers()[0], 'done'); await wait(30);
    choose(pickers()[2], 'done'); await wait(30);
    choose(pickers()[3], 'done'); await wait(30);
    choose(pickers()[5], 'done'); await wait(30);
    w = topWin();
    const rowsWithBins = Array.from(w.querySelectorAll('[data-x-drawn="bin"]')).length;
    out.push(['done rows keep their bins', rowsWithBins >= 7, rowsWithBins]);
    // Each bin at the far right, in the same column
    const lefts = Array.from(w.querySelectorAll('div[style*="grid-template-columns"] > button[data-x-drawn="bin"]')).map(b => Math.round(b.getBoundingClientRect().left));
    out.push(['every row’s bin in the same spot', lefts.length >= 5 && lefts.every(x => Math.abs(x - lefts[0]) <= 1), lefts.join(',')]);
    // Done → In the app: a fresh job, the finished one kept
    const fcDoneBefore = (lsGet('scheduledFilterCleans') || []).filter(f => f.customerId === 'a' && f.status === 'done').length;
    choose(pickers()[0], 'app'); await wait(40);
    const fcs = (lsGet('scheduledFilterCleans') || []).filter(f => f.customerId === 'a' && f.groupId === 'g1');
    out.push(['filter clean: the finished one is kept', fcDoneBefore === 1 && fcs.some(f => f.status === 'done' && f.reopened), JSON.stringify(fcs.map(f => [f.status, !!f.reopened]))]);
    out.push(['…and a fresh one goes to the app', fcs.some(f => f.status === 'scheduled' && !f.reopened && String(f.technicianId) === 't1')]);
    out.push(['…the calendar shows it in the app', pickers()[0].value === 'app']);
    choose(pickers()[2], 'app'); await wait(40);
    const pds = (lsGet('scheduledPoolDrains') || []).filter(r => r.customerId === 'a');
    out.push(['pool drain: the finished jobs are kept', pds.filter(r => r.status === 'done' && r.reopened).length === 2, JSON.stringify(pds.map(r => [r.status, !!r.reopened]))]);
    out.push(['…fresh ones go to the app', pds.filter(r => r.status === 'scheduled' && !r.reopened).length === 2]);
    out.push(['…the last drain stays on their record', pdLast(customers.find(x => x.id === 'a'), 'pool') !== '']);
    choose(pickers()[3], 'app'); await wait(40);
    const wos = (lsGet('scheduledWorkOrders') || []).filter(j => j.workOrderId === 'w1');
    out.push(['work order: the finished visit is kept', wos.some(j => j.status === 'done' && j.reopened) && wos.some(j => j.status === 'scheduled' && !j.reopened), JSON.stringify(wos.map(j => [j.status, !!j.reopened]))]);
    out.push(['…and the day lists it once', topWin().textContent.split('#0043').length === 2]);
    workOrders.push({id: 'w1', type: 'Work Order', number: 43, customerId: 'b', lineItems: [{description: 'Replace pump seal', qty: 1, price: 50}], status: 'finalized'});
    const jobs2 = qoEntriesFor('b').filter(x => x.kind === 'workorder');
    out.push(['…both are in the customer’s Jobs', jobs2.some(x => x.done) && jobs2.some(x => !x.done), jobs2.length]);
    choose(pickers()[5], ''); await wait(40);
    const tks = (lsGet('tasks') || []).filter(t => t.title === 'Check timer settings');
    out.push(['task: done → Not in app keeps the finished one', tks.some(t => t.done && t.reopened) && tks.some(t => !t.done && t.held && !t.reopened), JSON.stringify(tks.map(t => [t.done, !!t.held, !!t.reopened]))]);
    // A bin on a done job removes it; on a work order it's gone from the day and the app
    const before = (lsGet('scheduledWorkOrders') || []).length;
    const woRow = Array.from(topWin().querySelectorAll('div[style*="grid-template-columns"]')).find(r => /#0044/.test(r.textContent));
    woRow.querySelector('[data-x-drawn="bin"]').click(); await wait(40);
    out.push(['a work order’s bin takes it off the day and the app', (lsGet('scheduledWorkOrders') || []).length === before - 1 && !(lsGet('scheduledWorkOrders') || []).some(j => j.id === 'j2')]);
    return out;
  }, SITE);

  console.log('\n=== App: a done job put back from the website ===');
  await run('app.html', 'App reopened jobs', async ()=>{
    const out = [];
    const d = new Date(); const day = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    lsSet('scheduledWorkOrders', [{id: 'j1', customerId: 'a', technicianId: 't1', date: day, status: 'done', reopened: true, title: 'Old'},
                                  {id: 'j2', customerId: 'a', technicianId: 't1', date: day, status: 'scheduled', title: 'Fresh'}]);
    lsSet('scheduledFilterCleans', [{id: 'f1', customerId: 'a', technicianId: 't1', date: day, status: 'done', reopened: true},
                                    {id: 'f2', customerId: 'a', technicianId: 't1', date: day, status: 'scheduled'}]);
    const ids = techRouteJobsFor('t1', day).map(j => j.id);
    out.push(['a technician’s route shows the fresh job, not the old one too', ids.indexOf('j2') !== -1 && ids.indexOf('j1') === -1 && ids.indexOf('f2') !== -1 && ids.indexOf('f1') === -1, ids.join(',')]);
    const route = routeJobsFor('a', day, 't1').map(j => j.id);
    out.push(['the fresh work order is on the route to do', route.indexOf('j2') !== -1, route.join(',')]);
    return out;
  });

  console.log('\n=== Website: sub-tabs back to the top; customer search ===');
  await run('customer-intake.html', 'Sub-tabs and search', async ()=>{
    const out = [];
    switchView('workcenter');
    document.querySelector('#wcNavSubs .nav-sub[data-type="calendar"]').click();
    await wait(50);
    document.body.style.minHeight = '4000px';
    window.scrollTo(0, 900);
    await wait(50);
    document.querySelector('#wcNavSubs .nav-sub[data-type="calendar"]').click();
    await wait(700);
    out.push(['pressing the sub-tab already showing leaves the page where it is', window.scrollY > 800, window.scrollY]);
    document.querySelector('#wcNavSubs .nav-sub[data-type="filters"]').click();
    await wait(900);
    out.push(['pressing a different sub-tab goes back to the top', window.scrollY < 5, window.scrollY]);
    const cs = document.getElementById('customerSearch');
    out.push(['the customer search has a name of its own each time', /^cs-[a-z0-9]+$/.test(cs.getAttribute('name') || ''), cs.getAttribute('name')]);
    out.push(['…and the browser’s own suggestions turned off', cs.getAttribute('autocomplete') === 'weir-search', cs.getAttribute('autocomplete')]);
    window.__name1 = cs.getAttribute('name');
    return out;
  }, SITE);
  {
    const p1 = await open('customer-intake.html', 1300, SEED);
    const n1 = await p1.evaluate(()=> document.getElementById('customerSearch').getAttribute('name'));
    await p1.close();
    const p2 = await open('customer-intake.html', 1300, SEED);
    const n2 = await p2.evaluate(()=> document.getElementById('customerSearch').getAttribute('name'));
    await p2.close();
    check('opening the page again gives it a different name, so no past searches match', n1 && n2 && n1 !== n2, n1 + ' / ' + n2);
  }

  console.log('\n=== Website: the Deleted customers window ===');
  await run('customer-intake.html', 'Deleted customers', async ()=>{
    const out = [];
    window.confirmDialog = ()=> Promise.resolve(true);
    const asked = [];
    window.syncCall = async (path, opts)=>{
      asked.push({path, body: opts && opts.body});
      if(/customers\?select/.test(path)) return {ok: true, status: 200, body: [
        {id: 'x1', data: {name: 'Castillo-Hernandez Wellington, Raymond and Josephine', address: '23815 W Watkins Street, Buckeye AZ 85326 and a long way further'}, updated_at: '2026-10-17T16:40:00Z', field_times: {}},
        {id: 'x2', data: {name: 'Fox, Gary', address: '9 Palm Ln'}, updated_at: '2026-10-12T18:05:00Z', field_times: {}},
        {id: 'x3', data: {}, updated_at: '2026-10-10T18:05:00Z', field_times: {}}]};
      if(/purge_deleted_customer/.test(path)) return {ok: true, status: 200, body: {id: 'x1', purged: true}};
      return {ok: true, status: 200, body: []};
    };
    await openDeletedCustomers();
    await wait(150);
    const rows = ()=> Array.from(document.querySelectorAll('#deletedList .deleted-customer'));
    out.push(['one deleted for good already isn’t listed', rows().length === 2, rows().length]);
    const restores = rows().map(r => btnText(r, /^Restore$/));
    out.push(['every Restore is the same width', restores.every(b => Math.round(b.getBoundingClientRect().width) === 104), restores.map(b => b.getBoundingClientRect().width).join(',')]);
    const list = document.getElementById('deletedList').getBoundingClientRect();
    const bins = rows().map(r => r.querySelector('[data-x-drawn="bin"]'));
    out.push(['each has a bin after Restore, at the far right', bins.every((b, i) => b && b.getBoundingClientRect().left > restores[i].getBoundingClientRect().right && list.right - b.getBoundingClientRect().right < 24)]);
    out.push(['Restore buttons all line up', restores.every(b => Math.abs(b.getBoundingClientRect().left - restores[0].getBoundingClientRect().left) < 1)]);
    await wait(100);
    out.push(['a name too long for its line scrolls', rows()[0].querySelector('.deleted-scroll').classList.contains('marquee-on')]);
    out.push(['…and so does an address', rows()[0].querySelectorAll('.deleted-scroll')[1].classList.contains('marquee-on')]);
    out.push(['a short one doesn’t', !rows()[1].querySelector('.deleted-scroll').classList.contains('marquee-on')]);
    bins[0].click();
    await wait(80);
    const purge = asked.find(a => /purge_deleted_customer/.test(a.path));
    out.push(['the bin deletes them for good on the server', !!purge && JSON.parse(purge.body).p_id === 'x1']);
    out.push(['…and they leave the list', rows().length === 1 && /Fox/.test(rows()[0].textContent)]);
    return out;
  }, SITE);

  console.log('\n=== Last drain and filter clean dates ===');
  const LAST_SEED = SEED + `
    const c = JSON.parse(localStorage.getItem('weir:customers'));
    c[0].fountains = [{id: 'f1', name: 'Koi pond'}];
    c[0].drains = [{date: '2026-03-04'}, {date: '2025-02-01'}, {date: '2026-06-18', body: 'spa'}];
    localStorage.setItem('weir:customers', JSON.stringify(c));
    localStorage.setItem('weir:scheduledFilterCleans', JSON.stringify([
      {id: 'o1', customerId: 'a', status: 'done', doneAt: '2026-09-12T17:00:00Z', date: '2026-09-12'},
      {id: 'o2', customerId: 'a', status: 'done', doneAt: '2026-08-01T17:00:00Z', date: '2026-08-01'},
      {id: 'o3', customerId: 'a', status: 'scheduled', date: '2026-12-01'}]));
  `;
  await run('app.html', 'App last dates', async ()=>{
    const out = [];
    openCustomerEditor(customers.find(x => x.id === 'a'));
    const box = document.getElementById('ncLastDone');
    const t = box.textContent;
    out.push(['under Edit customer: the last pool drain', /Last pool drain Mar 4, 2026/.test(t), t]);
    out.push(['…the last spa drain', /Last spa drain Jun 18, 2026/.test(t)]);
    out.push(['…an extra body by its own name', /Last Koi pond drain Not yet/.test(t)]);
    out.push(['…the last filter clean done', /Last filter clean Sep 12, 2026/.test(t)]);
    out.push(['one under another', box.querySelectorAll('br').length === 3]);
    out.push(['right under the heading', box.previousElementSibling && box.previousElementSibling.contains(document.getElementById('newCustomerHeading'))]);
    resetCustomerForm();
    out.push(['not on New customer', box.style.display === 'none']);
    return out;
  }, {init: LAST_SEED});
  await run('customer-intake.html', 'Website last dates', async ()=>{
    const out = [];
    switchView('customers');
    viewCustomer(customers.find(x => x.id === 'a'));
    const box = document.getElementById('profileLastDone');
    const t = box.textContent;
    out.push(['on the profile: the last pool drain', /Last pool drain Mar 4, 2026/.test(t), t]);
    out.push(['…the last spa drain', /Last spa drain Jun 18, 2026/.test(t)]);
    out.push(['…an extra body by its own name', /Last Koi pond drain Not yet/.test(t)]);
    out.push(['…the last filter clean done', /Last filter clean Sep 12, 2026/.test(t)]);
    const tops = Array.from(box.children).map(x => Math.round(x.getBoundingClientRect().top));
    out.push(['side by side on one line', tops.length === 4 && tops.every(y => y === tops[0]), tops.join(',')]);
    const nameLine = document.getElementById('profileName').parentElement.getBoundingClientRect();
    out.push(['a little below the name line', box.getBoundingClientRect().top - nameLine.bottom >= 10, box.getBoundingClientRect().top - nameLine.bottom]);
    viewCustomer(customers.find(x => x.id === 'b'));
    out.push(['another customer shows their own (Not yet)', /Last pool drain Not yet/.test(box.textContent) && /Last filter clean Not yet/.test(box.textContent), box.textContent]);
    return out;
  }, {init: LAST_SEED});

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
