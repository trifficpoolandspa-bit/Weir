require('fake-indexeddb/auto');
const {JSDOM} = require('jsdom');
const fs = require('fs');

// A customer with their own reading list must have those readings saved AND
// shown in the report. Both apps read the global list instead, so a custom
// spa saved nothing and the section came out blank in the email.
let pass = 0, fail = 0;
function check(name, ok, detail){
  if(ok){ pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  — ' + detail : '')); }
}
const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const today=DAYS[new Date().getDay()];
const seed={technicians:[{id:'t1',name:'Alex'}], companyName:'Trifific Pool and Spa',
  customers:[{id:'a',name:'John T Tyler',email:'c@x.com',day:today,active:true,
              technicianId:'t1',hasPool:true,hasSpa:true}],
  afterPhotoDefaultFixed:true,
  chemConfig:{pool:{chemicals:[{key:'chlorine',label:'Free chlorine'}],dosages:[{key:'tabs',label:'Chlorine tabs'}]},
              spa:{chemicals:[{key:'chlorine',label:'Free chlorine'}],dosages:[{key:'tabs',label:'Chlorine tabs'}]},
              fountain:{chemicals:[],dosages:[]}},
  // THIS customer's spa uses its own reading, with a key nothing else has
  customChemConfig:{a:{spa:{
      chemicals:[{key:'spa_br', label:'Bromine'},{key:'spa_ph', label:'pH level'}],
      dosages:[{key:'spa_gran', label:'Bromine granules'}]}}}};
function boot(file){
  return new JSDOM(fs.readFileSync(file,'utf8'),{
    runScripts:'dangerously',pretendToBeVisual:true,url:'https://example.com/',
    beforeParse(w){
      // A company that has not ticked any photo for Everyone. New companies start
      // with the pool after photo required; that start is tested on its own.
      w.localStorage.setItem('weir:photoEveryone', '{}');
      w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
      w.scrollTo=()=>{};w.scrollBy=()=>{};w.alert=()=>{};
      w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){},fillRect(){}});
      w.console.warn=()=>{};w.console.error=()=>{};
      w.indexedDB=global.indexedDB;w.IDBKeyRange=global.IDBKeyRange;
      w.addEventListener('error',e=>console.log('  UNCAUGHT:',e.error?e.error.message:e.message));
      Object.keys(seed).forEach(k=>w.localStorage.setItem('weir:'+k,JSON.stringify(seed[k])));
    }});
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  for(const file of ['technician-app.html','admin-readings-app.html']){
    console.log('\n=== ' + file + ' — customer has a CUSTOM spa setup ===');
    const dom=boot(file); await wait(1500);
    const w=dom.window,d=w.document;
    const set=(id,v)=>{const e=d.getElementById(id); if(!e) return false; e.value=v; e.dispatchEvent(new w.Event('input',{bubbles:true})); return true;};
    w.eval("currentUser={id:'t1',name:'Alex'}; confirmDialog=()=>Promise.resolve(true); alertDialog=()=>Promise.resolve(); renderHomeList(); openVisit('a');");
    await wait(450);
    set('pool_chem_chlorine','1.5'); set('pool_dose_tabs','3');
    d.getElementById('btnSaveReading').click(); await wait(700);
    console.log('  spa fields present:', set('spa_chem_spa_br','4.0'), set('spa_chem_spa_ph','7.6'));
    set('spa_dose_spa_gran','2');
    d.getElementById('btnSaveSpaReading').click(); await wait(1200);
    const html=w.eval('currentReportHtml')||'';
    check('  a report is produced', html.length > 500, String(html.length));
    check('  the custom spa reading is named', html.indexOf('Bromine') !== -1);
    check('  with its value', html.indexOf('4.0') !== -1);
    check('  and its second reading', html.indexOf('7.6') !== -1);
    check('  the custom dosage too', html.indexOf('Bromine granules') !== -1);
    check('  and the pool is still there', html.indexOf('1.5') !== -1);
    const spaStored = JSON.parse(w.eval("JSON.stringify((lsGet('spaReadings:a')||[])[0]||{})"));
    check('  the custom keys reached storage',
          spaStored.spa_br === '4.0' && spaStored.spa_ph === '7.6',
          JSON.stringify(spaStored.spa_br) + ',' + JSON.stringify(spaStored.spa_ph));
  }
  
// ---- Restoring the defaults keeps the quick buttons ----
// The shipped lists carry no buttons of their own; they are filled in when a
// setup loads. Restoring once skipped that, leaving every field type-only.
{
  console.log('\n=== Restore defaults brings the quick buttons back ===');
  const src = fs.readFileSync('customer-intake.html', 'utf8');
  const set = (src.match(/chlorine: \[([^\]]*)\]/) || [])[1] || '';
  check('Free chlorine ships with 0, 1, 2, 3, 5, 7.5 and 10',
        set.replace(/\s/g, '') === '0,1,2,3,5,7.5,10', set);
  check('and a restore seeds the buttons before saving',
        /DEFAULT_CHEM_CONFIG\[selectedChemConfigType\]\)\);[\s\S]{0,400}seedButtonSets\(chemConfig\);[\s\S]{0,80}saveChemConfig\(\);/.test(src));

  // A setup saved before the 2 existed gets it back on its own, with no
  // Restore needed
  seed.chemConfig = {pool: {chemicals: [{key:'chlorine', label:'Free chlorine', unit:'ppm',
                                         buttons: [0, 1, 3, 5, 7.5, 10]}], dosages: []},
                     spa: {chemicals: [], dosages: []}, fountain: {chemicals: [], dosages: []}};
  const older = boot('customer-intake.html');
  await wait(1200);
  const gotTwo = older.window.eval(
    "JSON.stringify((chemConfig.pool.chemicals.find(c=>c.key==='chlorine')||{}).buttons)");
  check('an older setup gains the 2 when the page opens',
        JSON.parse(gotTwo).map(b => (b && b.v !== undefined) ? b.v : b).join() === '0,1,2,3,5,7.5,10', gotTwo);
  older.window.close();

  // Somebody who arranged their own buttons keeps exactly what they chose
  seed.chemConfig.pool.chemicals[0].buttons = [1, 4, 9];
  const mine = boot('customer-intake.html');
  await wait(1200);
  const kept = mine.window.eval(
    "JSON.stringify((chemConfig.pool.chemicals.find(c=>c.key==='chlorine')||{}).buttons)");
  check('but a set someone arranged themselves is left alone', JSON.parse(kept).join() === '1,4,9', kept);
  mine.window.close();
  delete seed.chemConfig;

  const dom = boot('customer-intake.html');
  const w = dom.window;
  await wait(1200);
  const chlorine = () => w.eval("JSON.stringify((chemConfig.pool.chemicals.find(c=>c.key==='chlorine')||{}).buttons)");
  check('a fresh setup has them', JSON.parse(chlorine()).join() === '0,1,2,3,5,7.5,10', chlorine());
  w.eval("chemConfig.pool.chemicals.find(c=>c.key==='chlorine').buttons = [9]; saveChemConfig();");
  w.eval("chemConfig.pool = JSON.parse(JSON.stringify(DEFAULT_CHEM_CONFIG.pool)); seedButtonSets(chemConfig); saveChemConfig();");
  check('and they are back after a restore, not left empty',
        JSON.parse(chlorine()).join() === '0,1,2,3,5,7.5,10', chlorine());
  const ph = w.eval("JSON.stringify((chemConfig.pool.chemicals.find(c=>c.key==='ph')||{}).buttons)");
  check('every other field gets its own back too', JSON.parse(ph).length === 8, ph);
}


// ---- Typing in a dosage rule does not redraw the rules ----
// Saving on every change used to rebuild every row, so moving to the next
// field destroyed the one being clicked and the press was swallowed.
{
  console.log('\n=== Dosage rule fields take one press ===');
  const src = fs.readFileSync('customer-intake.html', 'utf8');
  const handlers = src.match(/\w+\.addEventListener\('change', \(\)=>\{\s*\w+\.value = padLeadingZero[\s\S]{0,140}?\}\);/g) || [];
  check('there are rule value fields to check', handlers.length >= 3, String(handlers.length));
  check('none of them redraw the rules while being used',
        handlers.every(h => h.indexOf('render()') === -1),
        (handlers.find(h => h.indexOf('render()') !== -1) || '').slice(0, 90));
  check('but changing the operator still does, since it adds a field',
        /opSel\.addEventListener\('change'[^}]*render\(\);/.test(src));
}


// ---- Adding a quick button is ready to type into ----
{
  console.log('\n=== Add button leaves you typing ===');
  const dom = boot('customer-intake.html');
  const w = dom.window, d = w.document;
  await wait(1300);
  try{
    w.eval("siteUser={id:'u',companyId:'co',role:'owner'}; hideSiteLogin(); switchView('chemconfig');"
      + " openQuickButtonsModal(chemConfig.pool.chemicals.find(c=>c.key==='chlorine'));");
    await wait(250);
    const before = d.querySelectorAll('#quickButtonsBody input[type=number]').length;
    const add = Array.from(d.querySelectorAll('button')).find(b => /Add button/.test(b.textContent));
    check('there is an Add button', !!add);
    add.click();
    await wait(200);
    const fields = d.querySelectorAll('#quickButtonsBody input[type=number]');
    check('it adds a button', fields.length === before + 1, String(fields.length));
    check('and the new number is ready to type into',
          d.activeElement === fields[fields.length - 1],
          d.activeElement ? d.activeElement.tagName + ' ' + d.activeElement.value : 'nothing focused');
  }catch(e){ check('adding a quick button', false, e.message); }
  w.close();
}


// ---- The clear button sits level with the customer field ----
{
  console.log('\n=== Clearing the chosen customer ===');
  const src = fs.readFileSync('customer-intake.html', 'utf8');
  const btn = (src.match(/<button type="button" id="customCustClear"[^>]*>/) || [''])[0];
  check('it is centred on the field rather than pinned to the bottom',
        /top:50%/.test(btn) && /translateY\(-50%\)/.test(btn), btn.slice(0, 140));
  check('and it no longer measures from the bottom of the whole block',
        btn.indexOf('bottom:4px') === -1);

  const dom = boot('customer-intake.html');
  const w = dom.window, d = w.document;
  await wait(1200);
  try{
    const input = d.getElementById('customCustSearch');
    const clear = d.getElementById('customCustClear');
    check('the button sits with the field, not with the label',
          !!clear && clear.parentElement === input.parentElement
          && clear.parentElement.tagName === 'DIV'
          && clear.parentElement.querySelector('label') === null,
          clear ? clear.parentElement.tagName : 'no button');
  }catch(e){ check('the clear button', false, e.message); }
  w.close();
}


// ---- Starting a customer's own setup ----
{
  console.log('\n=== the bodies of water sit above the lists they change ===');
  {
    const src = fs.readFileSync('customer-intake.html', 'utf8');
    const bodies = src.indexOf('id="customBodyList"');
    const chems = src.indexOf('<h2 style="margin:0;">Chemicals to record</h2>');
    const picker = src.indexOf('id="customConfigPicker"');
    check('the body list is below the customer picker', bodies > picker);
    check('and directly above Chemicals to record', bodies < chems && (chems - bodies) < 700,
          'gap of ' + (chems - bodies) + ' characters');
  }

  console.log('\n=== the bodies of water stay on their own page ===');
  {
    const dom = boot('customer-intake.html');
    const w = dom.window, d = w.document;
    await wait(1300);
    try{
      w.eval("siteUser={id:'u',companyId:'co',role:'owner'}; hideSiteLogin();"
        + " customers=[{id:'c1', name:'Alpha One', hasPool:true, hasSpa:true, active:true}]; saveCustomers();"
        + " switchView('customerconfig'); openCustomSetup(customers[0], bodiesForCustomer(customers[0]));");
      await wait(250);
      check('they show while setting up a customer',
            d.getElementById('customBodyList').style.display !== 'none',
            d.getElementById('customBodyList').style.display);
      w.eval("switchView('chemconfig');");
      await wait(250);
      check('and are put away on Readings and dosages',
            d.getElementById('customBodyList').style.display === 'none',
            d.getElementById('customBodyList').style.display);
      w.eval("switchView('customerconfig');");
      await wait(250);
      check('Readings and dosages keeps its own Pool, Spa and Extra buttons',
            !!d.getElementById('chemConfigTypeControl'));
    }catch(e){ check('the bodies of water', false, e.message); }
    w.close();
  }

  console.log('\n=== starting on another customer ===');
  const dom = boot('customer-intake.html');
  const w = dom.window, d = w.document;
  await wait(1300);
  try{
    w.eval("siteUser={id:'u',companyId:'co',role:'owner'}; hideSiteLogin();"
      + " customers=[{id:'c1', name:'Alpha One', hasPool:true, active:true}]; saveCustomers();"
      + " switchView('customerconfig');");
    await wait(250);
    check('there is no "+ New customer setup" button any more', !d.getElementById('btnNewCustomSetup'));
    const group = d.getElementById('btnNewCustomerGroup');
    check('"+ New group" is the filled button in its place',
          !!group && group.classList.contains('btn-primary') && group.textContent.trim() === '+ New group');
    check('and the only filled button in that row',
          Array.from(group.parentElement.querySelectorAll('button.btn-primary')).length === 1);
    const site = fs.readFileSync('customer-intake.html', 'utf8');
    check('nothing is left behind from the old button', !/startNewCustomSetup|btnNewCustomSetup/.test(site));
    // load somebody, then clear the search with its x
    w.eval("openCustomSetup(customers[0], bodiesForCustomer(customers[0]));");
    await wait(200);
    check('a customer can be loaded', w.eval('customCustomerId') === 'c1', String(w.eval('customCustomerId')));
    d.getElementById('customCustClear').click();
    await wait(200);
    check('the x in the search clears whoever was loaded', !w.eval('customCustomerId'), String(w.eval('customCustomerId')));
    check('and empties the search box', d.getElementById('customCustSearch').value === '',
          d.getElementById('customCustSearch').value);
  }catch(e){ check('starting a custom setup', false, e.message); }
  w.close();
}


// ---- Groups of customers who share one setup ----
{
  console.log('\n=== groups share one setup ===');
  const dom = boot('customer-intake.html');
  const w = dom.window, d = w.document;
  await wait(1300);
  try{
    w.eval("siteUser={id:'u',companyId:'co',role:'owner'}; hideSiteLogin();"
      + " customers=[{id:'c1',name:'Alpha',hasPool:true,active:true},"
      + "{id:'c2',name:'Bravo',hasPool:true,active:true},"
      + "{id:'c3',name:'Charlie',hasPool:true,active:true}];"
      + " saveCustomers(); switchView('customerconfig');");
    check('there is a button to start a group', !!d.getElementById('btnNewCustomerGroup'));

    d.getElementById('btnNewCustomerGroup').click();
    check('it opens a window', d.getElementById('groupOverlay').style.display === 'flex');
    d.getElementById('btnSaveGroup').click();
    check('it will not save without a name',
          d.getElementById('groupError').style.display === 'block');

    d.getElementById('groupName').value = 'Salt pools';
    const boxes = Array.from(d.querySelectorAll('#groupPickList input[type=checkbox]'));
    check('every customer can be chosen', boxes.length === 3, String(boxes.length));
    boxes[0].checked = true; boxes[0].dispatchEvent(new w.Event('change'));
    boxes[1].checked = true; boxes[1].dispatchEvent(new w.Event('change'));
    d.getElementById('btnSaveGroup').click();
    await wait(250);
    check('the group is saved with its members',
          w.eval("customerGroups.length") === 1 && w.eval("customerGroups[0].customerIds.length") === 2,
          String(w.eval("JSON.stringify(customerGroups)")).slice(0, 120));
    check('and it is listed', d.getElementById('customGroupWrap').style.display !== 'none');

    const page = fs.readFileSync('customer-intake.html', 'utf8');
    check('groups sit below the customer search, not above it',
          page.indexOf('id="customCustSearch"') < page.indexOf('id="customGroupWrap"'));

    check('and the button says what it opens', /edit\.textContent = 'Customers';/.test(page));

    // Editing the group reaches everyone in it
    w.eval("openGroupSetup(customerGroups[0]);");
    w.eval("customWorking = {chemicals:[{key:'chlorine',label:'Salt reading',unit:'ppm'}], dosages:[]};"
      + " customWorkingFor = customCustomerId + '|' + customBodyKey; saveActiveConfig();");
    await wait(250);
    const labelFor = id => w.eval("(((customConfig." + id + "||{}).pool||{}).chemicals||[]).map(c=>c.label).join()");
    check('both members get the group\u2019s setup',
          labelFor('c1') === 'Salt reading' && labelFor('c2') === 'Salt reading',
          labelFor('c1') + ' / ' + labelFor('c2'));
    check('somebody outside the group is untouched', labelFor('c3') === '', labelFor('c3'));

    // Taking someone out puts them back on the defaults
    w.eval("const g = customerGroups[0]; g.customerIds = ['c1']; saveCustomerGroups(); clearSetupFor('c2');");
    await wait(150);
    check('leaving a group clears that customer\u2019s setup', labelFor('c2') === '', labelFor('c2'));
    check('and the one still in it keeps it', labelFor('c1') === 'Salt reading');

    // A customer's own tweak is replaced by the group, with a warning
    const site = fs.readFileSync('customer-intake.html', 'utf8');
    check('the window warns when somebody already has their own setup',
          /their own setup, which the group will replace/.test(site));
    check('and when somebody is being taken from another group',
          /in another group and will be moved into this one/.test(site));
    check('groups travel between office devices',
          /'reportEmailStyle', 'customerGroups'/.test(site));
  }catch(e){ check('groups', false, e.message); }
  w.close();
}


// ---- Groups show the moment the tab opens, and sit evenly between lines ----
{
  console.log('\n=== customer-intake.html — groups on arrival ===');
  const groups = [{id:'g1', name:'Salt pools', customerIds:['a'], config:{}},
                  {id:'g2', name:'Tab pools', customerIds:[], config:{}}];
  const dom = new JSDOM(fs.readFileSync('customer-intake.html','utf8'),{
    runScripts:'dangerously',pretendToBeVisual:true,url:'https://example.com/',
    beforeParse(w){
      // A company that has not ticked any photo for Everyone. New companies start
      // with the pool after photo required; that start is tested on its own.
      w.localStorage.setItem('weir:photoEveryone', '{}');
      w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
      w.scrollTo=()=>{};w.scrollBy=()=>{};w.alert=()=>{};
      w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){},fillRect(){}});
      w.console.warn=()=>{};w.console.error=()=>{};
      w.indexedDB=global.indexedDB;w.IDBKeyRange=global.IDBKeyRange;
      Object.keys(seed).forEach(k=>w.localStorage.setItem('weir:'+k,JSON.stringify(seed[k])));
      w.localStorage.setItem('weir:customerGroups', JSON.stringify(groups));
    }});
  await wait(1500);
  const w = dom.window, d = w.document;
  const names = ()=> Array.from(d.querySelectorAll('#customGroupList > div'))
    .map(r => r.firstChild.firstChild.textContent);
  try{
    w.eval("siteUser={id:'u',companyId:'co',role:'owner'}; hideSiteLogin(); switchView('customerconfig');");
    check('saved groups show as soon as the tab opens',
          d.getElementById('customGroupWrap').style.display !== 'none'
          && names().join() === 'Salt pools,Tab pools', names().join() || '(none)');

    // A group arriving by sync after the page loaded
    w.eval("switchView('customers');");
    w.eval("syncApplyRecord('setup', 'customerGroups', {value: "
      + JSON.stringify(groups.concat({id:'g3', name:'Spa only', customerIds:[], config:{}})) + "}, false);");
    w.eval("switchView('customerconfig');");
    check('a group that arrived by sync shows too', names().indexOf('Spa only') !== -1, names().join());
    w.eval("syncApplyRecord('setup', 'customerGroups', {value: "
      + JSON.stringify(groups.concat({id:'g4', name:'Arrived while open', customerIds:[], config:{}})) + "}, false);");
    check('even while the tab is open', names().indexOf('Arrived while open') !== -1, names().join());
    check('and the page is working from the synced list, not a stale copy',
          w.eval("customerGroups.map(g=>g.id).join()") === 'g1,g2,g4', w.eval("customerGroups.map(g=>g.id).join()"));

    // Spacing, matched to "Customers with a custom setup": no line over the
    // first group, 12px above and below each name, a line between groups, and
    // the line above the next section closing off the last one
    const rows = Array.from(d.querySelectorAll('#customGroupList > div'))
      .filter(r => !r.querySelector('[data-list-page]'));
    const pad = (el, side)=> parseFloat(el.style['padding' + side] || '0');
    check('each group has 12px above and below its name',
          rows.length === 3 && rows.every(r => pad(r, 'Top') === 12 && pad(r, 'Bottom') === 12),
          rows.map(r => pad(r, 'Top') + '/' + pad(r, 'Bottom')).join(' '));
    check('no line between the heading and the first group', !/1px solid/.test(rows[0].style.borderTop || ''));
    check('a line under every group but the last',
          rows.slice(0, -1).every(r => /1px solid/.test(r.style.borderBottom))
          && !/1px solid/.test(rows[rows.length - 1].style.borderBottom || ''));
    const existing = d.getElementById('customExistingWrap');
    check('the next section\u2019s line closes off the last group',
          parseFloat(existing.style.marginTop || '0') === 0 && /1px solid/.test(existing.style.borderTop),
          existing.style.marginTop);
    const list = d.getElementById('customGroupList');
    const wrap = d.getElementById('customGroupWrap');
    check('8px under the Groups heading, as under the custom-setup heading',
          parseFloat(list.style.marginTop) === 8, list.style.marginTop);
    check('group names line up with the heading (no side padding)',
          rows.every(r => pad(r, 'Left') === 0 && pad(r, 'Right') === 0));
    check('a group row lights up under the pointer', rows.every(r => r.classList.contains('press-row')));
    const hover = fs.readFileSync('customer-intake.html', 'utf8');
    check('with the site\u2019s pale teal', /\.press-row:hover\{background:var\(--teal-pale\);\}/.test(hover));

    // With no groups, the section beneath keeps its usual gap
    w.eval("syncApplyRecord('setup', 'customerGroups', {value: []}, false);");
    check('with no groups the heading is hidden', wrap.style.display === 'none');
    check('and the section below keeps its own space', parseFloat(existing.style.marginTop) > 0, existing.style.marginTop);
  }catch(e){ check('groups on arrival', false, e.message); }
  w.close();
}


// ---- Groups and custom setups, ten to a page, each with its own pages ----
{
  console.log('\n=== customer-intake.html — ten groups and ten custom setups to a page ===');
  const custs = Array.from({length: 14}, (_, i) => ({id: 'k' + i, name: 'Cust ' + String(i).padStart(2, '0'), active: true, hasPool: true}));
  const cfg = {}; custs.forEach(c => cfg[c.id] = {pool: {chemicals: [], dosages: []}});
  const groups = Array.from({length: 23}, (_, i) => ({id: 'g' + i, name: 'Group ' + i, customerIds: [], config: {}}));
  const dom = new JSDOM(fs.readFileSync('customer-intake.html','utf8'),{
    runScripts:'dangerously',pretendToBeVisual:true,url:'https://example.com/',
    beforeParse(w){
      w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
      w.scrollTo=()=>{};w.scrollBy=()=>{};w.alert=()=>{};
      w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){},fillRect(){}});
      w.console.warn=()=>{};w.console.error=()=>{};
      w.indexedDB=global.indexedDB;w.IDBKeyRange=global.IDBKeyRange;
      w.localStorage.setItem('weir:customers', JSON.stringify(custs));
      w.localStorage.setItem('weir:customChemConfig', JSON.stringify(cfg));
      w.localStorage.setItem('weir:customerGroups', JSON.stringify(groups));
    }});
  await wait(1500);
  const w = dom.window, d = w.document;
  try{
    w.eval("siteUser={id:'u',companyId:'co',role:'owner'}; hideSiteLogin(); switchView('customerconfig');");
    const gRows = ()=> Array.from(d.querySelectorAll('#customGroupList > div')).filter(r => !r.querySelector('[data-list-page]'));
    const cRows = ()=> Array.from(d.querySelectorAll('#customExistingList > div')).filter(r => !r.querySelector('[data-list-page]'));
    const pageBtn = (id, n) => d.querySelector('#' + id + ' [data-list-page="' + n + '"]');
    const info = id => { const b = pageBtn(id, 1); return b ? b.parentElement.lastChild.textContent : '(none)'; };

    check('ten groups on the first page', gRows().length === 10, String(gRows().length));
    check('ten custom setups on the first page', cRows().length === 10, String(cRows().length));
    check('the group pages say which ten', info('customGroupList') === 'Showing 1\u201310 of 23', info('customGroupList'));
    check('the custom-setup pages say which ten', info('customExistingList') === 'Showing 1\u201310 of 14', info('customExistingList'));
    const gPager = pageBtn('customGroupList', 1).parentElement;
    check('the group page numbers come after the last group', d.getElementById('customGroupList').lastElementChild === gPager);
    check('with a line above them and room below, before the next section',
          /1px solid/.test(gPager.style.borderTop) && parseFloat(gPager.style.paddingTop) === 14 && parseFloat(gPager.style.paddingBottom) === 14);
    const cPager = pageBtn('customExistingList', 1).parentElement;
    check('the custom-setup page numbers come under the last customer', d.getElementById('customExistingList').lastElementChild === cPager);

    pageBtn('customGroupList', 3).click();
    check('the last group page holds what is left', gRows().length === 3 && info('customGroupList') === 'Showing 21\u201323 of 23', info('customGroupList'));
    check('and paging the groups leaves the custom setups alone', info('customExistingList') === 'Showing 1\u201310 of 14', info('customExistingList'));
    pageBtn('customExistingList', 2).click();
    check('paging the custom setups works', cRows().length === 4 && info('customExistingList') === 'Showing 11\u201314 of 14', info('customExistingList'));
    check('and leaves the groups where they were', info('customGroupList') === 'Showing 21\u201323 of 23', info('customGroupList'));

    const row = cRows()[0];
    const nameEl = row.firstChild.firstChild;
    check('custom-setup names are the same dark colour as group names', /var\(--ink\)/.test(nameEl.getAttribute('style')), nameEl.getAttribute('style'));
    check('custom-setup rows light up under the pointer', cRows().every(r => r.classList.contains('press-row')));
    check('custom-setup rows are the taller height, like the groups',
          cRows().every(r => r.style.paddingTop === '12px' && r.style.paddingBottom === '12px'));

    // Ten or fewer: no page numbers
    w.eval("customerGroups = customerGroups.slice(0, 10); saveCustomerGroups(); renderGroupList();");
    check('ten groups or fewer: no page numbers', !pageBtn('customGroupList', 1) && gRows().length === 10);
  }catch(e){ check('groups and custom setups in pages', false, e.message); }
  w.close();
}


// ---- Customer Customization and syncing (Sept 24) ----
{
  console.log('\n=== customer-intake.html — groups open to their customers and setup ===');
  const custs = ['Alpha Smith','Bravo Jones','Charlie Brown','Delta Longname-Hyphenated','Echo Park','Foxtrot Miles','Golf Green']
    .map((n, i) => ({id: 'c' + i, name: n, active: true, hasPool: true}))
    .concat([{id: 'z', name: 'Zulu Own', active: true, hasPool: true}]);
  const cfg = {pool: {chemicals: [], dosages: []}};
  const dom = new JSDOM(fs.readFileSync('customer-intake.html','utf8'),{
    runScripts:'dangerously',pretendToBeVisual:true,url:'https://example.com/',
    beforeParse(w){
      w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
      w.scrollTo=()=>{};w.scrollBy=()=>{};w.alert=()=>{};
      w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){},fillRect(){}});
      w.console.warn=()=>{};w.console.error=()=>{};
      w.indexedDB=global.indexedDB;w.IDBKeyRange=global.IDBKeyRange;
      w.localStorage.setItem('weir:photoEveryone', '{}');
      w.localStorage.setItem('weir:customers', JSON.stringify(custs));
      w.localStorage.setItem('weir:customerGroups', JSON.stringify([
        {id: 'g1', name: 'Salt pools', customerIds: ['c0','c1','c2','c3','c4','c5','c6'], config: cfg},
        {id: 'g2', name: 'HOA', customerIds: [], config: cfg}]));
      const own = {z: cfg}; ['c0','c1','c2','c3','c4','c5','c6'].forEach(id => own[id] = cfg);
      w.localStorage.setItem('weir:customChemConfig', JSON.stringify(own));
    }});
  await wait(1500);
  const w = dom.window, d = w.document;
  try{
    w.eval("siteUser={id:'u',companyId:'co',role:'owner'}; hideSiteLogin(); switchView('customerconfig');");
    const setups = () => Array.from(d.querySelectorAll('#customExistingList > div')).map(r => r.firstChild && r.firstChild.firstChild ? r.firstChild.firstChild.textContent : '').filter(Boolean);
    check('group members are not listed under Customers with a custom setup', setups().join() === 'Own, Zulu', setups().join());
    const groupRow = name => Array.from(d.querySelectorAll('#customGroupList > div')).find(r => r.firstChild && r.firstChild.firstChild && r.firstChild.firstChild.textContent === name);
    const st = () => ({open: w.eval('groupOpenId'), group: w.eval('customGroupId'), loaded: w.eval('customCustomerId')});
    groupRow('Salt pools').click();
    let now = st();
    check('pressing a group opens its customers and its setup together', now.open === 'g1' && now.group === 'g1' && now.loaded === 'g1', JSON.stringify(now));
    const grid = d.querySelector('#customGroupList [style*="grid-template-columns"]');
    check('its customers are in five even columns', !!grid && /repeat\(5, minmax\(0(px)?, 1fr\)\)/.test(grid.style.gridTemplateColumns), grid && grid.style.gridTemplateColumns);
    const names = Array.from(grid.children).map(c => c.querySelector('span'));
    check('a long name is cut short rather than taking more room',
          names.every(n => /nowrap/.test(n.style.whiteSpace) && n.style.textOverflow === 'ellipsis'));
    check('there is no Edit setup button', !Array.from(d.querySelectorAll('#customGroupList button')).some(b => b.textContent === 'Edit setup'));
    check('each name has a small x just to its left',
          Array.from(grid.children).every(c => c.firstChild.tagName === 'BUTTON' && /Take .* out of this group/.test(c.firstChild.title)));
    groupRow('HOA').click();
    now = st();
    check('pressing another group switches to it', now.open === 'g2' && now.group === 'g2', JSON.stringify(now));
    check('an empty group says so', /No customers in this group yet/.test(d.getElementById('customGroupList').textContent));
    Array.from(d.querySelectorAll('#customExistingList > div')).find(r => /Zulu/.test(r.textContent)).click();
    now = st();
    check('pressing a customer with a custom setup closes the group and switches to them', now.open === null && now.group === null && now.loaded === 'z', JSON.stringify(now));
    groupRow('Salt pools').click(); groupRow('Salt pools').click();
    now = st();
    check('pressing the open group again closes its list and its setup', now.open === null && now.loaded === null, JSON.stringify(now));

    // Taking someone out with the x
    groupRow('Salt pools').click();
    w.eval("confirmDialog = () => Promise.resolve(true);");
    Array.from(d.querySelectorAll('#customGroupList button')).find(b => /Take Jones, Bravo out/.test(b.title)).click();
    await wait(80);
    check('the x takes that customer out of the group', JSON.stringify(w.eval('customerGroups[0].customerIds')) === JSON.stringify(['c0','c2','c3','c4','c5','c6']));
    check('and puts them back on the default readings and dosages', !w.eval("customConfig['c1']"));
    check('and the group stays open', w.eval('groupOpenId') === 'g1');
  }catch(e){ check('groups', false, e.message); }
  w.close();
}

{
  console.log('\n=== customer-intake.html — settings changed on another device ===');
  const dom = new JSDOM(fs.readFileSync('customer-intake.html','utf8'),{
    runScripts:'dangerously',pretendToBeVisual:true,url:'https://example.com/',
    beforeParse(w){
      w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
      w.scrollTo=()=>{};w.scrollBy=()=>{};w.alert=()=>{};
      w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){},fillRect(){}});
      w.console.warn=()=>{};w.console.error=()=>{};
      w.localStorage.setItem('weir:photoEveryone', '{}');
    }});
  await wait(1500);
  const w = dom.window, d = w.document;
  try{
    w.eval("siteUser={id:'u',companyId:'co',role:'owner'}; hideSiteLogin(); switchView('chemconfig');");
    Array.from(d.querySelectorAll('#chemConfigTypeControl .history-type-btn')).find(b => b.dataset.type === 'spa').click();
    const fromPhone = JSON.parse(w.eval("JSON.stringify(chemConfig)"));
    fromPhone.spa.dosages.push({key: 'dose_phone', label: 'Sodium Bicarbonate (phone)', unit: 'lb', buttons: []});
    w.eval("syncApplyRecord('setup','chemConfig',{value:" + JSON.stringify(fromPhone) + "},false)");
    check('a dosage added on another device reaches the page\u2019s working copy', w.eval("chemConfig.spa.dosages.some(x => /phone/.test(x.label))"));
    check('and shows on the page', /phone/.test(Array.from(d.querySelectorAll('#chemConfigDosagesList input')).map(i => i.value).join('|')));
    d.getElementById('btnAddChemical').click();
    check('and survives this computer\u2019s next save', /phone/.test(w.localStorage.getItem('weir:chemConfig')));
    w.eval("syncApplyRecord('setup','customChemConfig',{value:{x:{pool:{chemicals:[],dosages:[]}}}},false)");
    check('customers\u2019 own setups are picked up too', w.eval("!!customConfig.x"));
    w.eval("syncApplyRecord('setup','routeOrders',{value:{Monday:['q']}},false)");
    check('and route orders', w.eval("JSON.stringify(routeOrders)") === '{"Monday":["q"]}');
    const site = fs.readFileSync('customer-intake.html', 'utf8');
    check('products and services sync between devices', /'productsServices',/.test(site.slice(site.indexOf('const SYNC_SETUP_KEYS'), site.indexOf('const SYNC_SETUP_KEYS') + 600)));
    w.eval("switchView('productsservices');");
    w.eval("syncApplyRecord('setup','productsServices',{value:[{key:'p1',name:'Acid wash',price:'250',category:'repairs'}]},false)");
    check('a price from another device shows on Products & Services',
          Array.from(d.querySelectorAll('#productsServicesList input[type=number]')).some(i => i.value === '250'));
    check('and the page works from it', w.eval("productsServices.some(p => p.price === '250')"));
  }catch(e){ check('another device', false, e.message); }
  w.close();
}

{
  console.log('\n=== customer-intake.html — customer fields empty when clicked ===');
  const dom = new JSDOM(fs.readFileSync('customer-intake.html','utf8'),{
    runScripts:'dangerously',pretendToBeVisual:true,url:'https://example.com/',
    beforeParse(w){
      w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
      w.scrollTo=()=>{};w.scrollBy=()=>{};w.alert=()=>{};
      w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){},fillRect(){}});
      w.console.warn=()=>{};w.console.error=()=>{};
      w.localStorage.setItem('weir:customers', JSON.stringify([{id:'a',name:'Alpha Smith',active:true,hasPool:true},{id:'b',name:'Bravo Jones',active:true,hasPool:true}]));
    }});
  await wait(1500);
  const w = dom.window, d = w.document;
  try{
    w.eval("siteUser={id:'u',companyId:'co',role:'owner'}; hideSiteLogin(); switchView('customers');");
    const f = d.getElementById('customerSearch');
    f.value = 'Alp'; f.dispatchEvent(new w.Event('input', {bubbles: true}));
    const press = el => { el.dispatchEvent(new w.Event('pointerdown', {bubbles: true})); el.focus(); };
    press(f);
    check('clicking a customer field empties it', f.value === '', f.value);
    f.blur(); await wait(320);
    check('leaving without typing puts it back', f.value === 'Alp', f.value);
    press(f); f.value = 'Bra'; f.dispatchEvent(new w.Event('input', {bubbles: true})); f.blur(); await wait(320);
    check('typing something new keeps the new text', f.value === 'Bra', f.value);
    f.blur(); f.focus();
    check('coming in without a click leaves it alone', f.value === 'Bra', f.value);
    f.blur();
    // Pressing something beside it (its x) counts as a choice
    press(f);
    const clearBtn = d.getElementById('btnClearCustomerSearch');
    clearBtn.dispatchEvent(new w.Event('pointerdown', {bubbles: true})); f.blur(); clearBtn.click(); await wait(320);
    check('pressing its x instead leaves it empty', f.value === '', f.value);
  }catch(e){ check('customer fields', false, e.message); }
  w.close();
}



// ---- Today's website work ----
{
  console.log('\n=== customer-intake.html \u2014 today\u2019s changes ===');
  const boot2 = extra => new JSDOM(fs.readFileSync('customer-intake.html','utf8'),{
    runScripts:'dangerously',pretendToBeVisual:true,url:'https://example.com/',
    beforeParse(w){
      w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
      w.scrollTo=()=>{};w.scrollBy=()=>{};w.alert=()=>{};
      w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){},fillRect(){}});
      w.console.warn=()=>{};w.console.error=()=>{};
      w.Element.prototype.scrollIntoView=function(){};
      w.indexedDB=global.indexedDB;w.IDBKeyRange=global.IDBKeyRange;
      w.localStorage.setItem('weir:photoEveryone','{}');
      w.localStorage.setItem('weir:chemProductsSeeded','true'); w.localStorage.setItem('weir:repairProductsSeeded','true');
      const base = {
        companyName: 'Triffic Pool and Spa', accountPhone: '(623) 555-0100',
        customers: [{id:'a',name:'Alpha Smith',address:'1 A St',email:'a@x.com',active:true,hasPool:true},
                    {id:'b',name:'Bravo Jones',active:true,hasPool:true},{id:'c',name:'Charlie Brown',active:true,hasPool:true}],
        productsServices: [{key:'p1',name:'Acid wash',price:'250',category:'repairs'},{key:'p2',name:'Filter clean',price:'85',category:'repairs'}],
        workOrders: [{id:'q1',customerId:'a',type:'Quote',lineItems:[],total:10,date:'2026-09-20',createdAt:'2026-09-20T15:00:00Z'},
                     {id:'o1',customerId:'a',type:'Work Order',lineItems:[],total:20,date:'2026-09-21',createdAt:'2026-09-21T15:00:00Z'}],
        jobSubmissions: [{key:'work order:w1',kind:'work order',customerName:'Alpha Smith',title:'Swap cartridge',submittedAt:'2026-09-24T17:00:00Z'},
                         {key:'task:k1:a',kind:'task',customerName:'Alpha Smith',title:'Check seal',submittedAt:'2026-09-24T18:00:00Z'}],
        customerGroups: [{id:'g1',name:'Salt pools',customerIds:['a','b'],config:{pool:{chemicals:[],dosages:[]}}}],
        customChemConfig: {a:{pool:{chemicals:[],dosages:[]}},b:{pool:{chemicals:[],dosages:[]}},c:{pool:{chemicals:[],dosages:[]}}}
      };
      Object.keys(Object.assign(base, extra || {})).forEach(k=> w.localStorage.setItem('weir:'+k, JSON.stringify(base[k])));
    }});
  const dom = boot2();
  await wait(1500);
  const w = dom.window, d = w.document;
  try{
    w.eval("siteUser={id:'u',companyId:'co',role:'owner'}; hideSiteLogin(); switchView('workcenter');");
    const type = t => d.querySelector('#wcTypeToggle [data-wctype="' + t + '"]').click();
    const tab = v => d.querySelector('#wcViewControl [data-wcview="' + v + '"]').click();
    const shown = id => d.getElementById(id).style.display !== 'none';

    // Tabs and History, each kind its own
    // Quote History holds answered quotes: mark this test's quotes approved first
    w.eval("workOrders.forEach(x => { if((x.type || 'Quote') === 'Quote'){ x.closed = true; x.approved = true; } }); saveWorkOrders();");
    type('Quote'); tab('history');
    check('Quote History lists answered quotes only, tagged', shown('wcQuotesHistoryCard') && /APPROVED/.test(d.getElementById('wcHistoryList').textContent)
          && !/Work Order/.test(d.getElementById('wcHistoryList').textContent) && !shown('wcSubmittedCard'));
    type('Work Order'); tab('history');
    check('Work Order History shows only work orders submitted from the field',
          d.getElementById('wcQuotesHistoryCard').style.display === 'none' && /Swap cartridge/.test(d.getElementById('wcSubmittedList').textContent)
          && !/Check seal/.test(d.getElementById('wcSubmittedList').textContent));
    type('Task'); tab('history');
    check('Task History lists only tasks submitted from the field',
          /Check seal/.test(d.getElementById('wcSubmittedList').textContent) && !/Swap cartridge/.test(d.getElementById('wcSubmittedList').textContent)
          && !shown('wcQuotesHistoryCard'));
    type('Quote');
    check('changing kind starts on its own tab', w.eval('wcView') === 'main' && d.getElementById('btnWcViewMain').textContent === 'Quote');

    // Each kind keeps its own entries for a minute
    w.eval("wcSelectedCustomerIds=['a']; renderWcCustomerChips();"); d.getElementById('wcNotes').value = 'Heater quote';
    type('Work Order');
    check('Work Order does not show what was typed in Quote', d.getElementById('wcNotes').value === '' && w.eval("wcSelectedCustomerIds.length") === 0);
    type('Quote');
    check('back to Quote within the minute, it is all there', d.getElementById('wcNotes').value === 'Heater quote' && w.eval("wcSelectedCustomerIds.join()") === 'a');
    type('Task'); const realNow = w.Date.now; w.Date.now = () => realNow() + 61000; type('Quote'); w.Date.now = realNow;
    check('after a minute the form is blank', d.getElementById('wcNotes').value === '');

    // Line items
    d.getElementById('btnAddLineItem').click();
    const li = () => d.querySelectorAll('#wcLineItems .fountain-row')[0].querySelectorAll('input');
    check('a new line item starts at quantity 1', li()[1].value === '1');
    li()[0].value = 'Acid wash'; li()[0].dispatchEvent(new w.Event('input', {bubbles: true}));
    li()[0].value = 'Filter clean'; li()[0].dispatchEvent(new w.Event('input', {bubbles: true}));
    check('choosing another item replaces the price', li()[2].value === '85', li()[2].value);
    check('the price box shows a $', Array.from(d.querySelectorAll('#wcLineItems .fountain-row')[0].querySelectorAll('span')).some(x => x.textContent === '$'));

    // Quote email: the report's style, through the report function
    w.eval("window.__sent=[]; sbFetch = async (path, o)=>{ window.__sent.push({path, body: JSON.parse(o.body)}); return {ok:true,status:200,body:{}}; };");
    w.eval("wcSelectedCustomerIds=['a']; renderWcCustomerChips(); currentLineItems=[{description:'Acid wash',qty:1,price:'250'}]; renderLineItems();");
    d.getElementById('btnSendWorkOrder').click(); await wait(300);
    const calls = JSON.parse(w.eval("JSON.stringify(window.__sent)"));
    // First the quote's code is saved (for the Approve / Decline buttons), then the email goes
    const mails = calls.filter(c => c.path === '/functions/v1/send-report');
    const mail = mails[0] || {body: {}};
    check('a quote is sent through the report function', mails.length === 1, JSON.stringify(calls.map(c => c.path)));
    check('as a designed email with the items and total', /<table/.test(mail.body.html || '') && /Acid wash/.test(mail.body.html || '') && /\$250\.00/.test(mail.body.html || ''));
    check('from the company\u2019s own name', mail.body.subject === 'Quote from Triffic Pool and Spa \u2014 Alpha Smith', mail.body.subject);
    const code = calls.find(c => c.path.indexOf('/rest/v1/quote_responses') === 0);
    check('the quote\u2019s answer code is saved before the email goes', !!code && calls.indexOf(code) < calls.indexOf(mails[0]) && /^[0-9a-f]{32}$/.test(code.body.token || ''));
    check('the email has Approve and Decline buttons for that code', !!code && (mail.body.html || '').indexOf('t=' + code.body.token + '&a=approve') !== -1
          && (mail.body.html || '').indexOf('&a=deny') !== -1 && />Decline</.test(mail.body.html || ''));
    check('and the quote\u2019s number beside QUOTE (#0001)', /#0001/.test(mail.body.html || ''));
    check('the quote keeps its number and a copy of the email', w.eval("(()=>{ const q = workOrders.filter(x => (x.type||'Quote')==='Quote').slice(-1)[0]; return q.number === 1 && /Acid wash/.test(q.emailHtml || ''); })()"));
    check('the company name is not written into the page', fs.readFileSync('customer-intake.html', 'utf8').indexOf('Triffic Pool & Spa') === -1);
    // Customize email
    type('Work Order');
    check('Customize email is not offered on Work Order', d.getElementById('btnCustomizeQuoteEmail').style.display === 'none');
    type('Quote');
    d.getElementById('btnCustomizeQuoteEmail').click();
    check('Customize email opens with the current wording', d.getElementById('quoteEmailOverlay').style.display === 'flex'
          && /ready to go ahead/.test(d.getElementById('qeClosing').value));
    d.getElementById('qeHeader').value = 'Triffic Pools'; d.getElementById('qeClosing').value = 'Call to book.';
    d.getElementById('qeContact').checked = false;
    d.getElementById('btnSaveQuoteEmail').click();
    const custom = w.eval("quoteEmailHtml(customers[0],'Quote','Today',[{description:'X',qty:1,price:1}],1,'')");
    check('saved wording is used by the next quote', /Triffic Pools/.test(custom) && /Call to book\./.test(custom) && !/555-0100/.test(custom));
    d.getElementById('btnCustomizeQuoteEmail').click();
    w.eval("window.__asked = []; confirmDialog = (msg)=>{ window.__asked.push(msg); return Promise.resolve(true); };");
    d.getElementById('btnQeReset').click(); await wait(50);
    check('Reset asks first', /default/.test(w.eval("window.__asked.join(' ')")));
    check('then puts the default wording back', d.getElementById('qeHeader').value === '' && /ready to go ahead/.test(d.getElementById('qeClosing').value),
          JSON.stringify([d.getElementById('qeHeader').value, d.getElementById('qeClosing').value]));
    check('and saves it', (JSON.parse(w.localStorage.getItem('weir:quoteEmailStyle')) || {}).header === '');
    d.getElementById('btnCancelQuoteEmail').click();

    // Windows close only from their buttons; the × is drawn
    d.getElementById('btnCustomizeQuoteEmail').click();
    const ov = d.getElementById('quoteEmailOverlay');
    ov.dispatchEvent(new w.MouseEvent('click', {bubbles: true}));
    check('clicking a window\u2019s backdrop leaves it open', ov.style.display === 'flex');
    d.getElementById('btnCancelQuoteEmail').click();
    check('its own button closes it', ov.style.display === 'none');
    check('no window closes from its backdrop any more', !/target === overlay\) (cleanup|close|shut|done|finish)/.test(fs.readFileSync('customer-intake.html', 'utf8')));
    d.getElementById('btnAddLineItem').click(); await wait(50);
    const xBtn = d.querySelector('#wcLineItems .fountain-remove');
    check('a remove button\u2019s \u00d7 is drawn, not typed', xBtn.dataset.xDrawn === '1' && !!xBtn.querySelector('svg') && xBtn.textContent.trim() === '');

    // Products and settings from another device reach the page\u2019s working copy
    const fromPhone = JSON.parse(w.localStorage.getItem('weir:productsServices')); fromPhone[0].price = '999';
    w.eval("syncApplyRecord('setup','productsServices',{value:" + JSON.stringify(fromPhone) + "},false)");
    check('a price changed on another device reaches the page', w.eval("productsServices[0].price") === '999');
    const cfg = JSON.parse(w.eval("JSON.stringify(chemConfig)")); cfg.spa.dosages.push({key:'dose_phone',label:'From phone',unit:'lb',buttons:[]});
    w.eval("syncApplyRecord('setup','chemConfig',{value:" + JSON.stringify(cfg) + "},false)");
    check('a dosage added on another device reaches the page', w.eval("chemConfig.spa.dosages.some(x => x.label === 'From phone')"));
    check('products travel with the company setup', /'productsServices',/.test(fs.readFileSync('customer-intake.html', 'utf8')));

    // Groups
    w.eval("switchView('customerconfig');"); await wait(200);
    const setups = () => Array.from(d.querySelectorAll('#customExistingList > div')).map(r => r.textContent).join(' | ');
    check('customers in a group are not listed as custom setups', !/Smith|Jones/.test(setups()) && /Brown/.test(setups()), setups());
    const gRow = () => Array.from(d.querySelectorAll('#customGroupList > div')).find(r => /Salt pools/.test(r.textContent));
    gRow().click(); await wait(100);
    check('pressing a group opens it and its setup', w.eval('groupOpenId') === 'g1' && w.eval('customGroupId') === 'g1');
    const grid = d.querySelector('#customGroupList [style*="grid-template-columns"]');
    check('its customers are in five columns', !!grid && /repeat\(5/.test(grid.getAttribute('style')) && grid.children.length === 2);
    const cRow = Array.from(d.querySelectorAll('#customExistingList > div')).find(r => /Brown/.test(r.textContent));
    cRow.click(); await wait(100);
    check('pressing a customer with a setup closes the group and switches', w.eval('groupOpenId') === null && w.eval('customCustomerId') === 'c' && w.eval('customGroupId') === null);
    gRow().click(); await wait(100);
    w.eval("confirmDialog = ()=> Promise.resolve(true);");
    Array.from(d.querySelectorAll('#customGroupList [style*="grid-template-columns"] button')).find(b => /Jones, Bravo/.test(b.title)).click();
    await wait(100);
    check('the \u00d7 beside a name takes them out of the group', w.eval("customerGroups[0].customerIds.join()") === 'a' && !w.eval("customConfig['b']"));

    // Customer fields empty on click and come back if nothing is chosen
    const f = d.getElementById('customerSearch');
    w.eval("switchView('customers');"); f.value = 'Alp'; f.dispatchEvent(new w.Event('input', {bubbles: true}));
    f.dispatchEvent(new w.Event('pointerdown', {bubbles: true})); f.focus();
    check('clicking a customer field empties it', f.value === '');
    f.blur(); d.body.dispatchEvent(new w.Event('pointerdown', {bubbles: true})); await wait(350);
    check('clicking away without choosing puts it back', f.value === 'Alp', f.value);
  }catch(e){ check('today\u2019s website changes', false, e.message); }
  w.close();
}


// ---- Sept 25: the website ----
{
  console.log('\n=== customer-intake.html \u2014 Sept 25 ===');
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const plus = n => new Date(Date.now() + n * 86400000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const seed = {
    technicians: [{id: 't1', name: 'Pat'}, {id: 't2', name: 'Sam'}],
    customers: [{id: 'a', name: 'Alpha Smith', address: '1 A St', active: true, hasPool: true, day: 'Monday', technicianId: 't1'},
                {id: 'b', name: 'Bravo Jones', active: true, hasPool: true, day: 'Monday', technicianId: 't2'},
                {id: 'j', name: 'John Tyler', active: true, hasPool: true, day: 'Wednesday', technicianId: 't2'}],
    routeOrders: {Monday: {r1: ['b', 'a']}},
    workOrders: [{id: 'wo1', customerId: 'a', type: 'Work Order', lineItems: [{description: 'Fix light', qty: 1, price: 80}], total: 80, createdAt: '2026-09-20T10:00:00Z'},
                 {id: 'q1', customerId: 'a', type: 'Quote', lineItems: [{description: 'Heater', qty: 1, price: 900}], total: 900, date: '2026-09-21', createdAt: '2026-09-21T10:00:00Z'}],
    scheduledWorkOrders: [{id: 'jGone', workOrderId: 'woGONE', customerId: 'j', technicianId: 't2', date: plus(1), title: 'Filter clean', status: 'scheduled'},
                          {id: 'j1', workOrderId: 'wo1', customerId: 'a', technicianId: 't1', date: plus(2), title: 'Fix light', status: 'scheduled'},
                          {id: 'jDone', workOrderId: 'wo1', customerId: 'a', technicianId: 't1', date: today, title: 'Fix light', status: 'done', doneAt: '2026-09-25T12:00:00Z', doneBy: 't1', doneNotes: 'Bulb fitted.'}],
    tasks: [{id: 'k1', title: 'Check seal', technicianId: 't1', date: plus(1), customerIds: ['a'], done: false},
            {id: 'kDone', title: 'Drop kit', technicianId: 't1', date: today, customerIds: [], done: true, doneAt: '2026-09-25T13:00:00Z', doneBy: 't1', doneNotes: 'Left at gate.'}],
    scheduledFilterCleans: [{id: 'fcX', groupId: 'gX', groupName: 'Elsewhere', customerId: 'j', technicianId: 't2', date: plus(3), status: 'scheduled'}],
    taskTemplates: [{id: 'tt1', name: 'Check seal', title: 'Check seal', details: 'old'}]
  };
  const dom = new JSDOM(fs.readFileSync('customer-intake.html', 'utf8'), {runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.com/',
    beforeParse(w){
      w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
      w.scrollTo=()=>{}; w.scrollBy=()=>{}; w.alert=()=>{}; w.console.warn=()=>{}; w.console.error=()=>{};
      w.Element.prototype.scrollIntoView=function(){}; w.HTMLCanvasElement.prototype.getContext=()=>({});
      w.localStorage.setItem('weir:photoEveryone', '{}');
      Object.keys(seed).forEach(k => w.localStorage.setItem('weir:' + k, JSON.stringify(seed[k])));
    }});
  await wait(1500);
  const w = dom.window, d = w.document;
  const src = fs.readFileSync('customer-intake.html', 'utf8');
  try{
    w.eval("siteUser={id:'u',companyId:'co',role:'owner'}; hideSiteLogin(); window.__asked=[]; confirmDialog=(m)=>{ window.__asked.push(m); return Promise.resolve(true); };"
      + " window.__sent=[]; sbFetch = async (path, o)=>{ if(path.indexOf('amend_visit')!==-1) window.__sent.push(JSON.parse(o.body)); return {ok:true,status:200,body:{result:'saved'}}; };");
    check('the out-of-date blue note is gone', !/appear automatically in the main Weir app/.test(d.body.textContent));
    check('search boxes show no browser suggestions', Array.from(d.querySelectorAll('input')).filter(i => /search/i.test(i.id || '')).every(i => ['off', 'weir-search'].indexOf(i.getAttribute('autocomplete')) !== -1));
    check('the website\u2019s sign-in can go back to the app\u2019s sign-in', /index\.html\?app=service/.test(d.getElementById('btnLoginBack').getAttribute('onclick')));
    // Route Scheduling by technician; an old named-route order is split by technician once
    check('a route is a technician\u2019s customers', w.eval("routeKeyFor(customers[0])") === 't1');
    const split = JSON.parse(w.eval("JSON.stringify(dayOrdersFor('Monday'))"));
    check('an old order is split by technician, nobody reshuffled', JSON.stringify(split) === '{"t2":["b"],"t1":["a"]}', JSON.stringify(split));
    // Customers row: Day and Technician changed on the row, extra days on their own
    w.eval("customers[0].extraDays = ['Thursday']; switchView('customers');");
    const rowA = Array.from(d.querySelectorAll('#customerList .cust-row')).find(r => /Alpha/.test(r.textContent));
    const daySel = Array.from(rowA.querySelectorAll('select')).filter(x => /day/i.test(x.getAttribute('aria-label')));
    check('each of a customer\u2019s days is its own menu on the row', daySel.length === 2);
    daySel[1].value = 'Friday'; daySel[1].dispatchEvent(new w.Event('change'));
    check('changing the extra day leaves the main day', w.eval("customers[0].day") === 'Monday' && w.eval("customers[0].extraDays.join()") === 'Friday');
    check('an extra day counts as a service day', w.eval("customerServicedOn(customers[0], 'Friday')") && !w.eval("customerServicedOn(customers[0], 'Tuesday')"));
    // Profile: Done closes on the first press (the stale "wanted" note is cleared)
    check('a profile field closes on the first press of Done', /if\(profileRowWanted === label\) profileRowWanted = null;/.test(src));
    // Dosage rules: a sync waits while a window is open; borrowed rules show names
    check('a borrowed rule shows its dosage by name', w.eval("chemConfig.spa.dosages.push({key:'dose_x', label:'Muriatic acid'}); doseNameFor('dose_x', 'spa', [])") === 'Muriatic acid');
    const ov = d.createElement('div'); ov.className = 'confirm-overlay'; d.body.appendChild(ov);
    w.eval("syncApplyRecord('setup','chemConfig',{value: JSON.parse(localStorage.getItem('weir:chemConfig'))},false)");
    check('a sync waits while a window is open', w.eval("syncCopiesWaiting.size") === 1);
    ov.remove(); await wait(700);
    check('and is taken in once it closes', w.eval("syncCopiesWaiting.size") === 0);
    // Enter confirms, Escape cancels
    w.eval("window.__real = null;");
    const realConfirm = w.eval("(function(){ return typeof confirmDialog; })()");
    // WorkCenter: Current tab
    w.eval("confirmDialog = (m)=>{ window.__asked.push(m); return Promise.resolve(true); }; switchView('workcenter');");
    const kind = k => d.querySelector('#wcTypeToggle [data-wctype="' + k + '"]').click();
    const tab = v => d.querySelector('#wcViewControl [data-wcview="' + v + '"]').click();
    kind('Work Order'); tab('current');
    const cur = () => d.getElementById('wcCurrentList').textContent;
    check('Work Order \u2192 Current lists scheduled visits', /Fix light/.test(cur()) && /Filter clean/.test(cur()) && !/Bulb fitted/.test(cur()));
    check('and flags one whose work order was deleted', /Work order deleted/.test(cur()));
    Array.from(d.querySelectorAll('#wcCurrentList > div')).find(r => /Filter clean/.test(r.textContent)).querySelector('button[title="Take this one off the route"]').click();
    await wait(80);
    check('\u00d7 takes a visit off the route', !w.eval("(lsGet('scheduledWorkOrders')||[]).some(j => j.id === 'jGone')"));
    tab('history');
    check('Work Order History shows visits finished in the field, with who and the notes', /Fix light/.test(d.getElementById('wcSubmittedList').textContent) && /by Pat/.test(d.getElementById('wcSubmittedList').textContent) && /Bulb fitted/.test(d.getElementById('wcSubmittedList').textContent));
    kind('Task'); tab('current');
    check('Task \u2192 Current lists open tasks only', /Check seal/.test(cur()) && !/Drop kit/.test(cur()));
    tab('history');
    check('Task History shows tasks finished in the field', /Drop kit/.test(d.getElementById('wcSubmittedList').textContent) && /Left at gate/.test(d.getElementById('wcSubmittedList').textContent));
    kind('Quote'); tab('current');
    check('each open quote has Mark approved and Mark declined', Array.from(d.querySelectorAll('#wcCurrentList button')).some(b => b.textContent === 'Mark approved')
          && Array.from(d.querySelectorAll('#wcCurrentList button')).some(b => b.textContent === 'Mark declined'));
    Array.from(d.querySelectorAll('#wcCurrentList button')).find(b => b.textContent === 'Mark approved').click(); await wait(50);
    check('Mark approved takes a quote off Current, approved', !/Heater/.test(cur()) && w.eval("workOrders.some(x => x.id === 'q1' && x.closed && x.approved)"));
    // Select several and delete
    kind('Task'); tab('current');
    Array.from(d.querySelectorAll('#wcCurrentList button')).find(b => b.textContent === 'Select').click(); await wait(20);
    Array.from(d.querySelectorAll('#wcCurrentList button')).find(b => b.textContent === 'Select all').click(); await wait(20);
    Array.from(d.querySelectorAll('#wcCurrentList button')).find(b => /selected/.test(b.textContent)).click(); await wait(80);
    check('Select all and delete clears the list', !w.eval("tasks.some(t => !t.done)"));
    // Deleting a work order always takes its visits off the routes
    // (from the customer's profile, where saved work orders are listed)
    w.eval("switchView('customers'); viewCustomer(customers[0]); renderCustomerWorkOrders('a');"); await wait(100);
    Array.from(d.querySelectorAll('#custWorkOrderList button')).filter(b => /Delete/.test(b.textContent))
      .find(b => /Fix light|Work Order/.test((b.closest('.cust-row') || b.parentElement.parentElement).textContent)).click(); await wait(120);
    w.eval("switchView('workcenter');");
    check('deleting a work order takes all its visits off the routes', !w.eval("(lsGet('scheduledWorkOrders')||[]).some(j => j.workOrderId === 'wo1')"));
    // Tasks form: no Editing heading, no list below, Photo required
    kind('Task'); tab('main');
    check('no "Tasks on the schedule" list', d.getElementById('wcTaskListCard').style.display === 'none');
    check('no "Editing\u2026" heading is written any more', src.indexOf("heading.textContent = 'Editing a saved '") === -1 && src.indexOf("'Editing \"' + t.title") === -1);
    d.getElementById('taskTitle').value = 'Photo test'; d.getElementById('taskPhotoRequired').checked = true;
    w.eval("setPickedTechIds(document.getElementById('taskTechnician'), ['t1']);");
    d.getElementById('btnSaveTask').click(); await wait(80);
    check('Photo required is saved with a task', w.eval("tasks.some(t => t.title === 'Photo test' && t.photoRequired === true)"));
    // Saved tasks: one per name
    w.eval("promptDialog = ()=> Promise.resolve('check SEAL');");
    d.getElementById('taskTitle').value = 'Check seal'; d.getElementById('taskDetails').value = 'new';
    d.getElementById('btnSaveTaskTemplate').click(); await wait(80);
    const tpl = JSON.parse(w.localStorage.getItem('weir:taskTemplates'));
    check('saving a saved task with a taken name asks, then overwrites it', tpl.length === 1 && tpl[0].details === 'new' && w.eval("window.__asked.some(m => /already exists/.test(m))"));
    // Leftover filter cleans
    w.eval("applyWorkCenterMode('filters'); renderFilterGroups();");
    check('filter cleans no group here made are listed', /Tyler, John/.test(d.getElementById('wcFilterStrayList').textContent));
  }catch(e){ check('Sept 25 website', false, e.message); }
  w.close();
}


// ---- Sodium Bicarbonate on the spa must stay ----
{
  console.log('\n=== customer-intake.html \u2014 lists are never overwritten by a page load ===');
  const OLD = {pool:{chemicals:[{key:'chlorine',label:'Chlorine'}],dosages:[{key:'tabs',label:'Tabs'}]},
               spa:{chemicals:[{key:'chlorine',label:'Chlorine'}],dosages:[{key:'tabs',label:'Tabs'}]}, fountain:{chemicals:[],dosages:[]}};
  const PROD = [{key:'p1',name:'Acid wash',price:'250',category:'repairs'}];
  const dom = new JSDOM(fs.readFileSync('customer-intake.html','utf8'), {runScripts:'dangerously', pretendToBeVisual:true, url:'https://example.com/',
    beforeParse(w){ w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
      w.scrollTo=()=>{}; w.alert=()=>{}; w.console.warn=()=>{}; w.console.error=()=>{}; w.HTMLCanvasElement.prototype.getContext=()=>({});
      w.localStorage.setItem('weir:chemConfig', JSON.stringify(OLD)); w.localStorage.setItem('weir:productsServices', JSON.stringify(PROD)); }});
  await wait(1500);
  const w = dom.window;
  try{
    check('opening the page leaves the stored lists exactly as they were (nothing to send over another device\u2019s)',
          w.localStorage.getItem('weir:chemConfig') === JSON.stringify(OLD));
    check('and leaves the stored products as they were', w.localStorage.getItem('weir:productsServices') === JSON.stringify(PROD));
    check('while the page still fills in the quick buttons for use', w.eval("chemConfig.pool.chemicals.every(c => Array.isArray(c.buttons))"));
    w.eval("siteUser={id:'u',companyId:'co',role:'owner'}; hideSiteLogin(); appSettings.applyPoolDosagesToAll = true;"
      + " chemConfig.spa.dosages.push({key:'dose_sb', label:'Sodium Bicarbonate', unit:'lb', buttons:[]}); selectedChemConfigType='pool'; saveChemConfig();");
    const after = JSON.parse(w.localStorage.getItem('weir:chemConfig'));
    check('"use the pool\u2019s dosages for all" keeps what only the spa has', after.spa.dosages.some(x => x.label === 'Sodium Bicarbonate')
          && after.spa.dosages.some(x => x.key === 'tabs'));
  }catch(e){ check('lists never overwritten', false, e.message); }
  w.close();
}


// ---- Sept 26: quotes, work orders and the WorkCenter lists ----
{
  console.log('\n=== customer-intake.html \u2014 Sept 26 ===');
  const iso = n => new Date(Date.now() + n * 86400000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const ago = n => new Date(Date.now() - n * 86400000).toISOString();
  const seed = {
    technicians: [{id: 't1', name: 'Pat'}],
    customers: [{id: 'a', name: 'Alpha Smith', address: '12 Palm Way', phone: '5550101', email: 'a@x.test', active: true, hasPool: true},
                {id: 'b', name: 'Bravo Jones', address: '9 Oak St', active: true, hasPool: true}],
    workOrders: [
      {id: 'q1', customerId: 'a', type: 'Quote', name: 'Heater job', number: 3, lineItems: [{description: 'Heater', qty: 1, price: 900}], total: 900, createdAt: ago(2), status: 'sent'},
      {id: 'q2', customerId: 'b', type: 'Quote', lineItems: [{description: 'Pump', qty: 1, price: 500}], total: 500, createdAt: ago(40), status: 'sent'},
      {id: 'q3', customerId: 'a', type: 'Quote', lineItems: [{description: 'Lights', qty: 2, price: 50}], total: 100, createdAt: ago(5), status: 'sent', closed: true, denied: true},
      {id: 'q4', customerId: 'b', type: 'Quote', lineItems: [{description: 'Filter', qty: 1, price: 80}], total: 80, createdAt: ago(6), status: 'sent', closed: true, approved: true},
      {id: 'w1', customerId: 'a', type: 'Work Order', number: 5, lineItems: [{description: 'Fix light', qty: 1, price: 80}], total: 80, createdAt: ago(1)}],
    scheduledWorkOrders: [{id: 'j1', workOrderId: 'w1', customerId: 'a', technicianId: 't1', date: iso(1), title: 'Fix light', status: 'scheduled'}],
    tasks: [{id: 'k1', title: 'Check seal', technicianId: 't1', date: iso(1), customerIds: ['b'], done: false}],
    quoteCounter: 3, workOrderCounter: 5
  };
  const dom = new JSDOM(fs.readFileSync('customer-intake.html', 'utf8'), {runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.com/',
    beforeParse(w){
      w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
      w.scrollTo=()=>{}; w.scrollBy=()=>{}; w.alert=()=>{}; w.console.warn=()=>{}; w.console.error=()=>{};
      w.Element.prototype.scrollIntoView=function(){}; w.HTMLCanvasElement.prototype.getContext=()=>({});
      w.localStorage.setItem('weir:photoEveryone', '{}');
      Object.keys(seed).forEach(k => w.localStorage.setItem('weir:' + k, JSON.stringify(seed[k])));
    }});
  await wait(1500);
  const w = dom.window, d = w.document;
  try{
    w.eval("siteUser={id:'u',companyId:'co',role:'owner'}; hideSiteLogin(); confirmDialog=()=>Promise.resolve(true); sbFetch = async ()=>({ok:false,status:0,body:null}); switchView('workcenter');");
    const kind = k => d.querySelector('#wcTypeToggle [data-wctype="' + k + '"]').click();
    const tab = v => d.querySelector('#wcViewControl [data-wcview="' + v + '"]').click();
    const num = () => d.getElementById('wcQuoteNumber');
    kind('Quote'); tab('main');
    check('the Quote form shows the next quote number, #0004', num().style.display !== 'none' && num().textContent === '#0004', num().textContent);
    check('and a Quote name box; no Photo required box', d.getElementById('wcQuoteNameField').style.display !== 'none' && d.getElementById('wcPhotoRequiredWrap').style.display === 'none');
    kind('Work Order');
    check('Work Order counts on its own: #0006', num().textContent === '#0006', num().textContent);
    check('Photo required starts ticked on a new work order', d.getElementById('wcPhotoRequired').checked === true);
    check('no Quote name box on Work Order', d.getElementById('wcQuoteNameField').style.display === 'none');
    // Current: an old unanswered quote expires; search by address
    kind('Quote'); tab('current');
    const cur = () => d.getElementById('wcCurrentList').textContent;
    check('a quote unanswered 30 days expires out of Current', !/Jones/.test(cur()) && w.eval("workOrders.find(x => x.id === 'q2').expired === true"));
    check('Current shows the customer and the quote name', /Smith, Alpha \u2014 Heater job/.test(cur()), cur().slice(0, 80));
    d.getElementById('wcCurrentSearch').value = 'palm way'; d.getElementById('wcCurrentSearch').dispatchEvent(new w.Event('input'));
    check('Current searches by address too', /Heater job/.test(cur()));
    d.getElementById('wcCurrentSearch').value = ''; d.getElementById('wcCurrentSearch').dispatchEvent(new w.Event('input'));
    Array.from(d.querySelectorAll('#wcCurrentList button')).find(b => b.textContent === 'Mark declined').click(); await wait(50);
    check('Mark declined moves a quote to History as declined', w.eval("(q => q.closed && q.denied)(workOrders.find(x => x.id === 'q1'))"));
    // History: tags, menu
    tab('history');
    const hist = () => d.getElementById('wcHistoryList').textContent;
    check('History tags each quote APPROVED, DECLINED or EXPIRED', /APPROVED/.test(hist()) && /DECLINED/.test(hist()) && /EXPIRED/.test(hist()));
    const pick = v => { const m = d.getElementById('wcHistoryOutcome'); m.value = v; m.dispatchEvent(new w.Event('change')); };
    pick('expired');  check('the menu shows only expired', /EXPIRED/.test(hist()) && !/APPROVED|DECLINED/.test(hist()));
    pick('denied');   check('only declined', /DECLINED/.test(hist()) && !/APPROVED|EXPIRED/.test(hist()));
    pick('approved'); check('only approved', /APPROVED/.test(hist()) && !/DECLINED|EXPIRED/.test(hist()));
    pick('');
    // Convert to work order
    const approvedRow = Array.from(d.querySelectorAll('#wcHistoryList .cust-row')).find(r => /APPROVED/.test(r.textContent));
    Array.from(approvedRow.querySelectorAll('button')).find(b => b.textContent === 'Convert to work order').click(); await wait(60);
    check('Convert to work order opens a new work order with the quote\u2019s customer and items',
          d.getElementById('wcType').value === 'Work Order' && w.eval("wcSelectedCustomerIds.join()") === 'b'
          && w.eval("currentLineItems.map(l => l.description).join()") === 'Filter' && d.getElementById('wcPhotoRequired').checked);
    // Mark completed on work orders and tasks
    kind('Work Order'); tab('current');
    Array.from(d.querySelectorAll('#wcCurrentList button')).find(b => b.textContent === 'Mark completed').click(); await wait(50);
    tab('history');
    check('Mark completed moves a work order visit to History, by the office', /Fix light/.test(d.getElementById('wcSubmittedList').textContent) && /by the office/.test(d.getElementById('wcSubmittedList').textContent));
    kind('Task'); tab('current');
    Array.from(d.querySelectorAll('#wcCurrentList button')).find(b => b.textContent === 'Mark completed').click(); await wait(50);
    tab('history');
    check('and a task', /Check seal/.test(d.getElementById('wcSubmittedList').textContent));
    const techMenu = d.getElementById('wcSubmittedTech'); techMenu.value = 't1'; techMenu.dispatchEvent(new w.Event('change'));
    check('History\u2019s technician menu still finds it under its technician', /Check seal/.test(d.getElementById('wcSubmittedList').textContent));
  }catch(e){ check('Sept 26 website', false, e.message); }
  w.close();
}


// ---- Sept 26, later: filter clean groups, search windows, addresses ----
{
  console.log('\n=== customer-intake.html \u2014 filter clean groups and search windows ===');
  const iso = n => new Date(Date.now() + n * 86400000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const seed = {
    technicians: [{id: 't1', name: 'Zed'}, {id: 't2', name: 'amy'}],
    customers: [{id: 'a', name: 'John Tyler', address: '1 Palm Way', city: 'Buckeye', state: 'AZ', zip: '85326', active: true, hasPool: true},
                {id: 'b', name: 'John Tyler', address: '9 Oak St', active: true, hasPool: true},
                {id: 'c', name: 'Cara Diaz', address: '3 Elm Rd', active: true, hasPool: true}],
    filterGroups: [{id: 'g1', name: 'North', customerIds: ['a', 'c'], date: iso(2), technicianId: 't1'},
                   {id: 'g2', name: 'South', customerIds: ['b'], date: iso(3), technicianId: 't2'},
                   {id: 'g3', name: 'Unassigned', customerIds: [], date: '', technicianId: ''}]
  };
  const dom = new JSDOM(fs.readFileSync('customer-intake.html', 'utf8'), {runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.com/',
    beforeParse(w){
      w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
      w.scrollTo=()=>{}; w.scrollBy=()=>{}; w.alert=()=>{}; w.console.warn=()=>{}; w.console.error=()=>{};
      w.Element.prototype.scrollIntoView=function(){}; w.HTMLCanvasElement.prototype.getContext=()=>({});
      w.localStorage.setItem('weir:photoEveryone', '{}');
      Object.keys(seed).forEach(k => w.localStorage.setItem('weir:' + k, JSON.stringify(seed[k])));
    }});
  await wait(1500);
  const w = dom.window, d = w.document;
  try{
    w.eval("siteUser={id:'u',companyId:'co',role:'owner'}; hideSiteLogin(); confirmDialog=()=>Promise.resolve(true); switchView('workcenter'); applyWorkCenterMode('filters'); openFilterGroupIds.add('g1'); renderFilterGroups();");
    await wait(80);
    const list = () => d.getElementById('filterGroupList');
    const headings = () => Array.from(list().querySelectorAll(':scope > [data-reorder-key]')).map(c => c.dataset.reorderKey).join(',');
    check('the subtext says to press Schedule and mentions emails', /press Schedule to push it onto that technician\u2019s route\. Customize emails/.test(d.getElementById('wcFiltersSection').textContent.replace(/'/g, '\u2019')));
    check('no Save group button', !/Save group/.test(list().textContent));
    check('each group has a drag grip', list().querySelectorAll(':scope > [data-reorder-key] span[title="Drag to reorder"]').length === 3);
    check('each heading lights up under the pointer', list().querySelectorAll('.fg-head').length === 3);
    // The date: saved as it changes, no redraw, heading updated
    const dateBox = list().querySelector('input[type="date"]');
    dateBox.value = iso(5); dateBox.dispatchEvent(new w.Event('change'));
    await wait(30);
    check('a group\u2019s date saves as it changes', JSON.parse(w.localStorage.getItem('weir:filterGroups')).find(g => g.id === 'g1').date === iso(5));
    check('without redrawing the list (the box stays the same one)', list().querySelector('input[type="date"]') === dateBox);
    dateBox.dispatchEvent(new w.Event('blur')); await wait(30);
    check('nor on leaving the box, so the next click lands', list().querySelector('input[type="date"]') === dateBox);
    const dayName = new Date(iso(5) + 'T12:00:00').toLocaleDateString(undefined, {weekday: 'short', month: 'short', day: 'numeric'});
    check('the heading shows the new date', list().textContent.indexOf(dayName) !== -1, dayName);
    // Customers in a group: grips, and their order goes to the scheduled cleans
    check('an open group\u2019s customers have drag grips', list().querySelectorAll('span[title^="Drag to reorder \u2014 the order"]').length === 2);
    w.eval("scheduleFilterGroup(filterGroups.find(g => g.id === 'g1')); saveFilterGroups();");
    const order = () => JSON.stringify((JSON.parse(w.localStorage.getItem('weir:scheduledFilterCleans')) || []).filter(x => x.groupId === 'g1').sort((a, b) => a.order - b.order).map(x => x.customerId));
    check('scheduling carries the group\u2019s customer order', order() === '["a","c"]', order());
    w.eval("const g = filterGroups.find(x => x.id === 'g1'); g.customerIds = ['c', 'a']; saveFilterGroups(); setFilterCleanOrder(g);");
    check('reordering a scheduled group updates the order on its cleans', order() === '["c","a"]', order());
    // The technician menu
    const menu = d.getElementById('filterGroupTech');
    w.eval('renderFilterGroups()');
    check('the technician menu lists All, the technicians A\u2013Z, then No technician',
          Array.from(menu.options).map(o => o.textContent).join('|') === 'All technicians|amy|Zed|No technician', Array.from(menu.options).map(o => o.textContent).join('|'));
    menu.value = 't2'; menu.dispatchEvent(new w.Event('change'));
    check('picking one shows only their groups', headings() === 'g2', headings());
    menu.value = 'none'; menu.dispatchEvent(new w.Event('change'));
    check('No technician shows unassigned groups', headings() === 'g3', headings());
    menu.value = ''; menu.dispatchEvent(new w.Event('change'));
    // Away for more than a minute: every group closed
    w.eval("openFilterGroupIds.add('g1'); openFilterGroupIds.add('g2'); filtersLeftAt = Date.now() - 61000; renderFilterGroups();");
    check('after more than a minute away, the groups are closed', w.eval('openFilterGroupIds.size') === 0);
    w.eval("openFilterGroupIds.add('g1'); filtersLeftAt = Date.now() - 20000; renderFilterGroups();");
    check('within the minute they stay open', w.eval("openFilterGroupIds.has('g1')"));
    // The + Add customers window
    w.eval('renderFilterGroups()'); await wait(20);
    Array.from(list().querySelectorAll('button')).find(b => b.textContent === '+ Add customers').click();
    await wait(150);
    const box = d.getElementById('gcpSearch');
    check('+ Add customers opens with the cursor in its search box', d.activeElement === box);
    check('with no \u00d7 beside it', d.getElementById('gcpSearchClear').style.display === 'none' || d.getElementById('gcpSearchClear').hidden);
    check('its search box asks for no browser suggestions', box.getAttribute('autocomplete') === 'weir-search');
    const rows = Array.from(d.querySelectorAll('#gcpList label')).map(l => l.textContent);
    check('each customer shows their full address under the name', rows.some(t => /Tyler, John1 Palm Way, Buckeye, AZ, 85326/.test(t)) && rows.some(t => /Tyler, John9 Oak St/.test(t)), rows.join(' | '));
    box.value = 'palm'; box.dispatchEvent(new w.Event('input', {bubbles: true}));
    box.dispatchEvent(new w.MouseEvent('mousedown', {bubbles: true}));
    check('clicking in the box while typing leaves it alone', box.value === 'palm');
    box.blur(); await wait(10);
    box.dispatchEvent(new w.MouseEvent('mousedown', {bubbles: true}));
    check('clicking back into it after leaving empties it', box.value === '');
    check('and every customer shows again', Array.from(d.querySelectorAll('#gcpList label')).filter(l => l.style.display !== 'none').length === 3);
    // Addresses in the other customer searches
    check('the Task customer box and the other pickers show addresses too', (fs.readFileSync('customer-intake.html', 'utf8').match(/nameWithAddress\(/g) || []).length >= 8);
  }catch(e){ check('filter clean groups and search windows', false, e.stack); }
  w.close();
}

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
  process.exit(fail ? 1 : 0);
})();
