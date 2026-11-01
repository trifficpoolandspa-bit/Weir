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
  async function open(file, extraInit){
    const ctx = await browser.newContext({viewport: {width: /^app/.test(file) ? 400 : 1300, height: 900}});
    const p = await ctx.newPage();
    p.__errors = [];
    p.on('pageerror', e => p.__errors.push(String(e)));
    await p.addInitScript(SEED);
    if(extraInit) await p.addInitScript(extraInit);
    await p.goto(ROOT + file);
    await p.waitForTimeout(1500);
    await p.evaluate(HELPERS);
    return p;
  }

  // ======================= Website =======================
  console.log('Website');
  let p = await open('customer-intake.html');

  // --- Alerts ---
  const al = await p.evaluate(()=>{
    const tabs = Array.from(document.querySelectorAll('#view-alerts .history-type-btn[data-kind]')).map(b => b.dataset.kind + '=' + b.textContent.trim());
    setAlertFav('x1', true); const on = alertIsFav('x1');
    setAlertFav('x1', false); const off = alertIsFav('x1');
    return {tabs, on, off, per: ALERTS_PER_PAGE};
  });
  check('Alerts: Favorites tab', al.tabs.includes('fav=Favorites'), al.tabs.join(','));
  check('Alerts: Repairs tab is called Quotes', al.tabs.includes('repair=Quotes'));
  check('Alerts: star on and off', al.on === true && al.off === false);
  check('Alerts: 10 a page', al.per === 10);

  // --- Products & Services ---
  const ps = await p.evaluate(()=> Array.from(document.querySelectorAll('#psCategoryControl .history-type-btn')).map(b => b.dataset.pscat));
  check('Products: Chemicals is the last tab', ps[ps.length - 1] === 'chemicals', ps.join(','));

  // --- Customer Jobs: Select multiple stays after a sync that changes nothing ---
  const sm = await p.evaluate(()=>{
    lsSet('tasks', (lsGet('tasks') || []).concat([{id: 'kx', title: 'Net', date: isoIn(1), customerIds: ['c1']}]));
    tasks = lsGet('tasks');
    renderCustomerWorkOrders('c1');
    renderCustomerWorkOrders('c1', true); renderCustomerWorkOrders('c1', true);
    return document.getElementById('qoSelectSlot').textContent;
  });
  check('Customer Jobs: Select multiple stays after a sync', /Select multiple/.test(sm), sm);

  // --- Line items ---
  const li = await p.evaluate(async ()=>{
    switchView('workcenter'); applyWorkCenterMode('quotes'); await wait(200);
    currentLineItems = [{description: '', qty: '', price: ''}]; renderLineItems();
    const inp = document.querySelector('#wcLineItems input');
    const ph = inp.placeholder;
    inp.value = 'Replace pump seal'; inp.dispatchEvent(new Event('input', {bubbles: true}));
    const box = document.querySelector('#wcLineItems .line-detail textarea');
    const shown = box && box.closest('.line-detail').style.display !== 'none';
    const val = box && box.value;
    const size = box && getComputedStyle(box).fontSize;
    box.value = 'Shaft seal kit and labor. Customer has the part.'; box.dispatchEvent(new Event('input', {bubbles: true}));
    const edited = currentLineItems[0].detail;
    box.focus(); box.value = ''; box.dispatchEvent(new Event('input', {bubbles: true})); box.blur();
    const cleared = currentLineItems[0].detail;
    const hidden = box.closest('.line-detail').style.display === 'none';
    // Picking a product brings its description back
    inp.value = 'Pump lid O-ring'; inp.dispatchEvent(new Event('input', {bubbles: true}));
    inp.value = 'Replace pump seal'; inp.dispatchEvent(new Event('input', {bubbles: true}));
    const back = currentLineItems[0].detail;
    return {ph, shown, val, size, edited, cleared, hidden, back, price: currentLineItems[0].price};
  });
  check('Line item: placeholder says Item', li.ph === 'Item', li.ph);
  check('Line item: product description shows under the line', li.shown && li.val === 'Shaft seal kit and labor.', li.val);
  check('Line item: description words are 14px', li.size === '14px', li.size);
  check('Line item: description can be edited', li.edited === 'Shaft seal kit and labor. Customer has the part.', li.edited);
  check('Line item: emptied description goes away', li.cleared === undefined && li.hidden);
  check('Line item: picking the product again brings its description back', li.back === 'Shaft seal kit and labor.' && Number(li.price) === 85);

  // --- WorkCenter subtabs to the top ---
  const tops = [];
  for(const t of ['drains', 'calendar', 'filters', 'quotes', 'broadcast', 'calendar']){
    await p.evaluate(()=>{ document.querySelector('main').style.minHeight = '3000px'; window.scrollTo(0, 700); });
    await p.waitForTimeout(80);
    await p.click('#wcNavSubs .nav-sub[data-type="' + t + '"]');
    await p.waitForTimeout(550);
    tops.push(t + ':' + await p.evaluate(()=> Math.round(window.scrollY)));
    await p.evaluate(()=>{ document.querySelector('main').style.minHeight = ''; });
  }
  check('WorkCenter: every subtab goes to the top', tops.every(x => x.endsWith(':0')), tops.join(' '));

  // --- Calendar ---
  const cal = await p.evaluate(async ()=>{
    closeWins(); switchView('workcenter'); openWorkCalendar(); await wait(400);
    const chips = Array.from(document.querySelectorAll('.cal-chip-name')).map(n => n.parentElement);
    const tagOf = name => { const c = chips.find(ch => ch.textContent.includes(name)); return c ? (c.querySelector('span') || {}).textContent : null; };
    const bgOf = name => { const c = chips.find(ch => ch.textContent.includes(name)); return c ? c.style.background : null; };
    const keyText = (document.querySelector('#view-workcenter') || document).textContent;
    const ticks = chips.filter(c => /✓/.test(c.textContent)).length;
    return {cruz: tagOf('Cruz'), diaz: tagOf('Diaz'), ann: tagOf('Ann'), bob: tagOf('Bob'), annBg: bgOf('Ann'), bobBg: bgOf('Bob'), cruzBg: bgOf('Cruz'),
      key: /Clean & refill/.test(keyText), ticks, cols: JSON.stringify(CAL_JOB_COLOURS)};
  });
  check('Calendar: work order with a filter clean is tagged FC', cal.cruz === 'FC', cal.cruz);
  check('Calendar: filter clean work order is gold', /251, 241, 221/.test(cal.cruzBg || ''), cal.cruzBg);
  check('Calendar: other work order is WO', cal.diaz === 'WO', cal.diaz);
  check('Calendar: Clean & refill is tagged CR', cal.ann === 'CR', cal.ann);
  check('Calendar: Clean & refill is bright sky blue', /142, 197, 245/.test(cal.annBg || ''), cal.annBg);
  check('Calendar: tasks are mint', cal.bob === 'TK' && /201, 235, 195/.test(cal.bobBg || ''), cal.bobBg);
  check('Calendar: key lists Clean & refill', cal.key);
  check('Calendar: no old green chip with a tick', cal.ticks === 0, cal.ticks);
  const st = await p.evaluate(()=>{ const b = calStatusBadge('done'); return b.textContent; });
  check('Calendar: done status says COMPLETE', /COMPLETE/.test(st), st);
  const mv = await p.evaluate(async ()=>{
    closeWins();
    calMoveDialog({fromIso: isoIn(0), name: 'Alpha Ann', what: 'Task', techId: 't1', onMove: ()=>{}});
    await wait(100);
    const w = topWin(); const ok = !!w && /Move to another day/.test(w.textContent);
    const locked = document.documentElement.classList.contains('weir-win-open');
    closeWins(); await wait(100);
    const unlocked = !document.documentElement.classList.contains('weir-win-open');
    return {ok, locked, unlocked};
  });
  check('Calendar: Move window opens', mv.ok);
  check('Windows: page behind is locked while a window is open', mv.locked);
  check('Windows: page unlocks when it closes', mv.unlocked);
  const mp = await p.evaluate(async ()=>{
    let picked = null;
    monthPickWindow(new Date(), m => { picked = m; });
    await wait(100);
    const w = topWin(); const ok = !!w;
    const legend = w ? /this month/i.test(w.textContent) && /showing/i.test(w.textContent) : false;
    closeWins();
    return {ok, legend};
  });
  check('Calendar: month picker opens as a window', mp.ok);
  check('Calendar: month picker has no Showing / This month legend', !mp.legend);

  // --- Pool drains ---
  await p.evaluate(async ()=>{ closeWins(); switchView('workcenter'); applyWorkCenterMode('drains'); await wait(300); });
  const hdr = await p.evaluate(()=>{
    const v = document.getElementById('view-workcenter');
    const btns = Array.from(v.querySelectorAll('button, select')).filter(b => b.getClientRects().length).map(b => (b.textContent || b.id || '').trim().slice(0, 20));
    return btns.join('|');
  });
  check('Drains: header shows Import drains', /Import drains/.test(hdr), hdr.slice(0, 200));
  const heads = await p.$$('#drainStatusList .fg-head');
  let opened = '';
  if(heads.length){
    // Open the first list with customers in it
    for(const h of heads){ if(/[1-9]\d* customer/.test(await h.textContent())){ await h.click(); break; } }
    await p.waitForTimeout(300);
    opened = await p.evaluate(()=> Array.from(openDrainBuckets).join(','));
  }
  check('Drains: a list opens', !!opened, opened);
  const heads2 = await p.$$('#drainStatusList .fg-head');
  for(const h of heads2){ const t = await h.textContent(); if(/[1-9]\d* customer/.test(t) && !(await h.evaluate(e => !!e.querySelector('.pd-sel-slot')))){ await h.click(); break; } }
  await p.waitForTimeout(300);
  const oneOpen = await p.evaluate(()=> openDrainBuckets.size);
  check('Drains: only one list open at a time', oneOpen <= 1, oneOpen);
  // Tick boxes in the open list
  const rowBoxes = await p.$$('#drainStatusList .press-row input[type=checkbox]:not([data-own-shift])');
  const usableBoxes = [];
  for(const b of rowBoxes){ if(await b.isVisible()) usableBoxes.push(b); }
  if(usableBoxes.length >= 4){
    await usableBoxes[1].click();
    await p.waitForTimeout(150);
    const bar = await p.evaluate(()=>{ const s = document.querySelector('#drainStatusList .pd-sel-slot'); return s ? {shown: s.style.display !== 'none', words: s.textContent} : null; });
    check('Drains: ticked bar sits in the open list heading', bar && bar.shown, bar && bar.words);
    check('Drains: ticked bar has Edit, Add to schedule, Remove from schedule', bar && /Edit/.test(bar.words) && /Add to schedule/.test(bar.words) && /Remove from schedule/.test(bar.words), bar && bar.words);
    const rem = await p.evaluate(()=>{ const b = btnText(document.querySelector('#drainStatusList .pd-sel-slot'), /Remove from schedule/); return b ? b.textContent.trim() : null; });
    check('Drains: Remove from schedule stays words, not a bin', rem === 'Remove from schedule', rem);
    // Shift-click a range
    const fresh = [];
    for(const b of await p.$$('#drainStatusList .press-row input[type=checkbox]:not([data-own-shift])')){ if(await b.isVisible()) fresh.push(b); }
    await p.keyboard.down('Shift'); await fresh[3].click(); await p.keyboard.up('Shift');
    await p.waitForTimeout(300);
    const n = await p.evaluate(()=> drainPicked.size);
    check('Drains: Shift-click ticks everyone in between', n >= 3, n);
    const edit = await p.evaluate(async ()=>{
      const b = btnText(document.querySelector('#drainStatusList .pd-sel-slot'), /^Edit/); if(!b) return null;
      b.click(); await wait(200);
      const w = topWin(); const t = w ? w.textContent : '';
      const ov = w && w.querySelector('[data-ov]'); const cl = w && w.querySelector('[data-clean]');
      const r = {many: /customers/.test(t), ov: !!ov, clean: cl ? Array.from(cl.options).map(o => o.textContent).join(',') : '', keep: cl && cl.value};
      closeWins(); return r;
    });
    check('Drains: Edit with several ticked opens the bulk window', edit && edit.many, edit && JSON.stringify(edit));
    check('Drains: bulk window has Overnight drain and Cleaning', edit && edit.ov && /Next day,2nd day,3rd day,4th day/.test(edit.clean), edit && edit.clean);
    check('Drains: bulk Cleaning starts on Keep as is', edit && edit.keep === 'keep');
  } else {
    check('Drains: enough customers in the open list to test ticking', false, usableBoxes.length);
  }

  // --- Overnight drains ---
  const ov = await p.evaluate(async ()=>{
    closeWins(); drainPicked.clear(); renderPoolDrains();
    const c = customers.find(x => x.id === 'c4');
    openDrainHistory(c); await wait(200);
    const w = topWin();
    const box = w.querySelector('#pdhOvernight'), sel = w.querySelector('#pdhClean'), wrap = w.querySelector('#pdhCleanWrap');
    const r = {defaultOn: box.checked, opts: Array.from(sel.options).map(o => o.textContent).join(','), first: sel.value};
    // On the same row, to the right
    const bl = box.closest('label').getBoundingClientRect(), wr = wrap.getBoundingClientRect();
    r.sameRow = Math.abs((bl.top + bl.bottom) / 2 - (wr.top + wr.bottom) / 2) < 8;
    r.farRight = wr.right > w.querySelector('.confirm-box, .confirm-box *') ? true : true;
    r.right = Math.round(w.querySelector('.confirm-box').getBoundingClientRect().right - wr.right);
    sel.value = '3'; sel.dispatchEvent(new Event('change')); await wait(50);
    r.saved = c.drainCleanDays;
    r.note = w.querySelector('#pdhOvNote').textContent;
    box.click(); await wait(50);
    r.offSaved = c.drainOvernight; r.hidden = wrap.style.display === 'none';
    box.click(); await wait(50);
    closeWins();
    // Scheduling puts the Clean & refill on the cleaning day, with no question
    const day = isoIn(5);
    const before = tasks.length;
    pdAfterScheduled([{id: 'e_test', customerId: 'c4', date: day, technicianId: 't1'}]);
    await wait(50);
    const job = tasks.find(t => t.refillOf === 'e_test');
    r.noWindow = !document.querySelector('.confirm-overlay');
    r.jobDay = job && job.date; r.want = isoIn(8); r.title = job && job.title;
    pdAfterScheduled([{id: 'e_test', customerId: 'c4', date: day, technicianId: 't1'}]);
    r.noDouble = tasks.filter(t => t.refillOf === 'e_test').length === 1;
    pdShiftRefill('e_test', day, isoIn(6));
    r.moved = (tasks.find(t => t.refillOf === 'e_test') || {}).date; r.wantMoved = isoIn(9);
    pdDropRefill(['e_test']);
    r.dropped = !tasks.some(t => t.refillOf === 'e_test');
    // A customer left alone is overnight, next day
    pdAfterScheduled([{id: 'e_t2', customerId: 'c5', date: day, technicianId: 't1'}]);
    r.defDay = (tasks.find(t => t.refillOf === 'e_t2') || {}).date; r.wantDef = isoIn(6);
    pdDropRefill(['e_t2']);
    return r;
  });
  check('Overnight: ticked by default', ov.defaultOn);
  check('Overnight: Cleaning menu choices', ov.opts === 'Next day,2nd day,3rd day,4th day,Custom…', ov.opts);
  check('Overnight: Cleaning starts on Next day', ov.first === '1', ov.first);
  check('Overnight: Cleaning sits on the same row', ov.sameRow);
  check('Overnight: Cleaning is at the far right', ov.right < 40, ov.right);
  check('Overnight: choice is saved on the customer', ov.saved === 3, ov.saved);
  check('Overnight: note follows the choice', /3 days later/.test(ov.note), ov.note);
  check('Overnight: unticking saves it and hides Cleaning', ov.offSaved === false && ov.hidden);
  check('Overnight: scheduling asks nothing', ov.noWindow);
  check('Overnight: Clean & refill goes on the cleaning day', ov.jobDay === ov.want && ov.title === 'Clean & refill', ov.jobDay + ' vs ' + ov.want);
  check('Overnight: not made twice', ov.noDouble);
  check('Overnight: moving the drain moves the clean & refill', ov.moved === ov.wantMoved, ov.moved + ' vs ' + ov.wantMoved);
  check('Overnight: taking the drain off takes it off', ov.dropped);
  check('Overnight: customer never set is next day', ov.defDay === ov.wantDef, ov.defDay + ' vs ' + ov.wantDef);

  // --- Date boxes: our calendar picks only on a press; no text bar where you can't type ---
  await p.evaluate(()=>{ closeWins(); const i = document.createElement('input'); i.type = 'date'; i.id = 'dpTest';
    i.style.cssText = 'position:fixed;top:120px;left:120px;z-index:2147482000;width:170px;'; document.body.appendChild(i);
    window.__dpChanges = 0; i.addEventListener('change', ()=> window.__dpChanges++); });
  const dbx = await (await p.$('#dpTest')).boundingBox();
  await p.mouse.click(dbx.x + dbx.width - 14, dbx.y + dbx.height / 2); await p.waitForTimeout(150);
  const dpOpen = await p.evaluate(()=> !!document.querySelector('.weir-datepop'));
  await p.click('.weir-datepop .dp-arrow[aria-label="Next month"]'); await p.waitForTimeout(80);
  const dpAfterArrow = await p.evaluate(()=> [document.getElementById('dpTest').value, __dpChanges].join('|'));
  const d15 = await (await p.$('.weir-datepop .dp-day:text-is("15")')).boundingBox();
  await p.mouse.click(d15.x + d15.width / 2, d15.y + d15.height / 2); await p.waitForTimeout(100);
  const dpPicked = await p.evaluate(()=> [document.getElementById('dpTest').value, __dpChanges, !!document.querySelector('.weir-datepop')].join('|'));
  check('Date box: calendar icon opens our calendar', dpOpen);
  check('Date box: moving months picks nothing', dpAfterArrow === '|0', dpAfterArrow);
  check('Date box: pressing a day picks it and closes', /^\d{4}-\d{2}-15\|1\|false$/.test(dpPicked), dpPicked);
  const caret = await p.evaluate(()=> [getComputedStyle(document.getElementById('dpTest')).caretColor, getComputedStyle(document.querySelector('#wcLineItems input, input:not([type])') || document.body).caretColor].join('|'));
  check('No text bar in date boxes; text boxes keep it', /^rgba\(0, 0, 0, 0\)\|rgb\(/.test(caret), caret);
  // --- Customer Jobs: 10 a page ---
  const jp = await p.evaluate(()=>{
    lsSet('tasks', (lsGet('tasks') || []).concat(Array.from({length: 14}, (_, i) => ({id: 'pg' + i, title: 'Job ' + i, date: isoIn(i + 2), customerIds: ['c2']}))));
    tasks = lsGet('tasks'); renderCustomerWorkOrders('c2');
    return [document.querySelectorAll('#custWorkOrderList [data-qo-id]').length, document.querySelectorAll('#custWorkOrderList [data-list-page]').length].join('|');
  });
  check('Customer Jobs: 10 a page with page numbers', /^10\|2$/.test(jp), jp);

  // --- Colour-blind mode ---
  const cbSet = await p.evaluate(()=>{ switchView('settings'); const b = document.getElementById('settingColourBlind'); return {there: !!b && b.getClientRects().length > 0, on: b && b.checked, keys: document.getElementById('colourBlindKey').children.length}; });
  check('Colour-blind: switch in Settings', cbSet.there, JSON.stringify(cbSet));
  check('Colour-blind: off to start', cbSet.on === false);
  check('Colour-blind: shows its five colours', cbSet.keys === 5, cbSet.keys);
  check('Website: no page errors', !p.__errors.length, p.__errors.join(' | ').slice(0, 300));
  await p.context().close();

  p = await open('customer-intake.html', `localStorage.setItem('weir:colourBlind', 'true');`);
  const cb = await p.evaluate(async ()=>{
    switchView('workcenter'); openWorkCalendar(); await wait(400);
    const chips = Array.from(document.querySelectorAll('.cal-chip-name')).map(n => n.parentElement);
    const bg = name => { const c = chips.find(ch => ch.textContent.includes(name)); return c ? [c.style.background, c.style.color] : null; };
    return {on: CB_ON, ann: bg('Ann'), bob: bg('Bob'), diaz: bg('Diaz'), done: CAL_STATE_COLOURS.done, tw: twJobColours('task')[0]};
  });
  check('Colour-blind: turns on from Settings storage', cb.on === true);
  check('Colour-blind: Clean & refill blue', cb.ann && /0, 114, 178/.test(cb.ann[0]), cb.ann && cb.ann[0]);
  check('Colour-blind: tasks wine', cb.bob && /136, 34, 85/.test(cb.bob[0]), cb.bob && cb.bob[0]);
  check('Colour-blind: work orders grey with white words', cb.diaz && /154, 154, 154/.test(cb.diaz[0]) && /255, 255, 255/.test(cb.diaz[1]), cb.diaz && cb.diaz.join(' / '));
  check('Colour-blind: done is blue', cb.done === '#0072B2', cb.done);
  check('Colour-blind: technician job colours follow', cb.tw === '#882255', cb.tw);
  check('Website (colour-blind): no page errors', !p.__errors.length, p.__errors.join(' | ').slice(0, 300));
  await p.context().close();

  // ======================= App =======================
  console.log('App');
  p = await open('app.html');
  const ap = await p.evaluate(()=>({
    task: jobKindColours('task')[0],
    crKind: shownJobKind({kind: 'task', title: 'Clean & refill', refillOf: 'x'}),
    crCol: jobKindColours('clean refill')[0],
    crLabel: jobKindLabel('clean refill'),
    crIcon: jobKindIcon('clean refill') === jobKindIcon('task'),
    fcKind: shownJobKind({kind: 'work order', lineItems: [{description: 'Filter clean'}]}),
    woKind: shownJobKind({kind: 'work order', lineItems: [{description: 'Light repair'}]}),
    move: typeof acalMoveDialog === 'function', month: typeof monthPickWindow === 'function',
    away: typeof backToTodayAfterAway, cbSwitch: !!document.getElementById('settingColourBlind'),
    cr: ACAL_TAGS.cr && ACAL_TAGS.cr[0]
  }));
  check('App: tasks are mint', ap.task === '#C9EBC3', ap.task);
  check('App: Clean & refill shown as its own kind', ap.crKind === 'clean refill', ap.crKind);
  check('App: Clean & refill is bright sky blue', ap.crCol === '#8EC5F5', ap.crCol);
  check('App: Clean & refill keeps the task icon and its own name', ap.crIcon && ap.crLabel === 'Clean & refill');
  check('App: work order with a filter clean shows as a filter clean', ap.fcKind === 'filter clean' && ap.woKind === 'work order');
  check('App: calendar has a CR tag', ap.cr === 'CR');
  check('App: Move and month picker are there', ap.move && ap.month);
  check('App: back to Today after time away is there', ap.away !== 'undefined', ap.away);
  check('App: colour-blind switch in Settings', ap.cbSwitch);
  check('App: no page errors', !p.__errors.length, p.__errors.join(' | ').slice(0, 300));
  await p.context().close();
  p = await open('app.html', `localStorage.setItem('weir:colourBlind', 'true');`);
  const ac = await p.evaluate(()=>{
    const row = document.createElement('div'); cbMarkRow(row, 'task');
    const light = document.createElement('div'); cbMarkRow(light, 'filter clean');
    return {on: CB_ON, wo: jobKindColours('work order').join(' '), tk: ACAL_TAGS.tk[2], st: ACAL_STATES.app[1], dark: row.classList.contains('cb-dark-row'), light: light.classList.contains('cb-dark-row')};
  });
  check('App colour-blind: on', ac.on);
  check('App colour-blind: work orders grey with white words', ac.wo === '#9A9A9A #FFFFFF', ac.wo);
  check('App colour-blind: calendar tags and dots follow', ac.tk === '#882255' && ac.st === '#E69F00', ac.tk + ' ' + ac.st);
  check('App colour-blind: dark rows get light words, light rows don’t', ac.dark && !ac.light);
  check('App (colour-blind): no page errors', !p.__errors.length, p.__errors.join(' | ').slice(0, 300));
  await p.context().close();

  // ======================= Quote page =======================
  console.log('Quote page');
  const qr = fs.readFileSync('quote-response.html', 'utf8');
  check('Quote page: buttons say Approve and Decline', /'Approve'\)/.test(qr) && /'Decline'\)/.test(qr));
  check('Quote page: no Approve all / Decline all', !/Approve all|Decline all/.test(qr));
  p = await open('quote-response.html');
  check('Quote page: no page errors', !p.__errors.length, p.__errors.join(' | ').slice(0, 300));
  await p.context().close();

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
