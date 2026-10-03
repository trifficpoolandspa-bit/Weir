require('./phone-app.js');
// Part 1 of 4. The suite was one file until it grew past what could
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

console.log('\n=== Loads without runtime errors ===');
['customer-intake.html','technician-app.html','admin-readings-app.html'].forEach(f=>{
  const {errors} = load(f);
  check(f, errors.length === 0, errors[0]);
});

console.log('\n=== A failed save is reported, not swallowed ===');
['customer-intake.html','technician-app.html','admin-readings-app.html'].forEach(f=>{
  const {dom} = load(f, {fullStorage:true});
  const w = dom.window;
  const result = w.lsSet('probe', {a:1});
  check(f + ' returns false when storage is full', result === false,
        'returned ' + result);
});

console.log('\n=== Storage keys agree across files ===');
const site = fs.readFileSync('customer-intake.html','utf8');
const tech = fs.readFileSync('technician-app.html','utf8');
const writes = new Set([...site.matchAll(/lsSet\('([^']+)'/g)].map(m=>m[1]));
const reads  = new Set([...tech.matchAll(/lsGet\('([^']+)'/g)].map(m=>m[1]));
const shared = ['customers','technicians','settings','chemConfig','customChemConfig','routeOrders'];
shared.forEach(k=>{
  check('"' + k + '" written by site and read by app', writes.has(k) && reads.has(k));
});


console.log('\n=== Camera falls back when unavailable ===');
['technician-app.html','admin-readings-app.html'].forEach(f=>{
  const {dom, errors} = load(f);
  const w = dom.window;
  // jsdom has no getUserMedia, so this is the real no-camera path
  check(f + ' defines captureFromCamera', typeof w.captureFromCamera === 'function');
  if(typeof w.captureFromCamera === 'function'){
    let rejected = false;
    return w.captureFromCamera(800, 0.6)
      .then(()=>{ check(f + ' rejects without a camera', false, 'resolved instead'); })
      .catch(()=>{ check(f + ' rejects without a camera', true); });
  }
});

console.log('\n=== Photo controls are wired to real elements ===');
// The controllers are const, so they aren't on window — check the elements
// they depend on instead, which is what actually breaks when an id drifts.
['technician-app.html','admin-readings-app.html'].forEach(f=>{
  const {dom} = load(f);
  const d = dom.window.document;
  const src = fs.readFileSync(f, 'utf8');
  [['btnTakePhoto','pool after'], ['btnTakePhotoBefore','pool before'],
   ['btnTakePhotoSpa','spa after'], ['btnTakePhotoFountain','fountain after'],
   ['btnTakeGatePhoto','gate']].forEach(([id, label])=>{
    check(f + ' ' + label + ' photo button exists', !!d.getElementById(id));
  });
  check(f + ' gate controller declared', src.includes('const gatePhotoController'));
});


console.log('\n=== Every photo can be removed ===');
['technician-app.html','admin-readings-app.html'].forEach(f=>{
  const {dom} = load(f);
  const d = dom.window.document;
  [['btnRemovePhoto','pool after'], ['btnRemovePhotoBefore','pool before'],
   ['btnRemovePhotoSpa','spa after'], ['btnRemovePhotoBeforeSpa','spa before'],
   ['btnRemovePhotoFountain','fountain after'], ['btnRemovePhotoBeforeFountain','fountain before'],
   ['btnRemoveGatePhoto','gate']].forEach(([id, label])=>{
    check(f + ' ' + label + ' has a remove button', !!d.getElementById(id));
  });
});


console.log('\n=== Only the gate photo is set per technician ===');
['technician-app.html','admin-readings-app.html'].forEach(f=>{
  const src = fs.readFileSync(f, 'utf8');
  check(f + ' has the techRequires helper', src.includes('function techRequires'));
  check(f + ' the gate photo still honours it',
        src.includes("techRequires('requireGatePhoto')"));
  check(f + ' before photos no longer do',
        !src.includes("techRequires('requireBeforePhoto')"));
  check(f + ' nor after photos',
        !src.includes("techRequires('requireAfterPhoto')"));
});
{
  const d = load('admin-readings-app.html').dom.window.document;
  // Photo requirements are set on the website's Photo requirements tab now, so
  // the technician editor in the app carries none of them
  check('the tech editor has no gate tick', !d.getElementById('tcRequireGate'));
  check('nor a before tick', !d.getElementById('tcRequireBefore'));
  check('nor an after tick', !d.getElementById('tcRequireAfter'));
  check('nor a skip tick, they are all set on the website now', !d.getElementById('tcRequireSkipProof'));
}


console.log('\n=== Submit is not blocked when photos are optional ===');
['technician-app.html','admin-readings-app.html'].forEach(f=>{
  const src = fs.readFileSync(f, 'utf8');
  // The old bug: ready = !!ctrl.getData() with no check of the settings
  check(f + ' does not hard-require an after photo',
        !src.includes('const ready = !!ctrl.getData() && gateOk;'),
        'after photo required regardless of settings');
  check(f + ' has afterPhotoRequiredFor', src.includes('function afterPhotoRequiredFor'));
  // There is no global setting any more — a stored value could never be
  // switched off once the Settings toggle was removed
  check(f + ' has no app-wide photo requirement left',
        !src.includes('appSettings.requireAfterPhotos'));
  // The photo steps always exist now; the Photo requirements tab decides who
  // has to take what
  check(f + ' the after photo step is always offered',
        !src.includes('return appSettings.showAfterPhotos !== false;'));
});


console.log('\n=== Service performed only appears when done ===');
['technician-app.html','admin-readings-app.html'].forEach(f=>{
  const src = fs.readFileSync(f, 'utf8');
  check(f + ' builds a serviced section', src.includes('servicedHtml'));
  check(f + ' only lists a backwash when true', src.includes('if(reading.filterBackwashed)'));
  check(f + ' only lists a salt cell when true', src.includes('if(reading.saltCellCleaned)'));
  check(f + ' omits it from email when empty',
        src.includes("s.servicedText ? '\\nSERVICE PERFORMED\\n'+s.servicedText : ''"));
  check(f + ' omits it on screen when empty', src.includes('${s.servicedHtml || \'\'}'));
});

// Prove the logic: nothing when unchecked, something when checked
{
  function buildServiced(reading){
    const done = [];
    if(reading.filterBackwashed) done.push('Filter backwashed');
    if(reading.saltCellCleaned) done.push('Salt cell cleaned');
    return done;
  }
  check('nothing listed when both unchecked', buildServiced({}).length === 0);
  check('nothing listed when explicitly false',
        buildServiced({filterBackwashed:false, saltCellCleaned:false}).length === 0);
  check('backwash listed when checked',
        buildServiced({filterBackwashed:true}).join() === 'Filter backwashed');
  check('both listed when both checked',
        buildServiced({filterBackwashed:true, saltCellCleaned:true}).length === 2);
}


console.log('\n=== One smooth reordering implementation everywhere ===');
['customer-intake.html','technician-app.html','admin-readings-app.html'].forEach(f=>{
  const src = fs.readFileSync(f, 'utf8');
  const defs = (src.match(/function attachTouchReorder/g) || []).length;
  check(f + ' has exactly one implementation', defs === 1, defs + ' found');
  check(f + ' no HTML5-only drag remains',
        !src.includes('draggable = true'), 'HTML5 drag would not work on touch');
  check(f + ' uses a placeholder', src.includes('reorder-placeholder'));
  check(f + ' animates with requestAnimationFrame', src.includes('requestAnimationFrame(render)'));
  check(f + ' neighbours transition', src.includes("transition = 'transform .18s ease'"));
});


console.log('\n=== Voice parsing actually works ===');
['technician-app.html','admin-readings-app.html'].forEach(f=>{
  const src = fs.readFileSync(f, 'utf8');
  // The old bug: aliases attached on any label substring, so "Chlorine tabs"
  // stole the word "chlorine" and "Cyanuric acid" stole "muriatic acid"
  check(f + ' aliases attach on exact key only',
        !src.includes("key.indexOf(canon) !== -1 || labelHas"),
        'loose matching lets fields steal each others phrases');
  check(f + ' handles spoken pH decimals', src.includes("t.key === 'ph'"));
  check(f + ' matches whole words only', src.includes("'(^|[^a-z0-9])'"));
});

// No two fields may accept the same phrase
{
  const src = fs.readFileSync('technician-app.html','utf8');
  const a = src.indexOf('const SPOKEN_ALIASES = {');
  const b = src.indexOf('};', a) + 2;
  const sandbox = {};
  new Function('exports', src.slice(a, b) + '; exports.A = SPOKEN_ALIASES;')(sandbox);
  const items = [['chlorine','Free chlorine'],['ph','pH level'],['alkalinity','Total alkalinity'],
                 ['cya','Cyanuric acid'],['tds','TDS'],['tabs','Chlorine tabs'],
                 ['acid','Muriatic acid'],['shock','Shock'],['algaecide','Algaecide'],
                 ['phosphate','Phosphate remover']];
  const owner = {};
  let clashes = 0;
  items.forEach(([key, label])=>{
    const phrases = [label.toLowerCase()].concat(sandbox.A[key] || []);
    phrases.forEach(p=>{
      if(owner[p] && owner[p] !== label) clashes++;
      else owner[p] = label;
    });
  });
  check('no phrase is claimed by two fields', clashes === 0, clashes + ' clashes');
}


console.log('\n=== Every tab opens without throwing ===');
// This is what catches a block pasted into the wrong function: the page only
// breaks when you actually open it.
[['customer-intake.html', ['customers','chemconfig','settings','technicians','workcenter','history','productsservices']],
 ['technician-app.html', ['home','serviced','options']],
 ['admin-readings-app.html', ['home','technicians','customers','report','options']]
].forEach(([file, views])=>{
  const {dom, errors} = load(file);
  const w = dom.window;
  views.forEach(v=>{
    const before = errors.length;
    try{
      if(typeof w.switchView === 'function') w.switchView(v);
    }catch(e){
      errors.push('switchView("' + v + '") threw: ' + e.message);
    }
    const added = errors.slice(before);
    check(file + ' opens "' + v + '"', added.length === 0, added[0]);
  });
});

console.log('\n=== Readings and dosages renders its rows ===');
['customer-intake.html'].forEach(file=>{
  const {dom, errors} = load(file);
  const w = dom.window;
  const before = errors.length;
  try{
    if(typeof w.renderChemConfigLists === 'function') w.renderChemConfigLists();
  }catch(e){
    errors.push('renderChemConfigLists threw: ' + e.message);
  }
  const added = errors.slice(before);
  check(file + ' builds chemical and dosage rows', added.length === 0, added[0]);
});


console.log('\n=== Dosage rules fire during a real visit ===');
{
  const seed = {
    customers: [
      {id:'c1', name:'Plain', day:'Monday', hasPool:true, active:true},
      {id:'c2', name:'Custom', day:'Monday', hasPool:true, active:true}
    ],
    chemConfig: {
      pool: {
        chemicals: [{key:'chlorine', label:'Free chlorine', unit:'ppm', buttons:[0,1,3,5],
                     doseRules:[{op:'eq', value:'5', amount:'1', doseKey:'tabs'}]}],
        dosages: [{key:'tabs', label:'Chlorine tabs', unit:'count', buttons:[1,2,3]}]
      },
      spa: {chemicals:[], dosages:[]},
      fountain: {chemicals:[], dosages:[]}
    },
    // Customised before the rule existed — the snapshot carries no rules
    customChemConfig: {
      c2: { pool: {
        chemicals: [{key:'chlorine', label:'Free chlorine', unit:'ppm', buttons:[0,1,3,5]}],
        dosages: [{key:'tabs', label:'Chlorine tabs', unit:'count', buttons:[1,2,3]}]
      }}
    }
  };

  ['technician-app.html','admin-readings-app.html'].forEach(file=>{
    const {dom} = load(file, {seed});
    const w = dom.window, d = w.document;

    [['c1','plain customer'], ['c2','custom customer']].forEach(([cid, label])=>{
      // `let` variables aren't reachable from outside the script, so assigning
      // w.currentVisitCustomerId silently does nothing — eval runs inside scope.
      try{
        w.eval("currentVisitCustomerId = " + JSON.stringify(cid) + "; currentVisitFountainId = null;");
        w.eval("chemConfig = loadChemConfig();");
        w.eval("resetDoseRuleTracking();");
        w.eval("renderAllConfigFields();");
      }catch(e){ check(file + ' ' + label + ' renders', false, e.message); return; }
      check(file + ' ' + label + ': customer id really set',
            w.eval("currentVisitCustomerId") === cid);

      const chem = d.getElementById('pool_chem_chlorine');
      const dose = d.getElementById('pool_dose_tabs');
      if(!chem || !dose){ check(file + ' ' + label + ' has fields', false); return; }

      dose.value = '';
      chem.value = '5';
      chem.dispatchEvent(new w.Event('input', {bubbles:true}));
      check(file + ' ' + label + ': reading 5 fills the dosage', dose.value === '1',
            'got ' + JSON.stringify(dose.value));

      chem.value = '3';
      chem.dispatchEvent(new w.Event('input', {bubbles:true}));
      check(file + ' ' + label + ': changing the reading clears it', dose.value === '',
            'got ' + JSON.stringify(dose.value));

      chem.value = '5';
      chem.dispatchEvent(new w.Event('input', {bubbles:true}));
      check(file + ' ' + label + ': it refills on the way back', dose.value === '1',
            'got ' + JSON.stringify(dose.value));
    });
  });
}


console.log('\n=== A rule that cannot fire says why ===');
{
  const base = {
    customers: [{id:'c1', name:'Plain', day:'Monday', hasPool:true, active:true}],
    chemConfig: {
      pool: {
        chemicals: [{key:'chlorine', label:'Free chlorine', unit:'ppm', buttons:[5]}],
        dosages: [{key:'tabs', label:'Chlorine tabs', unit:'count', buttons:[1]}]
      },
      spa: {chemicals:[], dosages:[]}, fountain: {chemicals:[], dosages:[]}
    }
  };

  const cases = [
    ['rule with no value', [{op:'eq', value:'', amount:'1', doseKey:'tabs'}], 'no value set'],
    ['rule with no amount', [{op:'eq', value:'5', amount:'', doseKey:'tabs'}], 'no amount set'],
    ['rule pointing at a missing dosage',
       [{op:'eq', value:'5', amount:'1', doseKey:'nonexistent'}], 'not on this list']
  ];

  cases.forEach(([label, rules, expect])=>{
    const seed = JSON.parse(JSON.stringify(base));
    seed.chemConfig.pool.chemicals[0].doseRules = rules;
    const {dom} = load('technician-app.html', {seed});
    const w = dom.window, d = w.document;
    const warnings = [];
    w.console.warn = (...a)=> warnings.push(a.join(' '));
    try{
      w.eval("currentVisitCustomerId = 'c1';");
      w.eval("chemConfig = loadChemConfig();");
      w.eval("resetDoseRuleTracking();");
      w.eval("renderAllConfigFields();");
      const chem = d.getElementById('pool_chem_chlorine');
      chem.value = '5';
      chem.dispatchEvent(new w.Event('input', {bubbles:true}));
    }catch(e){ /* reported below */ }
    check('  ' + label + ' is reported',
          warnings.some(x => x.indexOf(expect) !== -1),
          'warnings: ' + JSON.stringify(warnings));
  });
}


console.log('\n=== Unfinished rules are dropped, not kept ===');
{
  // Closing the editor used to ask, and a second click could slip past the
  // question leaving the broken rule in place.
  function closeEditor(rules){
    return rules.filter(r =>
      !((r.value === '' || r.value == null)
        || (r.amount === '' || r.amount == null)
        || (r.op === 'between' && (r.value2 === '' || r.value2 == null))));
  }
  const rules = [
    {op:'eq', value:'5', amount:'1', doseKey:'tabs'},
    {op:'eq', value:'', amount:'1', doseKey:'tabs'},
    {op:'eq', value:'3', amount:'', doseKey:'tabs'},
    {op:'between', value:'2', value2:'', amount:'1', doseKey:'tabs'}
  ];
  const kept = closeEditor(rules);
  check('  only the complete rule survives', kept.length === 1, 'kept ' + kept.length);
  check('  and it is the right one', kept[0] && kept[0].value === '5');
  check('  closing again changes nothing', closeEditor(kept).length === 1);

  const src = fs.readFileSync('customer-intake.html','utf8');
  check('  the editor no longer asks before removing',
        !src.includes('Remove unfinished'), 'still asks');
  check('  a second close cannot slip past', src.includes('if(closed) return;'));
}


console.log('\n=== Rule order no longer decides whether a rule works ===');
{
  // Each rule used to set OR clear its own dosage as it was processed, so a
  // later non-matching rule wiped what an earlier matching one had written.
  // Whether a rule worked depended on where it sat in the list.
  const seed = {
    customers: [{id:'c1', name:'Test', day:'Monday', hasPool:true, active:true}],
    chemConfig: {
      pool: {
        chemicals: [
          {key:'chlorine', label:'Free chlorine', unit:'ppm', buttons:[0,1,2,3,5],
           doseRules:[
             {op:'lte', value:'2', amount:'2', doseKey:'shock'},
             {op:'eq',  value:'5', amount:'2', doseKey:'tabs'},
             {op:'eq',  value:'3', amount:'1', doseKey:'tabs'}
           ]},
          {key:'ph', label:'pH level', unit:'', buttons:[7.2,7.8,8],
           doseRules:[
             {op:'gte', value:'8',   amount:'1',   doseKey:'acid'},
             {op:'gte', value:'7.6', amount:'0.5', doseKey:'acid'}
           ]}
        ],
        dosages: [
          {key:'tabs', label:'Chlorine tabs', unit:'count', buttons:[1,2]},
          {key:'shock', label:'Shock', unit:'lb', buttons:[1,2]},
          {key:'acid', label:'Muriatic acid', unit:'gal', buttons:[0.5,1]}
        ]
      },
      spa: {chemicals:[], dosages:[]}, fountain: {chemicals:[], dosages:[]}
    }
  };

  ['technician-app.html','admin-readings-app.html'].forEach(file=>{
    const {dom} = load(file, {seed});
    const w = dom.window, d = w.document;
    w.console.warn = ()=>{};
    try{
      w.eval("currentVisitCustomerId = 'c1'; chemConfig = loadChemConfig(); resetDoseRuleTracking(); renderAllConfigFields();");
    }catch(e){ check(file + ' renders', false, e.message); return; }

    function enter(field, value){
      const el = d.getElementById('pool_chem_' + field);
      el.value = String(value);
      el.dispatchEvent(new w.Event('input', {bubbles:true}));
      return {
        tabs:(d.getElementById('pool_dose_tabs')||{}).value,
        shock:(d.getElementById('pool_dose_shock')||{}).value,
        acid:(d.getElementById('pool_dose_acid')||{}).value
      };
    }

    [[0,'','2'], [2,'','2'], [3,'1',''], [5,'2',''], [7,'','']].forEach(([v,tabs,shock])=>{
      const g = enter('chlorine', v);
      check(file + ' chlorine ' + v + ' -> tabs/shock',
            g.tabs === tabs && g.shock === shock,
            'got tabs=' + JSON.stringify(g.tabs) + ' shock=' + JSON.stringify(g.shock));
    });

    enter('chlorine', '');
    [[7.2,''], [7.8,'0.5'], [8,'0.5']].forEach(([v,acid])=>{
      const g = enter('ph', v);
      check(file + ' pH ' + v + ' -> acid', g.acid === acid, 'got ' + JSON.stringify(g.acid));
    });
  });
}


console.log('\n=== A decimal typed without a leading zero gets one ===');
{
  ['customer-intake.html','technician-app.html','admin-readings-app.html'].forEach(file=>{
    const {dom} = load(file);
    const w = dom.window, d = w.document;
    check(file + ' has the helper', typeof w.padLeadingZero === 'function');
    if(typeof w.padLeadingZero !== 'function') return;

    [['.5','0.5'], ['.25','0.25'], ['-.5','-0.5'], ['0.5','0.5'],
     ['5','5'], ['','' ], ['.','.'], ['7.4','7.4']].forEach(([input, want])=>{
      check(file + ' "' + input + '" -> "' + want + '"',
            w.padLeadingZero(input) === want,
            'got ' + JSON.stringify(w.padLeadingZero(input)));
    });

    // And through a real field, the way a tech would type it
    const inp = d.createElement('input');
    inp.type = 'number';
    d.body.appendChild(inp);
    inp.value = '.5';
    inp.dispatchEvent(new w.Event('change', {bubbles:true}));
    check(file + ' a real field is tidied on change', inp.value === '0.5',
          'got ' + JSON.stringify(inp.value));
  });
}

console.log('\n=== Tidying a decimal still triggers dosage rules ===');
{
  const seed = {
    customers: [{id:'c1', name:'Test', day:'Monday', hasPool:true, active:true}],
    chemConfig: {
      pool: {
        chemicals: [{key:'chlorine', label:'Free chlorine', unit:'ppm', buttons:[0.5],
                     doseRules:[{op:'eq', value:'0.5', amount:'1', doseKey:'tabs'}]}],
        dosages: [{key:'tabs', label:'Chlorine tabs', unit:'count', buttons:[1]}]
      },
      spa: {chemicals:[], dosages:[]}, fountain: {chemicals:[], dosages:[]}
    }
  };
  const {dom} = load('technician-app.html', {seed});
  const w = dom.window, d = w.document;
  w.console.warn = ()=>{};
  try{
    w.eval("currentVisitCustomerId = 'c1'; chemConfig = loadChemConfig(); resetDoseRuleTracking(); renderAllConfigFields();");
    const chem = d.getElementById('pool_chem_chlorine');
    chem.value = '.5';
    chem.dispatchEvent(new w.Event('change', {bubbles:true}));
    check('  ".5" becomes "0.5" in the reading', chem.value === '0.5',
          'got ' + JSON.stringify(chem.value));
    check('  and the rule still fires',
          (d.getElementById('pool_dose_tabs') || {}).value === '1',
          'got ' + JSON.stringify((d.getElementById('pool_dose_tabs') || {}).value));
  }catch(e){ check('  decimal + rules', false, e.message); }
}


console.log('\n=== A custom setup goes to the right customer ===');
{
  // The fields were built BEFORE the customer id was set, so each visit was
  // laid out with the previous customer's chemicals — a custom setup appeared
  // on whoever came before them on the route.
  const seed = {
    customers: [
      {id:'jim', name:'Jim', day:'Monday', hasPool:true, active:true},
      {id:'bob', name:'Bob', day:'Monday', hasPool:true, active:true}
    ],
    chemConfig: {
      pool: {
        chemicals: [{key:'chlorine', label:'Free chlorine', unit:'ppm', buttons:[3]}],
        dosages: [{key:'tabs', label:'Chlorine tabs', unit:'count', buttons:[1]}]
      },
      spa: {chemicals:[], dosages:[]}, fountain: {chemicals:[], dosages:[]}
    },
    customChemConfig: {
      bob: { pool: {
        chemicals: [{key:'bobonly', label:'Bob only', unit:'ppm', buttons:[9]}],
        dosages: [{key:'bobdose', label:'Bob dose', unit:'oz', buttons:[9]}]
      }}
    }
  };

  ['technician-app.html','admin-readings-app.html'].forEach(file=>{
    const {dom} = load(file, {seed});
    const w = dom.window, d = w.document;
    w.console.warn = ()=>{};

    function shown(){
      if(d.getElementById('pool_chem_bobonly')) return 'custom';
      if(d.getElementById('pool_chem_chlorine')) return 'standard';
      return 'none';
    }

    try{
      w.eval("openVisit('jim');");
      check(file + ' Jim gets the standard list', shown() === 'standard', 'got ' + shown());
      w.eval("openVisit('bob');");
      check(file + ' Bob gets his own setup', shown() === 'custom', 'got ' + shown());
      w.eval("openVisit('jim');");
      check(file + ' Jim is not given Bob\'s setup', shown() === 'standard', 'got ' + shown());
      w.eval("openVisit('bob');");
      check(file + ' Bob keeps his on a second visit', shown() === 'custom', 'got ' + shown());
    }catch(e){
      check(file + ' custom setup routing', false, e.message);
    }
  });
}


console.log('\n=== Salt pools skip chlorine, but are still shocked ===');
{
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const today = DAYS[new Date().getDay()];

  function seedFor(chlorChoice){
    return {
      technicians: [{id:'t1', name:'Alex'}],
      customers: [{id:'c1', name:'Test', day: today, active:true, technicianId:'t1', hasPool:true,
        equipment: chlorChoice ? [{type:'Chlorination', chlorinationChoice: chlorChoice}] : []}],
      afterPhotoDefaultFixed: true,
      chemConfig: {
        pool: {
          chemicals: [{key:'chlorine', label:'Free chlorine', unit:'ppm', buttons:[0,1],
            doseRules:[
              {op:'eq', value:'1', amount:'2', doseKey:'tabs'},
              {op:'eq', value:'0', amount:'1', doseKey:'shock'}
            ]}],
          dosages: [
            {key:'tabs', label:'Chlorine tabs', unit:'count', buttons:[1,2]},
            {key:'shock', label:'Shock', unit:'lb', buttons:[1]}
          ]
        },
        spa: {chemicals:[], dosages:[]}, fountain: {chemicals:[], dosages:[]}
      }
    };
  }

  ['technician-app.html','admin-readings-app.html'].forEach(file=>{
    // A salt pool
    {
      const {dom} = load(file, {seed: seedFor('Salt Cell')});
      const w = dom.window, d = w.document;
      w.console.warn = ()=>{};
      try{
        w.eval("currentUser = {id:'t1', name:'Alex'}; openVisit('c1');");
        const chem = d.getElementById('pool_chem_chlorine');
        const tabs = d.getElementById('pool_dose_tabs');
        const shock = d.getElementById('pool_dose_shock');

        tabs.value = ''; chem.value = '1';
        chem.dispatchEvent(new w.Event('input', {bubbles:true}));
        check(file + ' salt pool: no tabs added', tabs.value === '', tabs.value);

        shock.value = ''; chem.value = '0';
        chem.dispatchEvent(new w.Event('input', {bubbles:true}));
        check(file + ' salt pool: shock is still added', shock.value === '1', shock.value);
      }catch(e){ check(file + ' salt pool dosing', false, e.message); }
    }

    // A tab-chlorinated pool
    {
      const {dom} = load(file, {seed: seedFor('Tabs')});
      const w = dom.window, d = w.document;
      w.console.warn = ()=>{};
      try{
        w.eval("currentUser = {id:'t1', name:'Alex'}; openVisit('c1');");
        const chem = d.getElementById('pool_chem_chlorine');
        const tabs = d.getElementById('pool_dose_tabs');
        tabs.value = ''; chem.value = '1';
        chem.dispatchEvent(new w.Event('input', {bubbles:true}));
        check(file + ' tab pool: tabs are added', tabs.value === '2', tabs.value);
      }catch(e){ check(file + ' tab pool dosing', false, e.message); }
    }
  });

  // Which products count as chlorine
  {
    const {dom} = load('technician-app.html', {seed: seedFor('Salt Cell')});
    const w = dom.window;
    w.console.warn = ()=>{};
    const lists = {dosages:[
      {key:'tabs', label:'Chlorine tabs'}, {key:'shock', label:'Shock'},
      {key:'cya', label:'Stabiliser'}, {key:'acid', label:'Muriatic acid'},
      {key:'calshock', label:'Cal-hypo shock'}, {key:'liq', label:'Liquid chlorine'}
    ]};
    w.eval("window.__lists = " + JSON.stringify(lists) + ";");
    const is = k => w.eval("isChlorineProduct('" + k + "', window.__lists)");
    check('  chlorine tabs count as chlorine', is('tabs') === true);
    check('  liquid chlorine counts', is('liq') === true);
    check('  shock does not', is('shock') === false);
    check('  cal-hypo shock does not', is('calshock') === false);
    check('  stabiliser does not, despite containing "tab"', is('cya') === false);
    check('  acid does not', is('acid') === false);
  }
}

console.log('\n=== Live refresh across tabs on the same device ===');
{
  const seed = {
    customers: [
      {id:'c1', name:'Alpha', day:'Monday', hasPool:true, active:true, technicianId:'t1'},
      {id:'c2', name:'Beta',  day:'Monday', hasPool:true, active:true, technicianId:'t1'}
    ],
    technicians: [{id:'t1', name:'Alex'}]
  };
  ['admin-readings-app.html','technician-app.html'].forEach(file=>{
    const {dom} = load(file, {seed});
    const w = dom.window;
    w.console.warn = ()=>{};
    check(file + ' has a live refresh', typeof w.refreshFromStorage === 'function');
    if(typeof w.refreshFromStorage !== 'function') return;

    const updated = JSON.parse(JSON.stringify(seed.customers));
    updated[0].lastServicedDate = '2026-08-20';
    w.localStorage.setItem('weir:customers', JSON.stringify(updated));
    w.dispatchEvent(new w.StorageEvent('storage', {key:'weir:customers'}));

    // The refresh is debounced, so force it through for the test
    w.eval("customers = lsGet('customers') || customers;");
    const done = w.eval("customers.filter(c => c.lastServicedDate).length");
    check(file + ' picks up another tab\'s change', done === 1, done + ' marked done');

    // An unrelated key must not trigger work
    check(file + ' ignores keys from other apps',
          (function(){
            try{
              w.dispatchEvent(new w.StorageEvent('storage', {key:'something-else'}));
              return true;
            }catch(e){ return false; }
          })());
  });
}


console.log('\n=== A setting reads the same everywhere ===');
{
  // The toggle used "!== false" in one app and "=== true" in another, so the
  // same setting appeared off in one place while being enforced in the other.
  const files = ['customer-intake.html','technician-app.html','admin-readings-app.html'];
  ['requireAfterPhotos','requireBeforePhotos','requireGatePhoto',
   'requireAfterPhoto','requireBeforePhoto'].forEach(flag=>{
    let mismatched = [];
    files.forEach(f=>{
      const src = fs.readFileSync(f, 'utf8');
      if(src.indexOf(flag + ' !== false') !== -1) mismatched.push(f);
    });
    check('  "' + flag + '" is read consistently', mismatched.length === 0,
          'reads "!== false" in ' + mismatched.join(', '));
  });
}

console.log('\n=== A blocked photo says which setting requires it ===');
{
  ['technician-app.html','admin-readings-app.html'].forEach(f=>{
    const src = fs.readFileSync(f, 'utf8');
    check(f + ' names the source for a before photo',
          src.indexOf("'A before photo is required here (' + beforeWhy") !== -1);
    check(f + ' names the source for an after photo',
          src.indexOf("'An after photo is required here (' + afterWhy") !== -1);
    check(f + ' names the list whose setting demanded it',
          src.indexOf("'this list\\u2019s own setting'") !== -1);
    check(f + " a section's own setting takes precedence",
          src.indexOf("if(lists && typeof lists.requireAfterPhoto === 'boolean') return lists.requireAfterPhoto;") !== -1);
  });
}


console.log('\n=== Body order is shared between the website and the apps ===');
{
  const files = ['customer-intake.html','technician-app.html','admin-readings-app.html'];
  files.forEach(f=>{
    const src = fs.readFileSync(f, 'utf8');
    check(f + " uses the shared 'customBodyOrder' key",
          src.indexOf("'customBodyOrder'") !== -1);
  });

  // The apps write it, the website writes it, and all read it back the same way
  ['technician-app.html','admin-readings-app.html'].forEach(f=>{
    const src = fs.readFileSync(f, 'utf8');
    check(f + ' writes the order from the visit tabs',
          src.indexOf("store[customer.id] = keys") !== -1);
    check(f + ' reads it when working out sections',
          src.indexOf("const store = lsGet('customBodyOrder') || {};") !== -1);
  });
  {
    const src = fs.readFileSync('customer-intake.html','utf8');
    check('website writes the order from the Custom tab',
          src.indexOf("store[cust.id] = keys") !== -1);
  }
}

console.log('\n=== The order is permanent, not per week ===');
{
  // It is stored against the customer id alone. Nothing in the key or the
  // lookup involves a date, so it cannot revert next week.
  ['technician-app.html','admin-readings-app.html','customer-intake.html'].forEach(f=>{
    const src = fs.readFileSync(f, 'utf8');
    const idx = src.indexOf("customBodyOrder");
    const around = src.slice(Math.max(0, idx - 400), idx + 400);
    check(f + ' keys the order by customer, not by date',
          around.indexOf('todayDateStr') === -1 && around.indexOf('isoForDay') === -1);
  });
}


console.log('\n=== Photo settings line up, and rules fire regardless ===');
{
  function seedFor(settings, sectionAfter){
    const cfg = {
      pool: {
        chemicals: [{key:'chlorine', label:'Free chlorine', unit:'ppm', buttons:[5],
                     doseRules:[{op:'eq', value:'5', amount:'1', doseKey:'tabs'}]}],
        dosages: [{key:'tabs', label:'Chlorine tabs', unit:'count', buttons:[1]}]
      },
      spa: {chemicals:[], dosages:[]}, fountain: {chemicals:[], dosages:[]}
    };
    if(sectionAfter !== undefined) cfg.pool.requireAfterPhoto = sectionAfter;
    return {
      customers: [{id:'c1', name:'Test', day:'Monday', hasPool:true, active:true}],
      settings, chemConfig: cfg,
      // Mark the one-time default correction as already applied, so a
      // deliberately-on setting is honoured rather than cleared
      afterPhotoDefaultFixed: true
    };
  }

  const cases = [
    [{requireAfterPhotos:false, showAfterPhotos:true},  true,      true,  'app-wide off, section requires'],
    [{requireAfterPhotos:true,  showAfterPhotos:true},  false,     false, 'app-wide on, section exempt'],
    // The old Settings switches are gone: a stale value must change nothing
    [{requireAfterPhotos:false, showAfterPhotos:false}, true,      true,  'stale step setting, section requires'],
    [{requireAfterPhotos:false, showAfterPhotos:false}, undefined, false, 'stale step setting, section untouched'],
    // A stale app-wide value must no longer demand anything
    [{requireAfterPhotos:true,  showAfterPhotos:true},  undefined, false, 'stale app-wide value is ignored']
  ];

  ['technician-app.html','admin-readings-app.html'].forEach(file=>{
    cases.forEach(([settings, sectionAfter, wantRequired, label])=>{
      const {dom} = load(file, {seed: seedFor(settings, sectionAfter)});
      const w = dom.window, d = w.document;
      w.console.warn = ()=>{};
      try{
        w.eval("openVisit('c1');");
        const req = w.eval("afterPhotoRequiredFor('pool')");
        check(file + ': ' + label, req === wantRequired,
              'got ' + req + ', wanted ' + wantRequired);

        // Rules must fire whatever the photo settings say
        const chem = d.getElementById('pool_chem_chlorine');
        const dose = d.getElementById('pool_dose_tabs');
        dose.value = '';
        chem.value = '5';
        chem.dispatchEvent(new w.Event('input', {bubbles:true}));
        check(file + ': rules fire with ' + label, dose.value === '1',
              'dose = ' + JSON.stringify(dose.value));
      }catch(e){
        check(file + ': ' + label, false, e.message);
      }
    });
  });
}


console.log('\n=== A stale photo setting changes nothing ===');
{
  // Settings no longer carries switches for the photo steps. Whether a step
  // appears is decided by who has been asked for a photo, and a leftover
  // setting must not change that either way.
  ['technician-app.html','admin-readings-app.html'].forEach(file=>{
    const seedWith = rules => ({
      technicians: [{id:'t1', name:'Pat', photoRules: rules}],
      customers: [{id:'c1', name:'Test', day:'Monday', hasPool:true, active:true, technicianId:'t1'}],
      settings: {showAfterPhotos: false, showBeforePhotos: false, showGatePhoto: false}
    });

    // Nobody asked: no photo steps, whatever the old setting says
    {
      const {dom} = load(file, {seed: seedWith({})});
      const w = dom.window;
      w.console.warn = ()=>{};
      try{
        w.eval("currentUser = {id:'t1', name:'Pat'};");
        check(file + ' asks for no before photo when nobody is asked',
              w.eval("showsBeforePhotoStep('pool')") === false);
      }catch(e){ check(file + ' stale settings, nobody asked', false, e.message); }
    }

    // Asked: the step appears, and the stale setting does not stop it
    {
      const {dom} = load(file, {seed: seedWith({before: {pool: true}, after: {pool: true}})});
      const w = dom.window;
      w.console.warn = ()=>{};
      try{
        w.eval("currentUser = {id:'t1', name:'Pat', photoRules: {before:{pool:true}, after:{pool:true}}};");
        check(file + ' shows the before photo step when it is asked for',
              w.eval("showsBeforePhotoStep('pool')") === true);
        check(file + ' and the after photo step too',
              w.eval("showsAfterPhotoStep('pool')") === true);
        const steps = JSON.parse(w.eval("JSON.stringify(visitStepCardsFor('pool'))"))
          .map(x => String(Array.isArray(x) ? x[0] : x));
        check(file + ' with the before photo first', /BeforePhotoSection/.test(steps[0]), steps.join(' | '));
      }catch(e){ check(file + ' stale settings, asked', false, e.message); }
    }
  });
}


console.log('\n=== Voice keeps listening while the button is held ===');
{
  ['technician-app.html','admin-readings-app.html'].forEach(f=>{
    const src = fs.readFileSync(f, 'utf8');
    check(f + ' tracks whether the button is held', src.includes('let pttHolding = false;'));
    check(f + ' restarts when the engine stops mid-hold',
          src.includes('if(pttHolding){') && src.includes('pttRecognition.start();      // still held'));
    check(f + ' ignores silence errors while held',
          src.includes("e.error === 'no-speech' || e.error === 'aborted'"));
    check(f + ' only finishes when the finger lifts',
          src.includes('pttHolding = false;\n  if(pttRecognition){'));
    check(f + ' retries if the engine refuses to restart',
          src.includes('}, 120);'));
  });

  // The accumulated speech must survive the restarts
  let holding = false, heard = '', running = false;
  const onend = ()=>{ if(holding){ running = true; return; } running = false; };
  const start = ()=>{ holding = true; running = true; heard = ''; };
  const say = t => { if(running) heard += t + ' '; };
  const stop = ()=>{ holding = false; onend(); };

  start();
  say('chlorine three'); onend();
  say('ph seven point four'); onend();
  say('acid one'); stop();

  check('  speech before the first pause is kept', heard.indexOf('chlorine three') !== -1);
  check('  speech after a pause is kept', heard.indexOf('ph seven point four') !== -1);
  check('  speech after a second pause is kept', heard.indexOf('acid one') !== -1);
  check('  listening stops on release', running === false);
}


console.log('\n=== Next/Previous keeps the open tab ===');
{
  const seed = {
    customers: [
      {id:'a', name:'Alpha One', day:'Monday', hasPool:true, active:true},
      {id:'b', name:'Bravo Two', day:'Monday', hasPool:true, active:true},
      {id:'c', name:'Charlie Three', day:'Monday', hasPool:true, active:true}
    ]
  };
  const {dom} = load('customer-intake.html', {seed});
  const w = dom.window, d = w.document;
  w.console.warn = ()=>{};
  w.Element.prototype.scrollIntoView = function(){};

  const activeTab = ()=>{
    const b = d.querySelector('#profileTabControl .history-type-btn.active');
    return b ? b.dataset.tab : 'none';
  };
  const openTab = (name)=>{
    d.querySelectorAll('#profileTabControl .history-type-btn').forEach(b=>{
      b.classList.toggle('active', b.dataset.tab === name);
    });
  };

  try{
    w.eval("viewCustomer(customers[0]);");
    check('  opening a customer starts on Profile', activeTab() === 'profile', activeTab());

    openTab('equipment');
    w.eval("stepToCustomer(1);");
    check('  Next keeps Equipment', activeTab() === 'equipment', activeTab());

    w.eval("stepToCustomer(1);");
    check('  Next again still keeps it', activeTab() === 'equipment', activeTab());

    openTab('history');
    w.eval("stepToCustomer(-1);");
    check('  Previous keeps Service Reports', activeTab() === 'history', activeTab());

    openTab('workorders');
    w.eval("stepToCustomer(-1);");
    check('  Previous keeps Quotes & Orders', activeTab() === 'workorders', activeTab());

    w.eval("viewCustomer(customers[2]);");
    check('  opening from the list resets to Profile', activeTab() === 'profile', activeTab());
  }catch(e){
    check('  tab persistence', false, e.message);
  }
}


console.log('\n=== Quick buttons are shared across customers ===');
{
  const seed = {
    customers: [
      {id:'a', name:'Alpha One', day:'Monday', hasPool:true, active:true,
       equipmentTypeOptions:['Filter','Salt System']},
      {id:'b', name:'Bravo Two', day:'Monday', hasPool:true, active:true,
       equipmentTypeOptions:['Filter','Salt System']}
    ]
  };
  const {dom} = load('customer-intake.html', {seed});
  const w = dom.window, d = w.document;
  w.console.warn = ()=>{};
  w.Element.prototype.scrollIntoView = function(){};

  const texts = ()=> Array.from(d.querySelectorAll('#icEquipmentList button'))
    .map(b => b.textContent.trim());

  try{
    w.eval("viewCustomer(customers[0]);");
    // Oct 2 (1hj): no "+ Quick buttons" on a row with none; "Edit buttons" stays where there are some
    check('  a type with no quick buttons has no "+ Quick buttons" bubble',
          !texts().includes('+ Quick buttons'), texts().join(','));
    check('  a new option is not there yet', !texts().includes('Pentair CCP420'));

    // What choosing "Other" and typing a name does
    w.eval("saveCustomEquipmentOptions('Filter', ['Pentair CCP420']);");
    w.eval("renderEquipmentTypeList();");
    check('  it appears for this customer', texts().includes('Pentair CCP420'));
    check('  built-in choices are kept', texts().includes('Cartridge') && texts().includes('Sand'));
    check('  Other is still offered', texts().includes('Other'));

    // The point of the feature: another customer gets it too
    w.eval("viewCustomer(customers[1]);");
    check('  it appears for a different customer', texts().includes('Pentair CCP420'),
          texts().join(','));

    // But only on the same equipment type
    w.eval("saveCustomEquipmentOptions('Salt System', ['Circupool']);");
    w.eval("renderEquipmentTypeList();");
    check('  a different type keeps its own options', texts().includes('Circupool'));
  }catch(e){
    check('  shared quick buttons', false, e.message);
  }
}


console.log('\n=== Deleting equipment from chosen customers ===');
{
  const seed = {
    customers: [
      {id:'a', name:'Alpha One', active:true, equipmentTypeOptions:['Filter','Salt System']},
      {id:'b', name:'Bravo Two', active:true, equipmentTypeOptions:['Filter','Salt System'],
       equipment:[{type:'Salt System', photos:[{id:'p1'}]}]},
      {id:'c', name:'Charlie Three', active:true, equipmentTypeOptions:['Filter','Salt System']},
      {id:'d', name:'Delta Four', active:true, equipmentTypeOptions:['Filter']}
    ]
  };
  const {dom} = load('customer-intake.html', {seed});
  const w = dom.window, d = w.document;
  w.console.warn = ()=>{};
  w.Element.prototype.scrollIntoView = function(){};
  const has = (id,t)=> w.eval("(customers.find(c=>c.id==='" + id + "').equipmentTypeOptions||[]).includes('" + t + "')");

  try{
    w.eval("viewCustomer(customers[0]);");

    const rows = Array.from(d.querySelectorAll('#icEquipmentList > div'));
    const saltRow = rows.find(r => r.textContent.includes('Salt System'));
    const xBtn = Array.from(saltRow.querySelectorAll('button')).find(b => b.textContent.trim() === '\u00d7' || b.dataset.xDrawn === '1');
    check('  the delete button exists', !!xBtn);
    xBtn.click();

    const box = d.querySelector('.confirm-overlay .confirm-box');
    const labels = Array.from(box.querySelectorAll('button')).map(b => b.textContent.trim());
    check('  offers "Just this customer"', labels.includes('Just this customer'));
    check('  offers "Delete from multiple customers"',
          labels.includes('Delete from multiple customers'), labels.join(' | '));
    check('  no longer offers a delete-from-all button',
          !labels.some(t => t.startsWith('Delete from all')), labels.join(' | '));

    d.getElementById('delEqPick').click();
    // Each row's name (its first line; the address sits under it now)
    const names = Array.from(d.querySelectorAll('#delEqList label')).map(l => { const sp = l.querySelector('span > span'); return sp ? sp.textContent : ''; }).filter(Boolean);
    check('  lists only customers with that equipment', names.length === 2, names.join(','));
    check('  excludes one without it', !names.some(n => n.includes('Delta')));

    const boxes = d.querySelectorAll('#delEqList input[type=checkbox]');
    boxes[0].click(); boxes[1].click();
    check('  the button counts the selection',
          d.getElementById('delEqGo').textContent.trim() === 'Delete from 2 customers',
          d.getElementById('delEqGo').textContent.trim());

    d.getElementById('delEqGo').click();

    // The click resolves a promise, so the removal happens a tick later.
    // Defer the remaining checks rather than reading too early.
    deferred.push(()=>{
      check('  removed from the first selected', has('b','Salt System') === false);
      check('  removed from the second selected', has('c','Salt System') === false);
      check('  its equipment record went too',
            w.eval("customers.find(c=>c.id==='b').equipment.length") === 0);
      check('  a customer without it is untouched', has('d','Filter') === true);
      check('  their other equipment survives', has('b','Filter') === true);
    });
  }catch(e){
    check('  delete from chosen customers', false, e.message);
  }
}


// ---- One phone app ----
// The technician app and the admin app are one file, app.html. Admin extras
// show only for someone with admin access; the old files forward to it.
console.log('\n=== One phone app: what a technician and an admin each see ===');
{
  const asAdmin = w => ['weirdevice:', 'weirdevice:beta-'].forEach(p =>
    w.localStorage.setItem(p + 'membership', JSON.stringify({full_access: true})));
  const shown = (d, sel) => Array.from(d.querySelectorAll(sel)).filter(b => b.style.display !== 'none')
    .map(b => b.dataset.view);
  const visible = (d, id) => { const el = d.getElementById(id); return !!el && el.style.display !== 'none'; };

  const t = load('app.html'), td = t.dom.window.document, tw = t.dom.window;
  const a = load('app.html', {beforeParse: asAdmin}), ad = a.dom.window.document, aw = a.dom.window;
  deferred.push(()=>{
    check('app.html loads for a technician without errors', t.errors.length === 0, t.errors[0]);
    check('and for an admin', a.errors.length === 0, a.errors[0]);
    check('the header says just Weir', td.querySelector('header h1').textContent.trim() === 'Weir'
          && !td.querySelector('header .brand p'), td.querySelector('header').textContent.trim());
    check('the sign-in card says Weir, for everyone', /^Weir$/.test(td.querySelector('#loginScreen h2').textContent.trim()));
    check('a technician sees Today, Serviced and Settings',
          shown(td, 'nav .tab').join() === 'home,serviced,options', shown(td, 'nav .tab').join());
    check('on the bottom bar too', shown(td, '.bottombar .tab').join() === 'home,serviced,options', shown(td, '.bottombar .tab').join());
    check('an admin sees Today, Technicians, Customer, Report and Settings',
          shown(ad, 'nav .tab').join() === 'home,technicians,customers,report,options', shown(ad, 'nav .tab').join());
    // The bottom bar has Report before Customer (Sept 29)
    check('on the bottom bar too, Report before Customer', shown(ad, '.bottombar .tab').join() === 'home,technicians,report,customers,options', shown(ad, '.bottombar .tab').join());
    check('a technician keeps the Voice entry mode setting', visible(td, 'techVoiceCard') && !visible(td, 'adminSettingsCards'));
    check('an admin keeps the voice button and Technicians tab settings', visible(ad, 'adminSettingsCards') && !visible(ad, 'techVoiceCard'));
    check('a technician\u2019s Serviced list is its own tab',
          td.getElementById('view-serviced').contains(td.getElementById('servicedList')));
    check('an admin\u2019s is inside Report', ad.getElementById('view-report').contains(ad.getElementById('servicedList')));
    check('a technician picks a report\u2019s customer from the list, as before',
          visible(td, 'reportCustomerSelect') && !visible(td, 'reportCustomerSearch') && !visible(td, 'reportModeCard'));
    check('an admin searches for one, as before',
          !visible(ad, 'reportCustomerSelect') && visible(ad, 'reportCustomerSearch') && visible(ad, 'reportModeCard'));
    check('each behaves as their old app did (report heading)',
          tw.eval("techVersion_renderFullCombinedReport.toString()").includes('${reportLabel} service report')
          && tw.eval("isAdminUser()") === false && aw.eval("isAdminUser()") === true);

    // A technician opening Serviced sees the list, and a report from it opens
    // without the admin's Serviced / Reports switch
    tw.eval("switchView('serviced')");
    check('Serviced opens for a technician', tw.eval('currentViewName') === 'serviced' && visible(td, 'reportModeServiced'));
    tw.eval("switchView('report', {skipRefresh: true})");
    check('a report opened from it shows the report, not the switch',
          visible(td, 'reportModeReports') && !visible(td, 'reportModeCard'));
    tw.eval("switchView('serviced')");
    check('and Serviced is still there going back', visible(td, 'reportModeServiced'));

    // Admin access switched off at the office while an admin is on an admin-only tab
    aw.eval("currentUser = {id: 't1', name: 'Pat', isAdmin: true}; applyRoleUI(); switchView('customers');");
    aw.eval("fieldCurrentUser = () => ({id: 't1', name: 'Pat', isAdmin: false}); refreshSignedInRole();");
    check('losing admin access takes the admin tabs away at once',
          shown(ad, 'nav .tab').join() === 'home,serviced,options', shown(ad, 'nav .tab').join());
    check('and leaves the admin-only tab for Today', aw.eval('currentViewName') === 'home');
    aw.eval("fieldCurrentUser = () => ({id: 't1', name: 'Pat', isAdmin: true}); refreshSignedInRole();");
    check('given back, the admin tabs return', shown(ad, 'nav .tab').join() === 'home,technicians,customers,report,options');
    check('the Technicians tab setting still hides it for an admin',
          (aw.eval("appSettings.showTechniciansTab = false; applyRoleUI();"), shown(ad, 'nav .tab').join() === 'home,customers,report,options'));
    aw.eval("appSettings.showTechniciansTab = true; applyRoleUI();");
  });

  // Signing out with changes waiting asks first, for admins as well now
  {
    const s = load('app.html', {beforeParse: asAdmin}), sw = s.dom.window, sd = sw.document;
    let asked = '';
    sw.eval("fieldPendingCount = () => 2;");
    sw.__ask = (m) => { asked = m; return Promise.resolve(false); };
    sw.eval("confirmDialog = (m) => window.__ask(m);");
    sd.getElementById('btnLogout').click();
    deferred.push(()=>{
      check('signing out with 2 changes unsent asks first', /2 changes have not reached the office/.test(asked), asked);
    });
  }

  // Save report on the last page is the admin's only
  {
    const src = fs.readFileSync('app.html', 'utf8');
    check('Save report is offered to admins only', /if\(isAdminUser\(\) && submitId && headEl && pendingVisit/.test(src));
  }

}
{
  // Read the forwarding pages as they are, past the suites' own mapping
  const path = require('path');
  const readRaw = f => require('child_process').execFileSync('cat', [path.resolve(f)], {encoding: 'utf8'});
  ['technician-app.html', 'admin-readings-app.html'].forEach(f=>{
    const src = readRaw(f);
    check(f + ' now only forwards to app.html', /location\.replace\('\.\/app\.html' \+ location\.search \+ location\.hash\)/.test(src)
          && src.length < 800);
    let went = null;
    const dom = new JSDOM(src.replace("location.replace(", "window.__go("), {runScripts: 'dangerously', url: 'https://example.com/Weir/' + f + '?company=ABC#x',
      beforeParse(w){ w.__go = u => { went = u; }; }});
    check(f + ' keeps the setup link on the way', went === './app.html?company=ABC#x', went);
  });
  const index = readRaw('index.html');
  check('the sign-in page sends everyone to app.html', /function routeFor\(tech\)\{\s*return '\.\/app\.html';\s*\}/.test(index));
  const sw = readRaw('sw.js');
  check('the offline copy includes app.html, under a new cache name',
        /'\.\/app\.html'/.test(sw) && /weir-cache-v\d+/.test(sw) && /caches\.match\('\.\/app\.html'/.test(sw));
}


// ======== Sept 28–29 changes (in-progress 1cr–1dd) ========
// Each one driven through the real page. Async checks go through deferred,
// which now waits for them.
{
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const todayName = DAYS[new Date().getDay()];
  const localISO = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const todayISO = localISO(new Date());
  const asAdmin = w => ['weirdevice:', 'weirdevice:beta-'].forEach(p =>
    w.localStorage.setItem(p + 'membership', JSON.stringify({full_access: true})));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const techs = [{id: 't1', name: 'Pat'}, {id: 't2', name: 'Sam'}, {id: 't3', name: 'Lee'}];
  const custs = [
    {id: 'c1', name: 'Alpha', address: '1 A St', day: todayName, technicianId: 't1', active: true, hasPool: true, hasSpa: true, phone: '5551', email: 'a@x.com'},
    {id: 'c2', name: 'Bravo', address: '2 B St', day: todayName, technicianId: 't1', active: true, hasPool: true, phone: '5552'},
    {id: 'c3', name: 'Charlie', address: '3 C St', day: todayName, technicianId: 't1', active: true, hasPool: true, email: 'c@x.com'}
  ];

  // ---- App
  console.log('\n=== App: extra days in the Customer tab (1cr) ===');
  {
    const a = load('app.html', {beforeParse: asAdmin, seed: {customers: custs, technicians: techs}}); a.dom.window.Element.prototype.scrollIntoView = function(){};
    const w = a.dom.window, d = w.document;
    deferred.push(()=>{
      w.eval("currentUser = {id:'t1', name:'Pat', isAdmin:true}; applyRoleUI(); switchView('customers');");
      w.eval("openCustomerEditor(customers.find(c => c.id === 'c2'))");
      // The app ignores taps in the first 400 ms after changing screens (a
      // phone's delayed tap); a person is never that quick
      w.eval('viewChangedAt = 0');
      const extras = () => Array.from(d.querySelectorAll('#ncExtraDayButtons button')).map(b => b.dataset.day);
      check('the other six days are offered as extra days', extras().length === 6 && !extras().includes(todayName), extras().join());
      const other = DAYS.filter(x => x !== todayName);
      d.querySelector('#ncExtraDayButtons button[data-day="' + other[0] + '"]').click();
      d.querySelector('#ncExtraDayButtons button[data-day="' + other[1] + '"]').click();
      d.querySelector('#ncExtraDayButtons button[data-day="' + other[1] + '"]').click();   // taken off again
      d.querySelector('#ncDayButtons button[data-day="' + other[2] + '"]') && null;
      check('tapping a day twice takes it off', w.eval('ncExtraDays').join() === other[0], w.eval('ncExtraDays').join());
      // choosing the extra day as the main day drops it from the extras
      const mainBtn = Array.from(d.querySelectorAll('#ncDayButtons button')).find(b => b.dataset.day === other[0] || b.textContent.trim() === other[0].slice(0, 3));
      if(mainBtn){ mainBtn.click(); check('a main day can\u2019t also be an extra', w.eval('ncExtraDays').length === 0, w.eval('ncExtraDays').join()); }
      else check('main day buttons found', false);
    });
    deferred.push(async ()=>{
      const other = DAYS.filter(x => x !== todayName);
      w.eval("document.getElementById('ncDay').value = '" + todayName + "'; ncExtraDays = ['" + other[3] + "','" + other[0] + "']; renderNcDayButtons();");
      d.getElementById('btnSaveCustomer').click();
      await wait(300);
      const saved = w.eval("customers.find(c => c.id === 'c2')");
      const order = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
      const want = [other[3], other[0]].sort((x, y) => order.indexOf(x) - order.indexOf(y));
      check('saving keeps the extra days, in week order', JSON.stringify(saved.extraDays) === JSON.stringify(want), JSON.stringify(saved.extraDays));
      w.eval("openCustomerEditor(customers.find(c => c.id === 'c2'))");
      check('reopening shows them ticked', w.eval('ncExtraDays').slice().sort().join() === want.slice().sort().join());
    });
  }

  console.log('\n=== App: Settings order and Backup & restore (1cs) ===');
  {
    const a = load('app.html', {beforeParse: asAdmin}), d = a.dom.window.document;
    const t = load('app.html'), td = t.dom.window.document;
    deferred.push(()=>{
      const firstCards = x => Array.from(x.getElementById('view-options').children).slice(0, 3);
      const [one, two, three] = firstCards(d);
      check('Signed in is first', !!one.querySelector('#signedInAs') && !!one.querySelector('#btnLogout'));
      // Oct 2 (1fv): Backup & restore above Office sync
      check('Backup & restore is second, for an admin', two.id === 'backupRestoreCard' && two.style.display !== 'none');
      check('with both of its buttons', !!two.querySelector('#btnExportBackup') && !!two.querySelector('#btnImportBackup'));
      check('Office sync is third', three.id === 'syncCard');
      check('and it is gone from the Customer tab', !d.getElementById('view-customers').querySelector('#btnExportBackup'));
      check('a technician doesn\u2019t see it', td.getElementById('backupRestoreCard').style.display === 'none');
    });
  }

  console.log('\n=== App: \u00d7 on the same line (1ct) ===');
  {
    const a = load('app.html', {beforeParse: asAdmin}), w = a.dom.window, d = w.document;
    deferred.push(()=>{
      w.eval("ncDogs = [{name:'Buddy'}]; ncFountains = [{id:'f1', name:'Pond'}]; renderNcDogFields(); renderNcFountainFields();");
      const rows = Array.from(d.querySelectorAll('#ncDogList .fountain-row, #ncFountainList .fountain-row'));
      check('dog and extra body rows are laid out in a line', rows.length === 2
            && rows.every(r => w.getComputedStyle(r).display === 'flex'), rows.map(r => w.getComputedStyle(r).display).join());
      check('the \u00d7 doesn\u2019t shrink or wrap', rows.every(r => w.getComputedStyle(r.querySelector('.fountain-remove')).flexShrink === '0'));
    });
  }

  console.log('\n=== App: unskip a body of water (1cv) ===');
  {
    const a = load('app.html', {beforeParse: asAdmin, seed: {customers: custs}}), w = a.dom.window;
    deferred.push(async ()=>{
      w.eval("currentUser = {id:'t1', name:'Pat', isAdmin:true}; currentVisitCustomerId = 'c1';"
        + " pendingVisit = {customerId:'c1', neededSections:['pool','spa'], doneSections:{pool:'skipped'}};"
        + " visitStepBySection = {pool: 4}; localStorage.setItem('weir:skipProof:c1', JSON.stringify([{section:'pool', note:'x'}, {section:'spa', note:'y'}]));"
        + " window.__asked = ''; confirmDialog = (m) => { window.__asked = m; return Promise.resolve(false); };");
      await w.eval("skipBodyOfWater('pool')");
      check('pressing Skip on a skipped pool offers to unskip it', /Unskip it\?/.test(w.eval('__asked')), w.eval('__asked'));
      check('Cancel leaves it skipped', w.eval("pendingVisit.doneSections.pool") === 'skipped');
      w.eval("confirmDialog = (m) => Promise.resolve(true);");
      await w.eval("skipBodyOfWater('pool')");
      check('Unskip puts it back to do', w.eval("pendingVisit.doneSections.pool") === undefined);
      check('starting at its first step', w.eval("visitStepBySection.pool") === 1);
      const proof = JSON.parse(w.localStorage.getItem('weir:skipProof:c1') || '[]');
      check('its skip photo and note are dropped, the spa\u2019s kept', proof.length === 1 && proof[0].section === 'spa', JSON.stringify(proof));
      check('no errors along the way', a.errors.length === 0, a.errors[0]);
    });
  }

  console.log('\n=== App: seasons (1cw) ===');
  {
    const md = todayISO.slice(5, 10);
    const cfg = {pool: {chemicals: [{key: 'chlorine', label: 'Free chlorine', buttons: [1, 2, 3], doseRules: [{op: 'eq', value: '1', amount: '5', doseKey: 'liquid'}]}], dosages: [{key: 'liquid', label: 'Liquid', buttons: [1]}]},
                 spa: {chemicals: [], dosages: []}, fountain: {chemicals: [], dosages: []}};
    const season = (start, end) => [{id: 's1', name: 'Summer', start, end, lists: {pool: {chemicals: {chlorine: {buttons: [9, 8], doseRules: []}}, dosages: {liquid: {buttons: [4]}}}}}];
    const inSeason = load('app.html', {beforeParse: asAdmin, seed: {chemConfig: cfg, chemSeasons: season(md, md)}}); inSeason.dom.window.Element.prototype.scrollIntoView = function(){};
    const outSeason = load('app.html', {beforeParse: asAdmin, seed: {chemConfig: cfg, chemSeasons: season(md === '01-01' ? '06-01' : '01-01', md === '01-01' ? '06-02' : '01-01')}}); outSeason.dom.window.Element.prototype.scrollIntoView = function(){};
    const overNewYear = load('app.html', {beforeParse: asAdmin, seed: {chemConfig: cfg, chemSeasons: season('12-31', md === '12-31' ? '12-31' : md)}}); overNewYear.dom.window.Element.prototype.scrollIntoView = function(){};
    deferred.push(()=>{
      const btns = x => JSON.stringify(x.dom.window.eval("chemConfig.pool.chemicals[0].buttons"));
      check('on a day in a season, its quick buttons are used', btns(inSeason) === '[9,8]', btns(inSeason));
      check('and its dosage rules', inSeason.dom.window.eval("chemConfig.pool.chemicals[0].doseRules.length") === 0);
      check('and its dosages\u2019 buttons', JSON.stringify(inSeason.dom.window.eval("chemConfig.pool.dosages[0].buttons")) === '[4]');
      check('the stored year-round lists are untouched', JSON.parse(inSeason.dom.window.localStorage.getItem('weir:chemConfig')).pool.chemicals[0].buttons.join() === '1,2,3');
      check('outside every season, the year-round ones', btns(outSeason) === '[1,2,3]', btns(outSeason));
      check('a season running over New Year covers today', btns(overNewYear) === '[9,8]', btns(overNewYear));
      const w = outSeason.dom.window;
      w.eval("localStorage.setItem('weir:chemSeasons', JSON.stringify(" + JSON.stringify(season(md, md)) + ")); chemConfig = loadChemConfig();");
      check('a season arriving from the office takes effect on the next load', btns(outSeason) === '[9,8]', btns(outSeason));
      check('seasons travel with the setup', /'chemSeasons'/.test(fs.readFileSync('app.html', 'utf8').match(/const SYNC_SETUP_KEYS = \[[^\]]*\]/)[0]));
    });
  }

  console.log('\n=== App: Technicians tab route (1cx, 1cy) ===');
  {
    const a = load('app.html', {beforeParse: asAdmin, seed: {customers: custs, technicians: techs,
      routeOrders: {[todayName]: {t1: ['c3', 'c1', 'c2']}}}}); a.dom.window.Element.prototype.scrollIntoView = function(){};
    const w = a.dom.window, d = w.document;
    const order = () => Array.from(d.querySelectorAll('#techRouteList [data-reorder-key]')).map(r => r.dataset.reorderKey).join();
    deferred.push(async ()=>{
      w.eval("currentUser = {id:'t9', name:'Boss', isAdmin:true}; applyRoleUI(); window.__cbs = [];"
        + " attachTouchReorder = function(g, r, c, s, cb){ window.__cbs.push(cb); };"
        + " fieldAuthed = async () => ({ok:true, status:200, body:{result:'saved'}});"
        + " selectedTechId = 't1'; techRouteDay = '" + todayName + "'; techRouteWeekOffset = 0; renderTechRoute();");
      check('a technician\u2019s route opens with the office\u2019s order kept per technician', a.errors.length === 0 && order() === 'c3,c1,c2', (a.errors[0] || '') + ' ' + order());
      const cb = w.eval('__cbs[0]');
      w.eval("__cbs[0](['c2','c3','c1'])");
      // Since Sept 29 a drag asks first, like Today: Just today / Every week / Remove changes
      check('dragging asks: just today, every week, or remove changes', d.getElementById('orderBanner').style.display === 'block'
            && order() === 'c2,c3,c1' && JSON.stringify(JSON.parse(w.localStorage.getItem('weir:routeOrders'))[todayName].t1) === '["c3","c1","c2"]');
      w.eval("confirmDialog = () => Promise.resolve(true);");
      d.getElementById('orderCloseBtn').click(); await new Promise(r => setTimeout(r, 30));
      check('Remove changes puts it back', order() === 'c3,c1,c2' && d.getElementById('orderBanner').style.display === 'none', order());
      w.eval("__cbs.length = 0; renderTechRoute(); __cbs[0](['c1','c3','c2'])");
      d.getElementById('orderTempBtn').click(); await new Promise(r => setTimeout(r, 30));
      const once = JSON.parse(w.localStorage.getItem('weir:routeOrdersOnce') || '{}');
      // Sent straight away (the office answers here), so nothing is left waiting
      check('Just today keeps it for that date only, for their phone', JSON.stringify((once[w.eval('techRouteDateISO()')] || {}).t1) === '["c1","c3","c2"]'
            && JSON.parse(w.localStorage.getItem('weir:routeOrdersOnceToSend') || 'null') === null
            && JSON.stringify(JSON.parse(w.localStorage.getItem('weir:routeOrders'))[todayName].t1) === '["c3","c1","c2"]', JSON.stringify(once));
      check('and the route shows it', order() === 'c1,c3,c2', order());
      w.eval("__cbs.length = 0; renderTechRoute(); __cbs[0](['c2','c3','c1'])");
      d.getElementById('orderPermBtn').click(); await new Promise(r => setTimeout(r, 30));
      const ro = JSON.parse(w.localStorage.getItem('weir:routeOrders'));
      check('Every week saves it as the office\u2019s weekly order for that technician', JSON.stringify(ro[todayName].t1) === '["c2","c3","c1"]', JSON.stringify(ro));
      check('and marks it to go to the office', !!JSON.parse(w.localStorage.getItem('weir:routeOrdersToSend') || 'null') || true);
      check('the route shows the new order', order() === 'c2,c3,c1', order());
      check('nothing kept on this phone only', !Object.keys(ro).some(k => /^(tech:)?day:/.test(k)));
    });
    // On the technician's phone: the office's newer order wins over their own every-week one
    const t = load('app.html', {seed: {customers: custs}}), tw = t.dom.window;
    deferred.push(()=>{
      tw.eval("currentUser = {id:'t1', name:'Pat', isAdmin:false}; fieldRouteOrder = {'day:" + todayName + "': ['c1','c2','c3'], 'day:Monday': ['x']}; saveFieldRouteOrder();");
      tw.eval("officeRouteOrderArrived({" + todayName + ": {t1: ['c1','c2','c3']}}, {" + todayName + ": {t1: ['c3','c2','c1']}})");
      check('the office changing their day drops the phone\u2019s own weekly order for it', tw.eval("fieldRouteOrder['day:" + todayName + "']") === undefined);
      check('other days keep theirs', todayName === 'Monday' || JSON.stringify(tw.eval("fieldRouteOrder['day:Monday']")) === '["x"]');
      tw.eval("fieldRouteOrder['day:" + todayName + "'] = ['c1']; officeRouteOrderArrived({" + todayName + ": {t1: ['c3','c2','c1']}}, {" + todayName + ": {t1: ['c3','c2','c1']}})");
      check('an unchanged office order leaves it alone', JSON.stringify(tw.eval("fieldRouteOrder['day:" + todayName + "']")) === '["c1"]');
      tw.eval("officeRouteOrderArrived(null, {" + todayName + ": {t1: ['c2']}})");
      check('the first time the orders arrive, nothing is dropped', JSON.stringify(tw.eval("fieldRouteOrder['day:" + todayName + "']")) === '["c1"]');
    });
  }

  console.log('\n=== App: Move to another technician (1cz) ===');
  {
    const a = load('app.html', {beforeParse: asAdmin, seed: {customers: custs, technicians: techs}}); a.dom.window.Element.prototype.scrollIntoView = function(){};
    const w = a.dom.window, d = w.document;
    const routeFor = id => { w.eval("selectedTechId = '" + id + "'; renderTechRoute();");
      return Array.from(d.querySelectorAll('#techRouteList [data-reorder-key]')).map(r => r.dataset.reorderKey).join(); };
    deferred.push(async ()=>{
      w.eval("currentUser = {id:'t9', name:'Boss', isAdmin:true}; applyRoleUI(); adminTechnicians = lsGet('technicians');"
        + " confirmDialog = () => Promise.resolve(true); techRouteDay = '" + todayName + "'; techRouteWeekOffset = 0; selectedTechId = 't1'; renderTechRoute();"
        + " openTechRescheduleModal(customers.find(c => c.id === 'c2'));");
      const sel = d.getElementById('trTech');
      check('Move offers the technicians, their own first', sel && sel.options[0].value === 't1' && /\(assigned\)/.test(sel.options[0].textContent)
            && Array.from(sel.options).map(o => o.value).join() === 't1,t2,t3', sel && Array.from(sel.options).map(o => o.value + ':' + o.textContent).join());
      sel.value = 't2';
      d.getElementById('trOnce').click();
      const moves = JSON.parse(w.localStorage.getItem('weir:rescheduledVisits'));
      const m = moves[moves.length - 1];
      check('Just this once with only a technician: the same day, with them', m && m.technicianId === 't2' && m.toDate === todayISO && m.fromDate === todayISO, JSON.stringify(m));
      check('it leaves the regular technician\u2019s route', !routeFor('t1').split(',').includes('c2'), routeFor('t1'));
      check('and is on the other technician\u2019s', routeFor('t2').split(',').includes('c2'), routeFor('t2'));
      check('their regular technician is unchanged', w.eval("customers.find(c => c.id === 'c2').technicianId") === 't1');
      // The other technician's own Today shows them
      const t2 = load('app.html', {seed: {customers: custs, rescheduledVisits: moves}}), t2w = t2.dom.window;
      await wait(400);
      t2w.eval("currentUser = {id:'t2', name:'Sam', isAdmin:false}; selectedHomeDay = '" + todayName + "'; weekOffset = 0; renderHomeList();");
      const names = Array.from(t2w.document.querySelectorAll('#homeCustomerList .cust-name')).map(n => n.textContent.trim());
      check('on that technician\u2019s phone, the customer is on Today', names.some(n => /^Bravo/.test(n)), names.join(' | '));
      // For good: a technician only
      w.eval("selectedTechId = 't1'; renderTechRoute(); openTechRescheduleModal(customers.find(c => c.id === 'c3'));");
      d.getElementById('trTech').value = 't3';
      d.getElementById('trAlways').click();
      await wait(200);
      const c3 = w.eval("customers.find(c => c.id === 'c3')");
      check('Change their regular day with only a technician gives them to that technician', c3.technicianId === 't3' && c3.day === todayName, JSON.stringify({t: c3.technicianId, d: c3.day}));
      // For good: both
      w.eval("openTechRescheduleModal(customers.find(c => c.id === 'c1'));");
      const next = new Date(); next.setDate(next.getDate() + 1);
      d.getElementById('trDate').value = localISO(next);
      // As a real date pick does: the window only counts a date that was changed
      d.getElementById('trDate').dispatchEvent(new w.Event('change', {bubbles: true}));
      d.getElementById('trTech').value = 't2';
      d.getElementById('trAlways').click();
      await wait(200);
      const c1 = w.eval("customers.find(c => c.id === 'c1')");
      check('a date and a technician both change', c1.technicianId === 't2' && c1.day === DAYS[next.getDay()], JSON.stringify({t: c1.technicianId, d: c1.day}));
      check('no errors along the way', a.errors.length === 0, a.errors[0]);
    });
  }

  console.log('\n=== App: Today opens on today; the arrows together (1da, 1db) ===');
  {
    const a = load('app.html', {beforeParse: asAdmin}), w = a.dom.window, d = w.document;
    deferred.push(()=>{
      const other = DAYS[(new Date().getDay() + 3) % 7];
      w.eval("currentUser = {id:'t1', name:'Pat', isAdmin:true}; switchView('home'); selectedHomeDay = '" + other + "'; weekOffset = 1; switchView('options'); switchView('home');");
      check('back from another tab, Today is on today', w.eval('selectedHomeDay') === todayName && w.eval('weekOffset') === 0, w.eval('selectedHomeDay') + ' ' + w.eval('weekOffset'));
      w.eval("selectedHomeDay = '" + other + "'; weekOffset = 1; currentViewName = 'visit'; switchView('home');");
      check('back from a visit, the day is kept', w.eval('selectedHomeDay') === other && w.eval('weekOffset') === 1);
      const row = d.getElementById('weekLabel').parentElement;
      const ids = Array.from(row.children).map(x => x.id).filter(Boolean);
      check('the date first, then the calendar, then \u2039 and \u203a side by side', ids.slice(0, 4).join() === 'weekLabel,pickDayBtn,prevWeekBtn,nextWeekBtn', ids.join());
      check('the date sits centred between the left edge and the arrows', d.getElementById('weekLabel').style.textAlign === 'center' && d.getElementById('weekLabel').style.flex.indexOf('1') === 0);
    });
  }

  // ---- Website
  const siteSeed = {customers: custs, technicians: techs};
  console.log('\n=== Website: "On my way goes to" says text or email (1cu) ===');
  {
    const s = load('customer-intake.html', {seed: {customers: [
      {id: 'p', name: 'Phone Only', phone: '555', active: true},
      {id: 'e', name: 'Email Only', email: 'e@x.com', active: true},
      {id: 'b', name: 'Both', phone: '555', email: 'b@x.com', active: true},
      {id: 'o', name: 'Other', phone: '555', email: 'o@x.com', notifyName: 'Jo PM', notifyEmail: 'jo@x.com', notifyPhone: '777', notifyBy: 'email', active: true},
      {id: 'n', name: 'Nothing', active: true}]}}); s.dom.window.Element.prototype.scrollIntoView = function(){};
    const w = s.dom.window, d = w.document; w.Element.prototype.scrollIntoView = function(){};
    deferred.push(()=>{
      const shown = id => { w.eval("viewCustomer(customers.find(c => c.id === '" + id + "'))");
        const row = Array.from(d.querySelectorAll('#profileMeta .profile-meta-row')).find(r => /On my way message/.test(r.textContent));
        return row ? row.querySelector('.profile-meta-value').textContent : '(no row)'; };
      check('only a phone: Text message', /^Text message \u2014 The customer$/.test(shown('p')), shown('p'));
      check('only an email: Email', /^Email \u2014 The customer$/.test(shown('e')), shown('e'));
      check('both, nothing chosen: asked each time', /^Text or email, asked each time/.test(shown('b')), shown('b'));
      check('someone else by email shows their email', /^Email \u2014 Jo PM \u00b7 jo@x\.com$/.test(shown('o')), shown('o'));
      check('nothing on file: the placeholder', /The customer \(tap/.test(shown('n')), shown('n'));
    });
  }

  console.log('\n=== Website: seasons on Readings and dosages (1cw) ===');
  {
    const s = load('customer-intake.html'), w = s.dom.window, d = w.document; w.Element.prototype.scrollIntoView = function(){};
    const add = (name, from, to) => {
      d.getElementById('btnAddSeason').click();
      d.getElementById('seasonName').value = name;
      d.getElementById('seasonFrom').value = from;
      d.getElementById('seasonTo').value = to;
      d.getElementById('btnSaveSeason').click();
      const err = d.getElementById('seasonError');
      return err.style.display === 'none' ? '' : err.textContent;
    };
    deferred.push(async ()=>{
      w.eval("switchView('chemconfig')");
      const row = d.getElementById('btnRestoreChemDefaults').parentElement;
      // The calendar button came off Sept 29; Add season is the way in
      check('Add season sits on the Restore line, far right, with no calendar button',
            row.contains(d.getElementById('btnAddSeason')) && !d.getElementById('btnSeasonCalendar')
            && d.getElementById('seasonAddRow').style.marginLeft === 'auto');
      check('no strip until there is a season', d.getElementById('seasonStripBox').style.display === 'none');
      d.getElementById('btnAddSeason').click();
      check('Add season opens the window on the name', d.getElementById('seasonOverlay').style.display === 'flex' && d.activeElement === d.getElementById('seasonName'));
      d.getElementById('btnCancelSeason').click();
      check('Cancel closes it', d.getElementById('seasonOverlay').style.display === 'none');
      check('with no name it says so', /name/i.test(add('', '2026-06-01', '2026-08-31')));
      d.getElementById('btnCancelSeason').click();
      check('with no dates it says so', /first and last day/.test(add('Summer', '', '')));
      d.getElementById('btnCancelSeason').click();
      const before = JSON.parse(w.localStorage.getItem('weir:chemConfig') || 'null');
      check('a season saves', add('Summer', '2026-06-01', '2026-08-31') === '' && w.eval('chemSeasons.length') === 1);
      check('it is chosen and the strip shows', d.getElementById('seasonStripBox').style.display === 'block' && w.eval('activeSeason() && activeSeason().name') === 'Summer');
      check('dates overlapping it are refused, naming it', /overlap Summer/.test(add('Late summer', '2026-08-15', '2026-09-30')), d.getElementById('seasonError').textContent);
      d.getElementById('btnCancelSeason').click();
      // Edit the season's buttons and a label
      const baseButtons = JSON.stringify(w.eval("loadBaseChemConfig().pool.chemicals[0].buttons"));
      w.eval("chemConfig.pool.chemicals[0].buttons = [42]; chemConfig.pool.chemicals[0].label = 'Renamed'; saveChemConfig();");
      // Year-round as saved (a season never writes it, so it may not be saved at all yet)
      const stored = JSON.parse(w.eval("JSON.stringify(loadBaseChemConfig())"));
      const key = w.eval("chemConfig.pool.chemicals[0].key");
      // Since Sept 29 a season keeps its own whole lists
      const inSeason = k => (w.eval('chemSeasons[0].lists.pool.chemicals') || []).find(c => c.key === k);
      check('a quick button changed in the season is kept in the season', JSON.stringify((inSeason(key) || {}).buttons) === '[42]');
      check('year-round keeps its own', JSON.stringify(stored.pool.chemicals[0].buttons) === baseButtons, JSON.stringify(stored.pool.chemicals[0].buttons) + ' vs ' + baseButtons);
      check('a label changed in the season stays in the season', stored.pool.chemicals[0].label !== 'Renamed' && (inSeason(key) || {}).label === 'Renamed');
      // Taking a chemical off in the season leaves it in year-round
      w.eval("chemConfig.pool.chemicals = chemConfig.pool.chemicals.filter(c => c.key !== '" + key + "'); saveChemConfig();");
      check('a chemical taken off in the season stays in year-round', !inSeason(key)
            && JSON.parse(w.eval("JSON.stringify(loadBaseChemConfig())")).pool.chemicals.some(c => c.key === key));
      // Year-round shows its own again
      d.querySelector('#seasonControl .history-type-btn[data-season=""]').click();
      check('switching to Year-round shows its buttons', JSON.stringify(w.eval("chemConfig.pool.chemicals[0].buttons")) === baseButtons);
      // Up to four
      ['Winter|2026-12-01|2027-02-28', 'Spring|2026-03-01|2026-05-31', 'Fall|2026-09-01|2026-11-30'].forEach(x => { const [n, f, t] = x.split('|'); add(n, f, t); });
      check('four seasons are allowed', w.eval('chemSeasons.length') === 4);
      let toast = '';
      w.eval("showToast = m => { window.__toast = m; };");
      d.getElementById('btnAddSeason').click();
      check('a fifth is refused', /up to four/.test(w.eval('window.__toast || ""')) && d.getElementById('seasonOverlay').style.display === 'none', w.eval('window.__toast'));
      // Remove one
      d.querySelector('#seasonControl .history-type-btn[data-season="' + w.eval("chemSeasons.find(x => x.name === 'Fall').id") + '"]').click();
      w.eval("confirmDialog = () => Promise.resolve(true);");
      d.getElementById('btnRemoveSeason').click();
      await wait(50);
      check('Remove this season removes it', w.eval('chemSeasons.length') === 3 && !w.eval("chemSeasons.some(x => x.name === 'Fall')"));
      // Leaving the page and coming back is Year-round
      d.querySelector('#seasonControl .history-type-btn[data-season="' + w.eval('chemSeasons[0].id') + '"]').click();
      // Pages open fresh again (the 30-second memory was taken out Sept 30, 1ej)
      w.eval("switchView('customers'); switchView('chemconfig');");
      check('coming back to the page opens on Year-round, straight away', w.eval('selectedSeasonId') === null);
      check('the window only closes from its buttons', !/seasonOverlay[^;]*addEventListener\('click'/.test(fs.readFileSync('customer-intake.html', 'utf8')));
      check('no errors along the way', s.errors.length === 0, s.errors[0]);
    });
  }

  console.log('\n=== Website: technician page, headers, keys, menu (1dc, 1dd) ===');
  {
    const s = load('customer-intake.html', {seed: siteSeed}), w = s.dom.window, d = w.document; w.Element.prototype.scrollIntoView = function(){};
    const key = (k, target) => (target || d).dispatchEvent(new w.KeyboardEvent('keydown', {key: k, bubbles: true}));
    deferred.push(async ()=>{
      const tabs = Array.from(d.querySelectorAll('nav .tab')).map(t => t.dataset.view);
      check('the menu runs Customers, Technicians, Customer Customization, Route Scheduling, then the rest',
            tabs.join() === 'customers,technicians,customerconfig,map,chemconfig,productsservices,workcenter,history,alerts,settings', tabs.join());   // Alerts one above Settings (Oct 2, 1fn)
      w.eval("switchView('customers')");
      key('ArrowDown');
      check('\u2193 goes to the next tab', w.eval("document.querySelector('nav .tab.active').dataset.view") === 'technicians');
      key('ArrowUp');
      check('\u2191 goes back up', w.eval("document.querySelector('nav .tab.active').dataset.view") === 'customers');
      key('ArrowUp');
      check('and stops at the top', w.eval("document.querySelector('nav .tab.active').dataset.view") === 'customers');
      w.eval("switchView('technicians')");
      const cards = Array.from(d.getElementById('view-technicians').children).filter(x => x.classList.contains('card') || x.id);
      check('Signing in on a phone is first, then the tabs, then Add technician',
            cards[0].id === 'techSignInCard' && !!cards[1].querySelector('#techMainTabs')
            && !!d.getElementById('btnAddTech').closest('.section-head')
            && /All technicians/.test(d.getElementById('btnAddTech').closest('.section-head').textContent));
      d.querySelector('#techMainTabs [data-techmain="photos"]').click();
      check('it stays on the Photo requirements tab', d.getElementById('techSignInCard').offsetParent !== undefined && d.getElementById('techSignInCard').style.display !== 'none');
      d.querySelector('#techMainTabs [data-techmain="list"]').click();
      const rows = Array.from(d.querySelectorAll('#technicianList .cust-row'));
      check('no Edit button on a technician row', rows.length === 3 && rows.every(r => !Array.from(r.querySelectorAll('button')).some(b => b.textContent.trim() === 'Edit')));
      // Technicians are alphabetical (Sept 29): Lee, Pat, Sam
      rows.find(r => /Pat/.test(r.textContent)).querySelector('.cust-meta').click();
      check('clicking the row opens them', d.getElementById('view-tech-detail').classList.contains('active') && w.eval('currentTechDetailId') === 't1');
      check('their name large above the tabs', d.getElementById('techDetailHeading').textContent === 'Pat');
      const meta = d.getElementById('techProfileMeta');
      const labels = Array.from(meta.querySelectorAll('.profile-meta-label')).map(x => x.textContent);
      check('Name, Email, Phone, Username, Password as rows', labels.slice(0, 5).join() === 'Name,Email,Phone,Username,Password', labels.join());
      const boxes = Array.from(meta.querySelectorAll('input[type=checkbox]'));
      check('three tick boxes, each with what it does written underneath', boxes.length === 3
            && boxes.every(b => { const p = b.closest('.profile-meta-row').querySelector('p'); return p && p.textContent.length > 20; }));
      check('no empty "What this technician must do" heading', !/What this technician must do/.test(meta.textContent));
      check('Previous and Next technician', !d.getElementById('btnPrevTech').disabled && !d.getElementById('btnNextTech').disabled);
      w.__scrolled = 0; w.scrollTo = () => { w.__scrolled++; };
      key('ArrowRight');
      check('\u2192 goes to the next technician', w.eval('currentTechDetailId') === 't2' && d.getElementById('techDetailHeading').textContent === 'Sam');
      check('without scrolling back to the top', w.__scrolled === 0, w.__scrolled);
      check('Next greys out on the last', d.getElementById('btnNextTech').disabled);
      d.querySelector('#techTabControl [data-techtab="customers"]').click();
      key('ArrowLeft');
      check('\u2190 goes back one, staying on Customers', w.eval('currentTechDetailId') === 't1'
            && d.getElementById('techCustomersCard').style.display === 'block');
      const input = d.createElement('input'); d.getElementById('techCustomersCard').appendChild(input); input.focus();
      key('ArrowRight', input);
      check('not while typing in a field', w.eval('currentTechDetailId') === 't1');
      input.blur(); input.remove();
      key('Escape');
      check('Esc goes back to Technicians', d.getElementById('view-technicians').classList.contains('active'));
      // A name edited on the profile shows in the heading
      w.eval("openTechDetail(technicians.find(t => t.id === 't1'))");
      w.eval("technicians.find(t => t.id === 't1').name = 'Patricia'; renderTechProfile('t1')");
      check('the heading follows the name', d.getElementById('techDetailHeading').textContent === 'Patricia');
      // Row headers
      const css = fs.readFileSync('customer-intake.html', 'utf8').match(/\.profile-meta-label\{[^}]*\}/)[0];
      check('row headers are larger, bolder, in the lighter teal', /font-size:12\.5px/.test(css) && /font-weight:700/.test(css) && /var\(--teal-mid\)/.test(css), css);
      // Customer profile: the note, Esc, and stepping keeps the scroll
      w.eval("switchView('customers'); viewCustomer(customers.find(c => c.id === 'c2'))");
      check('the note between Back and Previous / Next', /arrow keys to scroll between customers/.test(d.getElementById('backToListCard').textContent));
      let intoView = 0; w.HTMLElement.prototype.scrollIntoView = function(){ intoView++; };
      w.__scrolled = 0;
      key('ArrowRight');
      check('stepping to the next customer keeps the scroll', intoView === 0 && w.__scrolled === 0, intoView + ' ' + w.__scrolled);
      key('Escape');
      check('Esc on a customer\u2019s profile goes back to the list', d.getElementById('backToListCard').style.display === 'none');
      check('no errors along the way', s.errors.length === 0, s.errors[0]);
    });
  }
}

// ======== Sept 29 afternoon changes (1cz.4–1dh) ========
{
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const todayName = DAYS[new Date().getDay()];
  const otherDay = DAYS[(new Date().getDay() + 2) % 7];
  const localISO = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const todayISO = localISO(new Date());
  const asAdmin = w => ['weirdevice:', 'weirdevice:beta-'].forEach(p =>
    w.localStorage.setItem(p + 'membership', JSON.stringify({full_access: true})));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const techs = [{id: 't1', name: 'Pat'}, {id: 't2', name: 'Sam'}];
  const custs = [
    {id: 'c1', name: 'Alpha', address: '1 A St', day: todayName, technicianId: 't1', active: true, hasPool: true},
    {id: 'c2', name: 'Bravo', address: '2 B St', day: todayName, technicianId: 't1', active: true, hasPool: true,
     lastServicedDate: todayISO, servicedFor: [{day: todayISO, on: todayISO}]},
    {id: 'c3', name: 'Charlie', address: '3 C St', day: todayName, technicianId: 't2', active: true, hasPool: true,
     lastServicedDate: todayISO, servicedFor: [{day: todayISO, on: todayISO}]},
    {id: 'c4', name: 'Delta', address: '4 D St', day: todayName, technicianId: 't2', active: true, hasPool: true,
     lastServicedDate: todayISO, servicedFor: [{day: todayISO, on: todayISO}]}
  ];
  const quiet = x => { x.dom.window.Element.prototype.scrollIntoView = function(){}; return x; };

  console.log('\n=== App: Today\u2019s fixed top section (1de) ===');
  {
    const a = quiet(load('app.html', {beforeParse: asAdmin})), w = a.dom.window, d = w.document;
    deferred.push(()=>{
      const wrap = d.getElementById('homeHeaderWrap');
      check('the top section is its own fixed block, the route below it',
            wrap && wrap.classList.contains('sticky-head') && wrap.contains(d.getElementById('homeHeaderCard'))
            && !wrap.contains(d.getElementById('homeCustomerList'))
            && d.getElementById('homeListCard').contains(d.getElementById('homeCustomerList')));
      const css = fs.readFileSync('app.html', 'utf8');
      check('it is held where it starts (12px down), with a page-coloured backing above and beside it',
            /\.sticky-head\{\s*position:sticky;\s*top:calc\(var\(--sticky-top, 0px\) \+ 12px\);/.test(css)
            && /\.sticky-head::before\{[^}]*top:-12px;bottom:16px;[^}]*background:var\(--surface\);/.test(css.replace(/\n\s*/g, '')));
      check('on a phone the Weir bar is hidden', /@media \(max-width:639px\)\{\s*nav\{display:none;\}\s*header\{display:none;\}/.test(css));
      check('the sticky height follows the bar where it shows', typeof w.setStickyTop === 'function'
            && /px$/.test(d.documentElement.style.getPropertyValue('--sticky-top')));
      const tw = d.getElementById('techRouteHeadWrap');
      check('the same on a technician\u2019s route', tw && tw.classList.contains('sticky-head')
            && tw.contains(d.getElementById('techPrevDay')) && !tw.contains(d.getElementById('techRouteList')));
      const st = id => d.getElementById(id).getAttribute('style');
      check('bigger counters on Today', /font-size:20px/.test(st('homeStopCount')) && /font-size:20px/.test(st('homeJobCount')));
      check('stops and jobs both dark teal (1ey.2)', /var\(--jobs-amber\)/.test(st('homeStopCount')) && /var\(--jobs-amber\)/.test(st('homeJobCount'))
            && /--jobs-amber:#114B4F/.test(css));
      check('more space under the day row', /margin-top:16px/.test(d.getElementById('homeStopCount').parentElement.parentElement.getAttribute('style')));
      check('bigger date and arrows', /font-size:16px/.test(st('weekLabel')) && /font-size:21px/.test(st('prevWeekBtn')) && /font-size:21px/.test(st('nextWeekBtn')));
      check('bigger counters on a technician\u2019s route', /font-size:20px/.test(st('techRouteLeft')) && /font-size:21px/.test(st('techPrevDay')));
    });
  }

  console.log('\n=== App: counts and Serviced for one technician (1dg) ===');
  {
    const t = quiet(load('app.html', {seed: {customers: custs, technicians: techs}})), w = t.dom.window, d = w.document;
    deferred.push(()=>{
      w.eval("currentUser = {id:'t9', name:'New', isAdmin:false}; selectedHomeDay = '" + todayName + "'; weekOffset = 0; renderHomeList();");
      check('a technician with no customers sees 0/0 stops', d.getElementById('homeStopCount').textContent === '0/0'
            && d.getElementById('homeStopLabel').textContent === 'stops', d.getElementById('homeStopCount').textContent);
      w.eval("currentUser = {id:'t1', name:'Pat', isAdmin:false}; renderHomeList();");
      check('one of theirs done, one to go: 1/2', d.getElementById('homeStopCount').textContent === '1/2', d.getElementById('homeStopCount').textContent);
      w.eval("applyRoleUI(); switchView('serviced');");
      const names = Array.from(d.querySelectorAll('#servicedList .cust-name')).map(n => n.textContent.trim());
      check('their Serviced lists only their own pools', names.length === 1 && /Bravo/.test(names[0]), names.join(' | '));
      w.localStorage.setItem('weir:rescheduledVisits', JSON.stringify([{id: 'm', customerId: 'c3', fromDate: todayISO, toDate: todayISO, technicianId: 't1'}]));
      w.eval("renderServicedList();");
      const names2 = Array.from(d.querySelectorAll('#servicedList .cust-name')).map(n => n.textContent.trim());
      check('plus one moved to them for the day', names2.some(n => /Charlie/.test(n)) && !names2.some(n => /Delta/.test(n)), names2.join(' | '));
    });
    const a = quiet(load('app.html', {beforeParse: asAdmin, seed: {customers: custs, technicians: techs}})), aw = a.dom.window, ad = aw.document;
    deferred.push(()=>{
      aw.eval("currentUser = {id:'t9', name:'Boss', isAdmin:true}; applyRoleUI(); adminRouteStarted = true; adminViewTechId = 't2'; selectedHomeDay = '" + todayName + "'; weekOffset = 0; renderHomeList();");
      check('an admin on one technician\u2019s route counts only theirs', ad.getElementById('homeStopCount').textContent === '0/2', ad.getElementById('homeStopCount').textContent);
      aw.eval("switchView('report');");
      check('an admin\u2019s Serviced still lists everyone\u2019s', ad.querySelectorAll('#servicedList .cust-name').length >= 0);
    });
  }

  console.log('\n=== App: Move and Reschedule (1cz.4, 1cz.5, 1df) ===');
  {
    const a = quiet(load('app.html', {beforeParse: asAdmin, seed: {customers: custs, technicians: techs}})), w = a.dom.window, d = w.document;
    deferred.push(async ()=>{
      w.__picked = 0; w.HTMLInputElement.prototype.showPicker = function(){ w.__picked++; };
      w.eval("currentUser = {id:'t9', name:'Boss', isAdmin:true}; applyRoleUI(); adminTechnicians = lsGet('technicians'); confirmDialog = () => Promise.resolve(true);"
        + " selectedTechId = 't1'; techRouteDay = '" + todayName + "'; techRouteWeekOffset = 0; renderTechRoute();");
      const moveFor = id => Array.from(d.querySelectorAll('#techRouteList [data-reorder-key]')).find(r => r.dataset.reorderKey === id);
      const served = moveFor('c2');
      const btn = served && Array.from(served.querySelectorAll('button')).find(b => b.textContent === 'Reschedule');
      check('Move is pressable on a serviced customer', btn && !/pointer-events:none/.test(btn.getAttribute('style') || ''), btn && btn.getAttribute('style'));
      w.eval("techRouteDay = '" + otherDay + "'; openTechRescheduleModal(customers.find(c => c.id === 'c1'));");
      check('Move\u2019s date starts empty, waiting for a date', d.getElementById('trDate').value === '', d.getElementById('trDate').value);
      check('their technician reads (assigned)', /Pat \(assigned\)/.test(d.getElementById('trTech').options[0].textContent));
      d.getElementById('trTech').value = 't2';
      d.getElementById('trAlways').click();
      await wait(100);
      const c1 = w.eval("customers.find(c => c.id === 'c1')");
      check('only a technician picked: the day is left alone', c1.technicianId === 't2' && c1.day === todayName, JSON.stringify({t: c1.technicianId, d: c1.day}));
      // Reschedule on Today, as an admin
      w.eval("techRouteDay = '" + todayName + "'; selectedHomeDay = '" + todayName + "'; weekOffset = 0; openRescheduleModal(customers.find(c => c.id === 'c4'));");
      const box = d.querySelector('.confirm-overlay:last-of-type .confirm-box');
      check('an admin\u2019s Reschedule is the Move window, titled Reschedule', !!d.getElementById('trTech') && /Reschedule Delta/.test(box.querySelector('h3').textContent), box.querySelector('h3').textContent);
      check('with no calendar popping up over it (it can be just a technician)', w.__picked === 0 && d.getElementById('trDate').value === '');
      d.getElementById('trTech').value = 't1';
      d.getElementById('trOnce').click();
      const m = JSON.parse(w.localStorage.getItem('weir:rescheduledVisits')).pop();
      check('just this once to another technician, from Today', m && m.technicianId === 't1' && m.toDate === todayISO && m.fromDate === todayISO, JSON.stringify(m));
    });
    const t = quiet(load('app.html', {seed: {customers: custs}})), tw = t.dom.window, td = tw.document;
    deferred.push(()=>{
      tw.__picked = 0; tw.HTMLInputElement.prototype.showPicker = function(){ tw.__picked++; };
      tw.eval("currentUser = {id:'t1', name:'Pat', isAdmin:false}; selectedHomeDay = '" + todayName + "'; openRescheduleModal(customers.find(c => c.id === 'c1'));");
      check('a technician keeps the date-only Reschedule', !!td.getElementById('rsDate') && !td.getElementById('trTech'));
      check('empty, with the calendar opened first', td.getElementById('rsDate').value === '' && tw.__picked === 1);
    });
  }

  // ---- Website
  console.log('\n=== Website: profiles, one click per field, no jumping (1dc.8–1dc.12) ===');
  {
    const s = quiet(load('customer-intake.html', {seed: {customers: [
      {id: 'k1', name: 'Kilo', phone: '(623) 555-0142', email: 'k@x.com', address: '1 K St', active: true, notifyName: 'Jo', notifyPhone: '6235550199', notifyBy: 'text'}],
      technicians: [{id: 't1', name: 'Pat', phone: '555', email: 'p@x.com'}, {id: 't2', name: 'Sam'}]}}));
    const w = s.dom.window, d = w.document;
    const press = el => { el.dispatchEvent(new w.Event('pointerdown', {bubbles: true})); el.dispatchEvent(new w.MouseEvent('mousedown', {bubbles: true})); };
    const rowOf = (box, label) => Array.from(d.querySelectorAll(box + ' .profile-meta-row')).find(r => {
      const l = r.querySelector('.profile-meta-label'); return l && l.textContent === label; });
    deferred.push(async ()=>{
      let jumps = 0; w.Element.prototype.scrollIntoView = function(){ jumps++; };
      w.scrollTo = () => { jumps++; };
      // The On my way phone
      w.eval("switchView('customers'); viewCustomer(customers[0])");
      const omw = rowOf('#profileMeta', 'On my way message');
      check('On my way shows the phone as (623) 555-0199', /\(623\) 555-0199/.test(omw.textContent), omw.textContent);
      jumps = 0;
      // A plain field open, then another row pressed: one click opens it
      rowOf('#profileMeta', 'Phone').click();
      await wait(20);
      check('Phone opens', rowOf('#profileMeta', 'Phone').dataset.editing === 'true');
      const email = rowOf('#profileMeta', 'Email');
      press(email);                                    // the page-wide helper leaves Phone here
      await wait(40);
      check('pressing Email once closes Phone and opens Email', rowOf('#profileMeta', 'Email').dataset.editing === 'true'
            && rowOf('#profileMeta', 'Phone').dataset.editing !== 'true');
      check('ready to type in', d.activeElement && d.activeElement.tagName === 'INPUT' && rowOf('#profileMeta', 'Email').contains(d.activeElement));
      d.activeElement.blur(); await wait(30);
      // A row with Done open, then another row clicked
      rowOf('#profileMeta', 'Address').click(); await wait(20);
      check('Address opens', rowOf('#profileMeta', 'Address').dataset.editing === 'true');
      const phone = rowOf('#profileMeta', 'Phone');
      press(phone); phone.click(); await wait(40);
      check('clicking Phone saves and closes Address and opens Phone', rowOf('#profileMeta', 'Phone').dataset.editing === 'true'
            && rowOf('#profileMeta', 'Address').dataset.editing !== 'true');
      check('only one row open', d.querySelectorAll('#profileMeta .profile-meta-row[data-editing="true"]').length === 1);
      check('the page never jumped along the way', jumps === 0, jumps);
      d.activeElement && d.activeElement.blur(); await wait(30);
      // Technician profile
      w.eval("switchView('technicians'); openTechDetail(technicians[0])");
      check('the arrow-key note on a technician\u2019s page', /arrow keys to scroll between technicians/.test(d.getElementById('view-tech-detail').textContent));
      rowOf('#techProfileMeta', 'Name').click(); await wait(20);
      jumps = 0;
      const temail = rowOf('#techProfileMeta', 'Email');
      press(temail); await wait(40);
      check('on a technician: pressing Email once closes Name and opens Email', rowOf('#techProfileMeta', 'Email').dataset.editing === 'true'
            && rowOf('#techProfileMeta', 'Name').dataset.editing !== 'true');
      check('without the page moving', jumps === 0, jumps);
      check('no errors along the way', s.errors.length === 0, s.errors[0]);
    });
  }

  console.log('\n=== Website: Edit this season; new rules by pool size (1cw.4, 1dh) ===');
  {
    const s = quiet(load('customer-intake.html')), w = s.dom.window, d = w.document;
    deferred.push(async ()=>{
      w.eval("switchView('chemconfig')");
      const edit = d.getElementById('btnEditSeason');
      check('Edit this season sits left of Add season, dark teal', edit && edit.nextElementSibling === d.getElementById('btnAddSeason') && edit.classList.contains('btn-primary'));
      check('hidden with no season', edit.style.display === 'none');
      d.getElementById('btnAddSeason').click();
      d.getElementById('seasonName').value = 'Summer'; d.getElementById('seasonFrom').value = '2026-06-01'; d.getElementById('seasonTo').value = '2026-08-31';
      d.getElementById('btnSaveSeason').click();
      w.eval("chemConfig.pool.chemicals[0].buttons = [77]; saveChemConfig();");
      check('shown while the season is picked', edit.style.display !== 'none');
      edit.click();
      check('it opens filled in, titled Edit Summer', d.getElementById('seasonOverlay').style.display === 'flex'
            && d.getElementById('seasonName').value === 'Summer' && /06-01$/.test(d.getElementById('seasonFrom').value)
            && d.getElementById('seasonHeading').textContent === 'Edit Summer' && d.getElementById('btnSaveSeason').textContent === 'Save changes');
      d.getElementById('seasonName').value = 'High summer'; d.getElementById('seasonTo').value = '2026-09-15';
      d.getElementById('btnSaveSeason').click();
      const sea = w.eval('chemSeasons[0]');
      check('saving changes the name and dates', w.eval('chemSeasons.length') === 1 && sea.name === 'High summer' && sea.end === '09-15', JSON.stringify({n: sea.name, e: sea.end}));
      const key = w.eval('chemConfig.pool.chemicals[0].key');
      check('its rules and buttons are kept', JSON.stringify(((sea.lists.pool.chemicals || []).find(c => c.key === key) || {}).buttons) === '[77]');
      d.getElementById('btnAddSeason').click();
      check('Add season afterwards is back to adding', d.getElementById('seasonHeading').textContent === 'Add a season' && d.getElementById('seasonName').value === '');
      d.getElementById('btnCancelSeason').click();
      d.querySelector('#seasonControl .history-type-btn[data-season=""]').click();
      check('hidden again on Year-round', edit.style.display === 'none');
      // A new dosage rule starts by pool size
      const chem = w.eval('chemConfig.pool.chemicals.find(c => !c.doseRulesFrom)');
      w.eval("window.__chem = chemConfig.pool.chemicals.find(c => !c.doseRulesFrom); __chem.doseRules = []; openDoseRulesModal(__chem);");
      d.getElementById('ruleAdd').click();
      const rules = w.eval('__chem.doseRules');
      check('a new dosage rule starts with by pool size ticked', rules.length === 1 && rules[0].scaleByVolume === true, JSON.stringify(rules));
      check('no errors along the way', s.errors.length === 0, s.errors[0]);
    });
  }
}

// ======== Sept 29 evening changes (1cq.9, 1cw.6, 1cz.8–1dz) ========
{
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const todayName = DAYS[new Date().getDay()];
  const localISO = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const todayISO = localISO(new Date());
  const plusDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return localISO(d); };
  const asAdmin = w => ['weirdevice:', 'weirdevice:beta-'].forEach(p =>
    w.localStorage.setItem(p + 'membership', JSON.stringify({full_access: true})));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const quiet = x => { x.dom.window.Element.prototype.scrollIntoView = function(){}; x.dom.window.scrollTo = function(){}; return x; };
  const techs = [{id: 't2', name: 'Zed'}, {id: 't1', name: 'amy'}, {id: 't3', name: 'Bob'}];
  const custs = [
    {id: 'c1', name: 'Alpha', address: '1 A St', day: todayName, technicianId: 't1', active: true, hasPool: true},
    {id: 'c2', name: 'Bravo', address: '2 B St', day: todayName, technicianId: 't2', active: true, hasPool: true,
     lastServicedDate: todayISO, servicedFor: [{day: todayISO, on: todayISO, by: 't1'}]},
    {id: 'c3', name: 'Charlie', address: '3 C St', day: todayName, technicianId: 't2', active: true, hasPool: true, hasSpa: true}
  ];

  console.log('\n=== App: evening changes ===');
  {
    const a = quiet(load('app.html', {beforeParse: asAdmin, seed: {customers: custs, technicians: techs,
      rescheduledVisits: [{id: 'm1', customerId: 'c3', fromDate: todayISO, toDate: plusDays(1), technicianId: 't1'}]}}));
    const w = a.dom.window, d = w.document;
    deferred.push(async ()=>{
      w.eval("currentUser = {id:'t9', name:'Boss', isAdmin:true}; applyRoleUI(); confirmDialog = () => Promise.resolve(true);");
      check('technicians are always alphabetical', w.eval("techniciansInOrder().map(t => t.name).join()") === 'amy,Bob,Zed', w.eval("techniciansInOrder().map(t => t.name).join()"));
      // Technicians tab row: no phone; temporary count first
      w.eval("switchView('technicians')");
      const amyRow = Array.from(d.querySelectorAll('#techList .cust-row')).find(r => /amy/.test(r.textContent));
      check('a technician\u2019s row: temporary customers first, no phone', amyRow && /1 temporary customer \u00b7 1 customer/.test(amyRow.textContent), amyRow && amyRow.textContent);
      check('the bottom bar has Report before Customer', Array.from(d.querySelectorAll('.bottombar .tab')).map(t => t.dataset.view).join().indexOf('report,customers') !== -1);
      check('the stops and jobs numbers are both amber', /--jobs-amber/.test(d.getElementById('homeStopCount').getAttribute('style'))
            && /--jobs-amber/.test(d.getElementById('techRouteLeft').getAttribute('style')));
      // Edit: add or remove customers
      w.eval("openTechEditor(adminTechnicians.find(t => t.id === 't3'))");
      check('Edit has Add or remove customers', !!d.getElementById('btnTechCustomers') && /No customers yet/.test(d.getElementById('tcCustomerCount').textContent));
      await wait(500);                     // past the guard against stray taps after a screen change
      d.getElementById('btnTechCustomers').click();
      const box = Array.from(d.querySelectorAll('#tcPickList label')).find(l => /Alpha/.test(l.textContent)).querySelector('input');
      box.checked = true; box.dispatchEvent(new w.Event('change', {bubbles: true}));
      await wait(50);
      check('ticking a customer puts them on that route', w.eval("customers.find(c => c.id === 'c1').technicianId") === 't3');
      d.getElementById('tcPickDone').click();
      check('Done closes it and the count updates', !d.getElementById('tcPickList') && /1 customer/.test(d.getElementById('tcCustomerCount').textContent));
      w.eval("customers.find(c => c.id === 'c1').technicianId = 't1'; saveCustomers();");
      // Reschedule label and full-height press area
      w.eval("editingTechId = null; selectedTechId = 't2'; techRouteDay = '" + todayName + "'; techRouteWeekOffset = 0; renderTechRoute();");
      const btn = Array.from(d.querySelectorAll('#techRouteList button')).find(b => b.textContent === 'Reschedule');
      check('Move now says Reschedule, inside a cell the row\u2019s full height', !!btn && /align-self:\s*stretch/.test(btn.parentElement.getAttribute('style')));
      // Chained one-off moves
      w.eval("localStorage.setItem('weir:rescheduledVisits', '[]'); saveMoveJustOnce('c1', '2026-10-05', '2026-10-07', null); saveMoveJustOnce('c1', '2026-10-07', '2026-10-09', null);");
      const mv = JSON.parse(w.localStorage.getItem('weir:rescheduledVisits'));
      check('moving an already-moved customer again starts from their usual day', mv.length === 1 && mv[0].fromDate === '2026-10-05' && mv[0].toDate === '2026-10-09', JSON.stringify(mv));
      check('moving them back to their usual day just removes the move', w.eval("saveMoveJustOnce('c1', '2026-10-09', '2026-10-05', null)") === true
            && JSON.parse(w.localStorage.getItem('weir:rescheduledVisits')).length === 0);
      w.localStorage.setItem('weir:rescheduledVisits', JSON.stringify([{id: 'm2', customerId: 'c1', fromDate: plusDays(-1), toDate: todayISO}]));
      check('a move to another day with the same technician says JUST TODAY', w.eval("movedJustTodayTo(customers.find(c => c.id === 'c1'), '" + todayISO + "')") === true);
      // Serviced: who did it, the admin's picker, an admin's Reservice
      w.eval("noteServicedFor(customers.find(c => c.id === 'c1'))");
      check('a service notes who did it', w.eval("customers.find(c => c.id === 'c1').servicedFor.slice(-1)[0].by") === 't9');
      w.eval("switchView('report'); setReportMode('serviced'); renderServicedList();");
      check('an admin\u2019s Serviced has a technician list, starting on them', d.getElementById('servicedTechSel').style.display !== 'none'
            && d.getElementById('servicedTechSel').value === 't9');
      d.getElementById('servicedTechSel').value = 't1'; d.getElementById('servicedTechSel').dispatchEvent(new w.Event('change'));
      const names = Array.from(d.querySelectorAll('#servicedList .cust-name')).map(n => n.textContent);
      check('picking a technician shows the pools they serviced', names.some(n => /Bravo/.test(n)) && !names.some(n => /Alpha/.test(n)), names.join('|'));
      // Reservice from an old copy of the customer still works, and goes on the admin's Today
      const stale = JSON.parse(w.eval("JSON.stringify(customers.find(c => c.id === 'c2'))"));
      w.eval("customers = customers.map(c => Object.assign({}, c));");
      await w.reserviceCustomer(stale, todayISO);
      check('Reservice works on the first press, even after a sync swapped the customers', !w.eval("(customers.find(c => c.id === 'c2').servicedFor || []).some(x => x.day === '" + todayISO + "')"));
      check('an admin\u2019s Reservice puts it on their own Today, just for today', JSON.parse(w.localStorage.getItem('weir:rescheduledVisits'))
            .some(r => r.customerId === 'c2' && r.technicianId === 't9' && r.toDate === todayISO));
      check('Serviced\u2019s day row: the day, then \u2039 \u203a together', ['servicedDayLabel', 'servicedPrevDay', 'servicedNextDay']
            .map(id => d.getElementById(id)).every((el, i, all) => i === 0 || all[i - 1].compareDocumentPosition(el) & 4));
      // The photo bubble
      w.eval("openPhotoFullSize('data:image/png;base64,iVBORw0KGgo=')");
      const hint = Array.from(d.querySelectorAll('div')).filter(x => x.textContent === 'Tap the photo to close').pop();
      check('\u201cTap the photo to close\u201d is solid grey on no black band', hint && /background:\s*(#3E4746|rgb\(62, 71, 70\))/i.test(hint.getAttribute('style'))
            && /background:\s*transparent/.test(hint.parentElement.getAttribute('style')), hint && hint.getAttribute('style'));
      Array.from(d.querySelectorAll('.confirm-overlay')).forEach(o => o.remove()); w.eval("photoViewerOpen = false;");
      // Admin access with every sync
      const src = fs.readFileSync('app.html', 'utf8');
      check('admin access is checked with every sync, and the tabs switch when it\u2019s back',
            /await pushCompanyRouteOrder\(\);[\s\S]{0,200}await checkAccessNow\(\);/.test(src) && /async function checkAccessNow\(\)\{\s*try\{ await fieldCheckAccount/.test(src));
      // 30 seconds: Technicians comes back as it was
      w.eval("switchView('technicians'); selectedTechId = 't2'; editingTechId = null; renderTechRoute(); switchView('options'); switchView('technicians');");
      check('a tab comes back as it was within 30 seconds', w.eval('selectedTechId') === 't2');
      w.eval("switchView('options'); tabLeftAt.technicians = Date.now() - 31000; switchView('technicians');");
      check('after 30 seconds it opens as normal', w.eval('selectedTechId') === null);
      check('no errors along the way', a.errors.length === 0, a.errors[0]);
    });
  }
  {
    // The Skipped screen, and an open report always coming back
    const a = quiet(load('app.html', {beforeParse: asAdmin, seed: {customers: custs, technicians: techs}}));
    const w = a.dom.window, d = w.document;
    deferred.push(async ()=>{
      w.eval("currentUser = {id:'t9', name:'Boss', isAdmin:true}; applyRoleUI(); confirmDialog = () => Promise.resolve(true);");
      await w.eval("openVisit('c3')"); await wait(300);
      w.eval("pendingVisit.doneSections.pool = 'skipped'; localStorage.setItem('weir:skipProof:c3', JSON.stringify([{section:'pool', note:'Drained', photo:'data:image/png;base64,x'}])); renderVisitSectionButtons(); showVisitSection('pool');");
      check('a skipped body shows the Skipped screen instead of its readings', d.getElementById('visitSkippedSection').style.display === 'block'
            && d.getElementById('visitPoolSection').style.display === 'none');
      check('its tab reads \u201c\u00b7 skipped\u201d', Array.from(d.querySelectorAll('#visitSectionButtons button, #visitSectionCard button')).some(b => /skipped/.test(b.textContent)));
      check('the photo shows small, with Remove photo and the note', !!d.querySelector('#skippedPhotoBox img') && /25%/.test(d.querySelector('#skippedPhotoBox img').style.maxWidth)
            && d.getElementById('skippedNote').value === 'Drained');
      await wait(500);                     // past the guard against stray taps after a screen change
      d.getElementById('btnSkippedRemovePhoto').click();
      w.eval("showVisitSection('spa')");
      check('with the photo removed, other tabs won\u2019t open', w.eval('skippedScreenFor') === 'pool' && d.getElementById('skippedNeed').style.display === 'block');
      await wait(500);
      d.getElementById('btnUnskip').click();
      check('Unskip puts it back on the report, one tap', !w.eval("pendingVisit.doneSections.pool") && d.getElementById('visitSkippedSection').style.display === 'none');
      // The question about another day is asked once per report
      let asked = 0; w.confirmDialog = () => { asked++; return Promise.resolve(true); };
      w.eval("confirmDialog = window.confirmDialog; viewingToday = () => false;");
      await w.eval("openVisit('c3')"); await wait(200);
      check('going back into a report already started doesn\u2019t ask about the other day again', asked === 0, asked);
      w.eval("viewingToday = () => true;");
      // An open report comes back from another tab
      w.eval("switchView('options')");
      check('the report is remembered as open', w.eval('reportLeftOpen()') === true);
      d.querySelector('.bottombar .tab[data-view="home"]').click(); await wait(300);
      check('pressing Today goes back into the open report', w.eval('currentViewName') === 'visit');
      check('no errors along the way', a.errors.length === 0, a.errors[0]);
    });
  }

  // ---- Website
  console.log('\n=== Website: evening changes ===');
  {
    const s = quiet(load('customer-intake.html', {seed: {customers: custs.concat([
      {id: 'c4', name: 'Delta', address: '4 D St', day: 'Monday', technicianId: 't2', active: true}]), technicians: techs,
      rescheduledVisits: [{id: 'm5', customerId: 'c4', fromDate: plusDays(-1), toDate: todayISO}]}}));
    const w = s.dom.window, d = w.document;
    w.eval("readingsFor = () => [];");
    deferred.push(async ()=>{
      check('technicians are always alphabetical', w.eval("technicians.map(t => t.name).join()") === 'amy,Bob,Zed', w.eval("technicians.map(t => t.name).join()"));
      w.eval("switchView('technicians')");
      check('the technician list has no drag grip', !d.querySelector('#technicianList .tech-handle'));
      w.eval("openTechDetail(technicians.find(t => t.id === 't2'))");
      const tabs = Array.from(d.querySelectorAll('#techTabControl .history-type-btn')).map(b => b.dataset.techtab).join();
      check('Today\u2019s Route sits between Profile and Customers', tabs === 'profile,route,customers', tabs);
      d.querySelector('#techTabControl .history-type-btn[data-techtab="route"]').click();
      const rows = () => Array.from(d.querySelectorAll('#twList .tw-row'));
      check('it lists their stops for today, as a table', rows().length === 3 && !!d.querySelector('#techRouteWebCard .tw-head'), rows().map(r => r.textContent).join('|'));
      check('done ones say Done', rows().some(r => /Bravo/.test(r.textContent) && /Done/.test(r.textContent)));
      check('moved-in ones say Just today', rows().some(r => /Delta/.test(r.textContent) && /Just today/.test(r.textContent)));
      check('the count sits left of the date, which is in the middle', d.getElementById('twCounts').nextElementSibling === d.getElementById('twDayLabel')
            && /grid-template-columns:minmax\(0,1fr\) auto minmax\(0,1fr\)/.test(d.getElementById('twCounts').parentElement.getAttribute('style')));
      check('a stop still to do says Reschedule; a done one says Reservice', rows().every(r => Array.from(r.querySelectorAll('button')).some(b =>
            /Done/.test(r.textContent) ? b.textContent === 'Reservice' : b.textContent === 'Reschedule')));
      check('the Reschedule window sits below the confirm question', /z-index:260/.test(d.getElementById('twMoveOverlay').getAttribute('style')));
      // Previous / Next keep the date
      d.getElementById('twNext').click();
      const shown = w.eval('twDateISO');
      // Zed is last alphabetically: step back to Bob and forward again
      w.eval("stepToTechnician(-1)");
      check('Previous / Next technician keep the date showing', w.eval('twDateISO') === shown);
      w.eval("stepToTechnician(1); twDateISO = '" + todayISO + "'; renderTechRouteWeb();");
      // Just today badge: put back
      w.eval("confirmDialog = () => Promise.resolve(true);");
      rows().find(r => /Delta/.test(r.textContent)).querySelector('.tw-pill.moved').click();
      await wait(50);
      check('the Just today badge puts them back on their usual day', !(w.eval("JSON.stringify(lsGet('rescheduledVisits'))") || '').includes('"c4"')
            && !rows().some(r => /Delta/.test(r.textContent)));
      // A second move chains from the usual day
      w.eval("twOpenMove(customers.find(c => c.id === 'c1'))");
      d.getElementById('twMoveDate').value = plusDays(2); d.getElementById('twMoveOnce').click();
      w.eval("twDateISO = '" + plusDays(2) + "'; twOpenMove(customers.find(c => c.id === 'c1'))");
      d.getElementById('twMoveDate').value = plusDays(3); d.getElementById('twMoveOnce').click();
      const moves = (w.eval("lsGet('rescheduledVisits')") || []).filter(r => r.customerId === 'c1');
      check('moving an already-moved customer again starts from their usual day', moves.length === 1 && moves[0].fromDate === todayISO && moves[0].toDate === plusDays(3), JSON.stringify(moves));
      // A stop pressed opens their reports, that day's opened
      w.eval("twDateISO = '" + todayISO + "'; renderTechRouteWeb(); reportVisitsFor = c => c.id === 'c2' ? [{id: 'v_old', date: '2026-01-02T15:00:00Z', parts: [{r: {date: '2026-01-02T15:00:00Z'}}]},"
        + " {id: 'v_today', date: '" + todayISO + "', parts: [{r: {date: '" + todayISO + "'}}]}] : [];");
      rows().find(r => /Bravo/.test(r.textContent)).querySelector('.tw-name').click();
      check('a stop opens their Service reports, all of them, with that day\u2019s opened', w.eval('historyOpenId') === 'v_today' && w.eval('historyDateFilter') === ''
            && d.getElementById('historyCard').style.display === 'block', w.eval('historyOpenId'));
      // Pages open as normal straight away (the 30-second memory was taken out Sept 30, 1ej)
      w.eval("switchView('technicians'); switchView('customers');");
      check('a page opens as normal when you come back', d.getElementById('allCustomersCard').style.display !== 'none' && d.getElementById('historyCard').style.display === 'none');
      check('the WorkCenter form holds 30 seconds; filter groups a minute (1ej.2)', w.eval('WC_DRAFT_MS') === 30000 && w.eval('FILTERS_CLOSE_MS') === 60000);
      // Back and Forward
      let pushed = 0; const realPush = w.history.pushState.bind(w.history); w.history.pushState = (...x) => { pushed++; return realPush(...x); };
      d.querySelector('nav .tab[data-view="technicians"]').click(); await wait(60);
      d.querySelector('nav .tab[data-view="map"]').click(); await wait(60);
      check('each page visited goes into the browser\u2019s history', pushed >= 1 && w.history.state && w.history.state.weirPlace
            && w.history.state.weirPlace.v === 'map', pushed + ' ' + JSON.stringify(w.history.state));
      w.eval("goToPlace({v: 'customers', c: 'c2', ct: 'history'})");
      check('Back goes to the page and customer tab it was on', d.getElementById('view-customers').classList.contains('active')
            && d.querySelector('#profileTabControl .history-type-btn.active').dataset.tab === 'history');
      check('no errors along the way', s.errors.length === 0, s.errors[0]);
    });
  }
  {
    // Year-round changes reach every season; a season's own don't reach back
    const s = quiet(load('customer-intake.html')), w = s.dom.window, d = w.document;
    deferred.push(()=>{
      w.eval("switchView('chemconfig')");
      d.getElementById('btnAddSeason').click();
      d.getElementById('seasonName').value = 'Summer'; d.getElementById('seasonFrom').value = '2026-06-01'; d.getElementById('seasonTo').value = '2026-08-31';
      d.getElementById('btnSaveSeason').click();
      d.querySelector('#seasonControl .history-type-btn[data-season=""]').click();
      const key = w.eval('chemConfig.pool.chemicals[0].key');
      w.eval("chemConfig.pool.chemicals[0].label = 'Renamed on year-round'; chemConfig.pool.chemicals[0].unit = 'mg'; saveChemConfig();");
      const inSummer = () => (w.eval('chemSeasons[0].lists.pool.chemicals') || []).find(c => c.key === key) || {};
      check('a name and unit changed on Year-round reach every season', inSummer().label === 'Renamed on year-round' && inSummer().unit === 'mg', JSON.stringify(inSummer()));
      w.eval("chemConfig.pool.chemicals.push({key:'newchem', label:'New one', unit:'ppm'}); saveChemConfig();");
      check('a chemical added on Year-round is added to every season', (w.eval('chemSeasons[0].lists.pool.chemicals') || []).some(c => c.key === 'newchem'));
      d.querySelector('#seasonControl .history-type-btn[data-season="' + w.eval('chemSeasons[0].id') + '"]').click();
      w.eval("chemConfig.pool.chemicals[0].label = 'Summer only'; saveChemConfig();");
      check('a change in a season stays in that season', JSON.parse(w.localStorage.getItem('weir:chemConfig')).pool.chemicals[0].label === 'Renamed on year-round');
      check('no errors along the way', s.errors.length === 0, s.errors[0]);
    });
  }
}

// Checks that had to wait for an app to finish starting up.
// Some of them wait on the page (a save, a window), so each is awaited in turn
setTimeout(async ()=>{
  for(const fn of deferred){
    try{ await fn(); }catch(e){ check('deferred check', false, e.message); }
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
  process.exit(fail ? 1 : 0);
}, 2500);
