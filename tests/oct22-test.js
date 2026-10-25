// Checks for everything built on Oct 22, 2026, in a real browser (Chromium
// through Playwright): Reschedule on the admin app's Today job drop-down (not
// for technicians), the camera's flip button and the back lens chosen over a
// selfie camera called "ultra wide", the salt cell clean photo (the Photo
// requirements row and the button that needs a photo), Directions / Share /
// Reschedule back to their plain look, the Technicians tab in the same order
// as Today, quote messages (the email's button, the page the customer writes
// on, and the message on the website), and the app's Customize email buttons
// with Clear asking first.
// Run from the main folder: node tests/oct22-test.js
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
  const day = DAYS[new Date().getDay()];
  const tIso = (()=>{ const x = new Date(); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10); })();
  put('photoEveryone', {});
  put('afterPhotoDefaultFixed', true);
  put('technicians', [{id: 't1', name: 'Amy', requireSaltCellPhoto: true}, {id: 't2', name: 'Ben'}]);
  put('customers', [
    {id: 'a', name: 'Alpha Ann', active: true, hasPool: true, technicianId: 't1', day: day, email: 'a@x.com', phone: '(623) 555-0148', address: '1 Main',
     equipment: [{id: 'e1', type: 'Chlorination', chlorinationChoice: 'Salt Cell'}]},
    {id: 'b', name: 'Bravo Bob', active: true, hasPool: true, technicianId: 't1', day: day, address: '2 Main'}]);
  put('routeOrders', {[day]: {t1: ['a', 'b']}});
  put('fieldRouteOrder', {['date:' + tIso + '|t1']: ['b', 'a']});
  put('scheduledWorkOrders', [{id: 'j1', customerId: 'a', technicianId: 't1', date: tIso, status: 'scheduled', title: 'Replace pump seal',
    lineItems: [{description: 'Replace pump seal', qty: 1}]}]);
  put('workOrders', [{id: 'w1', type: 'Quote', customerId: 'a', number: 12, createdAt: new Date().toISOString(), date: tIso,
    lineItems: [{description: 'New pump', qty: 1, price: 50}], total: 50}]);
`;

(async ()=>{
  const browser = await chromium.launch();
  async function open(file, extraInit){
    const p = await browser.newPage({viewport: {width: /^(app|quote)/.test(file) ? 400 : 1300, height: 900}});
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

  console.log('\n=== App: Reschedule on the Today job drop-down (admin app only) ===');
  const openJob = `
    switchView('home'); selectedHomeDay = DAYS_OF_WEEK[new Date().getDay()];
    try{ adminViewTechId = 't1'; }catch(e){}
    renderHomeList(); await wait(900);
    const jr = document.querySelector('#homeCustomerList .route-job');
    if(jr) jr.click();
    await wait(200);
    const brief = document.querySelector('#homeCustomerList .route-job-brief');
  `;
  await run('app.html', 'Job Reschedule', appFn(openJob + `
    const out = [];
    const btn = brief && btnText(brief, /^Reschedule$/);
    out.push(['an admin’s job drop-down has Reschedule', !!btn]);
    if(!btn) return out;
    out.push(['…in the plain look, like Directions', !btn.style.background && btn.classList.contains('btn-ghost')]);
    btn.click(); await wait(30);
    const w = topWin();
    btnText(w, /^Reschedule$/).click(); await wait(20);
    out.push(['with no date it’s marked in red', !!w.querySelector('#rdjDate.need-it')]);
    const d = new Date(); d.setDate(d.getDate() + 3);
    const later = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    w.querySelector('#rdjDate').value = later; w.querySelector('#rdjTech').value = 't2';
    btnText(w, /^Reschedule$/).click(); await wait(60);
    const all = lsGet('scheduledWorkOrders');
    out.push(['the job itself moves to that day and Ben (no copy)', all.length === 1 && all[0].id === 'j1' && all[0].date === later && all[0].technicianId === 't2', JSON.stringify(all)]);
    out.push(['it’s still a scheduled job', all[0].status === 'scheduled']);
    out.push(['it’s off today’s list', !document.querySelector('#homeCustomerList .route-job')]);
    out.push(['the move is sent to the office', (lsGet('officeWorkToSend') || []).some(x => x.kind === 'work_order' && x.id === 'j1')]);
    return out;
  `));
  await run('app.html', 'Technician job', appFn(`
    switchView('home'); selectedHomeDay = DAYS_OF_WEEK[new Date().getDay()];
    renderHomeList(); await wait(900);
    const jr = document.querySelector('#homeCustomerList .route-job');
    if(jr) jr.click();
    await wait(200);
    const brief = document.querySelector('#homeCustomerList .route-job-brief');
    return [['a technician’s job drop-down opens', !!brief],
            ['…with no Reschedule', !!brief && !btnText(brief, /^Reschedule$/)]];
  `, false));

  console.log('\n=== App: Directions, Share and Reschedule back to their plain look ===');
  await run('app.html', 'Plain buttons', appFn(`
    const out = [];
    switchView('home'); selectedHomeDay = DAYS_OF_WEEK[new Date().getDay()];
    try{ adminViewTechId = 't1'; }catch(e){}
    renderHomeList(); await wait(900);
    const row = Array.from(document.querySelectorAll('#homeCustomerList .cust-row')).find(r => /Alpha/.test(r.textContent));
    row.click(); await wait(200);
    const brief = document.querySelector('#homeCustomerList .route-brief');
    ['Directions', 'Share', 'Reschedule'].forEach(n=>{
      const b = brief && btnText(brief, new RegExp('^' + n + '$'));
      if(b) out.push([n + ' has no dark teal fill', !b.style.background && !/255, 255, 255/.test(b.style.color), b.getAttribute('style')]);
    });
    out.push(['Directions is there to check', !!(brief && btnText(brief, /^Directions$/))]);
    const skip = brief && btnText(brief, /^Skip Service$/);
    out.push(['Skip Service stays red', !!skip && /184, 73, 46/.test(getComputedStyle(skip).backgroundColor)]);
    return out;
  `));

  console.log('\n=== App: the Technicians tab follows Today’s order ===');
  await run('app.html', 'Route order', appFn(`
    const out = [];
    switchView('home'); selectedHomeDay = DAYS_OF_WEEK[new Date().getDay()];
    try{ adminViewTechId = 't1'; }catch(e){}
    renderHomeList(); await wait(900);
    const today = Array.from(document.querySelectorAll('#homeCustomerList .cust-row .cust-name')).map(e => /Alpha/.test(e.textContent) ? 'a' : /Bravo/.test(e.textContent) ? 'b' : '?').filter(x => x !== '?');
    switchView('technicians'); await wait(300);
    openTechRoute({id: 't1', name: 'Amy'}); await wait(200);
    const tab = Array.from(document.querySelectorAll('#techRouteList [data-reorder-key]')).map(r => r.dataset.reorderKey).filter(k => k.indexOf('job:') !== 0);
    out.push(['Today shows its Just today order', today.join() === 'b,a', today.join()]);
    out.push(['the Technicians tab shows the same', tab.join() === today.join(), tab.join() + ' vs ' + today.join()]);
    return out;
  `));

  console.log('\n=== App: the camera’s flip button ===');
  const CAMS = `
    window.__asked = [];
    const fake = ()=>{ const c = document.createElement('canvas'); c.width = 64; c.height = 48; c.getContext('2d').fillRect(0, 0, 64, 48); return c.captureStream(5); };
    Object.defineProperty(navigator, 'mediaDevices', {configurable: true, value: {
      enumerateDevices: async () => [{kind: 'videoinput', label: 'Front ultra wide camera', deviceId: 'front'},
                                     {kind: 'videoinput', label: 'Back camera', deviceId: 'back'}],
      getUserMedia: async c => { window.__asked.push(JSON.parse(JSON.stringify(c))); return fake(); }
    }});
  `;
  await run('app.html', 'Camera flip', appFn(`
    const out = [];
    const got = captureFromCamera(900, 0.5);
    await wait(600);
    const flip = document.querySelector('[data-camflip]');
    out.push(['the camera has a flip button', !!flip && getComputedStyle(flip).display !== 'none']);
    out.push(['it never opens the selfie camera called "ultra wide"', !window.__asked.some(c => c.video && c.video.deviceId && c.video.deviceId.exact === 'front'), JSON.stringify(window.__asked)]);
    out.push(['it opens on the back camera', window.__asked.length > 0 && window.__asked.every(c => !c.video.facingMode || c.video.facingMode === 'environment' || (c.video.facingMode.ideal === 'environment'))]);
    const n = window.__asked.length;
    flip.click(); await wait(400);
    const last = window.__asked[window.__asked.length - 1];
    out.push(['flip asks for the selfie camera', window.__asked.length > n && last.video.facingMode === 'user', JSON.stringify(last)]);
    flip.click(); await wait(400);
    const back = window.__asked[window.__asked.length - 1];
    out.push(['flip again goes back to the back camera', back.video.facingMode === 'environment' || (back.video.deviceId && back.video.deviceId.exact === 'back'), JSON.stringify(back)]);
    document.getElementById('camCancel').click();
    out.push(['Cancel still closes it', (await got) === null && !document.querySelector('[data-camflip]')]);
    return out;
  `), CAMS);

  console.log('\n=== Website: the salt cell clean photo on Photo requirements ===');
  await run('customer-intake.html', 'Salt cell tab', async ()=>{
    const out = [];
    renderPhotoRequirements();
    const rows = Array.from(document.querySelectorAll('#photoRequireRows > div'));
    const salt = rows.find(r => /Salt cell clean photo/.test(r.textContent));
    const gateAt = rows.findIndex(r => /Closed gate photo/.test(r.textContent));
    out.push(['a "Salt cell clean photo" row', !!salt]);
    out.push(['…right under the closed gate photo', rows.indexOf(salt) === gateAt + 1]);
    out.push(['it counts Amy, who has it', salt && /1 technician must/.test(salt.textContent), salt && salt.textContent]);
    photoStepOpen = 'saltcell'; renderPhotoRequirements();
    const open = Array.from(document.querySelectorAll('#photoRequireRows > div')).find(r => /Salt cell clean photo/.test(r.textContent));
    out.push(['it has no Optional button', !btnText(open, /Optional/)]);
    const boxes = Array.from(open.querySelectorAll('[data-tech-list] input[type=checkbox]'));
    out.push(['Everyone, Amy and Ben each have a tick', boxes.length === 3, boxes.length]);
    boxes[2].click(); await wait(20);
    out.push(['ticking Ben requires it of him', technicians.find(t => t.id === 't2').requireSaltCellPhoto === true]);
    boxes[0].click(); await wait(20);
    out.push(['Everyone is kept for the company', photoEveryoneOn('saltcell', 'saltcell') === true]);
    return out;
  });

  console.log('\n=== App: Salt cell cleaned needs a photo ===');
  await run('app.html', 'Salt cell button', appFn(`
    const out = [];
    openVisit('a'); await wait(500);
    const c = customers.find(x => x.id === 'a');
    let shots = 0, give = null;
    window.captureFromCamera = async ()=>{ shots++; return give; };
    await renderPoolServiceChecks(c); await wait(50);
    const btn = () => document.getElementById('chkSaltCell');
    out.push(['the salt cell button is there', !!btn()]);
    btn().click(); await wait(50);
    out.push(['pressing it opens the camera', shots === 1]);
    out.push(['cancelled, it stays off', btn().dataset.on === 'false']);
    give = 'data:image/jpeg;base64,AAAA';
    btn().click(); await wait(50);
    out.push(['with a photo it turns on', btn().dataset.on === 'true']);
    out.push(['…saying the photo is taken', /Photo taken/.test(btn().textContent)]);
    out.push(['the photo is kept with the pool’s photos', customPhotosTakenFor('pool').saltcell === give]);
    btn().click(); await wait(50);
    out.push(['turned off, the photo goes', btn().dataset.on === 'false' && !customPhotosTakenFor('pool').saltcell]);
    out.push(['it’s labelled Salt cell in reports', customPhotoLabelFor('saltcell') === 'Salt cell']);
    // Without the requirement: no camera
    const ts = lsGet('technicians'); ts[0].requireSaltCellPhoto = false; lsSet('technicians', ts);
    shots = 0;
    await renderPoolServiceChecks(c); await wait(50);
    btn().click(); await wait(50);
    out.push(['not required: it just turns on, no camera', btn().dataset.on === 'true' && shots === 0]);
    return out;
  `));

  console.log('\n=== Quote messages: the email’s button ===');
  await run('customer-intake.html', 'Quote email', async ()=>{
    const html = quoteEmailHtml({name: 'Alpha Ann', address: '1 Main'}, 'Quote', 'Oct 22', [{description: 'New pump', qty: 1, price: 50}], 50, '', null,
      'https://x.github.io/Weir/quote-response.html?s=https%3A%2F%2Fabc.supabase.co&t=abc123', 12, 30);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const a = Array.from(doc.querySelectorAll('a')).find(x => /Send a message/.test(x.textContent));
    const look = new DOMParser().parseFromString(quoteHtmlForLook(html), 'text/html');
    const la = Array.from(look.querySelectorAll('a')).find(x => /Send a message/.test(x.textContent));
    return [['the website’s quote email has Send a message', !!a && /[?&]a=message/.test(a.getAttribute('href'))],
            ['in the sent-email window it can’t be pressed', !!la && !la.getAttribute('href')]];
  });
  await run('app.html', 'App quote email', appFn(`
    const html = awcQuoteEmailHtml({name: 'Alpha Ann', address: '1 Main'}, 'Quote', 'Oct 22', [{description: 'New pump', qty: 1, price: 50}], 50, '', null,
      'https://x.github.io/Weir/quote-response.html?s=https%3A%2F%2Fabc.supabase.co&t=abc123', 12, 30);
    return [['the app’s quote email has Send a message', /a=message/.test(html) && /Send a message/.test(html)]];
  `));

  console.log('\n=== Quote messages: the page the customer writes on ===');
  const FETCH = `
    window.__sent = [];
    window.fetch = async (u, o) => { const b = JSON.parse(o.body); window.__sent.push({u: u, b: b});
      return {json: async () => b.m ? {state: 'sent', company: 'Triffic Pool and Spa', number: '0012'} : {state: 'message', company: 'Triffic Pool and Spa', number: '0012'}}; };
  `;
  {
    const p = await browser.newPage({viewport: {width: 400, height: 800}});
    const errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.addInitScript(FETCH);
    await p.goto(ROOT + 'quote-response.html?s=' + encodeURIComponent('https://abc.supabase.co') + '&t=tok1&a=message');
    await p.waitForTimeout(600);
    const r = await p.evaluate(async ()=>{
      const out = [];
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const box = document.querySelector('.msg-box');
      out.push(['a message box to write in', !!box]);
      out.push(['it names the quote and the company', /quote #0012 from Triffic Pool and Spa/.test(document.getElementById('text').textContent), document.getElementById('text').textContent]);
      out.push(['nothing was answered by opening it', window.__sent.every(x => !x.b.a || x.b.a === 'message') && window.__sent.every(x => !x.b.m)]);
      out.push(['the box can be typed in (a text cursor)', getComputedStyle(box).caretColor !== 'transparent' && getComputedStyle(box).userSelect !== 'none']);
      document.querySelector('.msg-send').click(); await wait(50);
      out.push(['Send with nothing written asks for a message', getComputedStyle(document.querySelector('.msg-need')).display === 'block' && window.__sent.length === 1]);
      box.value = 'Can you come Tuesday instead?'; box.dispatchEvent(new Event('input'));
      document.querySelector('.msg-send').click(); await wait(100);
      const last = window.__sent[window.__sent.length - 1];
      out.push(['it sends the message with the quote’s code', last && last.b.t === 'tok1' && last.b.a === 'message' && last.b.m === 'Can you come Tuesday instead?', JSON.stringify(last)]);
      out.push(['…to the server’s quote-response function', last && last.u === 'https://abc.supabase.co/functions/v1/quote-response']);
      out.push(['then thanks them', document.getElementById('title').textContent === 'Message sent']);
      return out;
    });
    r.forEach(([n, ok, info]) => check(n, ok, info));
    check('Message page: no page errors', errs.length === 0, errs.join(' | '));
    await p.close();
  }

  console.log('\n=== Quote messages: on the website ===');
  await run('customer-intake.html', 'Website messages', async ()=>{
    const out = [];
    const at = new Date().toISOString();
    sbFetch = async url => /messages=neq/.test(url)
      ? {ok: true, body: [{quote_id: 'w1', messages: [{at: at, text: 'Can you come Tuesday instead?'}]}]}
      : {ok: true, body: []};
    await takeQuoteAnswers(); await wait(20);
    const w = workOrders.find(x => x.id === 'w1');
    out.push(['the message is picked up onto the quote', (w.customerMessages || []).length === 1 && w.customerMessages[0].text === 'Can you come Tuesday instead?']);
    out.push(['…and saved', ((lsGet('workOrders') || []).find(x => x.id === 'w1').customerMessages || []).length === 1]);
    const a = collectAlerts().find(x => x.id === 'qmsg:w1:' + at);
    out.push(['it’s an alert that opens the quote', !!a && a.jobKey === 'q:w1' && /Tuesday/.test(a.notes)]);
    switchView('customers'); viewCustomer(customers.find(c => c.id === 'a'));
    document.querySelector('#profileTabControl .history-type-btn[data-tab="workorders"]').click(); await wait(100);
    qoOpenId = 'q:w1'; renderCustomerWorkOrders('a'); await wait(50);
    const list = document.getElementById('custWorkOrderList');
    out.push(['the quote in the Jobs tab shows the message', /Can you come Tuesday instead\?/.test(list.textContent) && /Message from the customer/.test(list.textContent)]);
    const reply = Array.from(list.querySelectorAll('a')).find(x => /Reply by email/.test(x.textContent));
    out.push(['with Reply by email to the customer', !!reply && /^mailto:a@x\.com\?subject=Re%3A%20Quote%20%230012/.test(reply.getAttribute('href')), reply && reply.getAttribute('href')]);
    // Again with nothing new: nothing changes
    const before = JSON.stringify(workOrders);
    await takeQuoteAnswers();
    out.push(['the same messages again change nothing', JSON.stringify(workOrders) === before]);
    switchView('workcenter'); applyWorkCenterMode('quotes'); await wait(50);
    try{ wcView = 'current'; }catch(e){}
    renderCurrentList('Quote'); await wait(30);
    const pill = Array.from(document.querySelectorAll('#wcCurrentList button')).find(b => /1 message/.test(b.textContent));
    out.push(['WorkCenter’s Current quotes show "1 message"', !!pill]);
    return out;
  });

  console.log('\n=== App: Customize email buttons, and Clear asks first ===');
  await run('app.html', 'Customize email', appFn(`
    const out = [];
    renderAppWorkCenter(); await wait(150);
    awcCustomizeQuoteEmail(); await wait(30);
    const w = topWin();
    const b = re => btnText(w, re);
    const save = b(/^Save$/), cancel = b(/^Cancel$/), prev = b(/^Preview$/), reset = b(/^Reset to default$/);
    out.push(['Save and Cancel sit side by side', save && cancel && save.parentElement === cancel.parentElement && Math.abs(save.getBoundingClientRect().top - cancel.getBoundingClientRect().top) < 2]);
    const wd = el => Math.round(el.getBoundingClientRect().width);
    out.push(['…the same width as Preview and Reset to default', save && Math.abs(wd(save) - wd(prev)) <= 1 && Math.abs(wd(cancel) - wd(reset)) <= 1, [wd(save), wd(cancel), wd(prev), wd(reset)].join()]);
    cancel.click(); await wait(30);
    out.push(['Cancel still closes it', !document.querySelector('.confirm-overlay')]);
    document.getElementById('awcQuoteName').value = 'Pump job';
    document.getElementById('awcQuoteClear').click(); await wait(50);
    const ask = topWin();
    out.push(['Clear asks if you’re sure', !!ask && /Are you sure you want to clear/.test(ask.textContent)]);
    out.push(['…and nothing is cleared yet', document.getElementById('awcQuoteName').value === 'Pump job']);
    btnText(ask, /^Clear$/).click(); await wait(80);
    out.push(['saying yes clears it', document.getElementById('awcQuoteName').value === '']);
    return out;
  `));

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
