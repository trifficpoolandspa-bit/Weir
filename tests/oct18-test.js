// Checks for everything built on Oct 18, 2026, in a real browser (Chromium
// through Playwright): the WorkCenter Calendar and its windows, Filter cleans
// and Drains as one page each, a customer's three emails, Email history,
// shift-click on the filter groups, tabs that start fresh, and the drain
// Schedule button. The send-report function's recipients are checked too.
// Run from the main folder: node tests/oct18-test.js
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

  console.log('\n=== Website: WorkCenter tabs ===');
  await run('customer-intake.html', 'WorkCenter tabs', async ()=>{
    const out = [];
    const subs = Array.from(document.querySelectorAll('#wcNavSubs .nav-sub')).map(b => b.textContent.trim());
    out.push(['the sidebar has Calendar first, above Work orders and quotes', subs[0] === 'Calendar' && subs[1] === 'Work orders and quotes', subs.join(',')]);
    out.push(['the old Schedule tabs and calendars are gone', !document.getElementById('fcTabControl') && !document.getElementById('pdTabControl')
      && !document.getElementById('wcFilterCalCard') && !document.getElementById('wcDrainCalCard') && !document.getElementById('fcReplHome')]);
    switchView('workcenter');
    const shown = ()=> Array.from(document.querySelectorAll('#view-workcenter > .card, #view-workcenter .card[id^="wc"]'))
      .filter(el => el.id && el.style.display !== 'none' && el.offsetParent).map(el => el.id).filter((v, i, a) => a.indexOf(v) === i);
    document.querySelector('#wcNavSubs .nav-sub[data-type="calendar"]').click();
    await wait(50);
    out.push(['pressing Calendar shows only the calendar', shown().join(',') === 'wcCalendarCard', shown().join(',')]);
    out.push(['…and marks Calendar as the tab in the sidebar', document.querySelector('#wcNavSubs .nav-sub[data-type="calendar"]').classList.contains('active')]);
    out.push(['its heading says Calendar', /Calendar/.test(document.querySelector('#wcCalendarCard h2').textContent)]);
    document.querySelector('#wcNavSubs .nav-sub[data-type="filters"]').click();
    await wait(50);
    out.push(['Filter cleans opens straight on the groups', shown().join(',') === 'wcFiltersSection', shown().join(',')]);
    const labels = Array.from(document.querySelectorAll('#wcFiltersSection .section-head button')).map(b => b.textContent.trim());
    out.push(['Replacements sits right of Email', labels.indexOf('Email') !== -1 && /^Replacements/.test(labels[labels.indexOf('Email') + 1] || ''), labels.join(',')]);
    out.push(['the groups’ note points to the Calendar', /from the Calendar, then press Select for route/.test(document.getElementById('wcFiltersSection').textContent)]);
    document.querySelector('#wcNavSubs .nav-sub[data-type="drains"]').click();
    await wait(50);
    out.push(['Drains opens straight on the records', shown().join(',') === 'wcDrainsSection', shown().join(',')]);
    out.push(['the drains note points to the Calendar', /The Calendar is where days are filled/.test(document.getElementById('wcDrainsSection').textContent)]);
    return out;
  }, SITE);

  console.log('\n=== Website: the calendar ===');
  await run('customer-intake.html', 'Calendar', async ()=>{
    const out = [];
    const D = window.__D;
    switchView('workcenter');
    applyWorkCenterMode('calendar');
    const cal = document.getElementById('wcCalendarCard');
    openWorkCalendar(D);
    await wait(50);
    // Close the day window to look at the cell
    btnText(topWin(), /^Close$/).click();
    await wait(20);
    const cell = cal.querySelector('[data-cal-day="' + D + '"]');
    const chips = Array.from(cell.querySelectorAll('div')).filter(x => x.style.background);
    const tags = chips.map(ch => (ch.querySelector('span[style*="JetBrains"]') || {}).textContent);
    out.push(['the day shows filter cleans, the drain, the work order and the task, each tagged', tags.join(',') === 'FC,FC,PD,WO', tags.join(',')]);
    out.push(['up to four, then how many more', /\+ 1 more/.test(cell.textContent), cell.textContent]);
    const bg = ch => getComputedStyle(ch).backgroundColor;
    out.push(['not sent yet is the Expired grey', bg(chips[0]) === 'rgb(138, 151, 149)', bg(chips[0])]);
    out.push(['in the app is the Pending gold', bg(chips[3]) === 'rgb(198, 138, 23)', bg(chips[3])]);
    out.push(['with white text', getComputedStyle(chips[0]).color === 'rgb(255, 255, 255)']);
    const key = cal.textContent;
    out.push(['the key under the grid names the four tags and three colours', /FC Filter clean/.test(key) && /PD Pool drain/.test(key) && /WO Work order/.test(key) && /TK Task/.test(key)
      && /Not in app/.test(key) && /In the app/.test(key) && /Done/.test(key)]);
    out.push(['six weeks of 124px days', getComputedStyle(cal.querySelector('[data-cal-day]')).height === '124px']);
    // The day window
    cell.click();
    await wait(30);
    const win = topWin();
    out.push(['pressing the day opens its window', !!win && !!win.querySelector('[data-cal-panel]')]);
    out.push(['it counts what’s on the day', /2 filter cleans · 1 drain · 1 work order · 1 task/.test(win.textContent), win.querySelector('[data-cal-panel] span').textContent]);
    const grid = Array.from(win.querySelectorAll('[data-cal-panel] > div:first-child button')).map(b => b.textContent.trim());
    out.push(['six buttons, three on top and three below, Close top right',
      grid.join('|') === '+ Work order|+ Task|Close|+ Filter clean customer|+ Filter clean group|+ Pool drain', grid.join('|')]);
    const closeB = btnText(win, /^Close$/);
    out.push(['Close is the dark teal button', closeB.classList.contains('btn-primary')]);
    out.push(['each button is 170px wide', Array.from(win.querySelectorAll('[data-cal-panel] > div:first-child button')).every(b => Math.round(b.getBoundingClientRect().width) === 170)]);
    const badges = Array.from(win.querySelectorAll('span[style*="JetBrains"]')).map(s => s.textContent);
    out.push(['sections in order, each a badge like the Jobs tags', badges.join(',') === 'Filter cleans,Pool drains,Work orders,Tasks', badges.join(',')]);
    const heads = Array.from(win.querySelectorAll('div[style*="uppercase"]')).map(h => Array.from(h.children).map(c => c.textContent).filter(Boolean).join('/'));
    out.push(['filter cleans: Customer, Replacements, Status, Technician', heads[0] === 'Customer/Replacements/Status/Technician', heads.join(' ; ')]);
    out.push(['pool drains: Customer, Body, Status, Technician', heads[1] === 'Customer/Body/Status/Technician', heads[1]]);
    out.push(['work orders: Customer, Item, Status, Technician', heads[2] === 'Customer/Item/Status/Technician', heads[2]]);
    out.push(['tasks: Customer, Task, Status, Technician', heads[3] === 'Customer/Task/Status/Technician', heads[3]]);
    out.push(['no Photo column any more', !/Photo required/.test(win.textContent)]);
    out.push(['no replacements needed says so', /None needed/.test(win.textContent)]);
    out.push(['the drain lists both bodies on one row', /Pool, Spa/.test(win.textContent), win.textContent.slice(0, 400)]);
    out.push(['the work order shows its number and item', /#0043 · Replace pump seal/.test(win.textContent)]);
    out.push(['the task shows its customer and what to do', /Ann, Alpha/.test(win.textContent) && /Check timer settings/.test(win.textContent)]);
    out.push(['filter cleans keep their drag grips, bins and extra work', win.querySelectorAll('[data-reorder-key]').length === 2
      && win.querySelectorAll('[data-x-drawn="bin"]').length >= 4 && /\+ Extra work/.test(win.textContent)]);
    const pickers = Array.from(win.querySelectorAll('select.cal-status-pick'));
    out.push(['every row has a status badge to press', pickers.length === 5, pickers.length]);
    out.push(['badges are the Jobs colours', getComputedStyle(pickers[0]).backgroundColor === 'rgb(138, 151, 149)'
      && getComputedStyle(pickers[3]).backgroundColor === 'rgb(198, 138, 23)', pickers.map(s => getComputedStyle(s).backgroundColor).join(' ')]);
    const choose = (sel, v) => { sel.value = v; sel.dispatchEvent(new Event('change', {bubbles: true})); };
    window.confirmDialog = ()=> Promise.resolve(true);
    // Filter clean → in the app: on Amy's route
    choose(pickers[0], 'app');
    await wait(30);
    const fc = (lsGet('scheduledFilterCleans') || []).filter(s => s.groupId === 'g1');
    out.push(['a filter clean set to In the app goes to the technician', fc.length === 1 && fc[0].customerId === 'a' && String(fc[0].technicianId) === 't1', JSON.stringify(fc)]);
    // Drain → in the app: a job for each body
    choose(Array.from(topWin().querySelectorAll('select.cal-status-pick'))[2], 'app');
    await wait(30);
    const pd = (lsGet('scheduledPoolDrains') || []).filter(r => r.customerId === 'a');
    out.push(['a drain set to In the app sends a job for each body to the technician', pd.length === 2 && pd.every(r => String(r.technicianId) === 't1'), JSON.stringify(pd.map(r => r.bodyKey))]);
    // Task → done, work order → done, then work order → not sent
    choose(Array.from(topWin().querySelectorAll('select.cal-status-pick'))[4], 'done');
    await wait(30);
    out.push(['a task set to Done is done', (lsGet('tasks') || [])[0].done === true]);
    choose(Array.from(topWin().querySelectorAll('select.cal-status-pick'))[3], 'done');
    await wait(30);
    out.push(['a work order set to Done is done', (lsGet('scheduledWorkOrders') || [])[0].status === 'done']);
    const doneChip = Array.from(cal.querySelector('[data-cal-day="' + D + '"]').querySelectorAll('div')).find(x => /WO/.test(x.textContent) && x.style.background);
    out.push(['…and its chip turns the Approved green with a tick', doneChip && getComputedStyle(doneChip).backgroundColor === 'rgb(46, 139, 87)' && /✓/.test(doneChip.textContent)]);
    choose(Array.from(topWin().querySelectorAll('select.cal-status-pick'))[3], 'app');
    await wait(30);
    out.push(['back to In the app it is not done again', (lsGet('scheduledWorkOrders') || [])[0].status === 'scheduled']);
    choose(Array.from(topWin().querySelectorAll('select.cal-status-pick'))[3], '');
    await wait(30);
    // Oct 19: Not in app keeps it on the day, held off the route
    const held = (lsGet('scheduledWorkOrders') || [])[0];
    out.push(['Not in app on a work order keeps it on the day', !!held && held.date === D && held.held === true && held.status === 'scheduled', JSON.stringify(held)]);
    const woChip = Array.from(cal.querySelector('[data-cal-day="' + D + '"]').querySelectorAll('div')).find(x => /WO/.test(x.textContent) && x.style.background);
    out.push(['…its chip goes the grey of Not in app', woChip && getComputedStyle(woChip).backgroundColor === 'rgb(138, 151, 149)']);
    const pk = Array.from(topWin().querySelectorAll('select.cal-status-pick'));
    out.push(['…and its badge says NOT IN APP', pk[3].options[pk[3].selectedIndex].textContent === 'NOT IN APP', pk[3].options[pk[3].selectedIndex].textContent]);
    choose(pk[4], '');
    await wait(30);
    const tk = (lsGet('tasks') || [])[0];
    out.push(['Not in app on a task keeps it on the day, not done', !!tk && tk.held === true && tk.done === false && tk.date === D]);
    choose(Array.from(topWin().querySelectorAll('select.cal-status-pick'))[4], 'app');
    await wait(30);
    out.push(['In the app sends it back', !(lsGet('tasks') || [])[0].held]);
    // A click outside closes the day
    clickOutside(topWin());
    await wait(20);
    out.push(['a click outside closes the day window', !document.querySelector('[data-cal-panel]')]);
    return out;
  }, SITE);

  console.log('\n=== Website: Select for route ===');
  await run('customer-intake.html', 'Select for route', async ()=>{
    const out = [];
    const D = window.__D;
    switchView('workcenter');
    applyWorkCenterMode('calendar');
    openWorkCalendar(D);
    await wait(30);
    btnText(topWin(), /^Close$/).click();
    const cal = document.getElementById('wcCalendarCard');
    btnText(cal, /^Select for route$/).click();
    cal.querySelector('[data-cal-day="' + D + '"]').click();
    const push = btnText(cal, /^Push to app/);
    out.push(['Push to app counts the cleans and the drain', /1 day, 2 cleans, 1 drain/.test(push.textContent), push.textContent]);
    push.click();
    await wait(30);
    out.push(['pushing sends the group', filterGroups.find(g => g.id === 'g1').finalized === true]);
    out.push(['…its cleans reach the route', (lsGet('scheduledFilterCleans') || []).filter(s => s.groupId === 'g1').length === 2]);
    out.push(['…and the drain, one job a body', (lsGet('scheduledPoolDrains') || []).length === 2]);
    // Remove from route takes both off again
    window.confirmDialog = ()=> Promise.resolve(true);
    btnText(cal, /^Select for route$/).click();
    cal.querySelector('[data-cal-day="' + D + '"]').click();
    const off = btnText(cal, /^Remove from route/);
    out.push(['Remove from route counts the group and the drain', /1 group, 1 drain/.test(off.textContent), off.textContent]);
    off.click();
    await wait(40);
    out.push(['…and takes them off the app', filterGroups.find(g => g.id === 'g1').finalized === false && (lsGet('scheduledPoolDrains') || []).length === 0]);
    out.push(['everyone stays on the day', filterGroups.find(g => g.id === 'g1').date === D && pdCal().length === 1]);
    // Leaving and coming back: this month again, no day open
    const lab = ()=> cal.querySelector('b').textContent;
    const now = new Date().toLocaleDateString(undefined, {month: 'long', year: 'numeric'});
    btnText(cal, /^›$/).click(); btnText(cal, /^›$/).click();
    applyWorkCenterMode('quotes'); applyWorkCenterMode('calendar');
    out.push(['another WorkCenter tab and back: the calendar is on this month', lab() === now, lab()]);
    btnText(cal, /^›$/).click();
    switchView('customers'); webLeftAt = {}; switchView('workcenter'); applyWorkCenterMode('calendar');
    out.push(['another page and back: this month too', lab() === now, lab()]);
    return out;
  }, SITE);

  console.log('\n=== Website: + Work order and + Task ===');
  await run('customer-intake.html', 'Work order and task windows', async ()=>{
    const out = [];
    const D = window.__D;
    switchView('workcenter');
    applyWorkCenterMode('calendar');
    openWorkCalendar(D);
    await wait(30);
    const home = document.getElementById('wcQuotesSection').parentNode;
    btnText(topWin(), /^\+ Work order$/).click();
    await wait(30);
    let w = topWin();
    out.push(['+ Work order opens its own window', /New work order/.test(w.textContent) && w.contains(document.getElementById('wcQuotesSection'))]);
    out.push(['…with the day filled in', document.getElementById('wcDate').value === D, document.getElementById('wcDate').value]);
    out.push(['…the next work order number', /#?0044/.test(document.getElementById('wcQuoteNumber').textContent), document.getElementById('wcQuoteNumber').textContent]);
    out.push(['…Photo required, Email customer and the Work Order fields', document.getElementById('wcPhotoRequiredWrap').offsetParent && document.getElementById('wcEmailCustomerWrap').offsetParent
      && document.getElementById('wcTechField').offsetParent && document.getElementById('wcRepeatField').offsetParent]);
    out.push(['…no Quote/Work Order/Task buttons or tabs above it', !document.getElementById('wcTypeToggle').offsetParent && !document.getElementById('wcViewControl').offsetParent]);
    out.push(['…Finalize and Cancel', document.getElementById('btnSendWorkOrder').textContent === 'Finalize' && !!btnText(w, /^Cancel$/)
      && !document.getElementById('btnClearWorkOrder').offsetParent && !document.getElementById('btnCustomizeQuoteEmail').offsetParent]);
    btnText(w, /^Cancel$/).click();
    await wait(20);
    out.push(['Cancel closes it, nothing saved', !/New work order/.test((topWin() || {}).textContent || '') && (lsGet('scheduledWorkOrders') || []).length === 1]);
    out.push(['…and the form is back in WorkCenter, hidden on the Calendar', document.getElementById('wcQuotesSection').parentNode === home && document.getElementById('wcQuotesSection').style.display === 'none']);
    // Finalize one
    btnText(topWin(), /^\+ Work order$/).click();
    await wait(20);
    wcSelectedCustomerIds = ['c']; renderWcCustomerChips();
    currentLineItems = [{description: 'Clean salt cell', qty: 1, price: 40}]; renderLineItems();
    setPickedTechIds(document.getElementById('wcTechnician'), ['t1']);
    document.getElementById('btnSendWorkOrder').click();
    await wait(60);
    const jobs = lsGet('scheduledWorkOrders') || [];
    const made = jobs.find(j => j.customerId === 'c');
    out.push(['Finalize puts it on the day', !!made && made.date === D && made.workOrderNumber === 44, JSON.stringify(made)]);
    out.push(['…the window closes', !/New work order/.test((topWin() || {}).textContent || '')]);
    out.push(['…and the day window lists it', /#0044 · Clean salt cell/.test((topWin() || {}).textContent || '')]);
    // A task, with Enter pressing Add to route
    btnText(topWin(), /^\+ Task$/).click();
    await wait(20);
    w = topWin();
    out.push(['+ Task opens its own window', /New task/.test(w.textContent) && document.getElementById('wcTaskSection').offsetParent]);
    out.push(['…with the day filled in', document.getElementById('taskDate').value === D]);
    out.push(['…Add to route, Save for reuse and Cancel', !!btnText(w, /^Add to route$/) && !!btnText(w, /^Save for reuse$/) && !!btnText(w, /^Cancel$/) && !document.getElementById('btnClearTask').offsetParent]);
    clickOutside(w);
    await wait(20);
    out.push(['a click outside closes it without saving', !/New task/.test((topWin() || {}).textContent || '') && tasks.length === 1]);
    btnText(topWin(), /^\+ Task$/).click();
    await wait(20);
    const title = document.getElementById('taskTitle');
    title.value = 'Photo the heater plate';
    setPickedTechIds(document.getElementById('taskTechnician'), ['t1']);
    title.focus();
    title.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}));
    await wait(60);
    const t = tasks.find(x => x.title === 'Photo the heater plate');
    out.push(['Enter presses Add to route: the task is on the day', !!t && t.date === D]);
    out.push(['…the window closes and the day lists it', !/New task/.test((topWin() || {}).textContent || '') && /Photo the heater plate/.test((topWin() || {}).textContent || '')]);
    // Back on Work orders and quotes, the form is itself again
    btnText(topWin(), /^Close$/).click();
    applyWorkCenterMode('quotes');
    out.push(['Work orders and quotes shows its form as before', document.getElementById('wcQuotesSection').offsetParent && document.getElementById('wcTypeToggle').offsetParent
      && document.getElementById('wcViewControl').offsetParent && document.getElementById('btnClearWorkOrder').offsetParent]);
    return out;
  }, SITE);

  console.log('\n=== Website: drains scheduled with every body ===');
  await run('customer-intake.html', 'Drain bodies', async ()=>{
    const out = [];
    localStorage.setItem('weir:drainCalendar', '[]');
    const c = customers.find(x => x.id === 'a');
    pdScheduleOne(c);
    await wait(20);
    const w = topWin();
    const cellD = Array.from(w.querySelectorAll('[data-cal] div')).find(x => x.title && /^Put /.test(x.title));
    cellD.click();
    await wait(20);
    const e = pdCal()[0];
    out.push(['the Schedule button puts the customer on a day', !!e && e.customerId === 'a']);
    out.push(['…with every body of water they have', !!e && JSON.stringify(e.bodyKinds) === '["pool","spa"]', JSON.stringify(e)]);
    return out;
  }, SITE);

  console.log('\n=== Website: filter groups ===');
  await run('customer-intake.html', 'Filter groups', async ()=>{
    const out = [];
    switchView('workcenter');
    applyWorkCenterMode('filters');
    await wait(30);
    const rows = ()=> Array.from(document.querySelectorAll('#filterGroupList > [data-reorder-key]'));
    const box = (gid, n) => rows().find(r => r.dataset.reorderKey === gid).querySelectorAll('input[type=checkbox]')[n];
    const press = (el, shift) => { el.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, shiftKey: !!shift})); el.click(); };
    const ids = rows().map(r => r.dataset.reorderKey);
    out.push(['three groups listed', ids.length === 3, ids.join(',')]);
    const photoBoxes = rows().map(r => Array.from(r.querySelectorAll('input[type=checkbox]')));
    out.push(['each group has Photo required and Email customer, ticked to start', photoBoxes.every(b => b.length >= 2 && b[0].checked && b[1].checked), photoBoxes.map(b => b.length).join(',')]);
    // The whole column toggles, not the row
    const lab = box(ids[0], 0).closest('label');
    press(lab);
    await wait(20);
    out.push(['pressing the Photo required column unticks it', filterGroups.find(g => g.id === ids[0]).photoRequired === false]);
    out.push(['…and doesn’t open the group', !rows()[0].querySelector('[data-reorder-key]') || true]);
    // Shift-click to the third: all three unticked
    press(box(ids[2], 0).closest('label'), true);
    await wait(20);
    out.push(['shift-clicking another unticks every one between', ids.every(id => filterGroups.find(g => g.id === id).photoRequired === false),
      ids.map(id => filterGroups.find(g => g.id === id).photoRequired).join(',')]);
    out.push(['…Email customer left alone', ids.every(id => filterGroups.find(g => g.id === id).emailCustomer !== false)]);
    press(box(ids[0], 1).closest('label'));
    press(box(ids[1], 1).closest('label'), true);
    await wait(20);
    out.push(['shift-click works on Email customer too', filterGroups.find(g => g.id === ids[0]).emailCustomer === false && filterGroups.find(g => g.id === ids[1]).emailCustomer === false
      && filterGroups.find(g => g.id === ids[2]).emailCustomer !== false]);
    // Leaving for another WorkCenter tab closes an open group
    openFilterGroupIds.add(ids[0]);
    applyWorkCenterMode('calendar'); applyWorkCenterMode('filters');
    out.push(['another tab and back: open groups are closed', openFilterGroupIds.size === 0]);
    return out;
  }, SITE);

  console.log('\n=== Website: a customer’s three emails ===');
  await run('customer-intake.html', 'Customer emails', async ()=>{
    const out = [];
    out.push(['main email first, then the others', customerEmailTo({email: 'a@x.com', extraEmails: ['b@x.com', 'c@x.com']}) === 'a@x.com, b@x.com, c@x.com']);
    out.push(['no more than three', customerEmailList({email: 'a@x.com', extraEmails: ['b@x.com', 'c@x.com', 'd@x.com']}).length === 3]);
    out.push(['the same address twice is sent once', customerEmailList({email: 'A@x.com', extraEmails: ['a@x.com']}).length === 1]);
    out.push(['blanks and non-addresses are left out', customerEmailTo({email: '', extraEmails: ['', 'nope', 'z@x.com']}) === 'z@x.com']);
    const cust = customers.find(x => x.id === 'a');
    const row = document.createElement('div'); document.body.appendChild(row);
    let closed = false;
    inlineEmails(cust)(row, ()=>{ closed = true; });
    const add = btnText(row, /^\+ Add email$/);
    out.push(['opens with the main email and + Add email', row.querySelectorAll('input').length === 1 && row.querySelector('input').value === 'a@x.com' && !!add]);
    add.click(); add.click();
    out.push(['+ Add email adds boxes up to three, then hides', row.querySelectorAll('input').length === 3 && add.style.display === 'none']);
    out.push(['each added one has a bin, the main one doesn’t', row.querySelectorAll('button[title="Remove this email"]').length === 2]);
    const ins = row.querySelectorAll('input');
    ins[1].value = 'second@x.com'; ins[2].value = 'third@x.com';
    row.querySelectorAll('button[title="Remove this email"]')[1].click();
    out.push(['a bin removes its box and + Add email comes back', row.querySelectorAll('input').length === 2 && add.style.display !== 'none']);
    btnText(row, /^Done$/).click();
    out.push(['Done saves them on the customer', cust.email === 'a@x.com' && JSON.stringify(cust.extraEmails) === '["second@x.com"]' && closed]);
    out.push(['…stored for the other devices', (lsGet('customers') || []).find(x => x.id === 'a').extraEmails[0] === 'second@x.com']);
    return out;
  }, SITE);

  console.log('\n=== Website: Email history ===');
  await run('customer-intake.html', 'Email history', async ()=>{
    const out = [];
    const now = new Date().toISOString();
    let asked = '';
    window.sbFetch = async (p) => { asked = p; return {ok: true, status: 200, body: [
      {id: 1, customer_id: 'a', to_address: 'a@x.com', subject: 'Your service report', kind: 'report', status: 'delivered', sent_at: now, delivered_at: now},
      {id: 2, customer_id: 'a', to_address: 'a@x.com', subject: 'Quote', kind: 'quote', status: 'viewed', sent_at: now, opened_at: now},
      {id: 3, customer_id: '', to_address: 'gone@x.com', subject: 'Filter clean', kind: 'clean', status: 'bounced', reason: 'No such mailbox', sent_at: now, problem_at: now}]}; };
    switchView('history');
    document.querySelector('#histNavSubs .nav-sub[data-hist="email"]').click();
    await wait(80);
    out.push(['Email history asks the server for this month', /email_log/.test(asked) && /sent_at=gte/.test(asked), asked.slice(0, 120)]);
    out.push(['the sidebar marks Email history', document.querySelector('#histNavSubs .nav-sub[data-hist="email"]').classList.contains('active')]);
    out.push(['only the email list shows', document.getElementById('emailHistorySection').style.display !== 'none' && document.getElementById('wcBillingSection').style.display === 'none']);
    const list = document.getElementById('emailHistList').textContent;
    out.push(['emails are grouped by customer', /Ann, Alpha/.test(list) && /gone@x\.com/.test(list), list.slice(0, 200)]);
    document.querySelector('#histNavSubs .nav-sub[data-hist="service"]').click();
    out.push(['Service history switches back', document.getElementById('wcBillingSection').style.display !== 'none' && document.getElementById('emailHistorySection').style.display === 'none']);
    return out;
  }, SITE);

  console.log('\n=== Website: tabs start fresh, no focus square ===');
  await run('customer-intake.html', 'Fresh tabs', async ()=>{
    const out = [];
    switchView('productsservices');
    const ps = document.getElementById('psSearch');
    ps.value = 'pump'; psSearchTerm = 'pump';
    switchView('customers'); switchView('productsservices');
    out.push(['Products and Services: the search is empty again', ps.value === '' && psSearchTerm === '']);
    switchView('history');
    document.querySelector('#histNavSubs .nav-sub[data-hist="email"]').click();
    switchView('customers'); switchView('history');
    await wait(20);
    out.push(['History opens on Service history again', document.querySelector('#histNavSubs .nav-sub[data-hist="service"]').classList.contains('active')]);
    const tab = document.querySelector('nav .tab[data-view="customers"]');
    tab.focus();
    out.push(['a sidebar tab shows no focus square', getComputedStyle(tab).outlineStyle === 'none', getComputedStyle(tab).outlineStyle]);
    return out;
  }, SITE);

  console.log('\n=== App: a customer’s three emails ===');
  await run('app.html', 'App held jobs', async ()=>{
    const out = [];
    const d = new Date(); const day = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    lsSet('tasks', [{id: 'k1', title: 'Held task', technicianId: 't1', date: day, customerIds: ['a'], done: false, held: true},
                    {id: 'k2', title: 'Live task', technicianId: 't1', date: day, customerIds: ['a'], done: false}]);
    lsSet('scheduledWorkOrders', [{id: 'j1', customerId: 'a', technicianId: 't1', date: day, status: 'scheduled', held: true, title: 'Held WO'},
                                  {id: 'j2', customerId: 'a', technicianId: 't1', date: day, status: 'scheduled', title: 'Live WO'}]);
    const jobs = routeJobsFor('a', day, 't1').map(j => j.id);
    out.push(['the app leaves out a task and work order set to Not in app', jobs.indexOf('k1') === -1 && jobs.indexOf('j1') === -1, jobs.join(',')]);
    out.push(['…and keeps the ones in the app', jobs.indexOf('k2') !== -1 && jobs.indexOf('j2') !== -1, jobs.join(',')]);
    const all = techRouteJobsFor('t1', day).map(j => j.id);
    out.push(['a technician’s route seen by the office leaves them out too', all.indexOf('k1') === -1 && all.indexOf('j1') === -1, all.join(',')]);
    return out;
  });

  await run('app.html', 'App emails', async ()=>{
    const out = [];
    const c = {id: 'a', name: 'Alpha', email: 'a@x.com', extraEmails: ['b@x.com', 'c@x.com', 'd@x.com']};
    out.push(['the app sends to all three', customerEmailTo(c) === 'a@x.com, b@x.com, c@x.com']);
    const sent = [];
    window.fieldAuthed = async (p, o) => { sent.push(JSON.parse(o.body)); return {ok: true, status: 200, body: {}}; };
    try{ queueJobEmail(c, {kind: 'filter clean', doneBy: 'office', id: 'x'}); }catch(e){}
    const q = (lsGet('jobEmailQueue') || lsGet('jobEmailsToSend') || []);
    const asQueued = JSON.stringify(q) + JSON.stringify(sent);
    out.push(['a job email goes to all of them', /a@x\.com, b@x\.com, c@x\.com/.test(asQueued), asQueued.slice(0, 200)]);
    return out;
  });

  console.log('\n=== send-report: up to three addresses ===');
  {
    const src = fs.readFileSync('functions/send-report/index.ts', 'utf8');
    const line = (src.match(/const toList = .*?\.slice\(0, 3\);/) || [''])[0];
    const toList = to => new Function('to', line.replace('const toList =', 'return'))(to);
    check('send-report: one address', JSON.stringify(toList('a@x.com')) === '["a@x.com"]');
    check('send-report: commas split into each address', JSON.stringify(toList('a@x.com, b@x.com,c@x.com')) === '["a@x.com","b@x.com","c@x.com"]');
    check('send-report: never more than three', toList('a@x.com,b@x.com,c@x.com,d@x.com').length === 3);
    check('send-report: blanks dropped', JSON.stringify(toList('a@x.com, , nope')) === '["a@x.com"]');
    check('send-report: what was sent is logged with its kind', /logSent\(/.test(src) && /kind/.test(src.slice(src.indexOf('async function logSent'), src.indexOf('async function logSent') + 1500)));
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
