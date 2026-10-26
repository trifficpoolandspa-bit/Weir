// Checks for everything built on Oct 23-25, 2026, in a real browser (Chromium
// through Playwright).
// App: the job drop-down laid out like a customer's (Reschedule / Directions /
// Share on top, Skip job and Start job below), black words on the white
// buttons, Share on a job, Skip job (a reason, off Today, to the office marked
// skipped, no customer email), the Calendar on Today (admin only, + Job, the
// day closing), the photo mat, and search boxes that don't offer typed history.
// Website: the header colour picker gone, Single filter clean, the Jobs tab
// (time on the job pill, Email to customer / Download, Reply in Weir), drain
// sorting, bigger ticks, All / None under Photo and Email, the drain import's
// dates in one cell and older years, and search boxes without typed history.
// Run from the main folder: node tests/oct25-test.js
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
  window.btnText = (root, re) => Array.from(root.querySelectorAll('button')).find(b => re.test((b.textContent || '').trim()));
  window.topWin = () => Array.from(document.querySelectorAll('.confirm-overlay')).pop();
  if(typeof hideSiteLogin === 'function'){ try{ siteUser = {id: 'u', companyId: 'co', role: 'owner'}; hideSiteLogin(); }catch(e){} }
`;
const SEED = `
  const put = (k, v) => localStorage.setItem('weir:' + k, JSON.stringify(v));
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const day = DAYS[new Date().getDay()];
  const tIso = (()=>{ const x = new Date(); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10); })();
  put('photoEveryone', {});
  put('afterPhotoDefaultFixed', true);
  put('technicians', [{id: 't1', name: 'Amy'}, {id: 't2', name: 'Ben'}]);
  put('customers', [
    {id: 'a', name: 'Alpha Ann', active: true, hasPool: true, technicianId: 't1', day: day, email: 'a@x.com', phone: '(623) 555-0148',
     address: '1 Main St', city: 'Buckeye', gateCode: '1234', accessNotes: 'Side gate'},
    {id: 'b', name: 'Bravo Bob', active: true, hasPool: true, technicianId: 't1', day: day, address: '2 Main St', city: 'Goodyear'},
    {id: 'c', name: 'Charlie Cruz', active: true, hasPool: true, technicianId: 't2', day: 'Nope', address: '3 Elm', city: 'Avondale'}]);
  put('routeOrders', {[day]: {t1: ['a', 'b']}});
  put('scheduledWorkOrders', [
    {id: 'j1', customerId: 'a', technicianId: 't1', date: tIso, status: 'scheduled', title: 'Replace pump seal', notes: 'Bring the seal kit',
     lineItems: [{description: 'Replace pump seal', qty: 1}]}]);
  put('scheduledFilterCleans', [
    {id: 'f9', customerId: 'a', technicianId: 't1', date: '2026-10-01', status: 'done', doneAt: '2026-10-01T18:00:00.000Z', doneBy: 't1',
     doneDurationMs: 2530000, doneNotes: 'All clean', doneReplacements: ['Cartridge']}]);
  put('workOrders', [{id: 'w1', type: 'Quote', customerId: 'a', number: 12, createdAt: new Date().toISOString(), date: tIso,
    lineItems: [{description: 'New pump', qty: 1, price: 50}], total: 50,
    customerMessages: [{at: new Date().toISOString(), text: 'Can you come Tuesday instead?'}]}]);
`;

(async ()=>{
  const browser = await chromium.launch();
  async function open(file, extraInit){
    const p = await browser.newPage({viewport: {width: /^app/.test(file) ? 400 : 1300, height: 900}, hasTouch: /^app/.test(file)});
    p.__errors = [];
    p.on('pageerror', e => p.__errors.push(String(e)));
    await p.addInitScript(SEED);
    if(extraInit) await p.addInitScript(extraInit);
    await p.goto(ROOT + file);
    await p.waitForTimeout(1500);
    await p.evaluate(HELPERS);
    return p;
  }
  async function run(file, name, fn, extraInit){
    const p = await open(file, extraInit);
    let r;
    try{ r = await p.evaluate(fn); }
    catch(e){ check(name + ' (ran)', false, String(e).slice(0, 300)); await p.close(); return; }
    (r || []).forEach(([n, ok, info]) => check(n, ok, info));
    check(name + ': no page errors', p.__errors.length === 0, p.__errors.join(' | ').slice(0, 300));
    await p.close();
  }
  const signIn = admin => `
    currentUser = {id: 't1', name: 'Amy', isAdmin: ${admin}};
    try{ hideLogin(); }catch(e){}
    localStorage.setItem('weirdevice:membership', JSON.stringify({full_access: ${admin}}));
    try{ applyRoleUI(); }catch(e){}
  `;
  const appFn = (body, admin) => new Function('return (async ()=>{' + signIn(admin !== false) + body + '})()');
  const openJob = admin => `
    switchView('home'); selectedHomeDay = DAYS_OF_WEEK[new Date().getDay()];
    ${admin ? "try{ adminViewTechId = 't1'; }catch(e){}" : ''}
    renderHomeList(); await wait(900);
    const jr = document.querySelector('#homeCustomerList .route-job');
    if(jr) jr.click();
    await wait(200);
    const brief = document.querySelector('#homeCustomerList .route-job-brief');
    const rows = brief ? Array.from(brief.querySelectorAll('.btn-row')) : [];
    const words = row => Array.from(row.querySelectorAll('button')).map(b => b.textContent.trim());
  `;

  console.log('\n=== App: the job drop-down, laid out like a customer’s ===');
  await run('app.html', 'Admin job buttons', appFn(openJob(true) + `
    const out = [];
    out.push(['the job drop-down opens', !!brief]);
    if(!brief) return out;
    out.push(['two rows of buttons', rows.length === 2, rows.length]);
    out.push(['top: Reschedule, Directions, Share', JSON.stringify(words(rows[0])) === '["Reschedule","Directions","Share"]', JSON.stringify(words(rows[0]))]);
    out.push(['bottom: Skip job on the left, Start job on the right', JSON.stringify(words(rows[1])) === '["Skip job","Start job →"]', JSON.stringify(words(rows[1]))]);
    const black = Array.from(rows[0].querySelectorAll('button')).every(b => getComputedStyle(b).color === 'rgb(0, 0, 0)');
    out.push(['the white buttons have black words', black]);
    const skip = rows[1].querySelector('button'), start = rows[1].querySelectorAll('button')[1];
    out.push(['Skip job is red with white words', /rust/.test(skip.style.background) && getComputedStyle(skip).color === 'rgb(255, 255, 255)']);
    out.push(['Start job fills the rest of the row', start.getBoundingClientRect().width > skip.getBoundingClientRect().width]);
    out.push(['the same size as a customer’s buttons', skip.style.padding === '8px 12px' && skip.style.fontSize === '13px' && start.style.padding === '10px 14px']);
    return out;
  `));
  await run('app.html', 'Technician job buttons', appFn(openJob(false) + `
    if(!brief) return [['a technician’s job drop-down opens', false]];
    return [['a technician’s top row: Directions and Share (no Reschedule)', JSON.stringify(words(rows[0])) === '["Directions","Share"]', JSON.stringify(words(rows[0]))],
            ['…and Skip job / Start job below', JSON.stringify(words(rows[1])) === '["Skip job","Start job →"]', JSON.stringify(words(rows[1]))]];
  `, false));

  console.log('\n=== App: black words on the customer drop-down’s white buttons ===');
  await run('app.html', 'Customer buttons', appFn(`
    switchView('home'); selectedHomeDay = DAYS_OF_WEEK[new Date().getDay()];
    try{ adminViewTechId = 't1'; }catch(e){}
    renderHomeList(); await wait(900);
    const row = Array.from(document.querySelectorAll('#homeCustomerList .cust-row')).find(r => /Alpha Ann/.test(r.textContent) && !r.classList.contains('route-job'));
    if(row) row.click();
    await wait(200);
    const brief = document.querySelector('#homeCustomerList .route-brief');
    if(!brief) return [['the customer drop-down opens', false]];
    const out = [];
    ['Reschedule', 'Directions', 'Share', 'Access notes'].forEach(w=>{
      const b = btnText(brief, new RegExp('^' + w + '$'));
      out.push([w + ' has black words', !!b && getComputedStyle(b).color === 'rgb(0, 0, 0)', b && getComputedStyle(b).color]);
    });
    const skip = btnText(brief, /^Skip Service$/);
    out.push(['Skip Service keeps its white words', !!skip && getComputedStyle(skip).color === 'rgb(255, 255, 255)']);
    return out;
  `));

  console.log('\n=== App: Share on a job ===');
  await run('app.html', 'Job share', appFn(openJob(true) + `
    const out = [];
    let shared = null;
    navigator.share = async d => { shared = d; };
    btnText(rows[0], /^Share$/).click(); await wait(50);
    out.push(['it opens the phone’s share list', !!shared]);
    const t = (shared && shared.text) || '';
    out.push(['with the job and its details', /Replace pump seal/.test(t) && /Bring the seal kit/.test(t), t]);
    out.push(['…the customer and their address with a map link', /Alpha Ann/.test(t) && /1 Main St/.test(t) && /maps\\.google\\.com\\/\\?q=/.test(t)]);
    out.push(['no gate code or phone is sent', !/1234/.test(t) && !/555-0148/.test(t)]);
    // A computer with no share list copies it instead
    delete navigator.share; navigator.share = undefined;
    let copied = '';
    try{ Object.defineProperty(navigator, 'clipboard', {value: {writeText: async x => { copied = x; }}, configurable: true}); }catch(e){}
    btnText(rows[0], /^Share$/).click(); await wait(50);
    out.push(['with no share list it copies the same words', copied === t]);
    return out;
  `));
  await run('app.html', 'Technician share', appFn(openJob(false) + `
    let shared = null;
    navigator.share = async d => { shared = d; };
    btnText(rows[0], /^Share$/).click(); await wait(50);
    return [['a technician can share a job too', !!shared && /Replace pump seal/.test(shared.text)]];
  `, false));

  console.log('\n=== App: Skip job ===');
  await run('app.html', 'Skip job', appFn(openJob(true) + `
    const out = [];
    const emailsBefore = JSON.stringify(lsGet('jobEmailsToSend') || lsGet('jobEmails') || []);
    btnText(rows[1], /^Skip job$/).click(); await wait(80);
    let w = topWin();
    out.push(['it asks why', !!w && /being skipped\\?/.test(w.textContent) && /Replace pump seal/.test(w.textContent)]);
    btnText(w, /^Skip job$/).click(); await wait(30);
    out.push(['a reason is needed', !!topWin() && (lsGet('scheduledWorkOrders')[0].status === 'scheduled')]);
    // Pressing outside closes it and nothing happens
    // Weir closes a window only when the press starts on the backdrop
    w.dispatchEvent(new MouseEvent('mousedown', {bubbles: true})); w.dispatchEvent(new MouseEvent('click', {bubbles: true})); await wait(30);
    out.push(['pressing outside closes it', !document.body.contains(w)]);
    out.push(['…and the job is untouched', lsGet('scheduledWorkOrders')[0].status === 'scheduled' && !jobSubmitted('work order:j1')]);
    btnText(document.querySelector('#homeCustomerList .route-job-brief'), /^Skip job$/).click(); await wait(80);
    w = topWin();
    w.querySelector('textarea').value = 'Gate was locked';
    btnText(w, /^Skip job$/).click(); await wait(150);
    const j = lsGet('scheduledWorkOrders')[0];
    out.push(['it goes to the office as finished', j.status === 'done' && !!j.doneAt && j.doneBy === 't1']);
    out.push(['…with the reason in its notes', j.doneNotes === 'Skipped \\u2014 Gate was locked', j.doneNotes]);
    out.push(['…marked skipped', j.doneSkipped === true && jobWasSkipped(j)]);
    out.push(['only fields the server accepts are sent (doneSkipped stays here)', SYNC_WORK_ORDER_FIELDS.indexOf('doneSkipped') === -1]);
    const sub = jobSubmissions().find(x => x.key === 'work order:j1');
    out.push(['it’s recorded as skipped on this phone', !!sub && sub.skipped === true && sub.durationMs === 0]);
    out.push(['it’s off Today', !document.querySelector('#homeCustomerList .route-job')]);
    out.push(['no customer email is queued', JSON.stringify(lsGet('jobEmailsToSend') || lsGet('jobEmails') || []) === emailsBefore]);
    // Serviced today, for the office
    servicedDayOffset = 0; renderServicedList(); await wait(50);
    const row = Array.from(document.querySelectorAll('#servicedList .cust-row')).find(r => /Replace pump seal/.test(r.textContent));
    out.push(['it shows on Serviced today', !!row]);
    const tag = row && Array.from(row.querySelectorAll('span')).find(s => s.textContent === 'Skipped');
    out.push(['…with a red Skipped tag', !!tag && /rust/.test(tag.style.background)]);
    out.push(['…and Reschedule to put it back on a day', !!row && !!btnText(row, /^Reschedule$/)]);
    // Another phone sees it from the notes alone
    out.push(['another phone knows it was skipped from its notes', jobWasSkipped({doneNotes: 'Skipped \\u2014 Gate was locked'}) && !jobWasSkipped({doneNotes: 'Skipped the backwash'})]);
    return out;
  `));
  await run('app.html', 'Skip a task', appFn(`
    lsSet('tasks', [{id: 'k1', title: 'Check the light', date: todayDateStr(), technicianId: 't1', customerIds: ['a']}]);
    lsSet('scheduledWorkOrders', []);
  ` + openJob(false).replace('const jr = ', 'const jr0 = 0; const jr = ') + `
    const out = [];
    if(!brief) return [['the task drop-down opens', false]];
    btnText(rows[1], /^Skip job$/).click(); await wait(80);
    const w = topWin();
    w.querySelector('textarea').value = 'No power to the light';
    btnText(w, /^Skip job$/).click(); await wait(150);
    const t = lsGet('tasks')[0];
    out.push(['a skipped task is done for the office', t.done === true && t.doneNotes === 'Skipped \\u2014 No power to the light', JSON.stringify(t)]);
    out.push(['…marked skipped', t.doneSkipped === true]);
    out.push(['…and off Today', !document.querySelector('#homeCustomerList .route-job')]);
    return out;
  `, false));

  console.log('\n=== App: Calendar on Today ===');
  await run('app.html', 'App calendar', appFn(`
    const out = [];
    switchView('home'); await wait(500);   // taps are ignored for 400ms after a screen change
    const tabs = document.getElementById('homeTabCard');
    out.push(['the admin app has Today / Calendar', !!tabs && getComputedStyle(tabs).display !== 'none']);
    document.getElementById('btnHomeTabCal').click(); await wait(200);
    const card = document.getElementById('appCalCard');
    out.push(['Calendar shows the month', card.style.display === 'block' && !!card.querySelector('[data-acal-day]')]);
    out.push(['the Today list is hidden', document.getElementById('homeListCard').style.display === 'none']);
    const todayCell = card.querySelector('[data-acal-day="' + todayDateStr() + '"]');
    out.push(['today has a WO tag for the work order', !!todayCell && /WO/.test(todayCell.textContent), todayCell && todayCell.textContent]);
    todayCell.click(); await wait(80);
    let sheet = document.getElementById('acalDay');
    out.push(['pressing a day opens it', !!sheet]);
    const words = Array.from(sheet.querySelector('div').querySelectorAll('button')).map(b => b.textContent.trim());
    out.push(['+ Job sits left of Close', JSON.stringify(words) === '["+ Job","Close"]', JSON.stringify(words)]);
    btnText(sheet, /^\\+ Job$/).click(); await wait(50);
    let menu = document.getElementById('acalJobMenu');
    out.push(['+ Job offers Work order and Task only', !!menu && /Work order/.test(menu.textContent) && /Task/.test(menu.textContent) && !/Filter|Drain/.test(menu.textContent)]);
    const other = Array.from(document.querySelectorAll('#appCalCard [data-acal-day]')).find(c => c.dataset.acalDay !== todayDateStr());
    other.click(); await wait(50);
    out.push(['another day closes the job menu', !document.getElementById('acalJobMenu')]);
    btnText(document.getElementById('acalDay'), /^\\+ Job$/).click(); await wait(50);
    btnText(document.getElementById('acalDay'), /^Close$/).click(); await wait(50);
    out.push(['Close shuts the day and its menu', !document.getElementById('acalDay') && !document.getElementById('acalJobMenu')]);
    document.getElementById('btnHomeTabToday').click(); await wait(200);
    out.push(['Today brings the list back', document.getElementById('homeListCard').style.display !== 'none' && card.style.display === 'none']);
    return out;
  `));
  await run('app.html', 'Technician calendar', appFn(`
    switchView('home'); await wait(200);
    const tabs = document.getElementById('homeTabCard');
    showHomeTab('calendar'); await wait(100);
    return [['a technician has no Today / Calendar', !tabs || getComputedStyle(tabs).display === 'none'],
            ['…and can’t open the calendar', document.getElementById('appCalCard').style.display !== 'block']];
  `, false));

  console.log('\n=== App: swiping the calendar to change months ===');
  await run('app.html', 'Calendar swipe', appFn(`
    const out = [];
    switchView('home'); await wait(500);
    showHomeTab('calendar'); await wait(150);
    const monthOf = () => acalMonth;
    const start = monthOf();
    const shift = (m, n) => { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
    const swipe = async (x0, y0, x1, y1, ms)=>{
      const grid = document.querySelector('#appCalCard [data-acal-day]').parentElement;
      const cell = grid.querySelector('[data-acal-day]');
      const t = (x, y) => new Touch({identifier: 1, target: cell, clientX: x, clientY: y});
      cell.dispatchEvent(new TouchEvent('touchstart', {bubbles: true, touches: [t(x0, y0)], changedTouches: [t(x0, y0)]}));
      await wait(ms || 120);
      cell.dispatchEvent(new TouchEvent('touchend', {bubbles: true, touches: [], changedTouches: [t(x1, y1)]}));
      await wait(30);
      return grid;
    };
    const grid0 = document.querySelector('#appCalCard [data-acal-day]').parentElement;
    out.push(['the month lets the page scroll up and down', grid0.style.touchAction === 'pan-y']);
    let g = await swipe(300, 300, 150, 310);
    out.push(['swiping left shows the next month', monthOf() === shift(start, 1), monthOf()]);
    const newGrid = document.querySelector('#appCalCard [data-acal-day]').parentElement;
    out.push(['…sliding in from the right', /acalSlideNext/.test(newGrid.style.animation), newGrid.style.animation]);
    await swipe(100, 300, 260, 290);
    out.push(['swiping right goes back a month', monthOf() === start, monthOf()]);
    const prevGrid = document.querySelector('#appCalCard [data-acal-day]').parentElement;
    out.push(['…sliding in from the left', /acalSlidePrev/.test(prevGrid.style.animation)]);
    await swipe(200, 300, 230, 300);
    out.push(['a small drag doesn’t change the month', monthOf() === start]);
    await swipe(200, 200, 120, 400);
    out.push(['scrolling up and down doesn’t change it', monthOf() === start]);
    await swipe(300, 300, 100, 300, 950);
    out.push(['a slow drag doesn’t change it', monthOf() === start]);
    // A day open before the swipe closes, like the arrows
    await wait(600);
    document.querySelector('#appCalCard [data-acal-day]').click(); await wait(50);
    out.push(['(a day is open)', !!document.getElementById('acalDay')]);
    await swipe(300, 300, 120, 300);
    out.push(['a swipe closes the open day', !document.getElementById('acalDay') && monthOf() === shift(start, 1)]);
    // The tap a swipe leaves behind doesn't open a day
    document.querySelector('#appCalCard [data-acal-day]').click(); await wait(50);
    out.push(['the tap left by the swipe doesn’t open a day', !document.getElementById('acalDay')]);
    await wait(550);
    document.querySelector('#appCalCard [data-acal-day]').click(); await wait(50);
    out.push(['a real tap afterwards still opens one', !!document.getElementById('acalDay')]);
    // The arrows still work
    btnText(document.getElementById('appCalCard'), /^›$/).click(); await wait(50);
    out.push(['the › arrow still works', monthOf() === shift(start, 2)]);
    out.push(['an arrow doesn’t slide the month', !/acalSlide/.test(document.querySelector('#appCalCard [data-acal-day]').parentElement.style.animation)]);
    return out;
  `));

  console.log('\n=== Website: the calendar month in DM Serif Display ===');
  await run('customer-intake.html', 'Calendar month', async ()=>{
    const out = [];
    out.push(['the font is loaded with the others', Array.from(document.querySelectorAll('link[href*="fonts.googleapis"]')).some(l => /family=DM\+Serif\+Display/.test(l.href))]);
    switchView('workcenter'); applyWorkCenterMode('calendar'); await wait(150);
    const year = String(new Date().getFullYear());
    const label = Array.from(document.querySelectorAll('#wcCalendarSection b, [id*="Cal"] b')).find(b => /^[A-Z][a-z]+ \d{4}$/.test(b.textContent.trim()) && b.offsetParent);
    out.push(['the month shows on the calendar', !!label, label && label.textContent]);
    if(!label) return out;
    const cs = getComputedStyle(label);
    out.push(['in DM Serif Display', /DM Serif Display/.test(cs.fontFamily), cs.fontFamily]);
    out.push(['at 25px', cs.fontSize === '25px', cs.fontSize]);
    out.push(['in the usual dark colour, not teal', !/teal/.test(label.style.color || '') && cs.color !== 'rgb(14, 74, 77)', cs.color]);
    const prev = label.previousElementSibling, next = label.nextElementSibling;
    out.push(['still between the ‹ › arrows', !!prev && !!next && prev.textContent === '‹' && next.textContent === '›']);
    const mid = r => (r.top + r.bottom) / 2;
    out.push(['lined up with the arrows', Math.abs(mid(label.getBoundingClientRect()) - mid(prev.getBoundingClientRect())) <= 3]);
    next.click(); await wait(80);
    const label2 = Array.from(document.querySelectorAll('[id*="Cal"] b, #wcCalendarSection b')).find(b => /^[A-Z][a-z]+ \d{4}$/.test(b.textContent.trim()) && b.offsetParent);
    out.push(['the next month keeps the font', !!label2 && label2.textContent !== label.textContent && /DM Serif Display/.test(getComputedStyle(label2).fontFamily)]);
    return out;
  });

  console.log('\n=== App: photo mat and search boxes ===');
  await run('app.html', 'App mat and search', appFn(`
    const out = [];
    const css = Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\\n');
    out.push(['photos get the white mat (not the full-size viewer)', /img:not\\(\\.no-mat\\)/.test(css)]);
    const box = document.createElement('input');
    box.type = 'text'; box.placeholder = 'Search customers';
    document.body.appendChild(box); await wait(30);
    out.push(['a new search box doesn’t offer typed history', box.getAttribute('autocomplete') === 'weir-search' && box.getAttribute('spellcheck') === 'false' && /^q/.test(box.getAttribute('name') || '')]);
    const plain = document.createElement('input');
    plain.type = 'text'; plain.placeholder = 'Gallons';
    document.body.appendChild(plain); await wait(30);
    out.push(['other boxes are left alone', !plain.dataset.noHistory]);
    out.push(['the route place picker is there for work orders and tasks', typeof appRouteStopsFor === 'function' && typeof awcRoutePlaceRefresh === 'function']);
    return out;
  `));

  console.log('\n=== Website: profile, single filter clean, search boxes ===');
  await run('customer-intake.html', 'Website basics', async ()=>{
    const out = [];
    out.push(['the header colour picker is gone', !/Header colou?r/i.test(document.body.innerHTML.replace(/<script[\s\S]*?<\/script>/g, ''))]);
    const b = document.getElementById('btnSingleFilterClean');
    out.push(['Filter cleans has + Single filter clean', !!b && /Single filter clean/.test(b.textContent)]);
    b.click(); await wait(80);
    const w = topWin();
    out.push(['it opens a window', !!w]);
    if(w){ w.dispatchEvent(new MouseEvent('mousedown', {bubbles: true})); w.dispatchEvent(new MouseEvent('click', {bubbles: true})); await wait(30); out.push(['which closes on an outside click', !document.body.contains(w)]); }
    const searches = Array.from(document.querySelectorAll('input')).filter(i => /search/i.test(i.id || ''));
    out.push(['every search box has typed history off', searches.length > 0 && searches.every(i => i.getAttribute('autocomplete') === 'weir-search'), searches.filter(i => i.getAttribute('autocomplete') !== 'weir-search').map(i => i.id).join(',')]);
    return out;
  });

  console.log('\n=== Website: Jobs tab ===');
  await run('customer-intake.html', 'Jobs tab', async ()=>{
    const out = [];
    out.push(['the time pill reads "Time on the job 42m 10s"', /Time on the job <b>42m 10s<\/b>/.test(jobTimePill(2530000)), jobTimePill(2530000)]);
    const row = qoDoneRow('Submitted', 'Oct 1, 2026', 'Amy', 2530000);
    out.push(['submitted by and the pill share one row', row.classList.contains('rdate-row') && /by <b>Amy<\/b>/.test(row.innerHTML) && !!row.querySelector('.job-time-pill')]);
    switchView('customers'); viewCustomer(customers.find(c => c.id === 'a'));
    document.querySelector('#profileTabControl .history-type-btn[data-tab="workorders"]').click(); await wait(100);
    qoOpenId = 'fc:f9'; renderCustomerWorkOrders('a'); await wait(80);
    const list = document.getElementById('custWorkOrderList');
    out.push(['the open filter clean shows its time on the job', !!list.querySelector('.job-time-pill') && /42m 10s/.test(list.textContent)]);
    const head = list.querySelector('.report-head');
    out.push(['Email to customer and Download sit in its heading', !!head && !!btnText(head, /Email to customer/) && !!btnText(head, /^Download$/)]);
    const info = qoJobInfo({kind: 'clean', f: lsGet('scheduledFilterCleans')[0]});
    out.push(['the email/download include the time, notes and replacements', info.lines.some(l => /Time on the job: 42m 10s/.test(l))
      && info.sections.some(s => s[0] === 'Needs replacing' && /Cartridge/.test(s[1])) && info.sections.some(s => /notes/.test(s[0]) && /All clean/.test(s[1]))]);
    const html = qoJobEmailHtml(customers.find(c => c.id === 'a'), info);
    out.push(['the email has the footer (for photos to go above)', /<tr><td style="padding:26px;">/.test(html) && /Filter clean/.test(html)]);
    let sent = null;
    sbFetch = async (url, opts) => { if(/send-report/.test(url)) sent = JSON.parse(opts.body); return {ok: true, body: {}}; };
    try{ window.supabaseFetch = sbFetch; }catch(e){}
    qoOpenId = 'q:w1'; renderCustomerWorkOrders('a'); await wait(80);
    const reply = btnText(list, /^Reply in Weir$/);
    out.push(['a quote message has Reply in Weir', !!reply]);
    out.push(['…and Reply by email', Array.from(list.querySelectorAll('a,button')).some(x => /Reply by email/.test(x.textContent))]);
    // No row badge with the number running off it: the number is in the words
    out.push(['the quote number shows in bold in the row', Array.from(list.querySelectorAll('b')).some(b => /0012/.test(b.textContent))]);
    return out;
  });

  console.log('\n=== Website: drains ===');
  await run('customer-intake.html', 'Drains', async ()=>{
    const out = [];
    const d = pdImportDates('12/23, 6/20, 4/16');
    out.push(['three dates in one cell are three drains', JSON.stringify(d) === '["12/23","6/20","4/16"]', JSON.stringify(d)]);
    out.push(['"Jun 5, 2024" stays one date', JSON.stringify(pdImportDates('Jun 5, 2024, 3/19')) === '["Jun 5, 2024","3/19"]', JSON.stringify(pdImportDates('Jun 5, 2024, 3/19'))]);
    out.push(['6/98 is 1998', pdImportDate('6/98') === '1998-06-01', pdImportDate('6/98')]);
    out.push(['6/1998 is 1998', pdImportDate('6/1998') === '1998-06-01']);
    out.push(['12/23 is 2023', pdImportDate('12/23') === '2023-12-01']);
    out.push(['before 1950 is turned away', pdImportDate('6/1940') === '']);
    out.push(['the sort menu has every choice', DRAIN_SORTS.map(x => x[0]).join(',') === 'sched,unsched,name,due,last,tech,area,size']);
    const cs = customers.filter(c => ['a', 'b', 'c'].indexOf(c.id) !== -1);
    out.push(['Name A–Z', pdSortList(cs, 'name').map(c => c.id).join('') === 'abc']);
    out.push(['City or area', pdSortList(cs, 'area').map(c => c.id).join('') === 'cab', pdSortList(cs, 'area').map(c => c.id).join('')]);
    out.push(['Technician', pdSortList(cs, 'tech').map(c => c.id).join('') === 'abc']);
    switchView('workcenter'); applyWorkCenterMode('drains'); await wait(150);
    const sec = document.getElementById('wcDrainsSection');
    Array.from(sec.querySelectorAll('[title="Tap to open"]')).forEach(h => h.click()); await wait(100);
    const ticks = Array.from(sec.querySelectorAll('input[type="checkbox"]')).filter(x => x.offsetParent);
    out.push(['drain ticks are 22px', ticks.length > 0 && ticks.every(x => Math.round(x.getBoundingClientRect().width) === 22), ticks.map(x => Math.round(x.getBoundingClientRect().width)).join(',')]);
    const sortBtn = btnText(sec, /Sort:/);
    out.push(['a Sort button beside Select all', !!sortBtn]);
    const photoHead = sec.querySelector('[data-col="photo"]');
    const none = photoHead && Array.from(photoHead.querySelectorAll('span')).find(s => s.textContent === 'None');
    out.push(['All · None under Photo', !!none && /All/.test(photoHead.textContent)]);
    if(none){
      none.click(); await wait(80);
      out.push(['None unticks Photo for everyone in that list', customers.filter(c => c.hasPool).every(c => c.drainPhotoRequired === false)]);
      const all = Array.from(sec.querySelector('[data-col="photo"]').querySelectorAll('span')).find(s => s.textContent === 'All');
      all.click(); await wait(80);
      out.push(['All ticks it again', customers.filter(c => c.hasPool).every(c => c.drainPhotoRequired === true)]);
      out.push(['…and it’s saved', (lsGet('customers') || []).every(c => !c.hasPool || c.drainPhotoRequired === true)]);
    }
    const fcCss = Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\n');
    out.push(['filter clean ticks are the same size', /#wcFiltersSection input\[type="checkbox"\],#wcDrainsSection input\[type="checkbox"\]\{width:22px !important;height:22px !important;\}/.test(fcCss)]);
    return out;
  });

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
