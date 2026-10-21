// Checks for everything built on Oct 20, 2026, in a real browser (Chromium
// through Playwright): Select all / Unselect all, WorkCenter opening on the
// Calendar, Time off for technicians, the extra charge colours, inactive
// customers in the search, several emails on one line, the quote buttons in
// the windows, Email history's four statuses, the drain Submit button, Skip
// Service on a customer copy the list was holding, Add customers, black text
// and bigger header tags, one open row at a time on Today, the drain window
// (price, bin, Add drain), the WorkCenter ticks shared with the app, and the
// tiles to tick on a job.
// Run from the main folder: node tests/oct20-test.js
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
  if(typeof hideSiteLogin === 'function'){ try{ siteUser = {id: 'u', companyId: 'co', role: 'owner'}; hideSiteLogin(); }catch(e){} }
`;
const SEED = `
  const put = (k, v) => localStorage.setItem('weir:' + k, JSON.stringify(v));
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const d3 = (()=>{ const x = new Date(); x.setDate(x.getDate() + 3); return x; })();
  window.__D = new Date(d3.getTime() - d3.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  window.__DAY = DAYS[d3.getDay()];
  put('photoEveryone', {});
  put('technicians', [{id: 't1', name: 'Amy'}, {id: 't2', name: 'Ben'}]);
  put('customers', [
    {id: 'a', name: 'Alpha Ann', active: true, hasPool: true, hasSpa: true, technicianId: 't1', day: window.__DAY, email: 'a@x.com, a2@y.com', address: '1 Main'},
    {id: 'b', name: 'Bravo Bob', active: true, hasPool: true, technicianId: 't1', day: window.__DAY, email: 'b@x.com', address: '2 Main'},
    {id: 'c', name: 'Cora Cole', active: false, hasPool: true, technicianId: 't2', day: window.__DAY, address: '3 Main'}]);
  put('scheduledWorkOrders', [{id: 'j1', workOrderId: 'w1', customerId: 'b', technicianId: 't1', date: window.__D,
    title: 'Replace pump seal', lineItems: [{description: 'Replace pump seal', qty: 1, price: 50}], status: 'scheduled'}]);
  put('tasks', [{id: 'k1', title: 'Check timer settings', technicianId: 't1', date: window.__D, customerIds: ['a'], done: false}]);
  put('productsServices', [{key: 'ps1', name: 'Muriatic acid', price: '12', category: 'chemicals', extraCharge: true, abbr: 'MA', extraColor: '#6B4FA0'}]);
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
  const APP_OPEN = `
    currentUser = {id: 't1', name: 'Amy'}; lsSet('technicians', [{id: 't1', name: 'Amy'}, {id: 't2', name: 'Ben'}]);
    try{ hideLogin(); }catch(e){}
    localStorage.setItem('weirdevice:membership', JSON.stringify({full_access: true}));
    try{ applyRoleUI(); }catch(e){}
  `;
  const src = fs.readFileSync('customer-intake.html', 'utf8');
  const appSrc = fs.readFileSync('app.html', 'utf8');

  console.log('\n=== Website: WorkCenter opens on the Calendar ===');
  await run('customer-intake.html', 'WorkCenter', async ()=>{
    const out = [];
    switchView('workcenter'); await wait(50);
    out.push(['opening WorkCenter shows the Calendar', workCenterMode === 'calendar', workCenterMode]);
    out.push(['…with Calendar lit in the sidebar', document.querySelector('#wcNavSubs .nav-sub.active').dataset.type === 'calendar']);
    applyWorkCenterMode('quotes'); switchView('home'); await wait(30); switchView('workcenter'); await wait(50);
    out.push(['leaving from Work orders and coming back opens the Calendar again', workCenterMode === 'calendar', workCenterMode]);
    return out;
  }, SITE);

  console.log('\n=== Website: Select all becomes Unselect all ===');
  await run('customer-intake.html', 'Select all', async ()=>{
    const out = [];
    switchView('workcenter'); applyWorkCenterMode('broadcast'); await wait(80);
    const all = document.getElementById('wcRecipientAll');
    all.click(); await wait(30);
    out.push(['after Select all the button says Unselect all', /Unselect all/.test(all.textContent), all.textContent]);
    all.click(); await wait(30);
    out.push(['pressing it again unticks everyone and it says Select all', broadcastPicked.size === 0 && /^Select all/.test(all.textContent.trim()), broadcastPicked.size + ' ' + all.textContent]);
    out.push(['the Unselect all button beside it is named so', /Unselect all/.test(document.getElementById('wcRecipientNone').textContent)]);
    return out;
  }, SITE);

  console.log('\n=== Website: Time off ===');
  await run('customer-intake.html', 'Time off', async ()=>{
    const out = [];
    const t = technicians.find(x => x.id === 't1');
    const back = (()=>{ const x = new Date(window.__D + 'T12:00:00'); x.setDate(x.getDate() + 1); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10); })();
    switchView('technicians'); await wait(50);
    const row = Array.from(document.querySelectorAll('#technicianList .cust-row')).find(r => /Amy/.test(r.textContent));
    btnText(row, /^Time off$/).click(); await wait(30);
    out.push(['Time off opens its window', document.getElementById('toOverlay').style.display === 'flex']);
    document.getElementById('toCover').value = 't2';
    document.getElementById('toFrom').value = window.__D;
    document.getElementById('toBack').value = back;
    document.getElementById('toSave').click(); await wait(50);
    const moves = lsGet('rescheduledVisits') || [];
    out.push(['Amy’s customers that day go to Ben just for that day', ['a', 'b'].every(id => moves.some(r => r.customerId === id && r.toDate === window.__D && r.fromDate === window.__D && r.technicianId === 't2')), JSON.stringify(moves)]);
    out.push(['Ben’s route that day has them', twRouteFor('t2', window.__D).list.map(c => c.id).sort().join() === 'a,b', twRouteFor('t2', window.__D).list.map(c => c.id).join()]);
    out.push(['Amy’s route that day is empty', twRouteFor('t1', window.__D).list.length === 0]);
    out.push(['her work order that day goes to Ben', (lsGet('scheduledWorkOrders') || [])[0].technicianId === 't2']);
    out.push(['her task that day goes to Ben', tasks.find(x => x.id === 'k1').technicianId === 't2']);
    out.push(['nobody’s own technician changes', customers.find(c => c.id === 'a').technicianId === 't1']);
    const row2 = Array.from(document.querySelectorAll('#technicianList .cust-row')).find(r => /Amy/.test(r.textContent));
    out.push(['Amy’s row says she’s off and who covers', /Off .*Ben covering/.test(row2.textContent), row2.textContent.slice(0, 120)]);
    // Taken away with its bin
    toOpen(technicians.find(x => x.id === 't1')); await wait(20);
    document.querySelector('#toList [data-x-drawn="bin"]').click(); await wait(40);
    out.push(['the bin takes the moves away again', !(lsGet('rescheduledVisits') || []).some(r => r.timeOffId)]);
    out.push(['…and the work order and task go back to Amy', (lsGet('scheduledWorkOrders') || [])[0].technicianId === 't1' && tasks.find(x => x.id === 'k1').technicianId === 't1']);
    toClose();
    return out;
  }, SITE);

  console.log('\n=== Website: extra charge colours ===');
  await run('customer-intake.html', 'Extra colours', async ()=>{
    const out = [];
    out.push(['eight colours to choose from', EXTRA_COLOURS.length === 8, EXTRA_COLOURS.length]);
    out.push(['an item set to the old purple shows the new one', extraColourOf({extraColor: '#6B4FA0'}) === '#6B3E78']);
    out.push(['an item with none set is gold', extraColourOf({}) === '#C68A17']);
    const p = extraChargeDialog('Abbreviation?', 'MA', '#1F5E86', 'Save');
    await wait(30);
    const w = topWin();
    out.push(['the window has a dot for each colour', w.querySelectorAll('#extraDots button').length === 8]);
    w.querySelectorAll('#extraDots button')[3].click();
    btnText(w, /^Save$/).click();
    const got = await p;
    out.push(['picking a dot and Save gives the abbreviation and that colour', got && got.abbr === 'MA' && got.color === EXTRA_COLOURS[3], JSON.stringify(got)]);
    return out;
  }, SITE);

  console.log('\n=== Website: inactive customers in the search; emails on one line ===');
  await run('customer-intake.html', 'Search and emails', async ()=>{
    const out = [];
    renderCustomerSearchSuggestions('Cora'); await wait(20);
    const box = document.getElementById('customerSearchSuggestions');
    out.push(['an inactive customer shows in the search', /Cora/.test(box.textContent), box.textContent.slice(0, 80)]);
    out.push(['…marked Inactive', /Inactive/.test(box.textContent)]);
    out.push(['two emails on one line are two emails', customerEmailList({email: 'a@x.com, a2@y.com'}).join('|') === 'a@x.com|a2@y.com', customerEmailList({email: 'a@x.com, a2@y.com'}).join('|')]);
    out.push(['semicolons and spaces split them too, the same one once', customerEmailList({email: 'x@a.com; y@b.com x@a.com'}).length === 2]);
    out.push(['the Email tab sends to each', (()=>{ broadcastPicked.clear(); broadcastPicked.add('a'); return broadcastRecipients().join('|'); })() === 'a@x.com|a2@y.com', broadcastRecipients().join('|')]);
    return out;
  }, SITE);

  console.log('\n=== Website: quote buttons shown in a window ===');
  await run('customer-intake.html', 'Quote look', async ()=>{
    const out = [];
    const html = quoteEmailHtml({name: 'Alpha Ann'}, 'Quote', 'Oct 20, 2026', [{description: 'Acid wash', qty: 1, price: 250}], 250, '', null,
      'https://example.com/quote-response.html?s=x&t=abc', 7, 30);
    out.push(['the email’s Decline is red with white words', /a=deny" style="[^"]*background:#B8492E;color:#ffffff/.test(html)]);
    const look = new DOMParser().parseFromString(quoteHtmlForLook(html), 'text/html');
    const links = Array.from(look.querySelectorAll('a')).filter(a => /Approve|Decline/.test(a.textContent));
    out.push(['in a window both buttons show', links.length === 2, links.length]);
    out.push(['…with nothing to press', links.every(a => !a.getAttribute('href') && /pointer-events:\s*none/.test(a.getAttribute('style')))]);
    out.push(['…white words on both', links.every(a => /color:\s*(rgb\(255, 255, 255\)|#ffffff)/i.test(a.getAttribute('style'))), links.map(a => a.getAttribute('style')).join(' || ').slice(0, 200)]);
    return out;
  }, SITE);

  console.log('\n=== Website: Email history’s statuses ===');
  await run('customer-intake.html', 'Email history', async ()=>{
    const out = [];
    const opts = Array.from(document.querySelectorAll('#emailHistStatus option')).map(o => o.value);
    out.push(['the Status menu has Not sent, Sent, Delivered and Viewed only', opts.join() === ',unsent,sent,delivered,viewed', opts.join()]);
    out.push(['a bounced email shows as Sent', ehShownStatus({status: 'bounced'}) === 'sent']);
    out.push(['a delayed one that arrived shows as Delivered', ehShownStatus({status: 'delayed', delivered_at: 'x'}) === 'delivered']);
    out.push(['a viewed one stays Viewed', ehShownStatus({status: 'viewed'}) === 'viewed']);
    return out;
  }, SITE);

  console.log('\n=== Website: Add customers, black text, bigger tags ===');
  await run('customer-intake.html', 'Looks', async ()=>{
    const out = [];
    renderTechAssignedList('t2'); await wait(10);
    out.push(['a technician with no customers: Add customers', document.getElementById('btnShowAssignCustomers').textContent === 'Add customers']);
    renderTechAssignedList('t1'); await wait(10);
    out.push(['with customers: Edit customers', document.getElementById('btnShowAssignCustomers').textContent === 'Edit customers']);
    const tag = document.querySelector('.hd-tag') || (()=>{ const s = document.createElement('span'); s.className = 'hd-tag'; document.body.appendChild(s); return s; })();
    out.push(['the header tags are 11.5px', getComputedStyle(tag).fontSize === '11.5px', getComputedStyle(tag).fontSize]);
    return out;
  }, SITE);
  check('no dark teal text left in the website', !/(?<![-\w])color\s*:\s*var\(--teal-deep(er)?\)/.test(src));

  console.log('\n=== Website: the drain window ===');
  await run('customer-intake.html', 'Drain window', async ()=>{
    const out = [];
    openDrainHistory(customers.find(c => c.id === 'a')); await wait(30);
    const w = topWin();
    const self = w.querySelector('#pdhSelf').closest('label');
    out.push(['Customer performs drain is only as wide as its box and words', getComputedStyle(self).display === 'inline-flex']);
    out.push(['Add drain is dark teal', w.querySelector('#pdhAdd').classList.contains('btn-primary')]);
    out.push(['the price is per body of water when there’s more than one', /Pool drain price/.test(w.querySelector('#pdhPriceLabel').textContent), w.querySelector('#pdhPriceLabel').textContent]);
    const price = w.querySelector('#pdhPrice');
    price.value = '350'; price.dispatchEvent(new Event('change'));
    out.push(['a price typed in is saved as 350.00', (customers.find(c => c.id === 'a').drainPriceByBody || {}).pool === '350.00', JSON.stringify(customers.find(c => c.id === 'a').drainPriceByBody)]);
    w.querySelector('#pdhDate').value = iso(-30); w.querySelector('#pdhAdd').click(); await wait(20);
    out.push(['a drain in the list has a bin', !!w.querySelector('#pdhList [data-x-drawn="bin"]')]);
    w.querySelector('#pdhList [data-x-drawn="bin"]').click(); await wait(20);
    out.push(['the bin removes it', !w.querySelector('#pdhList [data-x-drawn="bin"]')]);
    return out;
  }, SITE);

  console.log('\n=== Website and app: WorkCenter ticks shared ===');
  check('the website sends the ticks to the server', /'workCenterTicks'\]/.test(src));
  await run('app.html', 'App ticks', new Function('return (async ()=>{' + APP_OPEN + `
    const out = [];
    lsSet('workCenterTicks', {woPhoto: false, woVideo: true, woEmail: false, woPrices: false, taskPhoto: true, taskVideo: true});
    renderAppWorkCenter(); await wait(150);
    awcClearWo(); awcClearTask();
    const g = id => document.getElementById(id).checked;
    out.push(['a new work order in the app starts with the shared ticks', !g('awcWoPhoto') && g('awcWoVideo') && !g('awcWoEmail') && !g('awcWoPrices')]);
    out.push(['a new task too', g('awcTaskPhoto') && g('awcTaskVideo')]);
    lsSet('setupToSend', {});
    const box = document.getElementById('awcWoPhoto');
    box.checked = true; box.dispatchEvent(new Event('change'));
    out.push(['ticking one in the app saves it for everyone', (lsGet('workCenterTicks') || {}).woPhoto === true && 'workCenterTicks' in (lsGet('setupToSend') || {})]);
    return out;
  })()`));

  console.log('\n=== App: drains, Skip Service, one open row, tiles ===');
  await run('app.html', 'App jobs', new Function('return (async ()=>{' + APP_OPEN + `
    const out = [];
    const day = todayDateStr();
    lsSet('customers', [{id: 'a', name: 'Alpha Ann', active: true, hasPool: true, technicianId: 't1', day: DAYS_OF_WEEK[new Date().getDay()], address: '1 Main'}]);
    customers = lsGet('customers');
    lsSet('scheduledPoolDrains', [{id: 'p1', customerId: 'a', technicianId: 't1', date: day, status: 'scheduled', bodyKind: 'pool',
      lineItems: [{description: 'Acid wash', qty: 1}]},
      {id: 'p2', customerId: 'a', technicianId: 't1', date: day, status: 'scheduled', bodyKind: 'spa'}]);
    lsSet('scheduledWorkOrders', [{id: 'j1', customerId: 'a', technicianId: 't1', date: day, status: 'scheduled', title: 'Seal', lineItems: [{description: 'Replace pump seal', qty: 1}]}]);
    const job = routeJobsFor('a', day, 't1').find(j => j.kind === 'pool drain' && j.id === 'p1');
    openJobPage(customers[0], job); await wait(60);
    const page = Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent !== null && /^Submit/.test(b.textContent.trim())).pop();
    out.push(['a drain’s button just says Submit', page && page.textContent.trim() === 'Submit', page && page.textContent]);
    const tile = Array.from(document.querySelectorAll('label')).find(l => /Acid wash/.test(l.textContent));
    const cb = tile.querySelector('input');
    out.push(['an item to tick is a white tile with a border', /rgb\\(255, 255, 255\\)/.test(getComputedStyle(tile).backgroundColor) && parseFloat(getComputedStyle(tile).borderTopWidth) >= 1 && getComputedStyle(tile).borderTopStyle === 'solid', getComputedStyle(tile).backgroundColor + ' ' + getComputedStyle(tile).borderTopWidth]);
    cb.click(); await wait(10);
    out.push(['ticked, it turns pale teal', !/rgb\\(255, 255, 255\\)/.test(getComputedStyle(tile).backgroundColor), getComputedStyle(tile).backgroundColor]);
    Array.from(document.querySelectorAll('.job-page, [data-job-page]')).forEach(p => p.remove());
    // Skip Service on an old copy of the customer
    switchView('home'); selectedHomeDay = DAYS_OF_WEEK[new Date().getDay()]; renderHomeList(); await wait(30);
    const stale = JSON.parse(JSON.stringify(customers[0]));
    customers = JSON.parse(JSON.stringify(customers));   // as a sync does
    confirmDialog = () => Promise.resolve(true);
    appSettings.requireSkipReason = false; appSettings.requireSkipPhoto = false;
    await skipService(stale); await wait(50);
    out.push(['Skip Service on an old copy still marks the customer done', customers[0].lastServicedDate === day, customers[0].lastServicedDate]);
    out.push(['…and they leave Today', !/Alpha Ann/.test(Array.from(document.querySelectorAll('#homeCustomerList .cust-row')).map(r => r.textContent).join(' '))]);
    out.push(['…and show under Serviced', (()=>{ renderServicedList(); return /Alpha Ann/.test(document.getElementById('servicedList').textContent); })()]);
    // One open at a time
    renderHomeList(); await wait(30);
    const jobs = Array.from(document.querySelectorAll('#homeCustomerList .route-job'));
    if(jobs.length >= 2){
      await wait(800);   // a press straight after the list is drawn is ignored, on purpose
      jobs[0].click(); await wait(300);
      const first = document.querySelectorAll('#homeCustomerList .route-job-brief').length;
      jobs[1].click(); await wait(300);
      const briefs = document.querySelectorAll('#homeCustomerList .route-job-brief');
      out.push(['opening a second job closes the first', first === 1 && briefs.length === 1 && jobs[1].nextElementSibling === briefs[0], first + ' then ' + briefs.length]);
    } else out.push(['two jobs on Today to open', false, jobs.length]);
    return out;
  })()`));

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
