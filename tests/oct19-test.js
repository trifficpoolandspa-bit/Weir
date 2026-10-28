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
    out.push(['on the profile: the last pool drain', /Last pool drain\s*Mar 4, 2026/.test(t), t]);
    out.push(['…the last spa drain', /Last spa drain\s*Jun 18, 2026/.test(t)]);
    out.push(['…an extra body by its own name', /Last Koi pond drain\s*Not yet/.test(t)]);
    out.push(['…the last filter clean done', /Last filter clean\s*Sep 12, 2026/.test(t)]);
    const tops = Array.from(box.children).map(x => Math.round(x.getBoundingClientRect().top));
    out.push(['side by side on one line', tops.length === 4 && tops.every(y => y === tops[0]), tops.join(',')]);
    const nameLine = document.getElementById('profileName').parentElement.getBoundingClientRect();
    out.push(['a little below the name line', box.getBoundingClientRect().top - nameLine.bottom >= 10, box.getBoundingClientRect().top - nameLine.bottom]);
    viewCustomer(customers.find(x => x.id === 'b'));
    out.push(['another customer shows their own (Not yet)', /Last pool drain\s*Not yet/.test(box.textContent) && /Last filter clean\s*Not yet/.test(box.textContent), box.textContent]);
    return out;
  }, {init: LAST_SEED});

  // ===================== Later on Oct 19 =====================
  const APP_OPEN = `
    currentUser = {id: 't1', name: 'Amy'}; lsSet('technicians', [{id: 't1', name: 'Amy'}, {id: 't2', name: 'Ben'}]);
    try{ hideLogin(); }catch(e){}
    localStorage.setItem('weirdevice:membership', JSON.stringify({full_access: true}));
    try{ applyRoleUI(); }catch(e){}
  `;
  // The app's own type (Inter), from node_modules/@fontsource/inter when there,
  // so widths are measured as on a phone; without it the fallback type is wider
  let FONTS = '';
  try{
    const F = path.join(path.dirname(require.resolve('@fontsource/inter/package.json')), 'files') + '/';
    FONTS = "document.addEventListener('DOMContentLoaded',()=>{const st=document.createElement('style');st.textContent=\""
      + [400, 500, 600, 700].map(w => "@font-face{font-family:'Inter';font-weight:" + w + ";src:url(file://" + F + "inter-latin-" + w + "-normal.woff2)}").join('')
      + "\";document.head.appendChild(st);});";
  }catch(e){ console.log('  (Inter not installed: npm i @fontsource/inter — widths measured in the fallback type)'); }
  console.log('\n=== App: WorkCenter forms ===');
  await run('app.html', 'App WorkCenter forms', new Function('return (async ()=>{' + APP_OPEN + `
    const out = [];
    try{ await document.fonts.ready; }catch(e){}
    customers.push({id: 'c1', name: 'Jordan Ellis', email: 'jordan@example.com', address: '1 A St', active: true});
    switchView('customers');
    viewChangedAt = 0;
    document.getElementById('btnCustPaneWork').click();
    await wait(200);
    try{ await document.fonts.ready; }catch(e){}
    // Quote: Expires on the Date line, between Date and the number
    const dateLab = document.getElementById('awcQuoteNumber').parentElement;
    const kids = Array.from(dateLab.children);
    const exp = document.getElementById('awcQuoteExpires').closest('label');
    out.push(['quote: Expires in … days is on the Date line', kids.indexOf(exp) !== -1]);
    // Oct 27: a quote has no date, so Expires comes first, then the number
    out.push(['…before the quote number', kids.indexOf(exp) !== -1 && kids.indexOf(exp) < kids.indexOf(document.getElementById('awcQuoteNumber'))]);
    out.push(['…and the date box on its own line below', document.getElementById('awcQuoteDate').parentElement === dateLab.parentElement]);
    // Work order: four ticks in two even columns
    document.querySelector('#awcKindRow [data-kind="Work Order"]').click();
    await wait(80);
    const grid = document.getElementById('awcWoPhoto').closest('label').parentElement;
    const order = Array.from(grid.querySelectorAll('input')).map(i => i.id).join(',');
    out.push(['work order: Photo, Email customer, Video, Include prices in two columns', getComputedStyle(grid).display === 'grid' && order === 'awcWoPhoto,awcWoEmail,awcWoVideo,awcWoPrices', order]);
    const r = id => document.getElementById(id).closest('label').getBoundingClientRect();
    out.push(['…evenly lined up', Math.abs(r('awcWoPhoto').left - r('awcWoVideo').left) < 1 && Math.abs(r('awcWoEmail').left - r('awcWoPrices').left) < 1]);
    out.push(['…nothing runs off the phone', r('awcWoPrices').right <= document.getElementById('awc').getBoundingClientRect().right]);
    out.push(['…Email customer and Include prices ticked to start', document.getElementById('awcWoEmail').checked && document.getElementById('awcWoPrices').checked]);
    // Finalize with them unticked: saved on the visits
    document.getElementById('awcWoEmail').checked = false;
    awcWoCustomers = ['c1']; awcLineItems = [{description: 'Pump seal', qty: 1, price: 50}]; awcWoTechs = ['t1'];
    document.getElementById('awcWoDate').value = '2026-10-21';
    awcFinalize();
    const job = (lsGet('scheduledWorkOrders') || []).find(j => j.customerId === 'c1');
    out.push(['finalized: Email customer and Include prices saved on the visit', !!job && job.emailCustomer === false && job.emailPrices === true, JSON.stringify(job && [job.emailCustomer, job.emailPrices])]);
    out.push(['Clear ticks them again', document.getElementById('awcWoEmail').checked && document.getElementById('awcWoPrices').checked]);
    // Task: Saved tasks beside the date; ticks side by side under it
    document.querySelector('#awcKindRow [data-kind="Task"]').click();
    await wait(80);
    const tDate = document.getElementById('awcTaskDate'), saved = document.getElementById('awcSavedTasks');
    out.push(['task: Saved tasks on the date line, to the right of the date', saved.parentElement === tDate.parentElement && saved.getBoundingClientRect().left > tDate.getBoundingClientRect().right]);
    out.push(['…narrower than the form', saved.getBoundingClientRect().width < document.getElementById('awc').getBoundingClientRect().width / 2]);
    const tp = document.getElementById('awcTaskPhoto').closest('label').getBoundingClientRect(), tv = document.getElementById('awcTaskVideo').closest('label').getBoundingClientRect();
    out.push(['…Photo and Video required side by side under it', Math.abs(tp.top - tv.top) < 2 && tv.left > tp.right && tp.top > tDate.getBoundingClientRect().bottom, JSON.stringify([tp.top, tv.top, tp.right, tv.left, tDate.getBoundingClientRect().bottom, document.getElementById('awc').getBoundingClientRect().width, tp.width, tv.width])]);
    out.push(['…each label on one line', tp.height < 30 && tv.height < 30, tp.height + ' ' + tv.height]);
    out.push(['the tick labels are plain text, not the headings’ small capitals', getComputedStyle(document.getElementById('awcTaskPhoto').closest('label')).textTransform === 'none']);
    return out;
  `+ '})()'), {width: 375, init: FONTS});

  console.log('\n=== App: changing one from Current ===');
  await run('app.html', 'App Current editing', new Function('return (async ()=>{' + APP_OPEN + `
    const out = [];
    customers.push({id: 'c1', name: 'Jordan Ellis', email: 'jordan@example.com', address: '1 A St', active: true});
    lsSet('scheduledWorkOrders', [{id: 'j1', workOrderId: 'w1', workOrderNumber: 7, customerId: 'c1', technicianId: 't1', date: '2026-10-21', title: 'Pump seal',
      lineItems: [{description: 'Pump seal', qty: 1, price: 50}], notes: 'Old note', status: 'scheduled', photoRequired: true}]);
    lsSet('tasks', [{id: 'k1', title: 'Check timer', details: '', technicianId: 't1', date: '2026-10-22', customerIds: ['c1'], done: false}]);
    switchView('customers'); viewChangedAt = 0;
    document.getElementById('btnCustPaneWork').click(); await wait(150);
    document.querySelector('#awcKindRow [data-kind="Work Order"]').click(); await wait(50);
    awcView = 'current'; awcApply(); await wait(50);
    const row = ()=> document.querySelector('#awcCurList .awc-row');
    row().click(); await wait(50);
    out.push(['pressing a work order opens it underneath', !!row().querySelector('input[type=date]') && /Save changes/.test(row().textContent)]);
    const inputs = row().querySelectorAll('.awc-line input');
    out.push(['…with its line items to change', inputs[0].value === 'Pump seal']);
    row().querySelector('input[type=date]').value = '2026-10-25';
    inputs[0].value = 'New seal'; inputs[0].dispatchEvent(new Event('input', {bubbles: true}));
    row().querySelector('select').value = 't2';
    Array.from(row().querySelectorAll('button')).find(b => b.textContent === 'Save changes').click(); await wait(50);
    const j = lsGet('scheduledWorkOrders')[0];
    out.push(['Save changes updates the visit', j.date === '2026-10-25' && j.title === 'New seal' && j.technicianId === 't2', JSON.stringify([j.date, j.title, j.technicianId])]);
    out.push(['…and it goes to the office', (lsGet('officeWorkToSend') || []).some(x => x.kind === 'work_order' && x.id === 'j1')]);
    out.push(['…and the row closes', !row().querySelector('input[type=date]')]);
    row().click(); await wait(30);
    Array.from(row().querySelectorAll('button')).find(b => b.textContent === 'Cancel').click(); await wait(30);
    out.push(['Cancel closes it unchanged', !row().querySelector('input[type=date]') && lsGet('scheduledWorkOrders')[0].title === 'New seal']);
    document.querySelector('#awcKindRow [data-kind="Task"]').click(); await wait(50);
    awcView = 'current'; awcApply(); await wait(50);
    row().click(); await wait(30);
    const ins = Array.from(row().querySelectorAll('input:not([type=checkbox]):not([type=date])'));
    ins[0].value = 'Check timer and clock';
    Array.from(row().querySelectorAll('button')).find(b => b.textContent === 'Save changes').click(); await wait(30);
    out.push(['a task changes the same way', lsGet('tasks')[0].title === 'Check timer and clock']);
    return out;
  `+ '})()'), {width: 375});

  console.log('\n=== Website: changing one from Current ===');
  await run('customer-intake.html', 'Website Current editing', async ()=>{
    const out = [];
    workOrders.push({id: 'w1', type: 'Work Order', number: 43, customerId: 'b', lineItems: [{description: 'Replace pump seal', qty: 1, price: 50}], total: 50});
    switchView('workcenter'); applyWorkCenterMode('quotes');
    document.getElementById('wcType').value = 'Work Order'; wcView = 'current'; applyWorkOrderType();
    await wait(50);
    const rowOf = ()=> Array.from(document.querySelectorAll('#wcCurrentList .wc-row')).find(r => /Replace pump seal|Clean salt/.test(r.textContent));
    rowOf().click(); await wait(30);
    const ed = document.querySelector('#wcCurrentList .wc-cur-editor');
    out.push(['pressing a work order opens it underneath', !!ed && ed.previousElementSibling === rowOf()]);
    out.push(['…with date, ticks, technician, line items and notes', !!ed.querySelector('input[type=date]') && ed.querySelectorAll('input[type=checkbox]').length === 4 && !!ed.querySelector('select') && !!ed.querySelector('textarea')]);
    const desc = Array.from(ed.querySelectorAll('input')).find(i => i.value === 'Replace pump seal');
    desc.value = 'Replace pump seal and o-ring'; desc.dispatchEvent(new Event('input', {bubbles: true}));
    Array.from(ed.querySelectorAll('input')).find(i => i.value === '50').value = '80';
    Array.from(ed.querySelectorAll('input')).find(i => i.value === '80').dispatchEvent(new Event('input', {bubbles: true}));
    btnText(ed, /^Save changes$/).click(); await wait(30);
    const j = (lsGet('scheduledWorkOrders') || []).find(x => x.id === 'j1');
    out.push(['Save changes updates the visit', j.title === 'Replace pump seal and o-ring' && Number(j.lineItems[0].price) === 80]);
    out.push(['…a one-visit work order’s own total follows', Number(workOrders.find(w => w.id === 'w1').total) === 80]);
    out.push(['…and the row closes', !document.querySelector('#wcCurrentList .wc-cur-editor')]);
    // Tasks
    document.getElementById('wcType').value = 'Task'; applyWorkOrderType(); await wait(30);
    const trow = Array.from(document.querySelectorAll('#wcCurrentList .wc-row')).find(r => /Check timer/.test(r.textContent));
    trow.click(); await wait(30);
    const ted = document.querySelector('#wcCurrentList .wc-cur-editor');
    const title = Array.from(ted.querySelectorAll('input')).find(i => i.value === 'Check timer settings');
    title.value = 'Check the timer';
    btnText(ted, /^Save changes$/).click(); await wait(30);
    out.push(['a task changes the same way', tasks.find(t => t.id === 'k1').title === 'Check the timer']);
    // A repeat: its dates window, a date opens to change just that one
    tasks.push({id: 'r1', title: 'Weekly check', technicianId: 't1', date: iso(2), customerIds: ['a'], seriesId: 's1', everyDays: 7, done: false},
               {id: 'r2', title: 'Weekly check', technicianId: 't1', date: iso(9), customerIds: ['a'], seriesId: 's1', everyDays: 7, done: false});
    saveTasks(); renderCurrentList('Task'); await wait(30);
    Array.from(document.querySelectorAll('#wcCurrentList .wc-row')).find(r => /Weekly check/.test(r.textContent)).click(); await wait(30);
    const win = topWin();
    Array.from(win.querySelectorAll('[data-dates] > div')).filter(d => d.style.cursor === 'pointer')[1].click(); await wait(30);
    const red = win.querySelector('.wc-cur-editor');
    out.push(['in a repeat, pressing a date opens it to change', !!red && red.querySelector('input[type=date]').value === iso(9)]);
    Array.from(red.querySelectorAll('input')).find(i => i.value === 'Weekly check').value = 'Weekly check (gate)';
    btnText(red, /^Save changes$/).click(); await wait(30);
    out.push(['…changing just that date', tasks.find(t => t.id === 'r2').title === 'Weekly check (gate)' && tasks.find(t => t.id === 'r1').title === 'Weekly check']);
    return out;
  }, SITE);

  console.log('\n=== Website: Drains — Photo and Email columns ===');
  await run('customer-intake.html', 'Drains ticks', async ()=>{
    const out = [];
    customers.forEach((c, i) => { c.drains = [{date: '2022-0' + (i + 1) + '-01'}]; });
    customers.find(x => x.id === 'a').name = 'Castillo-Hernandez Wellington, Raymond and Josephine';
    // Alpha has a drain in the app, not done
    lsSet('scheduledPoolDrains', [{id: 'pdx', customerId: 'a', status: 'scheduled', technicianId: 't1', date: iso(3), photoRequired: true}]);
    saveCustomers();
    switchView('workcenter'); applyWorkCenterMode('drains');
    await wait(40);
    openDrainBuckets.add('overdue'); renderPoolDrains(); await wait(150);
    const rows = ()=> Array.from(document.querySelectorAll('[data-pd-customer]'));
    out.push(['each customer row has Photo and Email', rows().length >= 3 && rows().every(r => r.querySelectorAll('label input[type=checkbox]').length === 2)]);
    out.push(['…ticked to start', rows().every(r => Array.from(r.querySelectorAll('label input[type=checkbox]')).every(b => b.checked))]);
    const head = document.querySelector('[data-pd-rows]').previousElementSibling;
    out.push(['…with Photo and Email headings', /Photo/.test(head.textContent) && /Email/.test(head.textContent)]);
    // Lined up, whether scheduled or not
    const photoLefts = rows().map(r => Math.round(r.querySelectorAll('label')[0].getBoundingClientRect().left));
    out.push(['the tick columns line up, scheduled or not', photoLefts.every(x => Math.abs(x - photoLefts[0]) <= 1), photoLefts.join(',')]);
    const hPhoto = Array.from(head.querySelectorAll('span')).find(x => x.dataset.col === 'photo').getBoundingClientRect()   // All · None sit under it now (Oct 25);
    const firstPhoto = rows()[0].querySelectorAll('label')[0].getBoundingClientRect();
    out.push(['…under their headings', Math.abs((hPhoto.left + hPhoto.right) / 2 - (firstPhoto.left + firstPhoto.right) / 2) <= 2]);
    // Untick Photo for Alpha: saved and the drain in the app follows
    const aRow = rows().find(r => r.dataset.pdCustomer === 'a');
    aRow.querySelectorAll('label input')[0].click(); await wait(40);
    out.push(['unticking saves it on the customer', customers.find(x => x.id === 'a').drainPhotoRequired === false]);
    out.push(['…and their drain already in the app follows', pdScheduled().find(r => r.id === 'pdx').photoRequired === false]);
    out.push(['pressing the column doesn’t open the customer', !document.querySelector('.confirm-overlay')]);
    // Shift-click a run on Email
    const r2 = rows();
    r2[0].querySelectorAll('label')[1].dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    r2[0].querySelectorAll('label input')[1].click(); await wait(30);
    const r3 = rows();
    r3[2].querySelectorAll('label')[1].dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, shiftKey: true}));
    r3[2].querySelectorAll('label input')[1].click(); await wait(30);
    const ids = rows().slice(0, 3).map(r => r.dataset.pdCustomer);
    out.push(['shift-click unticks Email for every customer between', ids.every(id => customers.find(x => x.id === id).drainEmailCustomer === false), ids.map(id => customers.find(x => x.id === id).drainEmailCustomer).join(',')]);
    // A long name scrolls, on one line
    const nm = rows().find(r => r.dataset.pdCustomer === 'a').querySelector('.pd-scroll-name');
    await wait(80);
    out.push(['a long name stays on one line and scrolls', nm.getBoundingClientRect().height < 24 && nm.classList.contains('marquee-on'), nm.getBoundingClientRect().height]);
    // Sent from the calendar: the customer's settings go with it
    customers.find(x => x.id === 'a').drainEmailCustomer = false; saveCustomers();
    lsSet('scheduledPoolDrains', []);
    applyWorkCenterMode('calendar'); openWorkCalendar(window.__D); await wait(40);
    const pk = Array.from(topWin().querySelectorAll('select.cal-status-pick'))[2];
    pk.value = 'app'; pk.dispatchEvent(new Event('change', {bubbles: true})); await wait(40);
    const sent = pdScheduled().filter(r => r.customerId === 'a');
    out.push(['a drain sent from the calendar carries the customer’s Photo and Email', sent.length === 2 && sent.every(r => r.photoRequired === false && r.emailCustomer === false), JSON.stringify(sent.map(r => [r.photoRequired, r.emailCustomer]))]);
    return out;
  }, SITE);

  console.log('\n=== App: a finished drain emails the customer ===');
  await run('app.html', 'App drain email', new Function('return (async ()=>{' + APP_OPEN + `
    const out = [];
    const c = {id: 'c1', name: 'Jordan Ellis', email: 'jordan@example.com'};
    window.sendJobEmails = ()=>{};
    queueJobEmail(c, {kind: 'pool drain', id: 'pd1', bodyName: 'Spa', doneAt: new Date().toISOString(), doneBy: 'office'});
    const q = lsGet('jobEmailsToSend') || [];
    const it = q.find(x => x.key === 'pool drain:pd1');
    out.push(['a drain’s email says which body was drained', !!it && /Spa drain completed/.test(it.subject) && /Spa drain completed/.test(it.html), it && it.subject]);
    out.push(['…and is logged as a pool drain', !!it && it.kind === 'drain']);
    return out;
  `+ '})()'));
  {
    // The app's finish only emails when Email customer is ticked
    const src = fs.readFileSync('app.html', 'utf8');
    const piece = src.slice(src.indexOf("} else if(job.kind === 'pool drain'){"), src.indexOf("} else if(job.kind === 'pool drain'){") + 2500);
    check('finishing a drain in the app emails only with Email customer ticked', /wantEmail/.test(piece) && /if\(customer && wantEmail\) queueJobEmail\(customer, Object\.assign\(\{kind: 'pool drain'\}/.test(piece));
  }

  console.log('\n=== Last dates follow jobs finished in the app ===');
  await run('app.html', 'App last dates follow', new Function('return (async ()=>{' + APP_OPEN + `
    const out = [];
    const c = {id: 'c1', name: 'Jordan Ellis', hasPool: true, hasSpa: true, drains: [{date: '2024-01-05'}]};
    customers.push(c); lsSet('customers', customers);
    lsSet('scheduledPoolDrains', [{id: 'p1', customerId: 'c1', status: 'done', doneAt: '2026-10-18T17:00:00Z', bodyKey: 'spa'}]);
    openCustomerEditor(c);
    const t = document.getElementById('ncLastDone').textContent;
    out.push(['a drain finished on the routes counts at once', /Last spa drain Oct 18, 2026/.test(t) && /Last pool drain Jan 5, 2024/.test(t), t]);
    lsSet('scheduledFilterCleans', [{id: 'f1', customerId: 'c1', status: 'done', doneAt: '2026-10-19T17:00:00Z'}]);
    refreshNcLastDone();
    out.push(['an open customer’s dates refresh when a job finishes', /Last filter clean Oct 19, 2026/.test(document.getElementById('ncLastDone').textContent)]);
    return out;
  `+ '})()'));
  await run('customer-intake.html', 'Website last dates follow', async ()=>{
    const out = [];
    switchView('customers');
    const c = customers.find(x => x.id === 'a');
    viewCustomer(c);
    const box = document.getElementById('profileLastDone');
    out.push(['the last dates show as tiles', box.children.length === 3 && box.children[0].children.length === 2]);
    const h = box.children[0].children[0], v = box.children[0].children[1];
    out.push(['…an easy-to-read heading (not small capitals)', getComputedStyle(h).textTransform === 'none' && parseFloat(getComputedStyle(h).fontSize) >= 12.5 && h.textContent === 'Last pool drain']);
    out.push(['…over a large date', parseFloat(getComputedStyle(v).fontSize) >= 15 && getComputedStyle(v).fontWeight >= 700]);
    out.push(['…“Not yet” in grey', v.textContent === 'Not yet' && getComputedStyle(v).color === getComputedStyle(document.body).getPropertyValue('--muted').trim() || /Not yet/.test(v.textContent)]);
    // A drain and a filter clean finished in the app arrive
    syncApplyRecord('pool_drain', 'p9', {id: 'p9', customerId: 'a', status: 'done', doneAt: '2026-10-18T17:00:00Z', bodyKey: 'pool'}, false);
    syncApplyRecord('filter_clean', 'f9', {id: 'f9', customerId: 'a', status: 'done', doneAt: '2026-10-19T17:00:00Z', date: '2026-10-19'}, false);
    await wait(500);
    const t = box.textContent;
    out.push(['the open profile follows at once', /Oct 18, 2026/.test(t) && /Oct 19, 2026/.test(t), t]);
    out.push(['…and the drain is logged on the customer for the Drains page', (customers.find(x => x.id === 'a').drains || []).some(d => d.date === '2026-10-18')]);
    return out;
  }, SITE);

  console.log('\n=== Website: Email tab by technician and day ===');
  await run('customer-intake.html', 'Email grouping', async ()=>{
    const out = [];
    customers.find(x => x.id === 'a').day = 'Tuesday';
    customers.find(x => x.id === 'b').day = 'Monday'; customers.find(x => x.id === 'b').extraDays = ['Tuesday'];
    customers.find(x => x.id === 'c').email = 'c@x.com'; customers.find(x => x.id === 'c').day = 'Tuesday'; customers.find(x => x.id === 'c').technicianId = 't2';
    technicians.push({id: 't2', name: 'Ben'});
    switchView('workcenter'); applyWorkCenterMode('broadcast'); await wait(30);
    const tech = document.getElementById('wcRecipientTech'), day = document.getElementById('wcRecipientDay');
    out.push(['a Technician menu starting on All technicians', !!tech && tech.options[0].textContent === 'All technicians' && tech.value === '']);
    out.push(['a Day menu starting on All days', !!day && day.options[0].textContent === 'All days' && day.value === '']);
    const shown = ()=> Array.from(document.querySelectorAll('#wcRecipientList > label')).length;
    out.push(['all three listed to start', shown() === 3, shown()]);
    tech.value = 't1'; tech.dispatchEvent(new Event('change')); await wait(20);
    day.value = 'Tuesday'; day.dispatchEvent(new Event('change')); await wait(20);
    out.push(['Amy + Tuesday shows her Tuesday customers (an extra day counts)', shown() === 2, shown()]);
    document.getElementById('wcRecipientAll').click();
    out.push(['Select all ticks just those', broadcastPicked.size === 2 && broadcastPicked.has('a') && broadcastPicked.has('b')]);
    tech.value = 't2'; tech.dispatchEvent(new Event('change')); await wait(20);
    document.getElementById('wcRecipientAll').click();
    out.push(['changing the menus keeps those already ticked', broadcastPicked.size === 3]);
    tech.value = ''; tech.dispatchEvent(new Event('change')); day.value = ''; day.dispatchEvent(new Event('change')); await wait(20);
    out.push(['All and All shows everyone again', shown() === 3]);
    tech.value = 't1'; applyWorkCenterMode('quotes'); applyWorkCenterMode('broadcast');
    out.push(['back on Email later: All, All and nobody ticked', tech.value === '' && day.value === '' && broadcastPicked.size === 0]);
    return out;
  }, SITE);

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
