// Checks for everything built on Oct 26-28, 2026, in a real browser (Chromium
// through Playwright).
// App: Filter clean and Pool drain on the calendar's + Job (sent to the office,
// the office's current records read back), Finalize going back to the
// calendar, a typed name that isn't a customer yet, the WorkCenter's tagged
// headings, no date on a quote, mm/dd/yyyy in an empty date box on a phone,
// the camera's buttons at once and mirrored for left-handed mode, the two-word
// bottom tabs, no bottom bar on Equipment, and the calendar tags in each job's
// colour. Website: the Email tab's filters (groups, drains, city, inactive),
// the narrower empty day, a typed name on a work order, no date on a quote,
// phone equipment photos fetched from storage, the equipment rows lined up,
// the calendar in job colours, and the emailed photos as Polaroids.
// Run from the main folder: node tests/oct28-test.js
const path = require('path');
const fs = require('fs');
let chromium, devices;
try{ ({ chromium, devices } = require('playwright')); }
catch(e){ ({ chromium, devices } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); }

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
  window.isoIn = n => { const d = new Date(); d.setDate(d.getDate() + n); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  if(typeof hideSiteLogin === 'function'){ try{ siteUser = {id: 'u', companyId: 'co', role: 'owner'}; hideSiteLogin(); }catch(e){} }
`;
const SEED = `
  const put = (k, v) => localStorage.setItem('weir:' + k, JSON.stringify(v));
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const day = DAYS[new Date().getDay()];
  const tIso = (()=>{ const x = new Date(); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10); })();
  const ago = m => { const d = new Date(); d.setMonth(d.getMonth() - m); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  put('photoEveryone', {});
  put('afterPhotoDefaultFixed', true);
  put('technicians', [{id: 't1', name: 'Amy'}, {id: 't2', name: 'Ben'}]);
  put('customers', [
    {id: 'a', name: 'Alpha Ann', active: true, hasPool: true, hasSpa: true, technicianId: 't1', day: day, email: 'a@x.com', address: '1 Main St, Buckeye, AZ 85326',
     drains: [{date: ago(48)}], equipment: [{id: 'e1', type: 'Pump', quickText: 'Pentair', photos: [{id: 'ph1', stored: true}, {id: 'ph2', stored: true}], notes: 'x'},
       {id: 'e2', type: 'Chlorination', chlorinationChoice: 'Salt Cell', photos: []}]},
    {id: 'b', name: 'Bravo Bob', active: true, hasPool: true, technicianId: 't1', day: day, email: 'b@x.com', address: '2 Main St, Goodyear, AZ', drains: [{date: ago(4)}]},
    {id: 'c', name: 'Charlie Cruz', active: true, hasPool: true, technicianId: 't2', day: 'Nope', email: 'c@x.com', city: 'Buckeye', address: '3 Elm'},
    {id: 'd', name: 'Delta Diaz', active: false, hasPool: true, technicianId: 't2', email: 'd@x.com', address: '4 Oak, Verrado'}]);
  put('filterGroups', [{id: 'g1', name: 'Verrado Tuesday', customerIds: ['a', 'c']}]);
  put('scheduledWorkOrders', [{id: 'j1', customerId: 'a', technicianId: 't1', date: tIso, status: 'scheduled', title: 'Replace pump seal'}]);
`;

(async ()=>{
  const browser = await chromium.launch();
  async function open(file, extraInit, ctxOpts){
    const ctx = await browser.newContext(Object.assign({viewport: {width: /^app/.test(file) ? 400 : 1300, height: 900}}, ctxOpts || {}));
    const p = await ctx.newPage();
    p.__errors = [];
    p.on('pageerror', e => p.__errors.push(String(e)));
    await p.addInitScript(SEED);
    if(extraInit) await p.addInitScript(extraInit);
    await p.goto(ROOT + file);
    await p.waitForTimeout(1500);
    await p.evaluate(HELPERS);
    p.__ctx = ctx;
    return p;
  }
  async function run(file, name, fn, extraInit, ctxOpts){
    const p = await open(file, extraInit, ctxOpts);
    let r;
    try{ r = await p.evaluate(fn); }
    catch(e){ check(name + ' (ran)', false, String(e).slice(0, 300)); await p.__ctx.close(); return; }
    (r || []).forEach(([n, ok, info]) => check(n, ok, info));
    check(name + ': no page errors', p.__errors.length === 0, p.__errors.join(' | ').slice(0, 300));
    await p.__ctx.close();
  }
  const signIn = admin => `
    currentUser = {id: 't1', name: 'Amy', isAdmin: ${admin}};
    try{ hideLogin(); }catch(e){}
    localStorage.setItem('weirdevice:membership', JSON.stringify({full_access: ${admin}}));
    try{ applyRoleUI(); }catch(e){}
  `;
  const appFn = (body, admin) => new Function('return (async ()=>{' + signIn(admin !== false) + body + '})()');
  // The office's server, faked: what was pushed is kept, and the records it holds
  const SERVER = `
    window.__pushed = []; window.__rows = window.__rows || []; window.__offline = false;
    fieldAuthed = async (path, opts)=>{
      if(window.__offline) return {ok: false, offline: true, status: 0};
      if(/push_record_fields/.test(path)){ const b = JSON.parse(opts.body); window.__pushed.push(b); return {ok: true, body: {result: true, updated_at: new Date().toISOString(), data: {}}}; }
      if(/company_records/.test(path)) return {ok: true, body: window.__rows};
      return {ok: true, body: []};
    };
  `;

  console.log('\n=== App: Filter clean and Pool drain on the calendar ===');
  await run('app.html', 'Calendar + Job', appFn(SERVER + `
    const out = [];
    window.__rows = [{id: 'gx', kind: 'filter_group', deleted: false, data: {id: 'gx', name: 'Verrado', date: isoIn(3), customerIds: ['b'], finalized: true, technicianId: 't1'}},
                     {id: 'dx', kind: 'drain_entry', deleted: false, data: {id: 'dx', date: isoIn(4), customerId: 'c', bodyKinds: ['pool']}},
                     {id: 'old', kind: 'filter_group', deleted: true, data: {id: 'old', date: isoIn(3), customerIds: ['a']}}];
    switchView('home'); await wait(500);
    showHomeTab('calendar'); await wait(100);
    const got = await acalFetchOffice(true);
    out.push(['the calendar reads the office’s current groups and drains', got === true && acalOffice.filterGroups.length === 1 && acalOffice.drainCalendar.length === 1, JSON.stringify(acalOffice)]);
    acalSel = todayDateStr(); acalJobMenu = true; acalDraw(); await wait(50);
    const menu = document.getElementById('acalJobMenu');
    const items = menu ? Array.from(menu.children).map(x => x.textContent.replace(/^(WO|TK|FC|PD)/, '').trim()) : [];
    out.push(['+ Job: Work order, Task, then Filter clean and Pool drain', JSON.stringify(items) === '["Work order","Task","Filter clean","Pool drain"]', JSON.stringify(items)]);
    // Filter clean: a window, then onto the route
    Array.from(menu.children).find(x => /Filter clean/.test(x.textContent)).click(); await wait(80);
    let w = topWin();
    out.push(['Filter clean opens its window', !!w && /Filter clean/.test(w.textContent) && !!w.querySelector('[data-photo]') && !!w.querySelector('[data-email]')]);
    btnText(w, /^Add to route$/).click(); await wait(50);
    out.push(['it needs a customer first', !!topWin() && !(lsGet('scheduledFilterCleans') || []).length]);
    w.remove();
    const day = isoIn(5);
    let ok = await acalAddFilterCleans(day, ['a'], '', true, false);
    const fc = (lsGet('scheduledFilterCleans') || []).find(x => x.customerId === 'a' && x.date === day);
    out.push(['the filter clean goes onto Amy’s route', ok && !!fc && fc.technicianId === 't1' && fc.status === 'scheduled' && fc.photoRequired === true && fc.emailCustomer === false, JSON.stringify(fc)]);
    const g = window.__pushed.find(x => x.p_kind === 'filter_group');
    out.push(['…in that day’s "on their own" group, sent to the office', !!g && g.p_changes.solo.v === true && g.p_changes.date.v === day && g.p_changes.finalized.v === true && fc.groupId === g.p_id]);
    out.push(['…and the clean itself is sent too', (lsGet('officeWorkToSend') || []).some(x => x.kind === 'filter_clean' && x.id === fc.id)]);
    out.push(['it shows on the calendar that day', (acalOnDays()[day] || {fc: []}).fc.some(gr => gr.rows.some(r => r.cid === 'a'))]);
    // Pool drain: every body of water
    ok = await acalAddDrains(day, ['a'], 't2', false);
    const pds = (lsGet('scheduledPoolDrains') || []).filter(x => x.customerId === 'a' && x.date === day);
    out.push(['a drain covers each body of water (pool and spa)', ok && pds.length === 2 && pds.map(x => x.bodyKey).sort().join() === 'pool,spa', JSON.stringify(pds)]);
    out.push(['…on the technician chosen, photo not required', pds.every(x => x.technicianId === 't2' && x.photoRequired === false)]);
    const de = window.__pushed.find(x => x.p_kind === 'drain_entry');
    out.push(['…its drain day sent to the office', !!de && de.p_changes.technicianId.v === 't2' && de.p_changes.photoRequired.v === false]);
    // No signal: nothing is added
    window.__offline = true;
    const before = JSON.stringify(lsGet('scheduledFilterCleans'));
    ok = await acalAddFilterCleans(isoIn(6), ['b'], '', true, true);
    out.push(['with no signal nothing is added', ok === false && JSON.stringify(lsGet('scheduledFilterCleans')) === before]);
    return out;
  `));

  console.log('\n=== App: Finalize from the calendar goes back to it ===');
  await run('app.html', 'Back to calendar', appFn(`
    const out = [];
    switchView('home'); await wait(500);
    showHomeTab('calendar'); await wait(100);
    const day = isoIn(2);
    acalNewJob('Task', day); await wait(150);
    out.push(['+ Job → Task opens the task form on that day', currentViewName === 'customers' && document.getElementById('awcTaskDate').value === day]);
    document.getElementById('awcTaskTitle').value = 'Check the light';
    awcTaskTechs = ['t1'];
    awcAddTask(); await wait(150);
    out.push(['Finalize goes back to the calendar', currentViewName === 'home' && acalMode === 'calendar', currentViewName + ' ' + acalMode]);
    out.push(['…with that day open', acalSel === day && !!document.getElementById('acalDay')]);
    out.push(['…and the task was saved', (lsGet('tasks') || []).some(t => t.title === 'Check the light' && t.date === day)]);
    // Straight into the WorkCenter: it stays there
    switchView('customers'); showCustomerPane('work'); awcKind = 'Task'; awcView = 'main'; awcApply(); await wait(100);
    document.getElementById('awcTaskDate').value = day;
    document.getElementById('awcTaskTitle').value = 'Second task';
    awcTaskTechs = ['t1'];
    awcAddTask(); await wait(150);
    out.push(['started in the WorkCenter, it stays there', currentViewName === 'customers']);
    return out;
  `));

  console.log('\n=== App: a typed name that isn’t a customer yet ===');
  await run('app.html', 'Name only (app)', appFn(`
    const out = [];
    switchView('customers'); showCustomerPane('work'); awcKind = 'Work Order'; awcView = 'main'; awcApply(); await wait(500);   // taps are ignored just after a screen change
    const inp = document.getElementById('awcWoSearch');
    inp.value = 'Zed Newman'; inp.dispatchEvent(new Event('input')); await wait(30);
    const box = document.getElementById('awcWoSuggest');
    const add = box.querySelector('[data-add-name]');
    out.push(['an unknown name offers + Use "Zed Newman"', !!add && /Use \\u201cZed Newman\\u201d/.test(add.textContent)]);
    inp.value = 'alpha ann'; inp.dispatchEvent(new Event('input')); await wait(30);
    out.push(['a name already on file doesn’t offer it', !box.querySelector('[data-add-name]')]);
    inp.value = 'Zed Newman'; inp.dispatchEvent(new Event('input')); await wait(30);
    box.querySelector('[data-add-name]').click(); await wait(30);
    const c = customers.find(x => x.name === 'Zed Newman');
    out.push(['it’s kept as a name-only customer', !!c && c.nameOnly === true && c.hasPool === false && !c.day && c.active === true, JSON.stringify(c)]);
    out.push(['…and picked for the work order', awcWoCustomers.indexOf(c.id) !== -1]);
    const q = document.getElementById('awcQuoteSearch');
    q.value = 'Yolanda Q'; q.dispatchEvent(new Event('input')); await wait(30);
    out.push(['a quote doesn’t offer it (it needs an email)', !document.getElementById('awcQuoteSuggest').querySelector('[data-add-name]')]);
    giveNameOnlyTech([c], 't2');
    out.push(['finalizing gives them the job’s technician, so their phone has them', c.technicianId === 't2']);
    return out;
  `));

  console.log('\n=== App: WorkCenter headings, quote date, date boxes ===');
  await run('app.html', 'WorkCenter looks', appFn(`
    const out = [];
    switchView('customers'); showCustomerPane('work'); awcKind = 'Work Order'; awcView = 'main'; awcApply(); await wait(150);
    const lab = Array.from(document.querySelectorAll('#awc .field label')).find(l => /Customer/.test(l.textContent) && !l.classList.contains('inline-check'));
    const cs = getComputedStyle(lab);
    const pale = getComputedStyle(document.body).getPropertyValue('--teal-pale').trim();
    const probe = document.createElement('i'); probe.style.background = pale; document.body.appendChild(probe);
    out.push(['headings are light teal tags', cs.backgroundColor === getComputedStyle(probe).backgroundColor && cs.display === 'table', cs.backgroundColor + ' ' + cs.display]);
    out.push(['…with black words', cs.color === 'rgb(15, 46, 46)', cs.color]);
    const tick = document.querySelector('#awc label.inline-check');
    out.push(['tick boxes are left alone', getComputedStyle(tick).backgroundColor === 'rgba(0, 0, 0, 0)']);
    out.push(['the work order number is black', getComputedStyle(document.querySelector('#awc .awc-num')).color === 'rgb(15, 46, 46)']);
    awcKind = 'Quote'; awcApply(); await wait(50);
    out.push(['a quote has no date box', getComputedStyle(document.getElementById('awcQuoteDate')).display === 'none'
      && !Array.from(document.querySelectorAll('#awcQuoteForm label')).some(l => l.textContent.trim() === 'Date')]);
    out.push(['on a computer the date box keeps its own mm/dd/yyyy', !document.querySelector('#awc .date-ph')]);
    return out;
  `));
  await run('app.html', 'Phone date boxes', appFn(`
    const out = [];
    switchView('customers'); showCustomerPane('work'); awcKind = 'Work Order'; awcView = 'main'; awcApply(); await wait(200);
    ['awcWoDate', 'awcTaskDate'].forEach(id=>{
      const el = document.getElementById(id);
      const ph = el.parentNode.querySelector('.date-ph');
      out.push([id + ': an empty box says mm/dd/yyyy on a phone', !!ph && ph.textContent === 'mm/dd/yyyy']);
    });
    const el = document.getElementById('awcWoDate');
    const ph = el.parentNode.querySelector('.date-ph');
    out.push(['…shown while empty', ph.style.display === 'flex']);
    el.value = isoIn(3);
    out.push(['…gone once a date is set, however it’s set', ph.style.display === 'none']);
    el.value = '';
    out.push(['…back when it’s cleared', ph.style.display === 'flex']);
    out.push(['taps go through to the date box', getComputedStyle(ph).pointerEvents === 'none']);
    return out;
  `), null, devices['iPhone 13']);

  console.log('\n=== App: camera buttons ===');
  await run('app.html', 'Camera', appFn(`
    const out = [];
    const btn = document.createElement('button'); btn.style.display = 'none';
    deviceSet('camCount', 2);
    const pr = showCamFlipIfTwo(btn);
    out.push(['the switch camera button shows at once on a phone known to have two', btn.style.display === 'flex']);
    await pr;
    // Left-handed: mirrored
    document.body.classList.add('left-handed');
    const box = document.createElement('div');
    box.innerHTML = '<div style="position:relative;height:120px;">' + CAM_FLIP_HTML + '</div><div style="display:flex;justify-content:space-between;"><button id="camCancel">Cancel</button><button id="camShutter">o</button><button id="camFlash">Flash</button></div>'
      + '<div style="display:flex;justify-content:space-between;"><button id="clipCancel">Cancel</button><div id="clipTimer">0:00</div><button id="clipGo">Record</button></div>';
    document.body.appendChild(box);
    box.querySelector('[data-camflip]').style.display = 'flex';
    const x = id => document.getElementById(id).getBoundingClientRect().left;
    out.push(['left-handed: Flash on the left, Cancel on the right', x('camFlash') < x('camShutter') && x('camShutter') < x('camCancel')]);
    out.push(['left-handed: Record on the left, Cancel on the right for video', x('clipGo') < x('clipCancel')]);
    out.push(['left-handed: switch camera at the top left', box.querySelector('[data-camflip]').getBoundingClientRect().left < 40]);
    document.body.classList.remove('left-handed');
    out.push(['right-handed as before: Cancel on the left', x('camCancel') < x('camFlash') && box.querySelector('[data-camflip]').getBoundingClientRect().left > 300]);
    out.push(['the switch camera button’s style is read properly', /style="position:absolute;/.test(CAM_FLIP_HTML)]);
    return out;
  `));
  {
    const src = fs.readFileSync('app.html', 'utf8');
    check('the Flash button isn’t hidden until the camera starts', /id="camFlash"[\s\S]{0,260}cursor:pointer;">Flash off/.test(src) && /deviceGet\('camTorch'\) === false\) flashBtn\.style\.visibility = 'hidden'/.test(src));
    check('a Flash press before the camera is up is kept', /if\(!stream\)\{ showFlashButton\(true\); return; \}/.test(src));
  }

  console.log('\n=== App: bottom tabs, Equipment, calendar colours ===');
  await run('app.html', 'Bottom tabs', appFn(`
    const out = [];
    switchView('home'); await wait(500);
    const words = Array.from(document.querySelectorAll('.bottombar .tab')).filter(t => t.offsetParent).map(t => t.innerText.replace(/\\s+/g, ' ').replace('\\u25cf', '').trim());
    out.push(['admin tabs say both words', JSON.stringify(words) === '["Today Calendar","Techs Photo","Serviced Reports","Customers WorkCenter","Settings"]', JSON.stringify(words)]);
    const tab = v => document.querySelector('.bottombar .tab[data-view="' + v + '"]');
    tab('home').querySelector('[data-tabword="1"]').click(); await wait(100);
    out.push(['Calendar opens the calendar', acalMode === 'calendar']);
    tab('home').querySelector('[data-tabword="0"]').click(); await wait(100);
    out.push(['Today opens Today', acalMode === 'today']);
    await wait(450); tab('customers').querySelector('[data-tabword="1"]').click(); await wait(500);
    out.push(['WorkCenter opens the WorkCenter', getComputedStyle(document.getElementById('custPaneWork')).display !== 'none']);
    await wait(450); tab('report').querySelector('[data-tabword="1"]').click(); await wait(500);
    out.push(['Reports opens Reports', reportMode === 'reports']);
    await wait(450); tab('technicians').querySelector('[data-tabword="1"]').click(); await wait(500);
    out.push(['Photo opens Photo requirements', document.getElementById('view-technicians').classList.contains('photos-mode')]);
    currentUser.isAdmin = false; localStorage.setItem('weirdevice:membership', JSON.stringify({full_access: false})); applyRoleUI();
    const tw = Array.from(document.querySelectorAll('.bottombar .tab')).filter(t => t.offsetParent).map(t => t.innerText.replace(/\\s+/g, ' ').replace('\\u25cf', '').trim());
    out.push(['a technician’s tabs stay one word', JSON.stringify(tw) === '["Today","Serviced","Settings"]', JSON.stringify(tw)]);
    return out;
  `));
  await run('app.html', 'Equipment bar', appFn(`
    openVisit('a'); await wait(600);
    const before = document.getElementById('stepBar').style.display;
    showVisitSection('equipment'); await wait(400);
    const on = document.getElementById('stepBar').style.display;
    showVisitSection('pool'); await wait(400);
    const back = document.getElementById('stepBar').style.display;
    return [['no bottom bar on Equipment', on === 'none', on],
            ['…it’s back on the readings', back === 'block' && before === 'block', before + ' ' + back]];
  `, false));
  await run('app.html', 'Calendar colours', appFn(`
    const out = [];
    lsSet('tasks', [{id: 'k1', title: 'T', date: todayDateStr(), technicianId: 't1', customerIds: ['a'], done: true}]);
    acalFetchOffice = async () => false;
    switchView('home'); await wait(500); showHomeTab('calendar'); await wait(150);
    const cell = document.querySelector('#appCalCard [data-acal-day="' + todayDateStr() + '"]');
    const tag = t => Array.from(cell.querySelectorAll('span')).find(s => s.textContent.indexOf(t) === 0);
    const wo = tag('WO'), tk = tag('TK');
    out.push(['a work order’s tag is in the work order colour', !!wo && getComputedStyle(wo).backgroundColor === 'rgb(233, 238, 240)' && getComputedStyle(wo).color === 'rgb(62, 85, 96)']);
    out.push(['a task’s tag is in the task colour', !!tk && getComputedStyle(tk).backgroundColor === 'rgb(232, 241, 228)']);
    const dot = el => el && el.querySelector('i');
    out.push(['each has a dot for where it’s up to: in the app gold, done green', getComputedStyle(dot(wo)).backgroundColor === 'rgb(198, 138, 23)' && getComputedStyle(dot(tk)).backgroundColor === 'rgb(46, 139, 87)']);
    out.push(['two tags still fit side by side on a phone', Math.abs(wo.getBoundingClientRect().top - tk.getBoundingClientRect().top) < 2]);
    out.push(['the key shows the dots', /Not in app/.test(document.getElementById('appCalCard').textContent) && document.getElementById('appCalCard').querySelectorAll('i').length >= 5]);
    return out;
  `));

  console.log('\n=== Website: Email filters ===');
  await run('customer-intake.html', 'Email filters', async ()=>{
    const out = [];
    switchView('workcenter'); applyWorkCenterMode('broadcast'); await wait(150);
    const shown = () => broadcastShown().map(c => c.id).sort().join('');
    out.push(['with no filter: everyone active with an email', shown() === 'abc', shown()]);
    document.getElementById('wcRecipientFilter').click(); await wait(80);
    const panel = document.getElementById('wcRecipientFilterPanel');
    out.push(['Filter opens its panel', !!panel && /Filter clean group/.test(panel.textContent) && /Pool drains/.test(panel.textContent) && /City/.test(panel.textContent)]);
    out.push(['…listing the filter groups', /Verrado Tuesday/.test(panel.textContent) && /In no group/.test(panel.textContent)]);
    bfPicked.group = new Set(['g:g1']); bfChanged();
    out.push(['a filter group shows only its customers', shown() === 'ac', shown()]);
    bfPicked.drain = new Set(['overdue']); bfChanged();
    out.push(['…and with Overdue, only those whose drain is overdue too', shown() === 'a', shown()]);
    out.push(['the row says when the drain was due', /Drain due/.test(document.getElementById('wcRecipientList').textContent)]);
    bfClear(); bfCities = ['buckeye']; bfChanged();
    out.push(['a typed city finds customers by city or address', shown() === 'ac', shown()]);
    bfClear(); bfPicked.cust = new Set(['inactive']); bfChanged();
    out.push(['Inactive customers lists only the inactive', shown() === 'd', shown()]);
    out.push(['the filters show as chips with Clear all', /Inactive customers/.test(document.getElementById('wcRecipientChips').textContent) && /Clear all/.test(document.getElementById('wcRecipientChips').textContent)]);
    document.body.dispatchEvent(new MouseEvent('mousedown', {bubbles: true})); await wait(30);
    out.push(['a click outside closes the panel', !document.getElementById('wcRecipientFilterPanel')]);
    applyWorkCenterMode('calendar'); applyWorkCenterMode('broadcast'); await wait(50);
    out.push(['coming back to Email starts with no filters', !bfAny() && shown() === 'abc']);
    return out;
  });

  console.log('\n=== Website: calendar ===');
  await run('customer-intake.html', 'Website calendar', async ()=>{
    const out = [];
    lsSet('tasks', [{id: 'k1', title: 'T', date: isoIn(1), technicianId: 't1', customerIds: ['a'], done: true}]);
    try{ tasks = lsGet('tasks'); }catch(e){}
    switchView('workcenter'); applyWorkCenterMode('calendar'); await wait(300);
    const emptyDay = Array.from(document.querySelectorAll('#wcCalendarCard [data-cal-day]')).find(c => c.dataset.calDay === isoIn(10) || c.dataset.calDay === isoIn(-10));
    emptyDay.click(); await wait(150);
    let panel = document.querySelector('[data-cal-panel]');
    out.push(['an empty day opens narrower', !!panel && panel.style.maxWidth === '580px' && panel.dataset.calEmpty === '1']);
    out.push(['…with the buttons under the date', panel.firstChild.style.flexDirection === 'column']);
    document.querySelector('[data-cal-panel]').closest('.confirm-overlay').dispatchEvent(new MouseEvent('click', {bubbles: true})); await wait(80);
    applyWorkCenterMode('quotes'); applyWorkCenterMode('calendar'); await wait(200);
    const busy = document.querySelector('#wcCalendarCard [data-cal-day="' + isoIn(0) + '"]');
    // Job colours on the name chips
    const chip = busy && Array.from(busy.querySelectorAll('div')).find(d => d.querySelector('.cal-chip-name'));
    out.push(['a work order’s name is in the work order colour', !!chip && getComputedStyle(chip).backgroundColor === 'rgb(233, 238, 240)' && getComputedStyle(chip).color === 'rgb(62, 85, 96)']);
    out.push(['…with a gold dot (in the app)', !!chip && !!chip.querySelector('i') && getComputedStyle(chip.querySelector('i')).backgroundColor === 'rgb(198, 138, 23)']);
    const done = Array.from(document.querySelectorAll('#wcCalendarCard [data-cal-day="' + isoIn(1) + '"] div')).find(d => d.querySelector('.cal-chip-name'));
    out.push(['a done task is green-dotted, no ✓', !!done && getComputedStyle(done.querySelector('i')).backgroundColor === 'rgb(46, 139, 87)' && !/✓/.test(done.textContent)]);
    busy.click(); await wait(150);
    panel = document.querySelector('[data-cal-panel]');
    out.push(['a day with a job opens full width', !!panel && panel.style.maxWidth === '1000px' && !panel.dataset.calEmpty]);
    return out;
  });

  console.log('\n=== Website: work orders, quotes and equipment ===');
  await run('customer-intake.html', 'Work orders and quotes', async ()=>{
    const out = [];
    switchView('workcenter'); applyWorkCenterMode('quotes'); await wait(150);
    document.getElementById('wcType').value = 'Work Order'; applyWorkOrderType();
    renderWcSuggest('Zed Newman'); await wait(20);
    const box = document.getElementById('wcCustomerSuggest');
    out.push(['a work order offers + Use "Zed Newman"', !!box.querySelector('[data-add-name]')]);
    box.querySelector('[data-add-name]').dispatchEvent(new MouseEvent('mousedown', {bubbles: true})); await wait(20);
    const c = customers.find(x => x.name === 'Zed Newman');
    out.push(['…kept as a name-only customer, picked', !!c && c.nameOnly && c.hasPool === false && wcSelectedCustomerIds.indexOf(c.id) !== -1]);
    out.push(['the date box shows for a work order', getComputedStyle(document.getElementById('wcDate')).display !== 'none']);
    document.getElementById('wcType').value = 'Quote'; applyWorkOrderType();
    renderWcSuggest('Yolanda Q'); await wait(20);
    out.push(['a quote doesn’t offer a typed name', !box.querySelector('[data-add-name]')]);
    out.push(['a quote has no date box', getComputedStyle(document.getElementById('wcDate')).display === 'none'
      && getComputedStyle(document.querySelector('#wcDateField label')).display === 'none']);
    out.push(['…and Expires in stays', getComputedStyle(document.getElementById('wcExpiresWrap')).display !== 'none']);
    return out;
  });
  await run('customer-intake.html', 'Equipment', async ()=>{
    const out = [];
    let fetched = null;
    syncFetchPhoto = async id => { fetched = id; return 'data:image/png;base64,iVBORw0KGgo='; };
    const src = await photoDataUrl({id: 'ph9', stored: true});
    out.push(['a phone’s equipment photo is fetched from storage', fetched === 'ph9' && /^data:image/.test(src)]);
    switchView('customers'); viewCustomer(customers.find(c => c.id === 'a')); await wait(200);
    document.querySelector('#profileTabControl .history-type-btn[data-tab="equipment"]').click(); await wait(300);
    const rows = Array.from(document.querySelectorAll('#icEquipmentList .cust-row'));
    const lefts = sel => rows.map(r => { const el = sel(r); return el ? Math.round(el.getBoundingClientRect().left) : null; }).filter(x => x !== null);
    const typeL = lefts(r => r.querySelector('.equip-quick-text'));
    const notesL = lefts(r => Array.from(r.querySelectorAll('button')).find(b => /^Notes/.test(b.textContent)));
    const camL = lefts(r => Array.from(r.querySelectorAll('button')).find(b => /📷/.test(b.textContent)));
    const same = a => a.length > 2 && a.every(x => Math.abs(x - a[0]) <= 1);
    out.push(['the Type boxes line up down the list', same(typeL), typeL.join(',')]);
    out.push(['…and the Notes buttons, dot or no dot', same(notesL), notesL.join(',')]);
    out.push(['…and the cameras, number or no number', same(camL), camL.join(',')]);
    return out;
  });

  console.log('\n=== Emailed photos as Polaroids (send-report) ===');
  {
    const src = fs.readFileSync('functions/send-report/index.ts', 'utf8');
    check('each photo sits in a white frame with a fine grey edge', /background:#ffffff;border:1px solid #D5DEDC;border-radius:6px;/.test(src));
    check('…built as a table so Outlook shows it', /'<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="' \+ PHOTO_WIDTH/.test(src));
    check('…the label inside the frame, under the photo', /padding:6px 7px 7px;font-size:12px;font-weight:600;color:#1F8A8C;text-align:center;/.test(src));
    check('…the frame no wider than before, so two still sit side by side', /const IMG = PHOTO_WIDTH - 16;/.test(src));
    try{
      const ts = require(path.join(process.env.NODE_PATH || '/home/claude/node_modules', 'typescript'));
      const r = ts.transpileModule(src, {reportDiagnostics: true, compilerOptions: {target: 'es2022', module: 'esnext'}});
      check('send-report has no syntax errors', !(r.diagnostics || []).length, (r.diagnostics || []).map(d => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join(' | '));
    }catch(e){ console.log('  (TypeScript not installed here: syntax not checked)'); }
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
