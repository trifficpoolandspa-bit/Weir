// Checks for everything built on Oct 21, 2026, in a real browser (Chromium
// through Playwright): a cleared dosage staying cleared when another reading
// changes, the email on the admin app's Today drop-down and its button
// colours, the Jobs tab not redrawing on a sync that changes nothing, new
// quotes / work orders / tasks starting with no date and marking in red what
// they still need, + Filter clean gone from quotes, Reschedule on a finished
// job under Serviced today, notes on work orders and pool drains in Alerts,
// and the app's line item suggestions across the whole line.
// Run from the main folder: node tests/oct21-test.js
const path = require('path');
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
  window.todayIso = () => { const x = new Date(); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  window.btnText = (root, re) => Array.from(root.querySelectorAll('button')).find(b => re.test((b.textContent || '').trim()));
  window.topWin = () => Array.from(document.querySelectorAll('.confirm-overlay')).pop();
  if(typeof hideSiteLogin === 'function'){ try{ siteUser = {id: 'u', companyId: 'co', role: 'owner'}; hideSiteLogin(); }catch(e){} }
`;
const SEED = `
  const put = (k, v) => localStorage.setItem('weir:' + k, JSON.stringify(v));
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const tIso = (()=>{ const x = new Date(); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10); })();
  put('photoEveryone', {});
  put('afterPhotoDefaultFixed', true);
  put('technicians', [{id: 't1', name: 'Amy'}, {id: 't2', name: 'Ben'}]);
  put('customers', [
    {id: 'a', name: 'Alpha Ann', active: true, hasPool: true, technicianId: 't1', day: DAYS[new Date().getDay()], email: 'a@x.com, a2@y.com', phone: '(623) 555-0148', address: '1 Main'},
    {id: 'b', name: 'Bravo Bob', active: true, hasPool: true, technicianId: 't1', day: DAYS[new Date().getDay()], address: '2 Main'}]);
  put('chemConfig', {pool: {chemicals: [
      {key: 'chlorine', label: 'Free chlorine', doseRules: [{op: 'gte', value: '5', amount: '2', doseKey: 'tabs'}]},
      {key: 'ph', label: 'pH level', doseRules: [{op: 'gt', value: '7.5', amount: '0.25', doseKey: 'acid'}]}],
    dosages: [{key: 'tabs', label: 'Chlorine tabs', unit: 'count'}, {key: 'acid', label: 'Acid', unit: 'gal'}]},
    spa: {chemicals: [], dosages: []}, fountain: {chemicals: [], dosages: []}});
  put('productsServices', [{key: 'p1', name: 'Repair skimmer weir door and replace the basket', price: '65'}, {key: 'p2', name: 'Replace pump seal', price: '50'}]);
  put('scheduledWorkOrders', [{id: 'j1', customerId: 'a', technicianId: 't1', date: tIso, status: 'done', doneAt: new Date().toISOString(), doneBy: 't1',
    title: 'Replace pump seal', lineItems: [{description: 'Replace pump seal', qty: 1}], doneNotes: 'Seal was cracked; gate sticks'}]);
  put('scheduledPoolDrains', [{id: 'p1', customerId: 'a', technicianId: 't1', date: tIso, status: 'done', doneAt: new Date().toISOString(), doneBy: 't1', bodyKind: 'pool',
    doneNotes: 'Crack in the deep end', groupId: 'g1', order: 2}]);
`;

(async ()=>{
  const browser = await chromium.launch();
  async function open(file, width){
    const p = await browser.newPage({viewport: {width: width || (file === 'app.html' ? 400 : 1300), height: 900}});
    p.__errors = [];
    p.on('pageerror', e => p.__errors.push(String(e)));
    await p.addInitScript(SEED);
    await p.goto(ROOT + file);
    await p.waitForTimeout(1500);
    await p.evaluate(HELPERS);
    return p;
  }
  async function run(file, name, fn){
    const p = await open(file);
    let r;
    try{ r = await p.evaluate(fn); }
    catch(e){ check(name + ' (ran)', false, String(e).slice(0, 300)); await p.close(); return; }
    (r || []).forEach(([n, ok, info]) => check(n, ok, info));
    check(name + ': no page errors', p.__errors.length === 0, p.__errors.join(' | ').slice(0, 300));
    await p.close();
  }
  const APP_OPEN = `
    currentUser = {id: 't1', name: 'Amy'};
    try{ hideLogin(); }catch(e){}
    localStorage.setItem('weirdevice:membership', JSON.stringify({full_access: true}));
    try{ applyRoleUI(); }catch(e){}
  `;
  const appFn = body => new Function('return (async ()=>{' + APP_OPEN + body + '})()');

  console.log('\n=== App: a cleared dosage stays cleared when another reading changes ===');
  await run('app.html', 'Dosages', appFn(`
    const out = [];
    openVisit('a'); await wait(500);
    const set = (k, v)=>{ const el = document.getElementById('pool_chem_' + k); el.value = v; el.dispatchEvent(new Event('input', {bubbles: true})); };
    const dose = k => (document.getElementById('pool_dose_' + k) || {}).value;
    set('chlorine', '5'); set('ph', '7.6'); await wait(100);
    out.push(['chlorine 5 and pH 7.6 fill both dosages', dose('tabs') === '2' && dose('acid') === '0.25', dose('tabs') + ' / ' + dose('acid')]);
    const tabs = document.getElementById('pool_dose_tabs');
    tabs.value = ''; tabs.dispatchEvent(new Event('input', {bubbles: true})); await wait(50);
    set('ph', '7.8'); await wait(100);
    out.push(['changing the pH leaves the cleared chlorine dose empty', dose('tabs') === '', dose('tabs')]);
    out.push(['…and the acid still follows the pH', dose('acid') === '0.25', dose('acid')]);
    set('chlorine', '6'); await wait(100);
    out.push(['a new chlorine reading brings its dose back', dose('tabs') === '2', dose('tabs')]);
    return out;
  `));

  console.log('\n=== App: the admin Today drop-down ===');
  await run('app.html', 'Today drop-down', appFn(`
    const out = [];
    switchView('home'); selectedHomeDay = DAYS_OF_WEEK[new Date().getDay()]; renderHomeList(); await wait(900);
    const row = Array.from(document.querySelectorAll('#homeCustomerList .cust-row')).find(r => /Alpha/.test(r.textContent));
    row.click(); await wait(200);
    const brief = document.querySelector('#homeCustomerList .route-brief');
    const mails = brief ? Array.from(brief.querySelectorAll('a[href^="mailto:"]')).map(a => a.textContent) : [];
    out.push(['the customer’s emails show, each its own', mails.join('|') === 'a@x.com|a2@y.com', mails.join('|')]);
    out.push(['the phone opens the dialer, ready to call', !!(brief && brief.querySelector('a[href^="tel:6235550148"]'))]);
    const b = re => Array.from(brief.querySelectorAll('button')).find(x => re.test(x.textContent.trim()));
    const bg = el => el ? getComputedStyle(el).backgroundColor : '';
    out.push(['Skip Service is red with white words', /184, 73, 46/.test(bg(b(/^Skip Service$/))) && /255, 255, 255/.test(getComputedStyle(b(/^Skip Service$/)).color), bg(b(/^Skip Service$/))]);
    // Back to the plain look on Oct 22 (Tyrus asked)
    out.push(['Directions is in its plain look', !!b(/^Directions$/) && !b(/^Directions$/).style.background, b(/^Directions$/) && b(/^Directions$/).getAttribute('style')]);
    return out;
  `));

  console.log('\n=== Website: Jobs doesn’t redraw on a sync that changes nothing ===');
  await run('customer-intake.html', 'Jobs redraw', async ()=>{
    const out = [];
    switchView('customers'); viewCustomer(customers.find(c => c.id === 'a'));
    document.querySelector('#profileTabControl .history-type-btn[data-tab="workorders"]').click(); await wait(100);
    qoOpenId = 'pd:p1'; renderCustomerWorkOrders('a'); await wait(50);
    const before = document.querySelector('#custWorkOrderList .report-doc');
    renderCustomerWorkOrders('a', true); await wait(20);
    out.push(['a sync with nothing new leaves the open job as it is', document.querySelector('#custWorkOrderList .report-doc') === before && !!before]);
    const list = lsGet('scheduledPoolDrains'); list[0].doneNotes = 'Changed'; lsSet('scheduledPoolDrains', list);
    renderCustomerWorkOrders('a', true); await wait(20);
    out.push(['a sync that changes it draws it again', document.querySelector('#custWorkOrderList .report-doc') !== before]);
    return out;
  });

  console.log('\n=== Website: no date to start, and what a job needs marked in red ===');
  await run('customer-intake.html', 'Needs', async ()=>{
    const out = [];
    switchView('workcenter'); applyWorkCenterMode('quotes'); await wait(50);
    document.querySelector('#wcTypeToggle [data-wctype="Quote"]').click(); await wait(20);
    out.push(['a new quote has no date', document.getElementById('wcDate').value === '']);
    out.push(['+ Filter clean isn’t on quotes', getComputedStyle(document.getElementById('btnAddFilterClean')).display === 'none']);
    document.getElementById('btnSendWorkOrder').click(); await wait(30);
    const red = () => Array.from(document.querySelectorAll('#wcQuotesSection .need-it')).map(e => e.id || e.tagName);
    const msgs = () => Array.from(document.querySelectorAll('#wcQuotesSection .need-msg')).map(m => m.textContent);
    out.push(['sending an empty quote marks the date, customer and line item', red().includes('wcDate') && red().includes('wcCustomerSearch') && msgs().length === 3, red().join() + ' | ' + msgs().join(' / ')]);
    out.push(['…and nothing is sent', (lsGet('workOrders') || []).length === 0]);
    document.getElementById('wcDate').value = todayIso(); document.getElementById('wcDate').dispatchEvent(new Event('change'));
    out.push(['setting the date takes its red away', !red().includes('wcDate') && msgs().length === 2, red().join()]);
    document.querySelector('#wcTypeToggle [data-wctype="Work Order"]').click(); await wait(20);
    out.push(['a work order shows + Filter clean', getComputedStyle(document.getElementById('btnAddFilterClean')).display !== 'none']);
    document.getElementById('btnSendWorkOrder').click(); await wait(30);
    out.push(['a work order also needs a technician', red().includes('wcTechnician'), red().join()]);
    document.querySelector('#wcTypeToggle [data-wctype="Task"]').click(); await wait(20);
    out.push(['a new task has no date', document.getElementById('taskDate').value === '']);
    document.getElementById('btnSaveTask').click(); await wait(30);
    const tred = Array.from(document.querySelectorAll('#wcTaskSection .need-it')).map(e => e.id);
    out.push(['a task needs its date, what to do and a technician', ['taskDate', 'taskTitle', 'taskTechnician'].every(id => tred.includes(id)), tred.join()]);
    out.push(['…and no task is made', (tasks || []).length === 0]);
    return out;
  });

  console.log('\n=== Website: notes on work orders and pool drains in Alerts ===');
  await run('customer-intake.html', 'Alerts', async ()=>{
    const out = [];
    const a = collectAlerts();
    out.push(['a work order’s notes are an alert', a.some(x => x.id === 'wonote:j1' && x.kind === 'note' && /cracked/.test(x.notes))]);
    out.push(['a pool drain’s notes are an alert', a.some(x => x.id === 'pdnote:p1' && x.kind === 'note' && /deep end/.test(x.notes))]);
    return out;
  });

  console.log('\n=== App: no date to start, and what a job needs ===');
  await run('app.html', 'App needs', appFn(`
    const out = [];
    renderAppWorkCenter(); await wait(150);
    awcClearWo(); awcClearTask();
    out.push(['a new work order and task have no date', document.getElementById('awcWoDate').value === '' && document.getElementById('awcTaskDate').value === '']);
    out.push(['+ Filter clean isn’t on the quote form', !document.getElementById('awcQuoteAddFilterClean')]);
    awcFinalize(); await wait(20);
    const red = Array.from(document.querySelectorAll('#awcWoForm .need-it')).map(e => e.id || e.tagName);
    out.push(['Finalize with nothing filled in marks the date, customer, line item and technician',
      ['awcWoDate', 'awcWoSearch', 'awcWoTech'].every(id => red.includes(id)) && document.querySelectorAll('#awcWoForm .need-msg').length === 4, red.join()]);
    awcAddTask(); await wait(20);
    const tred = Array.from(document.querySelectorAll('#awcTaskForm .need-it')).map(e => e.id);
    out.push(['Add task with nothing marks the date, task and technician', ['awcTaskDate', 'awcTaskTitle', 'awcTaskTech'].every(id => tred.includes(id)), tred.join()]);
    // Line item suggestions across the whole line
    awcLineItems = [{description: '', qty: '', price: ''}]; awcRenderLines('awcLines'); await wait(20);
    const desc = document.querySelector('#awcLines .awc-line input');
    desc.value = 're'; desc.dispatchEvent(new Event('input', {bubbles: true})); await wait(50);
    const sug = document.querySelector('#awcLines .awc-suggest');
    const line = document.querySelector('#awcLines .awc-line');
    out.push(['the suggestions show', sug && getComputedStyle(sug).display === 'block']);
    out.push(['…as wide as the whole line', sug && Math.abs(sug.getBoundingClientRect().width - line.getBoundingClientRect().width) < 3, sug && Math.round(sug.getBoundingClientRect().width) + ' / ' + Math.round(line.getBoundingClientRect().width)]);
    return out;
  `));

  console.log('\n=== App: Reschedule a finished job from Serviced today ===');
  await run('app.html', 'Reschedule', appFn(`
    const out = [];
    switchView('serviced'); try{ renderServicedList(); }catch(e){} await wait(900);   // a press straight after arriving is ignored, on purpose
    const row = Array.from(document.querySelectorAll('#servicedList .cust-row')).find(r => /drain/i.test(r.textContent));
    const btn = row && btnText(row, /^Reschedule$/);
    out.push(['a finished pool drain has Reschedule', !!btn]);
    if(!btn) return out;
    btn.click(); await wait(30);
    const w = topWin();
    btnText(w, /^Reschedule$/).click(); await wait(20);
    out.push(['with no date it’s marked in red', !!w.querySelector('#rdjDate.need-it')]);
    const d = new Date(); d.setDate(d.getDate() + 7);
    const later = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    w.querySelector('#rdjDate').value = later; w.querySelector('#rdjTech').value = 't2';
    btnText(w, /^Reschedule$/).click(); await wait(30);
    const all = lsGet('scheduledPoolDrains');
    const fresh = all.find(x => x.id !== 'p1');
    out.push(['a fresh drain goes on that day with Ben', fresh && fresh.date === later && fresh.technicianId === 't2' && fresh.status === 'scheduled', JSON.stringify(fresh)]);
    out.push(['…with nothing of the finished one, and no group', fresh && !fresh.doneAt && !fresh.doneNotes && !fresh.groupId && fresh.order === undefined]);
    out.push(['the finished one stays as it was', all.find(x => x.id === 'p1').status === 'done']);
    out.push(['it’s sent to the office', (lsGet('officeWorkToSend') || []).some(x => x.kind === 'pool_drain' && x.id === fresh.id)]);
    return out;
  `));

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
