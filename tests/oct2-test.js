// Checks for everything built on Oct 2, 2026 (in-progress.md 1fj–1hf), in a
// real browser (Chromium through Playwright), app and website. Run from the
// main folder: node tests/oct2-test.js
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

(async ()=>{
  const browser = await chromium.launch();
  async function page(file, width){
    const p = await browser.newPage({viewport: {width: width || (file === 'app.html' ? 400 : 1300), height: 900}});
    p.__errors = [];
    p.on('pageerror', e => p.__errors.push(String(e)));
    await p.goto(ROOT + file);
    await p.waitForTimeout(1500);
    return p;
  }
  // Helpers put on every page
  const HELPERS = `
    window.wait = ms => new Promise(r => setTimeout(r, ms));
    window.day = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
    // The app ignores a tap within 0.4 s of a screen change: tests reset that first
    window.clickOutside = el => { try{ viewChangedAt = 0; }catch(e){} const o = {bubbles:true, cancelable:true, clientX:3, clientY:3};
      el.dispatchEvent(new MouseEvent('mousedown', o)); el.dispatchEvent(new MouseEvent('click', o)); };
    window.label = b => (b.textContent || '').trim() || b.title || b.getAttribute('aria-label') || '';
    // The window on top: the last one showing (some pages keep hidden windows built in)
    window.topWin = () => Array.from(document.querySelectorAll('.confirm-overlay')).filter(o => getComputedStyle(o).display !== 'none').pop() || null;
  `;
  async function run(file, name, fn){
    const p = await page(file);
    await p.evaluate(HELPERS);
    let r;
    try{ r = await p.evaluate(fn); }
    catch(e){ check(name + ' (ran)', false, String(e).slice(0, 200)); await p.close(); return; }
    (r || []).forEach(([n, ok, info]) => check(n, ok, info));
    check(name + ': no page errors', p.__errors.length === 0, p.__errors.join(' | ').slice(0, 300));
    await p.close();
  }

  console.log('\n=== App ===');
  await run('app.html', 'App WorkCenter and settings', async ()=>{
    const out = [];
    lsSet('technicians', [{id:'t1', name:'Mike'}]);
    customers.push({id:'c1', name:'Jordan Ellis', active:true});
    // 1fj: no microphone on Access notes
    out.push(['Access notes has no microphone', !document.getElementById('ncAccessNotes').closest('.note-mic-wrap')]);
    // 1fk: Customers / WorkCenter
    document.getElementById('view-customers').classList.add('active');
    out.push(['Customer tab has Customers and WorkCenter buttons', !!document.getElementById('btnCustPaneList') && !!document.getElementById('btnCustPaneWork')]);
    showCustomerPane('work');
    out.push(['WorkCenter shows Work Order and Task only', Array.from(document.querySelectorAll('#awcKindRow [data-kind]')).map(b => b.dataset.kind).join() === 'Work Order,Task']);
    // 1fp: the number on the Scheduled date line
    const num = document.getElementById('awcWoNumber');
    out.push(['work order number sits on the Scheduled date line', !!num && /Scheduled date/.test(num.parentElement.textContent)]);
    // 1he: Repeat choices as a task's; 1hc: Until
    out.push(['work order Repeat matches a task\u2019s', Array.from(document.getElementById('awcWoRepeat').options).map(o => o.textContent).join('|') === 'Just once|Every week|Every 2 weeks|Every 3 weeks|Every 4 weeks|Every\u2026 (choose)']);
    awcWoCustomers = ['c1']; awcWoTechs = ['t1']; awcLineItems = [{description:'Gauge', qty:1, price:50}];
    document.getElementById('awcWoDate').value = day(0);
    const rep = document.getElementById('awcWoRepeat'); rep.value = 'triweekly'; rep.dispatchEvent(new Event('change'));
    out.push(['Until shows for a repeating work order', document.getElementById('awcWoUntilWrap').style.display === 'block']);
    document.getElementById('awcWoUntil').value = day(63);
    document.getElementById('awcFinalize').click(); await wait(150);
    const jobs = lsGet('scheduledWorkOrders') || [];
    out.push(['Finalize: every 3 weeks up to Until \u2192 4 visits', jobs.length === 4, jobs.map(j => j.date).join()]);
    out.push(['made on the phone, queued for the office', (lsGet('officeWorkToSend') || []).filter(x => x.kind === 'work_order' && !x.del).length === 4]);
    out.push(['work order counter goes up with the setup queued', !!(lsGet('setupToSend') || {}).workOrderCounter]);
    // 1ge: task Every… in days
    awcKind = 'Task'; awcView = 'main'; awcApply();
    document.getElementById('awcTaskTitle').value = 'Latch'; awcTaskTechs = ['t1'];
    document.getElementById('awcTaskDate').value = day(0);
    const tr = document.getElementById('awcTaskRepeat'); tr.value = 'custom'; tr.dispatchEvent(new Event('change'));
    document.getElementById('awcTaskUnit').value = 'days'; document.getElementById('awcTaskWeeks').value = '3';
    document.getElementById('awcTaskUntil').value = day(9);
    document.getElementById('awcAddTask').click(); await wait(150);
    const tasksNow = (lsGet('tasks') || []).filter(t => t.title === 'Latch');
    out.push(['task every 3 days up to Until \u2192 4 dates, 3 days apart', tasksNow.length === 4 && tasksNow[0].everyDays === 3, tasksNow.map(t => t.date).join()]);
    // 1gq: Saved tasks has square bins
    lsSet('taskTemplates', [{id:'tt1', name:'Gate latch', title:'Check gate latch', details:''}]);
    awcOpenTemplates(); await wait(100);
    const tplBin = document.querySelector('.confirm-overlay [data-list] button svg.weir-bin');
    const tb = tplBin && tplBin.closest('button').getBoundingClientRect();
    out.push(['Saved tasks: a square bin per row', !!tb && Math.round(tb.width) === 33 && Math.round(tb.height) === 33]);
    clickOutside(topWin()); await wait(80);
    out.push(['a click outside closes the Saved tasks window', !topWin()]);
    // 1gf / 1gy: Current groups repeats; singles don't open; repeats open their window
    awcKind = 'Task'; awcView = 'current'; awcApply(); await wait(60);
    const rows = Array.from(document.querySelectorAll('#awcCurList .awc-row'));
    const repRow = rows.find(r => /left/.test(r.textContent));
    out.push(['a repeating task is one row in Current', rows.length === 1 && !!repRow, rows.length]);
    out.push(['a repeat\u2019s row has Edit and one bin, and no Mark completed', repRow && Array.from(repRow.querySelectorAll('button')).map(label).join() === 'Edit,Remove all 4']);
    repRow.click(); await wait(100);
    const win = topWin();
    out.push(['pressing it opens its window of dates', !!win && win.querySelectorAll('[data-dates] > div').length === 4]);
    out.push(['each date has a square bin', !!win && win.querySelectorAll('[data-dates] svg.weir-bin').length === 4]);
    win.querySelector('[data-dates] > div button').click(); await wait(100);   // Mark completed
    out.push(['Mark completed in the window sends that date to History', (lsGet('tasks') || []).filter(t => t.title === 'Latch' && t.done).length === 1]);
    clickOutside(win); await wait(80);
    out.push(['a click outside closes the repeat window', !topWin()]);
    // 1hd: History groups the repeat
    awcView = 'history'; awcApply(); await wait(60);
    out.push(['History shows a repeat as one row', document.querySelectorAll('#awcHistList .awc-row').length === 1]);
    // 1gi / 1gu: back on Customers after 30 seconds away, including away from the app
    switchView('customers'); showCustomerPane('work');
    tabHiddenAt = Date.now() - 40000; viewEnteredAt = Date.now() - 60000;
    switchView('home'); switchView('customers');
    out.push(['after 30 seconds away from the app, the Customer tab is back on Customers', document.getElementById('custPaneWork').style.display === 'none']);
    // 1fw / 1fx / 1gh / 1gg / 1gt: Settings
    const opts = Array.from(document.getElementById('view-options').querySelectorAll('h2')).map(h => h.textContent.trim());
    out.push(['no "Field app" label in Settings', !/Field app/.test(document.getElementById('view-options').textContent)]);
    out.push(['Voice entry button is right under Left-handed mode', opts.indexOf('Voice entry button') === opts.indexOf('Left-handed mode') + 1, opts.join('|')]);
    out.push(['Quick buttons switch in Settings', opts.indexOf('Quick buttons') !== -1]);
    out.push(['Service history table, with its one-line description', opts.indexOf('Service history table') !== -1
      && /Shows the last 3 months of readings at the top of each visit\./.test(document.getElementById('recentReadingsCard').textContent)]);
    out.push(['Show chemicals added too starts on', appSettings.showRecentDosages !== false]);
    const rr = document.getElementById('settingRecentReadings'); rr.checked = false; rr.dispatchEvent(new Event('change'));
    out.push(['turning Service history table off turns chemicals added off', document.getElementById('settingRecentDosages').checked === false && appSettings.showRecentDosages === false]);
    rr.checked = true; rr.dispatchEvent(new Event('change'));
    out.push(['and on turns it on', document.getElementById('settingRecentDosages').checked === true]);
    // 1fv: Backup & restore above Office sync
    const ids = Array.from(document.getElementById('view-options').children).map(c => c.id);
    out.push(['Backup & restore is above Office sync', ids.indexOf('backupRestoreCard') < ids.indexOf('syncCard')]);
    // 1hf: an are-you-sure window answers no to a click outside
    const ask = confirmDialog('Sure?', 'Delete'); await wait(60);
    clickOutside(topWin());
    out.push(['an "are you sure" window answers no to a click outside', (await ask) === false]);
    return out;
  });

  await run('app.html', 'App note microphone and bins', async ()=>{
    const out = [];
    // 1gr: spoken notes tidied
    const ta = {value:'', dataset:{}, dispatchEvent(){}};
    noteMicAdd(ta, 'the pump is making noise');
    noteMicAdd(ta, 'i checked the filter comma it looks fine period customer asked about salt question mark');
    out.push(['spoken notes: capitals, full stops and said punctuation', ta.value === 'The pump is making noise. I checked the filter, it looks fine. Customer asked about salt?', ta.value]);
    const t2 = {value:'', dataset:{}, dispatchEvent(){}};
    noteMicAdd(t2, 'the pump is'); noteMicAdd(t2, 'loud', true);
    out.push(['spoken notes: a sentence carried on after a pause has no stop in the middle', t2.value === 'The pump is loud.', t2.value]);
    // 1fm: (Max 3)
    out.push(['photo buttons say (Max 3)', /\(Max 3\)/.test(document.getElementById('btnTakePhoto').textContent), document.getElementById('btnTakePhoto').textContent]);
    // 1fz / 1gn: a red × on a page is a pale red square bin
    const b = document.createElement('button'); b.className = 'btn btn-ghost fountain-remove'; b.textContent = '\u00d7';
    document.getElementById('view-home').appendChild(b); await wait(400);   // buttons fade their colour in
    const cs = getComputedStyle(b);
    out.push(['a red \u00d7 on a page becomes the 33px pale red bin', b.dataset.xDrawn === 'bin' && cs.width === '33px' && cs.height === '33px' && cs.backgroundColor === 'rgb(251, 227, 220)', cs.width + ' ' + cs.backgroundColor]);
    // 1ga: a Delete button on a page is a bin, its words kept as the tooltip
    const del = document.createElement('button'); del.className = 'btn btn-ghost'; del.textContent = 'Delete this report';
    document.getElementById('view-home').appendChild(del); await wait(50);
    out.push(['a Delete button on a page becomes a bin, words as tooltip', del.dataset.xDrawn === 'bin' && del.title === 'Delete this report']);
    // 1gm: inside a window, words and a plain ×
    const ask = confirmDialog('Sure?', 'Delete'); await wait(60);
    const ok = document.getElementById('confirmOk');
    out.push(['an "are you sure" window keeps the word Delete', ok.textContent.trim() === 'Delete' && ok.dataset.xDrawn !== 'bin']);
    ok.click(); await ask;
    // 1fw: Quick buttons off on this phone hides them
    appSettings.quickButtonsHere = false;
    out.push(['Quick buttons switch is this phone\u2019s own (kept when the phone is cleared)', FIELD_DEVICE_SETTINGS.indexOf('quickButtonsHere') !== -1]);
    // 1fl: In history unticked leaves the table
    out.push(['the history table skips readings unticked In history', /chemList = chemList\.filter\(ch => ch && ch\.noHistory !== true\)/.test(renderRecentReadings.toString())]);
    // 1gc: the heads-up route is the one Today shows
    out.push(['automatic On my way uses the stops Today shows', /!viewing \|\| c\.technicianId === viewing/.test(routeOrderToday.toString())]);
    // 1hb: equipment from another device shows on the open customer
    customers.push({id:'c9', name:'Eq', active:true, equipmentTypeOptions:['Filter'], equipment:[]});
    currentVisitCustomerId = 'c9'; currentEquipmentTypeOptions = ['Filter'];
    customers.find(c => c.id === 'c9').equipmentTypeOptions = ['Filter', 'Booster Pump'];
    refreshOpenEquipment();
    out.push(['equipment that arrives by sync shows on the open customer', currentEquipmentTypeOptions.join() === 'Filter,Booster Pump']);
    return out;
  });

  console.log('\n=== Website ===');
  await run('customer-intake.html', 'Website WorkCenter, Alerts and settings', async ()=>{
    const out = [];
    technicians.push({id:'t1', name:'Mike'}, {id:'t2', name:'Ana Longername'}); saveTechnicians();
    customers.push({id:'c1', name:'Jordan Ellis', address:'1 Old St', city:'Buckeye', state:'AZ', zip:'85326', active:true, dogs:[], equipmentTypeOptions:['Filter','Pump'], equipment:[]});
    saveCustomers();
    // 1fn: Alerts one above Settings
    const tabs = Array.from(document.querySelectorAll('nav .tab')).map(t => t.dataset.view);
    out.push(['Alerts sits one above Settings', tabs.indexOf('alerts') === tabs.indexOf('settings') - 1]);
    lsSet('readings:c1', [{id:'r1', date:new Date().toISOString(), notes:'Pump is loud', video:'idb:v1', technicianId:'t1'}]);
    const al = collectAlerts();
    out.push(['a visit note and a video both become alerts', al.some(a => a.kind === 'note') && al.some(a => a.kind === 'video')]);
    out.push(['an alert says which technician sent it', al.every(a => a.tech === 'Mike')]);
    switchView('alerts'); await wait(50);
    const box = document.getElementById('alertsList'); const shape = box.dataset.shape;
    renderAlerts();
    out.push(['Alerts only redraws when something changed', box.dataset.shape === shape && box.children.length > 0]);
    // Oct 3: pressing the row opens its report and marks it seen (no Mark seen button)
    document.querySelector('#alertsList .alert-row').click(); await wait(50);
    out.push(['Mark seen is kept on this computer', Object.keys(alertsSeen()).length === 1]);
    // 1hc / 1he: work order Repeat as a task's, with Until
    switchView('workcenter'); document.getElementById('wcType').value = 'Work Order'; wcView = 'main'; applyWorkOrderType(); await wait(80);
    out.push(['work order Repeat matches a task\u2019s', Array.from(document.getElementById('wcRepeat').options).map(o => o.textContent).join('|') === 'Just once|Every week|Every 2 weeks|Every 3 weeks|Every 4 weeks|Every\u2026 (choose)']);
    wcSelectedCustomerIds = ['c1']; currentLineItems = [{description:'Gauge', qty:1, price:50}];
    document.getElementById('wcDate').value = day(0); setPickedTechIds(document.getElementById('wcTechnician'), ['t1', 't2']);
    const rep = document.getElementById('wcRepeat'); rep.value = 'weekly'; rep.dispatchEvent(new Event('change'));
    document.getElementById('wcRepeatUntil').value = day(21);
    document.getElementById('btnSendWorkOrder').click(); await wait(150);
    const jobs = lsGet('scheduledWorkOrders') || [];
    out.push(['weekly to Until 3 weeks on, two technicians \u2192 8 visits', jobs.length === 8, jobs.length]);
    // 1fp: numbering counts the visits on the routes
    out.push(['the next number counts work orders on the routes', nextWorkOrderNumber() > Math.max(...jobs.map(j => j.workOrderNumber || 0))]);
    // 1gf / 1gy / 1gx: Current
    wcView = 'current'; applyWorkOrderType(); await wait(80);
    const rows = Array.from(document.querySelectorAll('#wcCurrentList .wc-row'));
    out.push(['two technicians\u2019 repeats are one row', rows.length === 1 && /2 technicians/.test(rows[0].textContent), rows.length]);
    await wait(400);   // buttons fade their colour in
    const rowBin = rows[0].querySelector('button svg.weir-bin');
    out.push(['the row\u2019s bin is full size', !!rowBin && getComputedStyle(rowBin.closest('button')).width === '33px']);
    rows[0].click(); await wait(120);
    const tw = topWin();
    out.push(['it opens a window of the technicians, not the form', !!tw && tw.querySelectorAll('[data-list] > div').length === 2 && wcView === 'current']);
    tw.querySelector('[data-list] > div').click(); await wait(120);
    const dw = topWin();
    out.push(['a technician opens their own dates on top', !!dw && dw !== tw && dw.querySelectorAll('[data-dates] > div').length === 4]);
    clickOutside(dw); await wait(60);
    // the bin on one technician's leaves the other's
    const realConfirm = window.confirmDialog;
    window.confirmDialog = ()=> Promise.resolve(true);
    topWin().querySelector('[data-list] > div button svg.weir-bin').closest('button').click(); await wait(150);
    window.confirmDialog = realConfirm;
    clickOutside(topWin()); await wait(60);
    out.push(['Remove all on one technician leaves the other\u2019s', (lsGet('scheduledWorkOrders') || []).length === 4]);
    // 1hd: History groups
    tasks = [1, 2, 3].map(i => ({id:'h' + i, title:'Latch', technicianId:'t1', date:day(-i * 7), customerIds:[], seriesId:'S9', done:true, doneAt:new Date(Date.now() - i * 864e5).toISOString(), doneBy:'t1'}));
    saveTasks();
    document.getElementById('wcType').value = 'Task'; wcView = 'history'; applyWorkOrderType(); await wait(80);
    const hrows = document.querySelectorAll('#wcSubmittedList .wc-row');
    out.push(['History shows a repeat as one row, "3 completed"', hrows.length === 1 && /3 completed/.test(hrows[0].textContent)]);
    // 1fu / 1fy / 1gt: Settings
    const vis = Array.from(document.querySelectorAll('#view-settings > .card')).filter(c => c.style.display !== 'none').map(c => (c.querySelector('h2') || {}).textContent);
    out.push(['Settings starts Settings, Backup & restore, Customer sync', vis.slice(0, 3).join('|') === 'Settings|Backup & restore|Customer sync', vis.join('|')]);
    out.push(['Storage, water sizes, Keep photos, Voice entry and Quick buttons are hidden', ['Storage','Show water body sizes','Keep photos on this device','Voice entry button','Quick buttons'].every(h => vis.indexOf(h) === -1)]);
    out.push(['no "Field app" label', !/>Field app</.test(document.getElementById('view-settings').innerHTML)]);
    out.push(['Service history table with its one-line description', /Service history table/.test(document.getElementById('view-settings').textContent) && /Shows the last 3 months of readings at the top of each visit\./.test(document.getElementById('view-settings').textContent)]);
    // 1hf: a click outside a window closes it
    const ask = confirmDialog('Sure?', 'Delete'); await wait(60);
    clickOutside(topWin());
    out.push(['an "are you sure" window answers no to a click outside', (await ask) === false]);
    return out;
  });

  await run('customer-intake.html', 'Website profiles, equipment and technicians', async ()=>{
    const out = [];
    technicians.push({id:'t1', name:'Mike', phone:'', email:''}, {id:'t2', name:'Ana Longername'}); saveTechnicians();
    customers.push({id:'c1', name:'Jordan Ellis', address:'1 Old St', city:'Buckeye', state:'AZ', zip:'85326', active:true, dogs:[], equipmentTypeOptions:['Filter','Pump'], equipment:[], technicianId:'t2'},
                   {id:'c2', name:'Maria Lopez', active:true, technicianId:'t1'});
    saveCustomers();
    const rowOf = label => Array.from(document.querySelectorAll('#profileMeta .profile-meta-row')).find(r => (r.querySelector('.profile-meta-label') || {}).textContent === label);
    // 1ha: fields save when left
    viewCustomer(customers.find(c => c.id === 'c1')); await wait(150);
    const addr = rowOf('Address'); addr.click(); await wait(100);
    addr.querySelector('input').value = '22 New Rd';
    switchView('technicians'); await wait(150);
    out.push(['Address saves on leaving without Done', customers.find(c => c.id === 'c1').address === '22 New Rd']);
    // 1hb: equipment from another device shows on the open profile
    viewCustomer(customers.find(c => c.id === 'c1')); await wait(150);
    const list = JSON.parse(JSON.stringify(customers)); list.find(c => c.id === 'c1').equipmentTypeOptions = ['Filter','Pump','Booster Pump'];
    syncShowList(list); await wait(60);
    out.push(['equipment that arrives by sync shows on the open profile', currentEquipmentTypeOptions.join() === 'Filter,Pump,Booster Pump']);
    persistCurrentEquipmentTypeOptions();
    out.push(['and a change afterwards keeps it', customers.find(c => c.id === 'c1').equipmentTypeOptions.length === 3]);
    // 1gj: automatic On my way saves at once
    // 1go / 1gb / 1gd / 1gz: the Add equipment window
    editingId = 'c1';
    let p = openAddToCustomersModal(''); await wait(80);
    const w = topWin();
    out.push(['Add equipment: name box at the top', !!w.querySelector('#addEqName')]);
    w.querySelector('#addEqOne').click(); await wait(40);
    out.push(['no name: "Name the equipment first"', w.querySelector('#addEqNameErr').style.display === 'block' && !!topWin()]);
    w.querySelector('#addEqName').value = 'Booster Pump';
    w.querySelector('#addEqBtnAdd').click(); await wait(30);
    w.querySelector('#addEqBtnRows input').value = 'Polaris'; w.querySelector('#addEqBtnRows input').dispatchEvent(new Event('input'));
    w.querySelector('#addEqPick').click(); await wait(40);
    const wd = id => Math.round(w.querySelector(id).getBoundingClientRect().width);
    out.push(['Add to multiple: search half the row, Select all and Back a quarter each', Math.abs(wd('#addEqSearch') - 2 * wd('#addEqAll')) <= 2 && wd('#addEqAll') === wd('#addEqBack'), wd('#addEqSearch') + '/' + wd('#addEqAll') + '/' + wd('#addEqBack')]);
    w.querySelector('#addEqBack').click(); await wait(30);
    out.push(['Back returns to Just this customer / Add to multiple', w.querySelector('#addEqPickArea').style.display === 'none' && w.querySelector('#addEqOne').style.display === '']);
    w.querySelector('#addEqOne').click();
    const picked = await p;
    out.push(['Just this customer gives the name', picked && picked.name === 'Booster Pump' && picked.ids.length === 0]);
    out.push(['quick buttons typed in the window are kept for that equipment', customEquipmentOptions('Booster Pump').join() === 'Polaris']);
    out.push(['equipment quick buttons sync between office computers', SYNC_SETUP_KEYS.indexOf('equipmentChoices') !== -1]);
    p = openAddToCustomersModal('X'); await wait(60);
    document.querySelector('.confirm-overlay #addEqCancel').click();
    out.push(['Cancel adds nothing', (await p) === null]);
    // 1fq: a new technician starts with the pool after photo
    document.getElementById('btnAddTech') && (window.__techSrc = String(document.getElementById('btnSaveTech').onclick));
    out.push(['a new technician starts with the after photo Pool tick', /photoRules: \{after: \{pool: true\}\}/.test(document.documentElement.innerHTML)]);
    // 1fo: Currently tags one width; Edit customers closes on a click outside
    openTechDetail(technicians.find(t => t.id === 't1')); await wait(120);
    openAssignOverlay(); await wait(120);
    const tagsW = Array.from(document.querySelectorAll('#techAssignList div')).filter(d => /^Currently /.test(d.textContent) && d.children.length === 0).map(d => Math.round(d.getBoundingClientRect().width));
    out.push(['"Currently" tags are all one width', tagsW.length >= 1 && tagsW.every(x => x === tagsW[0]), tagsW.join()]);
    const ov = document.getElementById('techAssignOverlay');
    ov.dispatchEvent(new MouseEvent('mousedown', {bubbles:true})); ov.dispatchEvent(new MouseEvent('click', {bubbles:true})); await wait(60);
    out.push(['Edit customers closes on a click outside', ov.style.display === 'none']);
    // 1ha: a technician field saves when left
    const prow = Array.from(document.querySelectorAll('#techProfileMeta .profile-meta-row')).find(r => (r.querySelector('.profile-meta-label') || {}).textContent === 'Phone');
    prow.click(); await wait(80);
    const pin = prow.querySelector('input'); pin.focus(); pin.value = '(623) 555-0142';
    switchView('customers'); await wait(120);
    out.push(['a technician\u2019s phone saves on leaving', technicians.find(t => t.id === 't1').phone === '(623) 555-0142']);
    // 1fl / 1ft: Readings and Dosages rows
    switchView('chemconfig'); await wait(150);
    const chemRows = Array.from(document.querySelectorAll('#chemConfigChemicalsList .fountain-row'));
    const doseRows = Array.from(document.querySelectorAll('#chemConfigDosagesList .fountain-row'));
    const histX = r => { const l = Array.from(r.querySelectorAll('label')).find(x => /In history/.test(x.textContent)); return l ? Math.round(l.getBoundingClientRect().left) : -1; };
    const xs = chemRows.concat(doseRows).map(histX);
    out.push(['every reading and dosage has an In history tick', xs.length > 0 && xs.every(x => x > 0)]);
    out.push(['the In history ticks line up in one column', xs.every(x => x === xs[0]), xs.join()]);
    const rulesW = chemRows.map(r => Array.from(r.querySelectorAll('button')).find(b => /Dosage rules/.test(b.textContent))).filter(Boolean).map(b => Math.round(b.getBoundingClientRect().width));
    out.push(['Dosage rules buttons are all one width', rulesW.every(x => x === rulesW[0]), rulesW.join()]);
    return out;
  });

  await run('customer-intake.html', 'Website Edit from Current', async ()=>{
    const out = [];
    technicians.push({id:'t1', name:'Mike'}, {id:'t2', name:'Ana'}); saveTechnicians();
    customers.push({id:'c1', name:'Jordan', active:true}); saveCustomers();
    switchView('workcenter'); document.getElementById('wcType').value = 'Work Order'; wcView = 'main'; applyWorkOrderType(); await wait(80);
    wcSelectedCustomerIds = ['c1']; currentLineItems = [{description:'Gauge', qty:1, price:50}];
    document.getElementById('wcDate').value = day(0); setPickedTechIds(document.getElementById('wcTechnician'), ['t1', 't2']);
    const rep = document.getElementById('wcRepeat'); rep.value = 'weekly'; rep.dispatchEvent(new Event('change'));
    document.getElementById('wcRepeatUntil').value = day(14);
    document.getElementById('btnSendWorkOrder').click(); await wait(150);
    wcView = 'current'; applyWorkOrderType(); await wait(80);
    document.querySelector('#wcCurrentList .wc-row').click(); await wait(150);
    const mike = Array.from(topWin().querySelectorAll('[data-list] > div')).find(r => /Mike/.test(r.textContent));
    Array.from(mike.querySelectorAll('button')).find(b => b.textContent.trim() === 'Edit').click(); await wait(300);
    out.push(['Edit opens it for that technician only', pickedTechIds(document.getElementById('wcTechnician')).join() === 't1']);
    currentLineItems[0].price = 80;
    document.getElementById('btnSendWorkOrder').click(); await wait(200);
    const jobs = lsGet('scheduledWorkOrders');
    out.push(['saving changes it in place: no new work order, same number', jobs.length === 6 && new Set(jobs.map(j => j.workOrderId)).size === 1 && new Set(jobs.map(j => j.workOrderNumber)).size === 1]);
    out.push(['only that technician\u2019s visits change', jobs.filter(j => j.technicianId === 't1').every(j => j.lineItems[0].price === 80) && jobs.filter(j => j.technicianId === 't2').every(j => j.lineItems[0].price === 50)]);
    out.push(['the other technician stays on the work order', (workOrders.find(w => w.type === 'Work Order').technicianIds || []).join() === 't1,t2']);
    out.push(['saving goes back to Current', wcView === 'current']);
    tasks = [0, 7].map((n, i) => ({id:'k' + i, title:'Latch', technicianId:'t1', date:day(n), customerIds:[], everyDays:7, seriesId:'S1', done:false})); saveTasks();
    document.getElementById('wcType').value = 'Task'; wcView = 'current'; applyWorkOrderType(); await wait(80);
    const trow = document.querySelector('#wcCurrentList .wc-row');
    const tedit = Array.from(trow.querySelectorAll('button')).find(b => b.textContent.trim() === 'Edit');
    out.push(['tasks in Current have Edit too', !!tedit]);
    tedit.click(); await wait(200);
    document.getElementById('taskTitle').value = 'Check latch';
    document.getElementById('btnSaveTask').click(); await wait(200);
    out.push(['editing a task changes its dates in place', tasks.filter(t => !t.done).map(t => t.title).join() === 'Check latch,Check latch']);
    return out;
  });

  for(const file of ['customer-intake.html', 'app.html']){
    await run(file, (file === 'app.html' ? 'App' : 'Website') + ' several technicians on one', async ()=>{
      const out = [];
      const app = typeof awcApply === 'function';
      const wins = () => Array.from(document.querySelectorAll('.confirm-overlay')).filter(o => getComputedStyle(o).display !== 'none');
      const P = app ? 'App: ' : 'Website: ';
      customers.push({id:'c1', name:'Jordan', active:true});
      if(app){
        lsSet('technicians', [{id:'t1', name:'Mike'}, {id:'t2', name:'Ana'}]);
        document.getElementById('view-customers').classList.add('active'); showCustomerPane('work');
        awcKind = 'Work Order'; awcView = 'main'; awcApply();
        awcWoCustomers = ['c1']; awcWoTechs = ['t1', 't2']; awcLineItems = [{description:'Gauge', qty:1, price:50}];
        document.getElementById('awcWoDate').value = day(0);
        const rep = document.getElementById('awcWoRepeat'); rep.value = 'weekly'; rep.dispatchEvent(new Event('change'));
        document.getElementById('awcWoUntil').value = day(14);
        document.getElementById('awcFinalize').click(); await wait(150);
        awcView = 'current'; awcApply(); await wait(80);
      } else {
        technicians.push({id:'t1', name:'Mike'}, {id:'t2', name:'Ana'}); saveTechnicians(); saveCustomers();
        switchView('workcenter'); document.getElementById('wcType').value = 'Work Order'; wcView = 'main'; applyWorkOrderType(); await wait(80);
        wcSelectedCustomerIds = ['c1']; currentLineItems = [{description:'Gauge', qty:1, price:50}];
        document.getElementById('wcDate').value = day(0); setPickedTechIds(document.getElementById('wcTechnician'), ['t1', 't2']);
        const rep = document.getElementById('wcRepeat'); rep.value = 'weekly'; rep.dispatchEvent(new Event('change'));
        document.getElementById('wcRepeatUntil').value = day(14);
        document.getElementById('btnSendWorkOrder').click(); await wait(150);
        wcView = 'current'; applyWorkOrderType(); await wait(80);
      }
      const listSel = app ? '#awcCurList .awc-row' : '#wcCurrentList .wc-row';
      const rows = Array.from(document.querySelectorAll(listSel));
      out.push([P + 'a work order for two technicians is one row', rows.length === 1 && /2 technicians/.test(rows[0].textContent)]);
      out.push([P + 'with Edit all', Array.from(rows[0].querySelectorAll('button')).some(b => b.textContent.trim() === 'Edit all')]);
      rows[0].click(); await wait(150);
      const techRows = wins()[0] ? wins()[0].querySelectorAll('[data-list] > div') : [];
      out.push([P + 'pressing it opens a row per technician', techRows.length === 2]);
      out.push([P + 'each technician has Edit', Array.from(techRows).every(r => Array.from(r.querySelectorAll('button')).some(b => b.textContent.trim() === 'Edit'))]);
      techRows[0].click(); await wait(150);
      out.push([P + 'a technician\u2019s repeat opens a window within the window', wins().length === 2 && wins()[1].querySelectorAll('[data-dates] > div').length === 3]);
      wins()[1].querySelector('[data-close]').click(); await wait(60);
      wins()[0].querySelector('[data-close]').click(); await wait(60);
      Array.from(document.querySelector(listSel).querySelectorAll('button')).find(b => b.textContent.trim() === 'Edit all').click(); await wait(400);
      if(app){ awcLineItems[0].price = 90; document.getElementById('awcFinalize').click(); }
      else { currentLineItems[0].price = 90; document.getElementById('btnSendWorkOrder').click(); }
      await wait(250);
      const jobs = lsGet('scheduledWorkOrders');
      out.push([P + 'Edit all changes both in place: one work order, one number, the new price', jobs.length === 6
        && new Set(jobs.map(j => j.workOrderId)).size === 1 && new Set(jobs.map(j => j.workOrderNumber)).size === 1
        && jobs.every(j => j.lineItems[0].price === 90)]);
      return out;
    });
  }

  await run('customer-intake.html', 'Website: Other on equipment', async ()=>{
    const out = [];
    customers.push({id:'a', name:'Alpha', active:true, equipmentTypeOptions:['Filter'], equipment:[]},
                   {id:'b', name:'Beta', active:true, equipmentTypeOptions:['Filter', 'Filter 2'], equipment:[]}); saveCustomers();
    window.promptDialog = ()=> Promise.resolve('Hayward Pro');
    viewCustomer(customers.find(c => c.id === 'a')); await wait(200);
    const labels = () => Array.from(document.querySelectorAll('#icEquipmentList button')).map(b => b.textContent.trim());
    out.push(['a row with no quick buttons has no "+ Quick buttons" bubble', labels().indexOf('+ Quick buttons') === -1]);
    Array.from(document.querySelectorAll('#icEquipmentList button')).find(b => b.textContent.trim() === 'Other').click(); await wait(150);
    viewCustomer(customers.find(c => c.id === 'b')); await wait(200);
    out.push(['a name typed under Other becomes a button on every filter, every customer', labels().filter(t => t === 'Hayward Pro').length === 2]);
    return out;
  });

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
  process.exit(fail ? 1 : 0);
})();
