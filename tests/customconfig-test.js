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

  console.log('\n=== starting a new custom setup ===');
  const dom = boot('customer-intake.html');
  const w = dom.window, d = w.document;
  await wait(1300);
  try{
    w.eval("siteUser={id:'u',companyId:'co',role:'owner'}; hideSiteLogin();"
      + " customers=[{id:'c1', name:'Alpha One', hasPool:true, active:true}]; saveCustomers();"
      + " switchView('customerconfig');");
    await wait(250);
    const btn = d.getElementById('btnNewCustomSetup');
    check('there is a button to start one', !!btn);
    // load somebody, then press it
    w.eval("openCustomSetup(customers[0], bodiesForCustomer(customers[0]));");
    await wait(200);
    check('a customer can be loaded', w.eval('customCustomerId') === 'c1', String(w.eval('customCustomerId')));
    btn.click();
    await wait(200);
    check('pressing it clears whoever was loaded', !w.eval('customCustomerId'), String(w.eval('customCustomerId')));
    check('and empties the search box', d.getElementById('customCustSearch').value === '',
          d.getElementById('customCustSearch').value);
    check('with the cursor in it, ready to type a name',
          d.activeElement === d.getElementById('customCustSearch'),
          d.activeElement ? d.activeElement.id : 'nothing focused');
  }catch(e){ check('starting a custom setup', false, e.message); }
  w.close();
}

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
  process.exit(fail ? 1 : 0);
})();
