require('./phone-app.js');
// Part 2 of 4. The suite was one file until it grew past what could
// finish in a single run — checks at the end silently stopped executing. Each
// part shares the same setup below and reports its own result.

// Loads a file headlessly and exercises real behaviour, rather than only
// checking that the code is well-formed.
const { JSDOM } = require('jsdom');
const fs = require('fs');

function load(file, opts = {}){
  const html = fs.readFileSync(file, 'utf8');
  const errors = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: opts.url || 'https://example.com/',
    beforeParse(w){
      // A company that has not ticked any photo for Everyone. New companies start
      // with the pool after photo required; that start is tested on its own.
      w.localStorage.setItem('weir:photoEveryone', '{}');
      w.matchMedia = () => ({matches:false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){}});
      w.scrollTo = () => {}; w.scrollBy = () => {}; w.alert = () => {};
      w.HTMLCanvasElement.prototype.getContext = () => ({drawImage(){}, fillRect(){}});
      w.addEventListener('error', e => errors.push(e.error ? e.error.message : e.message));
      w.console.error = (...a) => errors.push(a.join(' '));
      if(opts.seed){
        Object.keys(opts.seed).forEach(k=>{
          w.localStorage.setItem('weir:' + k, JSON.stringify(opts.seed[k]));
        });
      }
      // Lets a test stub a browser API the app depends on, such as the camera
      if(typeof opts.beforeParse === 'function') opts.beforeParse(w);
      if(opts.fullStorage){
        // Simulate a browser that has run out of room. Must patch the prototype
        // — assigning to localStorage.setItem directly does nothing.
        w.Storage.prototype.setItem = function(){
          const err = new Error('quota'); err.name = 'QuotaExceededError'; throw err;
        };
      }
    }
  });
  return {dom, errors};
}

let pass = 0, fail = 0;
const deferred = [];
// Buttons carry a hidden × for deleting, so read the label without it
function labelOf(b){
  return (b.firstChild && b.firstChild.nodeType === 3)
    ? b.firstChild.textContent.trim()
    : b.textContent.replace('\u00d7','').trim();
}

function check(name, ok, detail){
  if(ok){ pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  — ' + detail : '')); }
}

console.log('\n=== Adding equipment must not wipe default equipment ===');
{
  // A customer who has never had their equipment edited has NO saved list and
  // shows the five defaults. Writing a fresh list containing only the new item
  // replaced that implicit default and deleted their standard equipment.
  const seed = {
    customers: [
      {id:'a', name:'Alpha One', day:'Monday', hasPool:true, active:true},
      {id:'b', name:'Bravo Two', day:'Monday', hasPool:true, active:true},
      {id:'c', name:'Charlie Three', day:'Monday', hasPool:true, active:true,
       equipmentTypeOptions:['Filter','Pump']}
    ]
  };
  const {dom} = load('customer-intake.html', {seed});
  const w = dom.window;
  w.console.warn = ()=>{};
  w.Element.prototype.scrollIntoView = function(){};

  try{
    w.eval("viewCustomer(customers[0]);");
    check('  an unedited customer has no saved list',
          w.eval("customers.find(c=>c.id==='b').equipmentTypeOptions") === undefined
          || w.eval("customers.find(c=>c.id==='b').equipmentTypeOptions") === null);

    w.eval("addEquipmentTypeToCustomers('Salt System', ['b','c']);");
    const b = JSON.parse(w.eval("JSON.stringify(customers.find(c=>c.id==='b').equipmentTypeOptions)"));

    check('  their default Filter survives', b.includes('Filter'), b.join(','));
    check('  their default Pump survives', b.includes('Pump'));
    check('  their default Heater survives', b.includes('Heater'));
    check('  their default Chlorination survives', b.includes('Chlorination'));
    check('  their default Cleaning System survives', b.includes('Cleaning System'));
    check('  and the new item was added', b.includes('Salt System'));

    const cc = JSON.parse(w.eval("JSON.stringify(customers.find(c=>c.id==='c').equipmentTypeOptions)"));
    check('  a customer with a saved list keeps it', cc.includes('Filter') && cc.includes('Pump'));
    check('  and gets the new item too', cc.includes('Salt System'));
    check('  a saved list is not padded with defaults', !cc.includes('Heater'), cc.join(','));
  }catch(e){
    check('  defaults preserved when adding equipment', false, e.message);
  }
}


console.log('\n=== Reset equipment to default ===');
{
  const seed = {
    customers: [{id:'a', name:'Alpha One', day:'Monday', hasPool:true, active:true,
      equipmentTypeOptions:['Filter','Salt System','Booster Pump'],
      equipment:[
        {type:'Filter', filterTypeChoice:'Sand', photos:[{id:'p1', data:'img'}], notes:'backwash weekly'},
        {type:'Salt System', photos:[{id:'p2', data:'img'}]},
        {type:'Booster Pump', photos:[]}
      ]}]
  };
  const {dom} = load('customer-intake.html', {seed});
  const w = dom.window;
  w.console.warn = ()=>{};
  w.Element.prototype.scrollIntoView = function(){};

  try{
    w.eval("viewCustomer(customers[0]);");
    check('  starts with custom equipment',
          w.eval("currentEquipmentTypeOptions.includes('Salt System')"));

    // What the Reset to default button does
    w.eval("currentEquipmentTypeOptions = [...DEFAULT_EQUIPMENT_TYPES];"
         + "currentEquipmentItems = currentEquipmentItems.filter(i => DEFAULT_EQUIPMENT_TYPES.includes(i.type));"
         + "persistCurrentEquipmentTypeOptions(); persistCurrentEquipmentItems();");

    const after = JSON.parse(w.eval("JSON.stringify(currentEquipmentTypeOptions)"));
    check('  exactly five items remain', after.length === 5, after.join(','));
    ['Filter','Pump','Cleaning System','Chlorination','Heater'].forEach(t=>{
      check('  ' + t + ' is present', after.includes(t));
    });
    check('  added equipment is gone',
          !after.includes('Salt System') && !after.includes('Booster Pump'));

    const items = JSON.parse(w.eval("JSON.stringify(currentEquipmentItems)"));
    const filter = items.find(i => i.type === 'Filter');
    check('  a default item keeps its record', !!filter);
    check('  it keeps its photos', filter && filter.photos.length === 1);
    check('  it keeps its notes', filter && filter.notes === 'backwash weekly');
    check('  it keeps its type choice', filter && filter.filterTypeChoice === 'Sand');
    check('  a removed item takes its record with it',
          !items.some(i => i.type === 'Salt System'));

    check('  the change is saved to the customer',
          w.eval("customers.find(c=>c.id==='a').equipmentTypeOptions.length") === 5);
  }catch(e){
    check('  reset to default', false, e.message);
  }
}


console.log('\n=== Technician dropdown opens on the first tap ===');
{
  const seed = {
    customers: [{id:'a', name:'Alpha One', active:true, technicianId:'t1'}],
    technicians: [{id:'t1', name:'Alex Rivera'}, {id:'t2', name:'Sam Okafor'}]
  };
  const {dom} = load('customer-intake.html', {seed});
  const w = dom.window, d = w.document;
  w.console.warn = ()=>{};
  w.Element.prototype.scrollIntoView = function(){};
  // Record whether the app asks the browser to open the list
  w.HTMLSelectElement.prototype.showPicker = function(){ this.__opened = true; };

  try{
    w.eval("viewCustomer(customers[0]);");
    check('  the assigned technician is shown',
          d.getElementById('profileTechName').textContent === 'Alex Rivera');

    d.getElementById('profileTechWrap').click();
    const sel = d.getElementById('profileTechWrap').nextElementSibling;
    check('  one tap creates the dropdown', sel && sel.tagName === 'SELECT');
    check('  and opens it without a second tap', !!(sel && sel.__opened));
    check('  every technician is listed',
          Array.from(sel.options).map(o=>o.textContent).join(',')
            === 'Unassigned,Alex Rivera,Sam Okafor');
    check('  the current one is preselected', sel.value === 't1');

    sel.value = 't2';
    sel.dispatchEvent(new w.Event('change', {bubbles:true}));
    deferred.push(()=>{
      check('  choosing another saves it',
            w.eval("customers.find(c=>c.id==='a').technicianId") === 't2');
    });
  }catch(e){
    check('  technician dropdown', false, e.message);
  }
}


console.log('\n=== Water body sizes, per body, with units ===');
{
  const seed = {
    customers: [{id:'a', name:'Alpha One', active:true, hasPool:true, hasSpa:true,
                 poolGallons:'18000',
                 fountains:[{id:'f1', name:'Front fountain'}]}],
    settings: {showPoolSizeInProfile:true}
  };
  const {dom} = load('customer-intake.html', {seed});
  const w = dom.window, d = w.document;
  w.console.warn = ()=>{};
  w.Element.prototype.scrollIntoView = function(){};

  try{
    w.eval("viewCustomer(customers[0]);");
    const meta = d.getElementById('profileMeta').textContent;
    check('  the row is labelled Water body sizes', meta.includes('Water body sizes'));
    check('  an existing pool volume is carried over', meta.includes('18000'));

    const bodies = JSON.parse(w.eval("JSON.stringify(bodiesForSizes(customers[0]).map(b=>b.label))"));
    check('  every body of water is offered',
          bodies.join(',') === 'Pool,Spa,Front fountain', bodies.join(','));

    check('  the old poolGallons is read as the pool size',
          w.eval("waterBodySize(customers[0],'pool').amount") === '18000');
    check('  a body with no size set reads as nothing',
          w.eval("waterBodySize(customers[0],'spa')") === null);

    w.eval("customers[0].waterSizes = {pool:{amount:'18000',unit:'gallons'},"
         + "spa:{amount:'450',unit:'gallons'}, f1:{amount:'2',unit:'m\u00b3'}}; saveCustomers();");
    w.eval("viewCustomer(customers[0]);");
    const meta2 = d.getElementById('profileMeta').textContent;
    check('  the pool size is shown', meta2.includes('Pool: 18000 gallons'));
    check('  the spa size is shown', meta2.includes('Spa: 450 gallons'));
    check('  a fountain keeps its own unit', meta2.includes('Front fountain: 2 m\u00b3'));
  }catch(e){
    check('  water body sizes', false, e.message);
  }
}


console.log('\n=== Removing a body of water warns first ===');
{
  const seed = {
    customers: [{id:'a', name:'Alpha One', active:true, hasPool:true,
      fountains:[{id:'f1', name:'Front fountain'}, {id:'f2', name:'Koi pond'}],
      waterSizes:{f1:{amount:'200',unit:'gallons'}}}],
    'fountainReadings:a:f1': [
      {id:'r1', date:'2026-09-01T10:00:00Z'},
      {id:'r2', date:'2026-08-25T10:00:00Z'}
    ],
    customChemConfig: {a: {f1: {chemicals:[], dosages:[]}}}
  };
  const {dom} = load('customer-intake.html', {seed});
  const w = dom.window, d = w.document;
  w.console.warn = ()=>{};
  w.Element.prototype.scrollIntoView = function(){};

  try{
    w.eval("viewCustomer(customers[0]);");

    const attached = JSON.parse(w.eval("JSON.stringify(fountainAttachments('f1'))"));
    check('  service reports are counted', attached.includes('2 service reports'), attached.join(','));
    check('  a custom setup is named', attached.includes('its custom readings and dosages'));
    check('  a recorded size is named', attached.includes('its recorded size'));
    check('  a body with nothing attached lists nothing',
          w.eval("fountainAttachments('f2').length") === 0);

    w.eval("showCustomerForm(); renderFountainFields();");
    const btns = d.querySelectorAll('#fountainList .fountain-remove');
    check('  each body has a remove button', btns.length === 2);

    btns[0].click();
    deferred.push(()=>{
      const overlay = d.querySelector('.confirm-overlay');
      check('  removing asks first', !!overlay);
      if(overlay){
        const said = overlay.textContent.replace(/\s+/g,' ');
        check('  the warning names the body of water', said.includes('Front fountain'), said.slice(0,80));
        check('  and says what else goes', said.includes('service report'), said.slice(0,120));
      }
      check('  nothing is removed until confirmed', w.eval("currentFountains.length") === 2);
    });
  }catch(e){
    check('  body of water removal warning', false, e.message);
  }
}


console.log('\n=== Neighborhood and yard gate codes ===');
{
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const today = DAYS[new Date().getDay()];
  const seed = {
    technicians: [{id:'t1', name:'Alex'}],
    customers: [{id:'a', name:'Alpha One', day: today, active:true, hasPool:true,
      technicianId:'t1', gateCode:'4821#', neighborhoodGateCode:'1234#',
      dogs:[{name:'Buddy'}]}]
  };

  // The website profile shows both, correctly labelled
  {
    const {dom} = load('customer-intake.html', {seed});
    const w = dom.window, d = w.document;
    w.console.warn = ()=>{};
    w.Element.prototype.scrollIntoView = function(){};
    w.eval("viewCustomer(customers[0]);");
    const meta = d.getElementById('profileMeta').textContent;
    check('  website shows a Neighborhood gate code row', meta.includes('Neighborhood gate code'));
    check('  website shows a Yard gate code row', meta.includes('Yard gate code'));
    check('  both values appear', meta.includes('1234#') && meta.includes('4821#'));
  }

  // Both field apps show them in the same panel as the dogs
  ['technician-app.html','admin-readings-app.html'].forEach(file=>{
    const {dom} = load(file, {seed});
    const w = dom.window, d = w.document;
    w.console.warn = ()=>{};
    try{
      w.eval("currentUser = {id:'t1', name:'Alex'}; renderHomeList();");
      const rows = Array.from(d.querySelectorAll('.cust-row'));
      if(!rows.length){ check(file + ' route list has the customer', false); return; }
      rows[0].click();
      // Read the panel now — deferring lets other tests reuse these variables
      const t = d.body.textContent;
      check(file + ' shows the neighborhood gate', t.includes('Neighborhood gate'));
      check(file + ' shows the yard gate', t.includes('Yard gate'));
      check(file + ' shows them with the dogs', t.includes('Buddy'));
      check(file + ' shows both codes', t.includes('1234#') && t.includes('4821#'));
    }catch(e){
      check(file + ' gate codes', false, e.message);
    }
  });
}


console.log('\n=== On my way is on the row, Directions in the panel ===');
{
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const today = DAYS[new Date().getDay()];
  const seed = {
    technicians: [{id:'t1', name:'Alex'}],
    customers: [{id:'a', name:'Alpha One', day: today, active:true, hasPool:true,
                 technicianId:'t1', address:'123 Main St', phone:'6234146875'}]
  };

  ['technician-app.html','admin-readings-app.html'].forEach(file=>{
    const {dom} = load(file, {seed});
    const w = dom.window, d = w.document;
    w.console.warn = ()=>{};
    try{
      w.eval("currentUser = {id:'t1', name:'Alex'}; renderHomeList();");
      const row = d.querySelector('.cust-row');
      if(!row){ check(file + ' has a route row', false); return; }

      const rowBtns = Array.from(row.querySelectorAll('button')).map(b=>b.textContent.trim());
      check(file + ' row button is On my way', rowBtns.includes('On my way'), rowBtns.join(','));
      check(file + ' row no longer shows Directions', !rowBtns.includes('Directions'));

      row.click();
      const all = Array.from(d.querySelectorAll('button')).map(b=>b.textContent.trim());
      check(file + ' the panel offers Directions', all.includes('Directions'));
      check(file + ' the panel still offers Skip Service', all.includes('Skip Service'));
    }catch(e){
      check(file + ' button swap', false, e.message);
    }
  });
}


console.log('\n=== Back retraces where you have been ===');
{
  // Each app has its own set of views
  [['technician-app.html','serviced'], ['admin-readings-app.html','customers']].forEach(([file, mid])=>{
    const {dom} = load(file, {seed: {customers: []}});
    const w = dom.window;
    w.console.warn = ()=>{};
    try{
      check(file + ' pushes an entry on every Back, not a counted buffer',
            fs.readFileSync(file,'utf8').indexOf('BACK_GUARD_DEPTH') === -1);
      check(file + ' keeps a navigation stack',
            typeof w.eval("typeof navStack") !== 'undefined' && w.eval("Array.isArray(navStack)"));

      w.eval("switchView('" + mid + "'); switchView('options');");
      check(file + ' records where you have been',
            w.eval("JSON.stringify(navStack.map(p=>p.view))") === '["home","' + mid + '"]',
            w.eval("JSON.stringify(navStack.map(p=>p.view))"));

      const a = JSON.parse(w.eval("JSON.stringify(goBackOnePlace())") || 'null');
      check(file + ' back goes to the previous place', a && a.view === mid,
            a && a.view);

      w.eval("currentViewName = '" + mid + "';");
      const b = JSON.parse(w.eval("JSON.stringify(goBackOnePlace())") || 'null');
      check(file + ' back again goes further back', b && b.view === 'home', b && b.view);

      w.eval("currentViewName = 'home';");
      check(file + ' an empty stack returns nothing rather than throwing',
            w.eval("goBackOnePlace()") === null);
    }catch(e){
      check(file + ' navigation stack', false, e.message);
    }
  });

  // The stack must not grow without bound
  {
    const {dom} = load('technician-app.html', {seed: {customers: []}});
    const w = dom.window;
    w.console.warn = ()=>{};
    w.eval("for(let i=0;i<200;i++){ switchView(i%2 ? 'serviced' : 'options'); }");
    check('  the stack is capped', w.eval("navStack.length") <= 40,
          'length ' + w.eval("navStack.length"));
  }
}


console.log('\n=== Clearing a dosage does not lock the rules out ===');
{
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const today = DAYS[new Date().getDay()];
  const seed = {
    technicians: [{id:'t1', name:'Alex'}],
    customers: [{id:'a', name:'Alpha One', day: today, active:true, technicianId:'t1', hasPool:true}],
    chemConfig: {
      pool: {
        chemicals: [{key:'chlorine', label:'Free chlorine', unit:'ppm', buttons:[1,3,5],
          doseRules:[
            {op:'eq', value:'5', amount:'1', doseKey:'tabs'},
            {op:'eq', value:'1', amount:'2', doseKey:'tabs'}
          ]}],
        dosages: [{key:'tabs', label:'Chlorine tabs', unit:'count', buttons:[1,2]}]
      },
      spa: {chemicals:[], dosages:[]}, fountain: {chemicals:[], dosages:[]}
    }
  };

  ['technician-app.html','admin-readings-app.html'].forEach(file=>{
    const {dom} = load(file, {seed});
    const w = dom.window, d = w.document;
    w.console.warn = ()=>{};
    try{
      w.eval("currentUser = {id:'t1', name:'Alex'}; openVisit('a');");
      const chem = d.getElementById('pool_chem_chlorine');
      const dose = d.getElementById('pool_dose_tabs');
      const setReading = v => { chem.value = v; chem.dispatchEvent(new w.Event('input', {bubbles:true})); };
      const clearDose = () => { dose.value = ''; dose.dispatchEvent(new w.Event('input', {bubbles:true})); };

      setReading('5');
      check(file + ' the rule fills the dosage', dose.value === '1', dose.value);

      clearDose();
      check(file + ' clearing it sticks', dose.value === '', dose.value);
      check(file + ' clearing is not treated as a manual entry',
            w.eval("Object.keys(manuallyEditedDoses).length") === 0);

      setReading('1');
      check(file + ' a new reading fills it again', dose.value === '2', dose.value);

      // Typing a value by hand should still win
      dose.value = '9';
      dose.dispatchEvent(new w.Event('input', {bubbles:true}));
      setReading('5');
      check(file + ' a hand-typed dosage is still protected', dose.value === '9', dose.value);
    }catch(e){
      check(file + ' cleared dosage handling', false, e.message);
    }
  });
}


console.log('\n=== Saving one body opens the next at its readings ===');
{
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const today = DAYS[new Date().getDay()];
  const seed = {
    // Asked for a before photo everywhere, so every body of water opens at
    // that step — which is what this section is about
    technicians: [{id:'t1', name:'Alex',
      photoRules: {before: {pool:true, spa:true, fountain:true}}}],
    customers: [{id:'a', name:'Alpha One', day: today, active:true, technicianId:'t1',
      hasPool:true, hasSpa:true, fountains:[{id:'f1', name:'Front fountain'}]}],
    settings: {showAfterPhotos:false, showBeforePhotos:false,
               requireAfterPhotos:false, requireBeforePhotos:false},
    afterPhotoDefaultFixed: true,
    chemConfig: {
      pool: {chemicals:[{key:'chlorine',label:'Free chlorine',unit:'ppm'}], dosages:[]},
      spa:  {chemicals:[{key:'chlorine',label:'Free chlorine',unit:'ppm'}], dosages:[]},
      fountain: {chemicals:[{key:'chlorine',label:'Free chlorine',unit:'ppm'}], dosages:[]}
    }
  };

  ['technician-app.html','admin-readings-app.html'].forEach(file=>{
    const {dom} = load(file, {seed});
    const w = dom.window;
    w.console.warn = ()=>{};
    const cardNow = ()=> w.eval("(function(){var t = currentVisibleSection === 'fountain' ? 'fountain' : currentVisibleSection;"
      + "var s = visitStepCardsFor(t)[currentVisitStep - 1];"
      + "return Array.isArray(s) ? s[0] : s; })()");

    try{
      w.eval("currentUser = {id:'t1', name:'Alex', photoRules: {before: {pool:true, spa:true, fountain:true}}}; openVisit('a');");
      // Every body of water opens at its before photo, which is its first step
      check(file + ' starts on the pool before photo', cardNow() === 'visitPoolBeforePhotoSection', cardNow());

      w.eval("markSectionDone('pool','r1');");
      check(file + ' moves to the spa', w.eval('currentVisibleSection') === 'spa');
      check(file + ' at its before photo', cardNow() === 'visitSpaBeforePhotoSection', cardNow());

      w.eval("markSectionDone('spa','r2');");
      check(file + ' then moves to the fountain', w.eval('currentVisibleSection') === 'fountain');
      check(file + ' with the right fountain selected', w.eval('currentVisitFountainId') === 'f1');
      check(file + ' at its before photo', cardNow() === 'visitFountainBeforePhotoSection', cardNow());
    }catch(e){
      check(file + ' auto-advance between bodies', false, e.message);
    }
  });
}


console.log('\n=== The Report tab opens on Serviced today ===');
{
  const {dom} = load('admin-readings-app.html', {seed: {customers: []}});
  const w = dom.window, d = w.document;
  w.console.warn = ()=>{};
  const showing = ()=> d.getElementById('reportModeServiced').style.display !== 'none'
    ? 'serviced' : 'reports';

  try{
    w.eval("switchView('report');");
    check('  tapping the tab shows Serviced today', showing() === 'serviced', showing());

    // A previous choice must not stick (once the tab's 30 seconds are up, Sept 29)
    w.eval("setReportMode('reports'); switchView('home'); tabLeftAt = {}; switchView('report');");
    check('  coming back still shows Serviced today', showing() === 'serviced', showing());

    // Opening a specific report goes to Reports
    w.eval("switchView('home'); switchView('report', {skipRefresh: true});");
    check('  opening a report directly shows Reports', showing() === 'reports', showing());

    // And the buttons reflect it
    check('  the Serviced button is highlighted when it should be',
          (function(){
            w.eval("switchView('home'); tabLeftAt = {}; switchView('report');");   // past its 30 seconds
            return d.getElementById('btnReportModeServiced').className.indexOf('btn-primary') !== -1;
          })());
  }catch(e){
    check('  report tab default', false, e.message);
  }
}


console.log('\n=== Today reopens a report only if it was left open ===');
{
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const today = DAYS[new Date().getDay()];
  const seed = {
    technicians: [{id:'t1', name:'Alex'}],
    customers: [
      {id:'a', name:'Alpha One', day: today, active:true, technicianId:'t1', hasPool:true},
      {id:'b', name:'Bravo Two', day: today, active:true, technicianId:'t1', hasPool:true}
    ],
    chemConfig: {pool:{chemicals:[{key:'chlorine',label:'Free chlorine'}],dosages:[]},
                 spa:{chemicals:[],dosages:[]}, fountain:{chemicals:[],dosages:[]}}
  };

  function tapToday(w, d){
    w.eval("stepBarPressedAt = 0; viewChangedAt = 0;");
    const tab = Array.from(d.querySelectorAll('.tab')).find(t => t.dataset.view === 'home');
    if(tab) tab.click();
  }

  ['technician-app.html','admin-readings-app.html'].forEach(file=>{
    // A report open when another tab was tapped
    {
      const {dom} = load(file, {seed});
      const w = dom.window, d = w.document;
      w.console.warn = ()=>{};
      try{
        w.eval("currentUser = {id:'t1', name:'Alex'}; openVisit('a');");
        w.eval("switchView('options');");
        tapToday(w, d);
        // Changed Sept 29 at Tyrus's request: an open report always comes back,
        // so Today goes back into it (Return to route is how it's left)
        check(file + ' Today goes back into the open report',
              w.eval('currentViewName') === 'visit', w.eval('currentViewName'));
        check(file + ' and the draft is kept so the visit can resume',
              w.eval("visitDraft && visitDraft.customerId") === 'a',
              String(w.eval("visitDraft && visitDraft.customerId")));
      }catch(e){ check(file + ' leaving an open report', false, e.message); }
    }

    // Nothing opened at all
    {
      const {dom} = load(file, {seed});
      const w = dom.window, d = w.document;
      w.console.warn = ()=>{};
      try{
        w.eval("currentUser = {id:'t1', name:'Alex'}; renderHomeList();");
        w.eval("switchView('options');");
        tapToday(w, d);
        check(file + ' shows the route when nothing was open',
              w.eval('currentViewName') === 'home', w.eval('currentViewName'));
      }catch(e){ check(file + ' nothing open', false, e.message); }
    }

    // Opened a report, went back to the route, then to another tab
    {
      const {dom} = load(file, {seed});
      const w = dom.window, d = w.document;
      w.console.warn = ()=>{};
      try{
        w.eval("currentUser = {id:'t1', name:'Alex'}; openVisit('a');");
        w.eval("switchView('home');");
        w.eval("switchView('options');");
        tapToday(w, d);
        check(file + ' shows the route when the report was closed first',
              w.eval('currentViewName') === 'home', w.eval('currentViewName'));
      }catch(e){ check(file + ' report closed first', false, e.message); }
    }
  });
}

console.log('\n=== Search suggestions only appear once you type ===');
{
  const seed = {
    customers: [
      {id:'a', name:'Alpha One', active:true},
      {id:'b', name:'Bravo Two', active:true},
      {id:'c', name:'Charlie Three', active:true}
    ]
  };

  // Website: three separate customer searches
  {
    const {dom} = load('customer-intake.html', {seed});
    const w = dom.window, d = w.document;
    w.console.warn = ()=>{};
    w.Element.prototype.scrollIntoView = function(){};

    [['renderCustomerSearchSuggestions','customerSearchSuggestions','the customer list search'],
     ['renderWcSuggest','wcCustomerSuggest','the work centre search'],
     ['renderCustomCustSuggest','customCustSuggest','the custom tab search']
    ].forEach(([fn, boxId, label])=>{
      try{
        w.eval(fn + "('');");
        const box = d.getElementById(boxId);
        check('  ' + label + ' stays closed when empty',
              !box || box.style.display === 'none', box ? box.style.display : 'missing');

        w.eval(fn + "('alph');");
        check('  ' + label + ' opens once you type',
              box && box.style.display !== 'none' && box.textContent.indexOf('Alpha') !== -1,
              box ? box.textContent.slice(0, 40) : 'missing');

        w.eval(fn + "('   ');");
        check('  ' + label + ' treats spaces as empty',
              box && box.style.display === 'none', box ? box.style.display : 'missing');
      }catch(e){
        check('  ' + label, false, e.message);
      }
    });
  }

  // Admin app: the report customer search
  {
    const {dom} = load('admin-readings-app.html', {seed});
    const w = dom.window, d = w.document;
    w.console.warn = ()=>{};
    try{
      w.eval("renderReportCustomerSuggestions('');");
      const box = d.getElementById('reportCustomerSuggestions');
      check('  the report search stays closed when empty',
            box && box.style.display === 'none', box ? box.style.display : 'missing');

      w.eval("renderReportCustomerSuggestions('brav');");
      check('  the report search opens once you type',
            box && box.style.display !== 'none' && box.textContent.indexOf('Bravo') !== -1,
            box ? box.textContent.slice(0, 40) : 'missing');
    }catch(e){
      check('  the report search', false, e.message);
    }
  }
}


console.log('\n=== Camera controls: flash replaces flip ===');
{
  function withCamera(file, hasTorch){
    const {dom} = load(file, {seed: {customers: []}, beforeParse(w){
      // A company that has not ticked any photo for Everyone. New companies start
      // with the pool after photo required; that start is tested on its own.
      w.localStorage.setItem('weir:photoEveryone', '{}');
      w.__torchCalls = [];
      const track = {
        getCapabilities: ()=> hasTorch ? {torch:true} : {},
        applyConstraints: (cfg)=>{
          const adv = (cfg && cfg.advanced && cfg.advanced[0]) || {};
          if('torch' in adv) w.__torchCalls.push(adv.torch);
          return Promise.resolve();
        },
        stop: ()=>{}
      };
      w.navigator.mediaDevices = {
        getUserMedia: ()=> Promise.resolve({getTracks:()=>[track], getVideoTracks:()=>[track]}),
        enumerateDevices: ()=> Promise.resolve([])
      };
    }});
    return dom;
  }

  ['technician-app.html','admin-readings-app.html'].forEach(file=>{
    const dom = withCamera(file, true);
    const w = dom.window, d = w.document;
    w.console.warn = ()=>{};
    w.eval("captureFromCamera(900, 0.5).catch(()=>{});");

    deferred.push(()=>{
      check(file + ' the flip button is gone', !d.getElementById('camFlip'));
      const btn = d.getElementById('camFlash');
      check(file + ' a flash button is in its place', !!btn);
      if(!btn) return;
      check(file + ' visible when the camera has a torch', btn.style.visibility === 'visible',
            btn.style.visibility);
      check(file + ' starts off', btn.textContent.trim() === 'Flash off', btn.textContent);
      check(file + ' the shutter is still there', !!d.getElementById('camShutter'));
      check(file + ' cancel is still there', !!d.getElementById('camCancel'));
    });

    const dom2 = withCamera(file, false);
    const w2 = dom2.window, d2 = w2.document;
    w2.console.warn = ()=>{};
    w2.eval("captureFromCamera(900, 0.5).catch(()=>{});");
    deferred.push(()=>{
      const btn2 = d2.getElementById('camFlash');
      check(file + ' hidden when there is no torch',
            btn2 && btn2.style.visibility === 'hidden', btn2 ? btn2.style.visibility : 'missing');
      check(file + ' the camera still opens without one', !!d2.getElementById('camShutter'));
    });
  });
}


console.log('\n=== A photo can be required to skip a service ===');
{
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const today = DAYS[new Date().getDay()];

  function seedFor(requirePhoto){
    return {
      technicians: [{id:'t1', name:'Alex'}],
      customers: [{id:'a', name:'Alpha One', day: today, active:true, technicianId:'t1', hasPool:true}],
      settings: {requireSkipReason:false, requireSkipPhoto: requirePhoto},
      afterPhotoDefaultFixed: true
    };
  }

  // It is asked of a technician by name on the Photo requirements tab now,
  // rather than being one switch in Settings for everyone
  {
    const {dom} = load('customer-intake.html', {seed: {customers: []}});
    const w = dom.window, d = w.document;
    w.console.warn = ()=>{};
    check('  the website no longer has it in Settings', !d.getElementById('settingRequireSkipPhoto'));
    check('  and it is off unless someone is asked for it',
          w.eval('appSettings.requireSkipPhoto') !== true);
  }

  ['technician-app.html','admin-readings-app.html'].forEach(file=>{
    // Required
    {
      const {dom} = load(file, {seed: seedFor(true)});
      const w = dom.window, d = w.document;
      w.console.warn = ()=>{};
      try{
        w.eval("window.__r = 'pending';");
        w.eval("openSkipReasonModal({id:'a', name:'Alpha One'}).then(x => { window.__r = x ? 'skipped' : 'cancelled'; });");
        deferred.push(()=>{
          const btn = d.getElementById('skipPhotoBtn');
          check(file + ' the photo button says it is required',
                btn && btn.textContent.indexOf('required') !== -1,
                btn ? btn.textContent : 'missing');

          d.getElementById('skipReasonText').value = 'Gate was locked';
          d.getElementById('skipReasonSave').click();
          check(file + ' skipping is blocked without a photo',
                w.eval('window.__r') === 'pending', w.eval('window.__r'));

          // With a photo it goes through
          w.eval("photoData = 'data:image/jpeg;base64,AAAA';");
          d.getElementById('skipReasonSave').click();
        });
      }catch(e){ check(file + ' skip photo required', false, e.message); }
    }

    // Not required
    {
      const {dom} = load(file, {seed: seedFor(false)});
      const w = dom.window, d = w.document;
      w.console.warn = ()=>{};
      try{
        w.eval("window.__r = 'pending';");
        w.eval("openSkipReasonModal({id:'a', name:'Alpha One'}).then(x => { window.__r = x ? 'skipped' : 'cancelled'; });");
        deferred.push(()=>{
          const btn = d.getElementById('skipPhotoBtn');
          check(file + ' the photo button is optional',
                btn && btn.textContent.indexOf('required') === -1, btn ? btn.textContent : 'missing');

          d.getElementById('skipReasonText').value = 'Gate was locked';
          d.getElementById('skipReasonSave').click();
          // The promise resolves a tick later, so check the screen closed —
          // that only happens once the save is accepted
          check(file + ' skipping works without a photo',
                !d.getElementById('skipReasonSave'),
                d.getElementById('skipReasonSave') ? 'still open' : 'closed');
        });
      }catch(e){ check(file + ' skip photo optional', false, e.message); }
    }
  });
}


console.log('\n=== A customer moved in for the day drops off when serviced ===');
{
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const todayName = DAYS[new Date().getDay()];
  const otherDay = DAYS[(new Date().getDay() + 3) % 7];
  const dnow = new Date();
  const iso = new Date(dnow.getTime() - dnow.getTimezoneOffset()*60000).toISOString().slice(0,10);

  const seed = {
    technicians: [{id:'t1', name:'Alex'}],
    customers: [
      {id:'a', name:'Alpha One', day: todayName, active:true, technicianId:'t1', hasPool:true},
      {id:'m', name:'Moved Mike', day: otherDay, active:true, technicianId:'t1', hasPool:true}
    ],
    rescheduledVisits: [{id:'r1', customerId:'m', fromDate:'2026-01-01', toDate: iso}],
    afterPhotoDefaultFixed: true
  };

  ['technician-app.html','admin-readings-app.html'].forEach(file=>{
    const {dom} = load(file, {seed});
    const w = dom.window, doc = w.document;
    w.console.warn = ()=>{};
    const box = ()=> doc.getElementById('homeCustomerList') || doc.getElementById('adminCustomerList');
    const onRoute = name => { const b = box(); return !!b && b.textContent.indexOf(name) !== -1; };

    try{
      w.eval("currentUser = {id:'t1', name:'Alex'}; adminViewTechId = 't1'; renderHomeList();");
      check(file + ' a moved-in customer appears on the route', onRoute('Moved'));
      check(file + ' alongside the regular ones', onRoute('Alpha'));

      w.eval("customers.find(c=>c.id==='a').lastServicedDate = todayDateStr();");
      w.eval("customers.find(c=>c.id==='m').lastServicedDate = todayDateStr();");
      w.eval("renderHomeList();");

      check(file + ' a regular customer drops off once serviced', !onRoute('Alpha'));
      check(file + ' a moved-in customer drops off too', !onRoute('Moved'),
            'still listed');
    }catch(e){
      check(file + ' moved-in customer handling', false, e.message);
    }
  });
}


console.log('\n=== Back never leaves the app ===');
{
  // The old cushion counted history entries in a variable and drifted out of
  // step with the browser. It is replaced by one guard entry that is pushed
  // back the instant it is consumed, so Back can never walk out.
  ['technician-app.html','admin-readings-app.html'].forEach(file=>{
    const src = fs.readFileSync(file, 'utf8');
    check(file + ' no longer counts history entries',
          src.indexOf('backEntries') === -1);
    check(file + ' tops the guard up on user gestures',
          src.indexOf("['pointerdown','touchstart','mousedown','keydown'].forEach") !== -1);
    check(file + ' remembers forty places (Oct 3)',
          src.indexOf('NAV_STACK_LIMIT = 40') !== -1);
    check(file + ' and does not record new places while going back',
          src.indexOf('if(navigatingBack) return;') !== -1);
  });
  // The behaviour itself is exercised in back-test.js, which needs real timing.
}

console.log('\n=== Readings are required per reading, not app-wide ===');
{
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const today = DAYS[new Date().getDay()];

  const seed = {
    technicians: [{id:'t1', name:'Alex'}],
    customers: [{id:'c1', name:'Test', day: today, active:true, technicianId:'t1', hasPool:true}],
    settings: {showAfterPhotos:false, showBeforePhotos:false},
    afterPhotoDefaultFixed: true,
    chemConfig: {
      pool: {
        chemicals: [{key:'chlorine', label:'Free chlorine', required:true},
                    {key:'ph', label:'pH level'}],
        dosages: [{key:'tabs', label:'Chlorine tabs'}]
      },
      spa:{chemicals:[],dosages:[]}, fountain:{chemicals:[],dosages:[]}
    }
  };

  ['customer-intake.html','technician-app.html','admin-readings-app.html'].forEach(file=>{
    const src = fs.readFileSync(file, 'utf8');
    check(file + ' no longer offers the app-wide setting',
          src.indexOf('settingRequireReadings') === -1);
    check(file + ' and nothing reads it',
          src.indexOf('appSettings.requireReadings') === -1);
  });

  ['technician-app.html','admin-readings-app.html'].forEach(file=>{
    const {dom} = load(file, {seed});
    const w = dom.window, d = w.document;
    w.console.warn = ()=>{};
    try{
      w.eval("currentUser={id:'t1',name:'Alex'}; openVisit('c1');");
      // Step 1 is the before photo, so move to the readings card itself
      w.eval("currentVisibleSection='pool';"
        + "currentVisitStep = visitStepCardsFor('pool')"
        + ".findIndex(s => (Array.isArray(s) ? s[0] : s) === 'visitPoolSection') + 1;");
      check(file + ' a reading ticked Required is still enforced',
            w.eval('missingReadingFields().length') === 1,
            String(w.eval('missingReadingFields().length')));

      const el = d.getElementById('pool_chem_chlorine');
      if(el){ el.value = '3'; el.dispatchEvent(new w.Event('input', {bubbles:true})); }
      check(file + ' and satisfied once filled in',
            w.eval('missingReadingFields().length') === 0,
            String(w.eval('missingReadingFields().length')));
    }catch(e){ check(file + ' per-reading required', false, e.message); }
  });
}

console.log('\n=== New equipment photos go to the database, not the record ===');
{
  ['customer-intake.html','technician-app.html','admin-readings-app.html'].forEach(file=>{
    const src = fs.readFileSync(file, 'utf8');
    check(file + ' saves a reference, not the image',
          src.indexOf("item.photos.push({id: photoId, stored: true, caption: ''});") !== -1);
    check(file + ' no save path writes dataUrl straight in',
          src.indexOf("      id: 'eqphoto_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),\n      dataUrl,") === -1);
    check(file + ' keeps the photo inline if the database refuses',
          src.indexOf("item.photos.push({id: photoId, dataUrl, caption: ''});") !== -1);
  });
}


console.log('\n=== Route Scheduling works without the map library ===');
{
  // Leaflet is loaded from the internet. Without it the whole view used to
  // throw and show nothing, taking the route list down with it.
  const seed = {
    customers: [
      {id:'a', name:'Alpha One', day:'Monday', active:true, address:'1 Main St'},
      {id:'b', name:'Bravo Two', day:'Monday', active:true, address:'2 Main St'}
    ],
    technicians: [{id:'t1', name:'Alex'}]
  };
  const {dom} = load('customer-intake.html', {seed});
  const w = dom.window, d = w.document;
  w.console.warn = ()=>{};
  w.Element.prototype.scrollIntoView = function(){};

  try{
    check('  Leaflet is genuinely absent in this test', w.eval("typeof L") === 'undefined');
    w.eval("switchView('map');");
    check('  opening the view does not throw', true);

    const txt = d.getElementById('view-map').textContent.replace(/\s+/g, ' ');
    check('  a plain explanation replaces the map',
          txt.indexOf('needs an internet connection') !== -1, txt.slice(0, 60));
    check('  the rest of the page still renders',
          txt.indexOf('Route Scheduling') !== -1);
  }catch(e){
    check('  Route Scheduling without a map', false, e.message);
  }
}


console.log('\n=== Backwash and salt cell sit on the readings step ===');
{
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const today = DAYS[new Date().getDay()];
  const seed = {
    technicians: [{id:'t1', name:'Alex'}],
    customers: [{id:'a', name:'Alpha One', day: today, active:true, technicianId:'t1', hasPool:true,
      equipment:[{type:'Filter', filterTypeChoice:'Sand'},
                 {type:'Chlorination', chlorinationChoice:'Salt Cell'}]}],
    afterPhotoDefaultFixed: true,
    chemConfig: {pool:{chemicals:[{key:'chlorine',label:'Free chlorine'}],dosages:[]},
                 spa:{chemicals:[],dosages:[]}, fountain:{chemicals:[],dosages:[]}}
  };

  ['technician-app.html','admin-readings-app.html'].forEach(file=>{
    const {dom} = load(file, {seed});
    const w = dom.window, d = w.document;
    w.console.warn = ()=>{};
    try{
      w.eval("currentUser={id:'t1',name:'Alex'}; openVisit('a');");

      const box = d.getElementById('poolServiceChecks');
      const readings = d.getElementById('visitPoolSection');
      const fields = d.getElementById('poolChemFields');

      check(file + ' the checks exist', !!box);
      check(file + ' they are inside the readings card', readings && readings.contains(box));
      check(file + ' they sit above the reading fields',
            box && fields && (box.compareDocumentPosition(fields) & 4) !== 0);
      check(file + ' they are not in the after photo card',
            !d.getElementById('visitPoolPhotoSection').contains(box));

      deferred.push(()=>{
        check(file + ' backwash is offered for a sand filter',
              box.textContent.indexOf('Filter backwashed') !== -1, box.textContent.slice(0,60));
        check(file + ' salt cell is offered for a salt pool',
              box.textContent.indexOf('Salt cell cleaned') !== -1);

        const bw = d.getElementById('chkBackwashed');
        const sc = d.getElementById('chkSaltCell');
        if(bw && sc){
          const cellA = bw.parentElement, cellB = sc.parentElement;
          const row = cellA.parentElement;
          check(file + ' both sit on one row', row === cellB.parentElement);
          check(file + ' that row is a flex row', row.style.display === 'flex', row.style.display);
          check(file + ' each takes equal width', cellA.style.flexGrow === '1'
                && cellB.style.flexGrow === '1');
          check(file + ' the last-done note sits under each button',
                cellA.style.flexDirection === 'column');
          check(file + ' the buttons fill their half', bw.style.width === '100%');

          bw.click();
          check(file + ' tapping one records it', bw.dataset.on === 'true');
          check(file + ' and does not affect the other', sc.dataset.on === 'false');
          sc.click();
          check(file + ' the other toggles independently', sc.dataset.on === 'true');
        }
      });
    }catch(e){
      check(file + ' service checks placement', false, e.message);
    }
  });
}


console.log('\n=== Quick button colours ===');
{
  const seed = {
    customers: [{id:'a', name:'Alpha One', active:true}],
    chemConfig: {pool:{chemicals:[{key:'chlorine', label:'Free chlorine', buttons:[1,3]}], dosages:[]},
                 spa:{chemicals:[],dosages:[]}, fountain:{chemicals:[],dosages:[]}}
  };

  // The website can set a colour
  {
    const {dom} = load('customer-intake.html', {seed});
    const w = dom.window, d = w.document;
    w.console.warn = ()=>{};
    w.Element.prototype.scrollIntoView = function(){};
    try{
      check('  a colour picker exists', w.eval("typeof openColorPicker") === 'function');
      check('  the editor offers a swatch',
            fs.readFileSync('customer-intake.html','utf8').indexOf("swatch.title = 'Change colour'") !== -1);

      w.eval("openColorPicker(chemConfig.pool.chemicals[0], 1, function(){});");
      const grid = d.getElementById('colorGrid');
      check('  the palette opens', !!grid);
      if(grid){
        const swatches = Array.from(grid.querySelectorAll('button'));
        check('  nine colours are offered', swatches.length === 9, swatches.length + ' offered');
        const red = swatches.find(b => /red/i.test(b.textContent));
        if(red){
          red.click();
          check('  picking one saves it against that button',
                w.eval("chemConfig.pool.chemicals[0].buttons[1].c") === 'red',
                w.eval("JSON.stringify(chemConfig.pool.chemicals[0].buttons[1])"));
        }
      }
    }catch(e){ check('  colour picker', false, e.message); }
  }

  // The field apps render it
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const today = DAYS[new Date().getDay()];
  ['technician-app.html','admin-readings-app.html'].forEach(file=>{
    const {dom} = load(file, {seed: {
      technicians:[{id:'t1', name:'Alex'}],
      customers:[{id:'a', name:'Alpha One', day: today, active:true, technicianId:'t1', hasPool:true}],
      afterPhotoDefaultFixed:true, settings:{showDosageSuggestions:true},
      chemConfig:{pool:{chemicals:[{key:'chlorine', label:'Free chlorine',
        buttons:[1, {v:3,c:'red'}, {v:5,c:'green'}]}], dosages:[]},
        spa:{chemicals:[],dosages:[]}, fountain:{chemicals:[],dosages:[]}}
    }});
    const w = dom.window, d = w.document;
    w.console.warn = ()=>{};
    try{
      w.eval("currentUser={id:'t1',name:'Alex'}; openVisit('a');");
      const field = d.getElementById('pool_chem_chlorine').closest('.field');
      const btns = Array.from(field.querySelectorAll('button'))
        .filter(b => /^[0-9]/.test(b.textContent.trim()));
      const colours = btns.map(b => b.style.background || b.style.backgroundColor);
      check(file + ' renders each button in its own colour',
            new Set(colours).size === 3, colours.join(' | '));
      check(file + ' the values are unaffected',
            btns.map(b=>b.textContent.trim()).join(',') === '1,3,5');
    }catch(e){ check(file + ' coloured buttons', false, e.message); }
  });
}





// ======================= Sept 30 – Oct 1 changes =======================
console.log('\n=== Sept 30 – Oct 1: phone app ===');
{
  const today = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
  const seed = {
    customers: [
      {id:'a', name:'Alpha One', active:true, day: today, technicianId:'t1', hasPool:true},
      {id:'b', name:'Bravo Two', active:true, day: today, technicianId:'t1', hasPool:true},
      {id:'s', name:'Spa Only', active:true, day: today, technicianId:'t1', hasPool:false, hasSpa:true},
      {id:'ps', name:'Pool And Spa', active:true, day: 'Nonday', technicianId:'t1', hasPool:true, hasSpa:true}
    ],
    technicians: [{id:'t1', name:'Alex'}],
    chemConfig: {pool:{chemicals:[{key:'chlorine', label:'Free chlorine', unit:'ppm', buttons:[5, 1, {v:3, c:'red'}]}],
                       dosages:[{key:'acid', label:'Acid', unit:'gal'}]},
                 spa:{chemicals:[],dosages:[]}, fountain:{chemicals:[],dosages:[]}}
  };
  const {dom} = load('app.html', {seed});
  const w = dom.window, d = w.document;
  w.console.warn = ()=>{};
  w.Element.prototype.scrollIntoView = function(){};
  try{
    w.eval("currentUser={id:'t1',name:'Alex'}; renderHomeList();");
    const stops = (d.getElementById('homeStopCount') || {}).textContent || '';
    check('Today counts read left/total with a slash (1ey)', /^\d+\/\d+$/.test(stops.trim()), stops);
    check('Today counts label reads "stops" (1ey)', ((d.getElementById('homeStopLabel') || {}).textContent || '').trim() === 'stops');
  }catch(e){ check('Today counts', false, e.message); }

  try{
    w.eval("openVisit('a');");
    const field = d.getElementById('pool_chem_chlorine').closest('.field');
    const vals = Array.from(field.querySelectorAll('.quick-row button')).map(b => b.textContent.trim());
    check('Quick buttons in number order, low to high (1fe)', vals.join(',') === '1,3,5', vals.join(','));
    const row = field.querySelector('.quick-row');
    check('Quick buttons sit on one swipeable line (1fa)', !!row && row.style.flexWrap === 'nowrap' && row.style.overflowX === 'auto');
  }catch(e){ check('Quick buttons order and line', false, e.message); }

  try{
    w.eval("poolPhotoController.clear(); poolPhotoController.setAll(['data:image/png;base64,QQ==','data:image/png;base64,Qg==','data:image/png;base64,Qw==','data:image/png;base64,RA==']);");
    check('A photo step holds up to three photos (1eq)', w.eval("poolPhotoController.getAll().length") === 3);
    check('The first photo stays the main one (1eq)', w.eval("poolPhotoController.getData()") === 'data:image/png;base64,QQ==');
    check('Take photo hides at three (1eq)', d.getElementById('btnTakePhoto').style.display === 'none');
    w.eval("poolPhotoController.setAll(['data:image/png;base64,QQ==']);");
    check('Take another reads "(Max 3)" after one (1eq; Max 3 since Oct 2, 1fm)', /Take another \(Max 3\)/.test(d.getElementById('btnTakePhoto').textContent), d.getElementById('btnTakePhoto').textContent);
    check('No Remove photo button or × on thumbnails (1es)',
      d.getElementById('btnRemovePhoto').style.display === 'none'
      && !d.querySelector('#photoPreviewWrap [data-shot] button'));
  }catch(e){ check('Up to three photos', false, e.message); }

  try{
    let deleted = false;
    w.__del = ()=>{ deleted = true; };
    // A press within 0.4 s of the screen changing is ignored on purpose; this one is later
    w.eval("viewChangedAt = 0; openPhotoFullSize('data:image/png;base64,QQ==', ()=> window.__del());");
    const del = Array.from(d.querySelectorAll('button')).find(b => b.textContent === 'Delete photo');
    check('Full-size photo shows Delete photo (1es)', !!del);
    if(del) del.click();
    check('Delete photo removes it (1es)', deleted);
  }catch(e){ check('Delete photo from full size', false, e.message); }

  try{
    const caps = w.eval("collectReportPhotos([{label:'Pool', reading:{beforePhoto:'data:x', photo:'data:a', photoMore:['data:b','data:c'], gatePhoto:'data:g', gatePhotoMore:['data:h']}}]).map(p => p.caption).join('|')");
    check('Email photos keep labels, numbered when more than one (1eq)',
      caps === 'Pool before|Pool after 1|Pool after 2|Pool after 3|Gate 1|Gate 2', caps);
  }catch(e){ check('Email photo labels', false, e.message); }

  try{
    const html = w.eval("buildReportEmailHtml({name:'Alpha One', email:'a@example.com'}, 'Oct 1', [{label:'Spa', skipped:true, readingPairs:[], productPairs:[], servicePairs:[]}], {})");
    check('A skipped body says "Skipped this visit" in the email (1fc)', /Skipped this visit/.test(html));
  }catch(e){ check('Skipped body in the email', false, e.message); }

  try{
    w.eval("currentVisitCustomerId = 's';");
    check('One body of water reads the pool\u2019s photo rules (1er)', w.eval("photoBodyType('spa')") === 'pool');
    w.eval("currentVisitCustomerId = 'ps';");
    check('Two or more bodies keep their own (1er)', w.eval("photoBodyType('spa')") === 'spa');
    w.eval("currentVisitCustomerId = 'a';");
  }catch(e){ check('Single body photo rules', false, e.message); }

  try{
    w.eval("appSettings.leftHanded = true; applyLeftHanded();");
    check('Left-handed mode marks the page (1et)', d.body.classList.contains('left-handed'));
    w.eval("appSettings.leftHanded = false; applyLeftHanded();");
    check('Left-handed mode off clears it (1et)', !d.body.classList.contains('left-handed'));
  }catch(e){ check('Left-handed mode', false, e.message); }

  try{
    check('Readings history covers 3 months (1fd)', w.eval("RECENT_READINGS_DAYS") === 91);
    check('Videos only for technicians allowed them (1em)', w.eval("currentUser={id:'t1',name:'Alex'}; visitVideoAllowed()") === false);
    check('A technician with Video ticked may record (1em)', w.eval("currentUser={id:'t1',name:'Alex',allowVideo:true}; visitVideoAllowed()") === true);
    check('Up to three videos (1em)', w.eval("VISIT_VIDEOS_MAX") === 3);
  }catch(e){ check('Readings window and videos', false, e.message); }

  try{
    w.eval("promptHeadsUpText({id:'b', name:'Bravo Two', phone:'6235550101'}, 2);");
    const go = Array.from(d.querySelectorAll('button')).find(b => b.textContent === 'Open text message');
    check('Automatic On my way asks for one tap to open the text (1fb)', !!go);
    const later = Array.from(d.querySelectorAll('button')).find(b => b.textContent === 'Not now');
    if(later) later.click();
  }catch(e){ check('Automatic On my way prompt', false, e.message); }

  try{
    const vids = d.querySelectorAll('video[controls]');
    w.eval("openVideoFullScreen('data:video/mp4;base64,AA==', ()=>{});");
    const v = d.querySelector('video[controls]');
    check('App video players offer no full screen of their own (1em.14)',
      !!v && /nofullscreen/.test(v.getAttribute('controlsList') || ''));
    const del = Array.from(d.querySelectorAll('button')).find(b => b.textContent === 'Delete video');
    check('Full-screen video has Delete video (1em.11)', !!del);
  }catch(e){ check('Video viewer', false, e.message); }
}

console.log('\n=== Sept 30 – Oct 1: website ===');
{
  const seed = {
    technicians: [{id:'t1', name:'Alex'}],
    customers: [{id:'c1', name:'Alpha One', active:true}],
    skippedVisits: undefined,
    chemConfig: {pool:{chemicals:[],dosages:[]}, spa:{chemicals:[],dosages:[]}, fountain:{chemicals:[],dosages:[]}}
  };
  delete seed.skippedVisits;
  const {dom} = load('customer-intake.html', {seed, beforeParse(w){
    w.localStorage.setItem('weir:skippedVisits:c1', JSON.stringify([{id:'skip_1', date:'2026-09-29', timestamp:'2026-09-29T16:00:00.000Z', reason:'Gate locked'}]));
  }});
  const w = dom.window, d = w.document;
  w.console.warn = ()=>{};
  w.Element.prototype.scrollIntoView = function(){};

  try{
    const sorted = w.eval("(function(){ const it = {buttons:[5, 1, {v:3, c:'red'}]}; sortQuickButtons(it); return JSON.stringify(it.buttons); })()");
    check('Website quick buttons sort low to high (1fe)', sorted === '[1,{"v":3,"c":"red"},5]', sorted);
    const kept = w.eval("(function(){ const it = {buttons:[5, 1, 3], buttonsOrdered:true}; sortQuickButtons(it); return JSON.stringify(it.buttons); })()");
    check('A dragged order is kept (1fe)', kept === '[5,1,3]', kept);
  }catch(e){ check('Quick button order', false, e.message); }

  try{
    const all = w.eval("(function(){ const it = {buttons:[1, 2, 3]}; colorAllButtons(it, 'green'); return JSON.stringify(it.buttons); })()");
    check('All colors paints every button, order unchanged (1ff)', all === '[{"v":1,"c":"green"},{"v":2,"c":"green"},{"v":3,"c":"green"}]', all);
    check('A field\u2019s own colour starts new buttons (1ff.3)', w.eval("newButtonColor({buttonColor:'red'})") === 'red');
  }catch(e){ check('Quick button colours', false, e.message); }

  try{
    const pairs = w.eval("reportPhotoPairs({beforePhoto:'b1', photo:'a1', photoMore:['a2']}).map(p => p[0]).join('|')");
    check('Website report photos numbered when more than one (1eq)', pairs === 'Before|After 1|After 2', pairs);
  }catch(e){ check('Website photo labels', false, e.message); }

  try{
    const visits = w.eval("JSON.stringify(reportVisitsFor(customers.find(c => c.id === 'c1')).map(v => v.parts.map(p => p.label)))");
    check('A whole skipped visit is a "Service skipped" report (1fc)', /Service skipped/.test(visits), visits);
  }catch(e){ check('Skipped visit report', false, e.message); }

  try{
    w.eval("switchView('technicians');");
    const tab = d.querySelector('[data-techtab="photos"], #techTabPhotos, [data-tab="photos"]');
    if(tab) tab.click();
    w.eval("renderPhotoRequirements();");
    const first = d.querySelector('#photoRequireRows [data-photo-step]');
    check('Photo requirements: Video is the first row (1em.6)', !!first && first.dataset.photoStep === 'video', first ? first.dataset.photoStep : 'none');
    check('Its note is hidden while the row is closed (1em.6b)', !/delete themselves after 7 days/.test(d.getElementById('photoRequireRows').textContent));
  }catch(e){ check('Photo requirements Video row', false, e.message); }

  try{
    const svc = w.eval("JSON.stringify(equipmentServiceFor('Filter', {filterTypeChoice:'Sand'}))");
    check('A sand filter gets a Backwashed date (1en)', /lastBackwashed/.test(svc), svc);
    check('A cartridge filter gets none (1en)', w.eval("equipmentServiceFor('Filter', {filterTypeChoice:'Cartridge'})") === null);
  }catch(e){ check('Equipment service dates', false, e.message); }
}

console.log('\n=== Sept 30: one company per browser ===');
{
  const {dom} = load('customer-intake.html', {seed: {customers: [{id:'x', name:'Old Company Customer', active:true}]}, beforeParse(w){
    w.localStorage.setItem('weir:sync:state:other-co', JSON.stringify({pulledOnce: true, edits: {}, records: {edits: {}}}));
  }});
  const w = dom.window;
  w.console.warn = ()=>{};
  try{
    const prefix = w.eval("SYNC_PREFIX");
    w.localStorage.setItem(prefix + 'state:other-co', JSON.stringify({pulledOnce: true, edits: {}, records: {edits: {}}}));
    const r = w.eval("siteMatchCompany('new-co')");
    check('Signing in as another company clears the old copy (1eh)', r === 'reload', r);
    check('The old company\u2019s customers are gone from this browser (1eh)', w.localStorage.getItem('weir:customers') === null);
    check('This browser is now marked for the new company (1eh)', JSON.parse(w.localStorage.getItem('weir:dataCompany')) === 'new-co');
    w.localStorage.setItem(prefix + 'state:third-co', JSON.stringify({v: 2, pulledOnce: true, edits: {k: {name: '2026-10-01T10:00:00Z'}}, records: {edits: {}}}));
    check('Unsent changes of another company stop the switch (1eh)', w.eval("siteMatchCompany('fourth-co')") === 'blocked');
  }catch(e){ check('One company per browser', false, e.message); }
}


// Checks that had to wait for an app to finish starting up.
setTimeout(async ()=>{
  deferred.forEach(fn => {
    try{ fn(); }catch(e){ check('deferred check', false, e.message); }
  });
  // Today's server snippets and company separation, against real Postgres
  await serverOct1();
  console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
  process.exit(fail ? 1 : 0);
}, 2500);

// ======== Sept 30 – Oct 1: the server (real snippets, real Postgres) ========
// Needs: bash sync-test-setup.sh
async function serverOct1(){
  const { Pool } = require('pg');
  const pool = new Pool({host: '127.0.0.1', user: 'postgres', password: 'pw', database: 'pl', max: 4});
  const CO = 'aaaaaaaa-0000-0000-0000-0000000000a1', OTHER = 'bbbbbbbb-0000-0000-0000-0000000000b2';
  const OWNER = '11111111-0000-0000-0000-0000000000a1', OTHER_OWNER = '22222222-0000-0000-0000-0000000000b2';
  const TECH = '33333333-0000-0000-0000-0000000000a1';
  async function asUser(uid, sql, params){
    const c = await pool.connect();
    try{
      await c.query('begin');
      await c.query('set local role authenticated');
      await c.query("select set_config('request.uid', $1, true)", [uid]);
      const r = await c.query(sql, params);
      await c.query('commit');
      return r;
    }catch(e){ await c.query('rollback').catch(()=>{}); throw e; }
    finally{ c.release(); }
  }
  try{ await pool.query('select 1'); }
  catch(e){ check('Postgres is reachable for the server checks (run: bash sync-test-setup.sh)', false); await pool.end().catch(()=>{}); return; }
  try{
    // Two companies, each with an owner; Triffic with a technician; something of every kind for both
    await pool.query('delete from public.members where company_id in ($1, $2)', [CO, OTHER]);
    await pool.query('delete from public.companies where id in ($1, $2)', [CO, OTHER]);
    await pool.query('delete from auth.users where id in ($1, $2, $3)', [OWNER, OTHER_OWNER, TECH]);
    await pool.query(`insert into auth.users(id, email) values ($1, 'o@triffic.test'), ($2, 'o@affinity.test'), ($3, 'tech-x@accounts.weir.invalid')`, [OWNER, OTHER_OWNER, TECH]);
    await pool.query(`insert into public.companies(id, name, code) values ($1, 'Triffic Test', 'TTEST1'), ($2, 'Affinity Test', 'ATEST1')`, [CO, OTHER]);
    await pool.query(`insert into public.members(user_id, company_id, role, name) values ($1, $2, 'owner', 'John'), ($3, $4, 'owner', 'Mike')`, [OWNER, CO, OTHER_OWNER, OTHER]);
    await pool.query(`insert into public.members(user_id, company_id, role, name, technician_id, username) values ($1, $2, 'technician', 'Pat', 't_pat', 'pat')`, [TECH, CO]);
    for(const [co, tag] of [[CO, 'tri'], [OTHER, 'aff']]){
      await pool.query(`insert into public.customers(company_id, id, data) values ($1, $2, $3)`, [co, 'cust_' + tag, {name: tag + ' customer', technicianId: 't_pat'}]);
      await pool.query(`insert into public.company_records(company_id, kind, id, data) values ($1, 'technician', $2, $3)`, [co, 't_' + tag, {name: tag + ' tech'}]);
      await pool.query(`insert into public.visits(company_id, customer_id, kind, id, data, occurred_at, service_date) values ($1, $2, 'reading', $3, '{}', now(), current_date)`, [co, 'cust_' + tag, 'v_' + tag]);
      await pool.query(`insert into public.photos(company_id, id, customer_id, kind, path, taken_at) values ($1, $2, $3, 'after', $4, now())`, [co, 'p_' + tag, 'cust_' + tag, co + '/cust_' + tag + '/p_' + tag]);
      await pool.query(`insert into public.quote_responses(company_id, quote_id, token) values ($1, $2, $3)`, [co, 'q_' + tag, 'tok_' + tag + '_' + Date.now()]);
    }

    console.log('\n=== Server: no company sees another\u2019s data ===');
    for(const [who, uid, own] of [['Triffic owner', OWNER, CO], ['Affinity owner', OTHER_OWNER, OTHER], ['Triffic technician', TECH, CO]]){
      let seen = 0; const where = [];
      for(const t of ['customers', 'company_records', 'visits', 'photos', 'quote_responses', 'members', 'customer_versions', 'record_versions']){
        const r = await asUser(uid, `select count(*)::int n from public.${t} where company_id <> $1`, [own]);
        if(r.rows[0].n){ seen += r.rows[0].n; where.push(t); }
      }
      const co = await asUser(uid, 'select count(*)::int n from public.companies where id <> $1', [own]);
      seen += co.rows[0].n;
      check(who + ' sees nothing of any other company', seen === 0, where.join(', '));
    }
    const mine = await asUser(OWNER, 'select count(*)::int n from public.customers', []);
    check('and still sees its own', mine.rows[0].n >= 1);

    console.log('\n=== Server: snippet 22, videos ===');
    const vid = await asUser(TECH, `select public.push_photo('vid_1', 'cust_tri', 'video', 'pool', 'v_tri', null, $1, 2000000, now() - interval '8 days', current_date) r`, [CO + '/cust_tri/vid_1']);
    check('a technician can send a video (kind video accepted)', vid.rows[0].r.result === 'saved', JSON.stringify(vid.rows[0].r));
    const techSees = await asUser(TECH, `select count(*)::int n from public.photos where kind = 'video'`, []);
    check('a technician can\u2019t see videos', techSees.rows[0].n === 0);
    const techPhotos = await asUser(TECH, `select count(*)::int n from public.photos where kind <> 'video'`, []);
    check('but still sees their customers\u2019 photos', techPhotos.rows[0].n >= 1);
    const ownerSees = await asUser(OWNER, `select count(*)::int n from public.photos where kind = 'video'`, []);
    check('the owner sees the video', ownerSees.rows[0].n === 1);
    const old = await asUser(OWNER, `select id from public.photos_past_keeping()`, []);
    check('a video over 7 days old is listed for the clean-up', old.rows.some(r => r.id === 'vid_1'));
    let refused = false;
    try{ await asUser(TECH, `select public.push_photo('bad_1', 'cust_tri', 'movie', 'pool', null, null, $1, 1, now(), current_date)`, [CO + '/cust_tri/bad_1']); }
    catch(e){ refused = true; }
    check('an unknown kind is still refused', refused);

    console.log('\n=== Server: snippet 20, quote expiry days ===');
    let bad = false;
    try{ await pool.query(`update public.quote_responses set expires_days = 400 where company_id = $1`, [CO]); }catch(e){ bad = true; }
    check('expiry days must be 1 to 365', bad);
    await pool.query(`update public.quote_responses set expires_days = 14 where company_id = $1`, [CO]);
    const ex = await pool.query(`select expires_days from public.quote_responses where company_id = $1`, [CO]);
    check('a quote keeps its own number of days', ex.rows[0].expires_days === 14);

    console.log('\n=== Server: snippet 23, deleting a technician shuts them out at once ===');
    await pool.query(`insert into public.company_records(company_id, kind, id, data) values ($1, 'technician', 't_pat', '{"name":"Pat","username":"pat"}')
                      on conflict (company_id, kind, id) do update set data = excluded.data, deleted = false`, [CO]);
    await pool.query(`insert into public.record_versions(company_id, kind, record_id, data) values ($1, 'technician', 't_pat', '{"name":"Pat old"}')`, [CO]).catch(()=>{});
    let notOwner = false;
    try{ await asUser(TECH, `select public.remove_technician_account('t_pat')`, []); }catch(e){ notOwner = true; }
    check('only an owner can delete a technician', notOwner);
    await asUser(OWNER, `select public.remove_technician_account('t_pat')`, []);
    const pw = await pool.query('select encrypted_password p from auth.users where id = $1', [TECH]);
    check('their password stops working at once', pw.rows[0] && pw.rows[0].p === '');
    const seesNow = await asUser(TECH, `select count(*)::int n from public.customers`, []);
    check('they can read nothing at once', seesNow.rows[0].n === 0);
    const free = await asUser(OWNER, `select public.username_available('pat') ok`, []);
    check('their username is free straight away', free.rows[0].ok === true);
    const rec = await pool.query(`select data, deleted from public.company_records where company_id = $1 and kind = 'technician' and id = 't_pat'`, [CO]);
    check('their profile is an empty deleted marker', rec.rows[0] && rec.rows[0].deleted === true && JSON.stringify(rec.rows[0].data) === '{}');
    const rv = await pool.query(`select count(*)::int n from public.record_versions where company_id = $1 and kind = 'technician' and record_id = 't_pat'`, [CO]);
    check('and no earlier versions are kept', rv.rows[0].n === 0);
    const held = await asUser(TECH, `select public.push_photo('held_1', 'cust_tri', 'after', 'pool', 'v_tri', null, $1, 1000, now(), current_date) r`, [CO + '/cust_tri/held_1']);
    check('for a day, their phone may still send what it held', held.rows[0].r.result === 'saved');
    const told = await asUser(TECH, `select public.my_membership() m`, []);
    check('and is told it was removed, and until when', told.rows[0].m.removed === true && !!told.rows[0].m.upload_until);
    await pool.query(`update public.members set removed_at = now() - interval '2 days' where user_id = $1`, [TECH]);
    let late = false;
    try{ await asUser(TECH, `select public.push_photo('held_2', 'cust_tri', 'after', 'pool', 'v_tri', null, $1, 1000, now(), current_date)`, [CO + '/cust_tri/held_2']); }catch(e){ late = true; }
    check('after the day, nothing more is accepted', late);
    await asUser(OWNER, `select public.username_available('anyone')`, []);
    await asUser(OWNER, `select public.remove_technician_account('nobody')`, []);
    const u = await pool.query('select count(*)::int n from auth.users where id = $1', [TECH]);
    check('then the account is deleted the next time technicians are managed', u.rows[0].n === 0);
    const otherCo = await pool.query(`select count(*)::int n from public.company_records where company_id = $1 and deleted = false`, [OTHER]);
    check('the other company is untouched', otherCo.rows[0].n === 1);
  }catch(e){ check('server checks, Sept 30 – Oct 1', false, e.message); }
  await pool.end().catch(()=>{});
}
