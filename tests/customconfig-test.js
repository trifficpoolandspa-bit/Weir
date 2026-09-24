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

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
  process.exit(fail ? 1 : 0);
})();
