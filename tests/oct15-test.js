// Checks for everything built on Oct 15, 2026, in a real browser (Chromium
// through Playwright): the app, the website and the quote page.
// Run from the main folder: node tests/oct15-test.js
// The quote download needs jsPDF; pass its folder as JSPDF_DIR (node_modules
// holding jspdf and pdf-parse), or that part is skipped.
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
    catch(e){ check(name + ' (ran)', false, String(e).slice(0, 300)); await p.close(); return p; }
    (r || []).forEach(([n, ok, info]) => check(n, ok, info));
    if(opts.after) await opts.after(p);
    check(name + ': no page errors', p.__errors.length === 0, p.__errors.join(' | ').slice(0, 300));
    await p.close();
  }
  // An app page signed in as a technician with admin access
  const APP_SIGNED_IN = `
    currentUser = {id: 't1', name: 'Amy'};
    lsSet('technicians', [{id: 't1', name: 'Amy'}]);
    try{ hideLogin(); }catch(e){}
    try{ applyRoleUI(); }catch(e){}
  `;

  console.log('\n=== App: Today and opening the app ===');
  await run('app.html', 'Today on today', async ()=>{
    const out = [];
    currentUser = {id: 't1', name: 'Amy'}; lsSet('technicians', [{id: 't1', name: 'Amy'}]);
    try{ hideLogin(); }catch(e){} try{ applyRoleUI(); }catch(e){}
    const today = DAYS_OF_WEEK[new Date().getDay()];
    switchView('home');
    selectedHomeDay = DAYS_OF_WEEK[(new Date().getDay() + 3) % 7]; weekOffset = 2;
    // Back to the front from another app
    todayOnReturn();
    out.push(['coming back to the app puts Today back on today', selectedHomeDay === today && weekOffset === 0, selectedHomeDay + ' ' + weekOffset]);
    // Not while a window is up
    selectedHomeDay = DAYS_OF_WEEK[(new Date().getDay() + 3) % 7]; weekOffset = 1;
    const ov = document.createElement('div'); ov.className = 'confirm-overlay'; document.body.appendChild(ov);
    todayOnReturn();
    out.push(['a window open: the day is left alone', weekOffset === 1]);
    ov.remove();
    // Another tab and back: today
    switchView('customers'); switchView('home');
    out.push(['another tab and back: today', selectedHomeDay === today && weekOffset === 0]);
    // Back from another tab with Back: today
    selectedHomeDay = DAYS_OF_WEEK[(new Date().getDay() + 2) % 7]; weekOffset = 1;
    const place = snapshotPlace();
    switchView('customers');
    await restorePlace(place);
    out.push(['Back from another tab lands on today', selectedHomeDay === today && weekOffset === 0, selectedHomeDay + ' ' + weekOffset]);
    // Opening the app: swiped away → Today, even if it was on Customers
    localStorage.setItem('weir:lastPage', JSON.stringify({view: 'customers', date: todayDateStr()}));
    switchView('customers');
    openWhereLeft();
    out.push(['opened again after a swipe-away: Today', currentViewName === 'home', currentViewName]);
    // Closed by the phone in the background: the page it was on
    Object.defineProperty(document, 'wasDiscarded', {value: true, configurable: true});
    switchView('home');
    openWhereLeft();
    out.push(['closed by the phone in the background: the page it was on', currentViewName === 'customers', currentViewName]);
    Object.defineProperty(document, 'wasDiscarded', {value: false, configurable: true});
    return out;
  });

  console.log('\n=== App: JUST TODAY, drain colour, special rows ===');
  await run('app.html', 'Today rows', async ()=>{
    const out = [];
    currentUser = {id: 't1', name: 'Amy'}; lsSet('technicians', [{id: 't1', name: 'Amy'}]);
    try{ hideLogin(); }catch(e){} try{ applyRoleUI(); }catch(e){}
    const today = todayDateStr();
    const dow = DAYS_OF_WEEK[new Date().getDay()];
    const other = DAYS_OF_WEEK[(new Date().getDay() + 2) % 7];
    customers.push({id: 'c1', name: 'Fitzgerald-Montgomery, Alexandra Catherine', address: '780 N Apache Rd', active: true, day: other, technicianId: 't1', hasPool: true});
    customers.push({id: 'c2', name: 'Anderson, Mark', address: '1 Main', active: true, day: dow, technicianId: 't1', hasPool: true});
    customers.push({id: 'c3', name: 'Chen, David', address: '2 Main', active: true, day: 'Never', technicianId: 't1', hasPool: true});
    lsSet('rescheduledVisits', [{id: 'rv1', customerId: 'c1', fromDate: iso(2), toDate: today, justToday: true}]);
    lsSet('scheduledFilterCleans', [{id: 'fc1', customerId: 'c2', date: today, technicianId: 't1', status: 'scheduled'}]);
    lsSet('scheduledPoolDrains', [{id: 'pd1', customerId: 'c3', date: today, technicianId: 't1', status: 'scheduled', bodyKind: 'pool'}]);
    selectedHomeDay = dow; weekOffset = 0;
    switchView('home'); renderHomeList();
    await wait(400);
    const row = document.querySelector('[data-customer-row="c1"]');
    const line = row && row.querySelector('.cust-name');
    const nameEl = line && line.querySelector('.cust-name-text');
    const tag = line && line.lastElementChild;
    out.push(['moved customer shows JUST TODAY', !!tag && tag.textContent === 'JUST TODAY']);
    if(tag && nameEl){
      const t = tag.getBoundingClientRect(), n = nameEl.getBoundingClientRect(), l = line.getBoundingClientRect();
      out.push(['the tag shows in full', tag.scrollWidth <= tag.clientWidth + 1 && t.width > 40, t.width]);
      out.push(['the tag sits at the right end of the name line', Math.abs(t.right - l.right) < 2, t.right + ' / ' + l.right]);
      out.push(['the name stays left of the tag', n.right <= t.left + 1]);
      out.push(['a long name slides', nameEl.classList.contains('marquee-on')]);
    }
    out.push(['no FILTER CLEAN tag anywhere', !/FILTER CLEAN/.test(document.getElementById('view-home').textContent)]);
    const pd = jobKindColours('pool drain'), wo = jobKindColours('work order');
    out.push(['pool drain row is sky blue', pd[0] === '#C3DEF3' && pd[1] === '#174C78', pd.join()]);
    out.push(['and different from the work order', pd[0] !== wo[0]]);
    return out;
  });

  console.log('\n=== App: WorkCenter (Quote, line items, ticks) ===');
  await run('app.html', 'App WorkCenter', async ()=>{
    const out = [];
    currentUser = {id: 't1', name: 'Amy'}; lsSet('technicians', [{id: 't1', name: 'Amy'}]);
    try{ hideLogin(); }catch(e){}
    localStorage.setItem('weirdevice:membership', JSON.stringify({full_access: true}));
    try{ applyRoleUI(); }catch(e){}
    customers.push({id: 'c1', name: 'Jordan Ellis', email: 'jordan@example.com', address: '1 A St', active: true});
    lsSet('productsServices', [{key: 'p1', name: 'Pump install labour', price: 95}, {key: 'p2', name: 'Pump inspection', price: 45}, {key: 'p3', name: 'Acid wash', price: 300}]);
    switchView('customers');
    awcKind = 'Task';
    viewChangedAt = 0;          // the app ignores a tap just after a screen change
    document.getElementById('btnCustPaneWork').click();
    await wait(200);
    out.push(['WorkCenter shows Quote, Work Order, Task', Array.from(document.querySelectorAll('#awcKindRow [data-kind]')).map(b => b.dataset.kind).join() === 'Quote,Work Order,Task']);
    out.push(['pressing WorkCenter opens on Quote', awcKind === 'Quote' && document.getElementById('awcQuoteForm').style.display !== 'none']);
    out.push(['the quote number shows', /#\s*\d{4}/.test(document.getElementById('awcQuoteNumber').textContent)]);
    // Video required under Photo required, one column
    const ph = document.getElementById('awcWoPhoto').closest('label'), vd = document.getElementById('awcWoVideo').closest('label');
    // Oct 19: four ticks in two even columns; Video still under Photo
    out.push(['work order: Video required in the same column as Photo required', ph.parentElement === vd.parentElement && getComputedStyle(ph.parentElement).display === 'grid'
      && (() => { const k = Array.from(ph.parentElement.children); return k.indexOf(ph) % 2 === k.indexOf(vd) % 2 && k.indexOf(vd) > k.indexOf(ph); })()]);
    const tph = document.getElementById('awcTaskPhoto').closest('label'), tvd = document.getElementById('awcTaskVideo').closest('label');
    out.push(['task: Video required in the same column as Photo required', tph.parentElement === tvd.parentElement]);
    // Line item suggestions
    const desc = document.querySelector('#awcQuoteLines input');
    desc.focus(); desc.value = 'pump'; desc.dispatchEvent(new Event('input', {bubbles: true}));
    const sug = desc.closest('.awc-line').querySelector('.awc-suggest');   // across the whole line now (Oct 21)
    out.push(['typing a description lists matching products', sug && sug.style.display === 'block' && sug.children.length === 2, sug && sug.children.length]);
    sug.children[0].dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true}));
    out.push(['picking one fills its name and price', awcQuoteLines[0].description === 'Pump inspection' || awcQuoteLines[0].description === 'Pump install labour']);
    out.push(['…and the price', Number(awcQuoteLines[0].price) > 0, awcQuoteLines[0].price]);
    // Sending a quote
    const calls = [];
    window.deviceGet = (k => (orig => key => key === 'company' ? {id: 'co1'} : orig(key))(deviceGet))();
    window.fieldAuthed = async (p, o) => { calls.push({p, o}); return {ok: true, status: 201, body: null}; };
    awcQuoteCustomers = ['c1'];
    document.getElementById('awcQuoteName').value = 'Pump refresh';
    const before = Number(lsGet('quoteCounter')) || 0;
    document.getElementById('awcQuoteDate').value = (()=>{ const x = new Date(); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10); })();   // a date has to be set (Oct 21)
    await awcSendQuote();
    const reg = calls.find(c => /quote_responses/.test(c.p));
    const mail = calls.find(c => /send-report/.test(c.p));
    out.push(['sending registers the quote on the server', !!reg]);
    out.push(['…with its breakdown for Download', !!reg && !!JSON.parse(reg.o.body).details]);
    out.push(['…and asks to merge (Prefer header kept)', !!reg && reg.o.headers && /merge-duplicates/.test(reg.o.headers.Prefer)]);
    const html = mail ? JSON.parse(mail.o.body).html : '';
    out.push(['the email goes through the office', !!mail && JSON.parse(mail.o.body).to === 'jordan@example.com']);
    out.push(['the email has Approve and Decline', /a=approve/.test(html) && /a=deny/.test(html)]);
    out.push(['the email has Download quote', /a=download/.test(html) && /Download quote/.test(html)]);
    const saved = (lsGet('workOrders') || []).find(w => w.name === 'Pump refresh');
    out.push(['the quote is kept as the website keeps it', !!saved && saved.type === 'Quote' && saved.status === 'sent' && saved.customerId === 'c1']);
    out.push(['it goes to the office whole', (lsGet('officeWorkToSend') || []).some(x => x.kind === 'quote' && x.id === (saved || {}).id)]);
    out.push(['the quote number goes up and is shared', Number(lsGet('quoteCounter')) === before + 1 && !!(lsGet('setupToSend') || {}).quoteCounter]);
    out.push(['the form is cleared after sending', awcQuoteCustomers.length === 0]);
    // Current
    awcView = 'current'; awcApply();
    const rows = document.querySelectorAll('#awcCurList .awc-row');
    out.push(['Current lists the quote as PENDING', rows.length === 1 && /PENDING/.test(rows[0].textContent), rows.length]);
    // An answer from the customer
    window.fieldAuthed = async (p) => /quote_responses\?select/.test(p)
      ? {ok: true, body: [{quote_id: saved.id, outcome: 'approved', responded_at: new Date().toISOString()}]} : {ok: true, body: null};
    awcAnswersAt = 0;
    await awcCheckQuoteAnswers();
    const after = (lsGet('workOrders') || []).find(w => w.id === saved.id);
    out.push(['an approval is picked up in the app', after.approved === true && after.answeredByCustomer === true]);
    out.push(['…shown as APPROVED', /APPROVED/.test(document.getElementById('awcCurList').textContent)]);
    // Quotes made on the website arrive in the app's list
    out.push(['quotes come from the office into workOrders', SYNC_WORK_LISTS.some(([k, kind]) => k === 'workOrders' && kind === 'quote') && SYNC_WORK_SENDABLE.indexOf('quote') === -1]);
    return out;
  });

  console.log('\n=== App: a customer’s quick buttons follow the company’s ===');
  await run('app.html', 'Quick buttons', async ()=>{
    const out = [];
    const cfg = lsGet('chemConfig') || chemConfig;
    chemConfig.pool.dosages.forEach(d => { if(d.key === 'shock') d.buttons = [0.5, 1]; });
    const stale = () => ({chemicals: [], dosages: [{key: 'shock', label: 'Shock', buttons: [0.5, 1, 2, 3, 4]}]});
    lsSet('customChemConfig', {a: {pool: stale()}, b: {pool: stale()},
      c: {pool: {chemicals: [], dosages: [{key: 'shock', label: 'Shock', buttons: [7, 8]}]}},
      d: {pool: {chemicals: [], dosages: [{key: 'shock', label: 'Shock', buttons: [0.5, 1, 2, 3, 4], buttonsOwn: true}]}}});
    const shock = id => listsForBody(id, 'pool', 'pool').dosages.find(x => x.key === 'shock').buttons.map(b => btnValue(b)).join();
    out.push(['an old company set several customers share follows the company', shock('a') === '0.5,1', shock('a')]);
    out.push(['a set only one customer has is kept as theirs', shock('c') === '7,8', shock('c')]);
    out.push(['buttons changed for a customer are kept', shock('d') === '0.5,1,2,3,4', shock('d')]);
    out.push(['nothing stored is changed by looking', JSON.stringify(lsGet('customChemConfig').a.pool.dosages[0].buttons) === '[0.5,1,2,3,4]']);
    return out;
  });

  console.log('\n=== Website ===');
  await run('customer-intake.html', 'Website', async ()=>{
    const out = [];
    // Quote answers in Alerts → Repairs
    customers.push({id: 'c1', name: 'Mark Anderson', email: 'mark@example.com', address: '1 Main', active: true, hasPool: true});
    workOrders.push({id: 'wo_1', number: 1042, type: 'Quote', customerId: 'c1', name: 'Pump', lineItems: [{description: 'Pump', qty: 1, price: 1200}],
      total: 1200, createdAt: new Date().toISOString(), status: 'sent', closed: true, approved: true, answeredByCustomer: true, approvedAt: new Date().toISOString()});
    workOrders.push({id: 'wo_2', number: 1041, type: 'Quote', customerId: 'c1', total: 50, createdAt: new Date().toISOString(), status: 'sent'});
    const alerts = collectAlerts();
    const qa = alerts.find(a => a.id === 'quote:wo_1:a');
    out.push(['an approved quote is an alert', !!qa]);
    out.push(['…on the Repairs tab, tagged Quote', !!qa && qa.kind === 'repair' && qa.tagText === 'Quote']);
    out.push(['…saying it was approved, with the total', !!qa && /Approved by the customer/.test(qa.notes) && /1200\.00/.test(qa.notes)]);
    out.push(['…and opens the quote in Jobs', !!qa && qa.jobKey === 'q:wo_1']);
    out.push(['a quote not answered is not an alert', !alerts.some(a => /wo_2/.test(a.id))]);
    // The PDF breakdown and the email's Download button
    const det = quoteDownloadDetails(customers[0], 'Quote', 'October 15, 2026', [{description: 'Pump', qty: 1, price: 1200}], 1200, 'Note', 1042, 30, 'Pump refresh');
    out.push(['the download breakdown has the items, total, number and company', det.items.length === 1 && det.total === 1200 && det.number === '1042' && !!det.company && !!det.expiresOn]);
    quoteCanDownload['abc123'] = true;
    const withDl = quoteEmailHtml(customers[0], 'Quote', 'Oct 15', [{description: 'Pump', qty: 1, price: 1200}], 1200, '', null, 'https://x/quote-response.html?s=a&t=abc123', 1042, 30);
    const noDl = quoteEmailHtml(customers[0], 'Quote', 'Oct 15', [{description: 'Pump', qty: 1, price: 1200}], 1200, '', null, 'https://x/quote-response.html?s=a&t=fff000', 1042, 30);
    out.push(['the email has Download when the breakdown is on the server', /a=download/.test(withDl)]);
    out.push(['…and not when it isn’t (server without 34)', !/a=download/.test(noDl) && /a=approve/.test(noDl)]);
    // Registering falls back without the breakdown when the server turns it away
    const sent = [];
    const realFetch = window.sbFetch;
    siteUser = Object.assign({}, siteUser || {}, {companyId: 'co1'});
    window.sbFetch = async (p, o) => { sent.push(JSON.parse(o.body)); return sent.length === 1 ? {ok: false, status: 400} : {ok: true, status: 201}; };
    const url = await registerQuoteResponse('wo_9', 30, det);
    window.sbFetch = realFetch;
    out.push(['a server without 34: sent again without the breakdown', sent.length === 2 && !!sent[0].details && !sent[1].details && !!url]);
    out.push(['…and that email has no Download', !quoteLinkCanDownload(url)]);
    // Jobs (was Quotes & Orders) and pool drains in it
    const tab = document.querySelector('#profileTabControl [data-tab="workorders"]');
    out.push(['the tab says Jobs', tab && tab.textContent.trim() === 'Jobs']);
    out.push(['the heading says Jobs', document.querySelector('#workOrdersCard h2').textContent.trim() === 'Jobs']);
    lsSet('scheduledPoolDrains', [{id: 'pd1', customerId: 'c1', date: iso(0), status: 'done', doneAt: new Date().toISOString(), bodyKind: 'spa', technicianId: 't1', lineItems: [{description: 'Acid wash', qty: 1}]},
      {id: 'pd2', customerId: 'c1', date: iso(3), status: 'scheduled', bodyKind: 'pool', technicianId: 't1'}]);
    const jobs = qoEntriesFor('c1');
    const d1 = jobs.find(x => x.key === 'pd:pd1'), d2 = jobs.find(x => x.key === 'pd:pd2');
    out.push(['pool drains are in Jobs', !!d1 && !!d2 && d1.kind === 'drain']);
    out.push(['…named for the body of water', d1 && d1.tag === 'Spa drain' && d2.tag === 'Pool drain']);
    out.push(['"Pool drains" is in the Jobs filter', !!document.querySelector('#qoKindFilter option[value="drain"]')]);
    switchView('customers'); viewCustomer(customers[0]);
    tab.click(); renderCustomerWorkOrders('c1'); await wait(200);
    const tags = Array.from(document.querySelectorAll('#custWorkOrderList span')).filter(s => s.textContent === 'Spa drain' && !s.children.length);
    out.push(['the drain badge is sky blue', tags.length > 0 && getComputedStyle(tags[0]).backgroundColor === 'rgb(195, 222, 243)', tags[0] && getComputedStyle(tags[0]).backgroundColor]);
    out.push(['the technicians’ week view uses the same sky blue', twJobColours('pool drain')[0] === '#C3DEF3']);
    // The scrollbar's room is always kept
    out.push(['the page keeps the scrollbar’s room', getComputedStyle(document.documentElement).overflowY === 'scroll']);
    return out;
  });

  // Website: things that need real clicks and keys
  {
    const p = await open('customer-intake.html');
    // Line item suggestions on the quote
    await p.evaluate(()=>{
      const ls = document.getElementById('loginScreen'); if(ls) ls.style.display = 'none';
      productsServices.length = 0;
      productsServices.push({key: 'a', name: 'Pump install labour', price: 95}, {key: 'b', name: 'Acid wash', price: 300});
      switchView('workcenter'); applyWorkCenterMode('quotes');
      currentLineItems = [{description: '', qty: 1, price: ''}]; renderLineItems();
    });
    const desc = p.locator('#wcLineItems input').first();
    await desc.click(); await desc.type('pump');
    await p.waitForTimeout(150);
    const shown = await p.evaluate(()=>{ const box = document.querySelector('#wcLineItems .fountain-row div div[style*="absolute"]'); return box ? {vis: box.style.display, n: box.children.length, text: box.textContent} : null; });
    check('website quote: typing a description lists matching products', !!shown && shown.vis === 'block' && shown.n === 1 && /Pump install labour/.test(shown.text), JSON.stringify(shown));
    await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter');
    await p.waitForTimeout(100);
    const li = await p.evaluate(()=> currentLineItems[0]);
    check('website quote: Down and Enter pick it, with its price', li.description === 'Pump install labour' && String(li.price) === '95', JSON.stringify(li));
    // Tabs stay put (scrolled down a little, the tabs still on screen, as a person would press them)
    await p.evaluate(()=>{
      switchView('alerts');
      const list = document.getElementById('alertsList');
      list.innerHTML = '<div style="height:2400px">tall</div>';
      window.scrollTo(0, 120);
    });
    await p.waitForTimeout(150);
    const y0 = await p.evaluate(()=> window.scrollY);
    const x0 = await p.evaluate(()=> document.querySelector('main').getBoundingClientRect().left);
    const box = await p.locator('#alertsKindControl [data-kind="video"]').boundingBox();
    await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await p.waitForTimeout(500);
    const after = await p.evaluate(()=> ({y: window.scrollY, x: document.querySelector('main').getBoundingClientRect().left, min: document.querySelector('main').style.minHeight, kind: alertsKind}));
    check('website: the tab was pressed', after.kind === 'video', after.kind);
    check('website: switching tabs on a page doesn\u2019t move it up or down', y0 > 50 && Math.abs(after.y - y0) <= 1, y0 + ' → ' + after.y);
    check('website: …or sideways', Math.abs(after.x - x0) <= 1, x0 + ' → ' + after.x);
    check('website: the page keeps its height (the bottom can only grow)', !!after.min);
    await p.evaluate(()=> switchView('customers'));
    check('website: going to another page starts fresh', await p.evaluate(()=> document.querySelector('main').style.minHeight === ''));
    // Enter presses a window's main button
    await p.evaluate(()=>{
      window.__pressed = [];
      const mk = (label, cls) => {
        const ov = document.createElement('div'); ov.className = 'confirm-overlay'; ov.id = 'tst' + label;
        ov.innerHTML = '<div class="confirm-box"><input id="tstIn' + label + '"><textarea id="tstTa' + label + '"></textarea><button class="btn btn-ghost">Cancel</button><button class="btn ' + cls + '" id="tstGo' + label + '">' + label + '</button></div>';
        ov.querySelector('#tstGo' + label).addEventListener('click', ()=>{ __pressed.push(label); ov.remove(); });
        document.body.appendChild(ov);
      };
      window.__mk = mk;
      mk('Save', 'btn-primary');
    });
    await p.focus('#tstInSave'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
    check('website: Enter in a window presses its main button', (await p.evaluate(()=> __pressed.join())) === 'Save');
    await p.evaluate(()=> __mk('Done', 'btn-primary'));
    await p.focus('#tstTaDone'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
    check('website: Enter in a multi-line box is a new line, not the button', (await p.evaluate(()=> __pressed.join())) === 'Save');
    await p.evaluate(()=> document.getElementById('tstDone').remove());
    await p.evaluate(()=> __mk('Delete', 'btn-primary'));
    await p.focus('#tstInDelete'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
    check('website: Enter never presses a Delete button', (await p.evaluate(()=> __pressed.join())) === 'Save');
    await p.evaluate(()=> document.getElementById('tstDelete').remove());
    // A click outside a window still closes it now the page keeps its scrollbar's room
    await p.evaluate(()=>{ __mk('Keep', 'btn-primary'); const ov = document.getElementById('tstKeep'); ov.querySelector('.btn-ghost').addEventListener('click', ()=>{ window.__cancelled = true; ov.remove(); }); });
    await p.mouse.click(6, 6); await p.waitForTimeout(150);
    check('website: a click outside a window still closes it', await p.evaluate(()=> !!window.__cancelled && !document.getElementById('tstKeep')));
    check('website (clicks and keys): no page errors', p.__errors.length === 0, p.__errors.join(' | ').slice(0, 300));
    await p.close();
  }

  console.log('\n=== Quote page ===');
  {
    const p = await open('quote-response.html');
    const t = await p.evaluate(()=> document.getElementById('title').textContent + ' | ' + document.getElementById('text').textContent);
    check('a link with no code: "Thank you for your response! We will be in touch shortly."', t === 'Thank you for your response! | We will be in touch shortly.', t);
    await p.close();
  }
  const JSPDF_DIR = process.env.JSPDF_DIR;
  if(JSPDF_DIR && fs.existsSync(path.join(JSPDF_DIR, 'jspdf/dist/jspdf.umd.min.js'))){
    const ctx = await browser.newContext({acceptDownloads: true});
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({contentType: 'application/javascript', body: fs.readFileSync(path.join(JSPDF_DIR, 'jspdf/dist/jspdf.umd.min.js'))}));
    let asked = null;
    await p.route('https://myxxahrlmzvrbcmopwyo.supabase.co/rest/v1/rpc/quote_download', r => {
      asked = r.request();
      r.fulfill({contentType: 'application/json', body: JSON.stringify({v: 1, type: 'Quote', number: '1042', name: 'Pump and filter refresh', date: 'October 15, 2026',
        expiresOn: 'November 14, 2026', customer: {name: 'Mark Anderson', address: '21456 W Sunrise Ln, Buckeye, AZ 85396'},
        items: Array.from({length: 40}, (_, i) => ({description: 'Item number ' + (i + 1) + (i === 3 ? ' with a long description that has to wrap onto a second line in the table' : ''), qty: 1, price: 10})),
        total: 400, notes: 'Includes haul-away.', colour: '#134E4A',
        company: {name: 'Triffic Pool and Spa', phone: '(623) 555-0148', email: 'office@example.com', website: 'example.com', license: 'ROC 1'},
        signoff: 'Thank you for your business.', companyName: 'Triffic Pool and Spa'})});
    });
    const dl = p.waitForEvent('download', {timeout: 15000}).catch(()=> null);
    await p.goto(ROOT + 'quote-response.html?s=' + encodeURIComponent('https://myxxahrlmzvrbcmopwyo.supabase.co') + '&t=' + 'ab'.repeat(16) + '&a=download');
    const file = await dl;
    check('quote page: Download asks the server with the link’s code and the public key', !!asked && /"p_token":"(ab){16}"/.test(asked.postData() || '') && !!asked.headers()['apikey']);
    check('quote page: the PDF downloads', !!file);
    if(file){
      const name = file.suggestedFilename();
      void name;
      const where = path.join(JSPDF_DIR, 'q.pdf');
      await file.saveAs(where);
      const pdfParse = require(path.join(JSPDF_DIR, 'pdf-parse'));
      const data = await pdfParse(fs.readFileSync(where));
      check('quote page: a long quote runs onto a second page', data.numpages >= 2, data.numpages);
      check('quote page: the PDF has the customer, items and total', /Mark Anderson/.test(data.text) && /Item number 40/.test(data.text) && /\$400\.00/.test(data.text));
      check('quote page: every page has its footer', (data.text.match(/Page \d of \d/g) || []).length === data.numpages);
      // Oct 15: no "40 items" above the total, and the total bar stays where it was
      check('quote page: no item count above the total', !/\b\d+ items?\b/.test(data.text), (data.text.match(/\b\d+ items?\b/) || [])[0]);
      const at = {};
      await pdfParse(fs.readFileSync(where), {pagerender: pg => pg.getTextContent().then(tc=>{
        tc.items.forEach(i=>{ if(/^(Item number 40|TOTAL)$/.test(i.str)) at[i.str] = i.transform[5]; }); return ''; })});
      const gap = at['Item number 40'] - at.TOTAL;
      check('quote page: the total sits the same distance below the last item as before (67pt)', Math.abs(gap - 67) < 0.5, gap);
    }
    const shown = await p.evaluate(()=> document.getElementById('title').textContent + ' | ' + document.getElementById('text').textContent);
    check('quote page: says it is downloading, with a button to download again', /downloading/.test(shown) && await p.locator('.dl-btn').count() === 1, shown);
    check('quote page: the file is named for the quote and the company', shown.indexOf('Quote 1042 \u2013 Triffic Pool and Spa.pdf') !== -1, shown);
    check('quote page: no page errors', errs.length === 0, errs.join(' | ').slice(0, 300));
    await ctx.close();
  } else {
    console.log('  (quote download skipped: set JSPDF_DIR)');
  }

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
