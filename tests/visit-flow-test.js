// End-to-end visits, not features in isolation. Walks a whole service report
// from opening a customer to submitting the last body of water, checking the
// technician is never dumped somewhere unexpected.
require('fake-indexeddb/auto');
const { JSDOM } = require('jsdom');
const fs = require('fs');

let pass = 0, fail = 0;
function check(name, ok, detail){
  if(ok){ pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  — ' + detail : '')); }
}

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const today = DAYS[new Date().getDay()];
const iso = new Date(Date.now() - new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);

function seedFor(extra){
  return Object.assign({
    technicians: [{id:'t1', name:'Alex'}],
    customers: [{id:'a', name:'Alpha One', day: today, active:true, technicianId:'t1',
                 hasPool:true, hasSpa:true}],
    afterPhotoDefaultFixed: true,
    chemConfig: {
      pool: {chemicals:[{key:'chlorine',label:'Free chlorine'}], dosages:[{key:'tabs',label:'Tabs'}]},
      spa:  {chemicals:[{key:'chlorine',label:'Free chlorine'}], dosages:[{key:'tabs',label:'Tabs'}]},
      fountain: {chemicals:[], dosages:[]}
    }
  }, extra || {});
}

function boot(file, seed){
  return new JSDOM(fs.readFileSync(file,'utf8'), {
    runScripts:'dangerously', pretendToBeVisual:true, url:'https://example.com/' + file,
    beforeParse(w){
      // A company that has not ticked any photo for Everyone. New companies start
      // with the pool after photo required; that start is tested on its own.
      w.localStorage.setItem('weir:photoEveryone', '{}');
      w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
      w.scrollTo=()=>{}; w.scrollBy=()=>{}; w.alert=()=>{};
      w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){},fillRect(){}});
      w.console.warn=()=>{}; w.console.error=()=>{};
      w.indexedDB = global.indexedDB; w.IDBKeyRange = global.IDBKeyRange;
      Object.keys(seed).forEach(k=> w.localStorage.setItem('weir:'+k, JSON.stringify(seed[k])));
    }
  });
}

const wait = ms => new Promise(r => setTimeout(r, ms));

// Presses Next until the visit ends, returning every place it passed through
async function walkVisit(w, d, maxPresses){
  const trail = [];
  for(let i = 0; i < (maxPresses || 10); i++){
    const btn = d.getElementById('stepBarNext');
    if(!btn || btn.disabled) break;
    btn.click();
    await wait(500);
    trail.push(w.eval('currentViewName') + '/' + w.eval('currentVisibleSection'));
    if(w.eval('currentViewName') !== 'visit') break;
  }
  return trail;
}

(async ()=>{
  for(const file of ['technician-app.html','admin-readings-app.html']){

    // ---- A whole visit, pool then spa ----
    console.log('\n=== ' + file + ': a full pool-and-spa visit ===');
    {
      const dom = boot(file, seedFor());
      await wait(1400);
      const w = dom.window, d = w.document;
      const set = (id,v)=>{ const e = d.getElementById(id); if(!e) return false;
        e.value = v; e.dispatchEvent(new w.Event('input',{bubbles:true})); return true; };
      try{
        w.eval("currentUser={id:'t1',name:'Alex'}; confirmDialog=()=>Promise.resolve(true); "
             + "alertDialog=()=>Promise.resolve(); renderHomeList(); openVisit('a');");
        await wait(400);
        check('  it opens on the pool', w.eval('currentVisibleSection') === 'pool',
              String(w.eval('currentVisibleSection')));

        set('pool_chem_chlorine','3');
        set('pool_dose_tabs','2');
        const trail = await walkVisit(w, d);
        check('  submitting the pool moves on to the spa',
              trail.indexOf('visit/spa') !== -1, trail.join(' -> '));
        check('  it does not leave the visit early',
              trail.filter(t => t.indexOf('visit/') === 0).length >= 2, trail.join(' -> '));

        set('spa_chem_chlorine','4');
        set('spa_dose_tabs','1');
        const trail2 = await walkVisit(w, d);
        check('  finishing the spa returns to the route',
              trail2[trail2.length - 1] === 'home/null', trail2.join(' -> '));
        check('  and never lands on a customer form',
              trail2.every(t => t.indexOf('customers') === -1), trail2.join(' -> '));
      }catch(e){ check('  full visit', false, e.message); }
    }

    // ---- Reopened later, with the pool already sent ----
    console.log('\n=== ' + file + ': the pool was already sent this morning ===');
    {
      const dom = boot(file, seedFor({
        'readings:a': [{id:'r1', date: iso + 'T09:00:00.000Z', chlorine:'3', tabs:'2'}]
      }));
      await wait(1400);
      const w = dom.window, d = w.document;
      const set = (id,v)=>{ const e = d.getElementById(id); if(!e) return false;
        e.value = v; e.dispatchEvent(new w.Event('input',{bubbles:true})); return true; };
      try{
        w.eval("currentUser={id:'t1',name:'Alex'}; confirmDialog=()=>Promise.resolve(true); "
             + "alertDialog=()=>Promise.resolve(); renderHomeList(); openVisit('a');");
        await wait(450);

        check('  the pool counts as already done',
              w.eval("pendingVisit.doneSections.pool !== undefined"),
              JSON.stringify(w.eval('JSON.stringify(pendingVisit.doneSections)')));
        check('  so it opens on the spa, not the finished pool',
              w.eval('currentVisibleSection') === 'spa',
              String(w.eval('currentVisibleSection')));

        set('spa_chem_chlorine','4');
        set('spa_dose_tabs','1');
        const trail = await walkVisit(w, d);
        check('  finishing the spa ends the visit',
              trail[trail.length - 1] === 'home/null', trail.join(' -> '));
        check('  it is NOT thrown back into the finished pool',
              trail.indexOf('visit/pool') === -1, trail.join(' -> '));
      }catch(e){ check('  reopened visit', false, e.message); }
    }
  }

  // ---- Salt cell cleaned / Filter backwashed survive leaving the report ----
  for(const file of ['technician-app.html','admin-readings-app.html']){
    console.log('\n=== ' + file + ': salt cell and backwash are recorded, reported and dated ===');
    const dom = boot(file, seedFor({
      customers: [
        {id:'a', name:'Salty Pool', day: today, active:true, technicianId:'t1', hasPool:true, hasSpa:true,
         equipment:[{id:'e1', type:'Chlorination', chlorinationChoice:'Salt Cell'},
                    {id:'e2', type:'Filter', filterTypeChoice:'Sand'}]},
        {id:'b', name:'Other Salty', day: today, active:true, technicianId:'t1', hasPool:true,
         equipment:[{id:'e3', type:'Chlorination', chlorinationChoice:'Salt Cell'}]}
      ]
    }));
    await wait(1400);
    const w = dom.window, d = w.document;
    const set = (id,v)=>{ const e = d.getElementById(id); if(!e) return false;
      e.value = v; e.dispatchEvent(new w.Event('input',{bubbles:true})); return true; };
    const on = id => { const b = d.getElementById(id); return !!b && b.dataset.on === 'true'; };
    try{
      w.eval("currentUser={id:'t1',name:'Alex'}; confirmDialog=()=>Promise.resolve(true); "
           + "alertDialog=()=>Promise.resolve(); renderHomeList(); openVisit('a');");
      await wait(500);
      check('  the Salt cell cleaned button is there', !!d.getElementById('chkSaltCell'));
      const cell = d.getElementById('chkSaltCell').parentNode;
      check('  the last-done note sits below the button',
            cell.style.flexDirection === 'column' && cell.firstChild === d.getElementById('chkSaltCell')
            && cell.lastChild.tagName === 'SPAN', cell.style.cssText);
      check('  with nothing logged yet it says so', /Not logged yet/.test(cell.lastChild.textContent), cell.lastChild.textContent);

      set('pool_chem_chlorine', '3');
      d.getElementById('chkSaltCell').click();
      d.getElementById('chkBackwashed').click();
      check('  pressing them turns them on', on('chkSaltCell') && on('chkBackwashed'));

      // Leave the report for another tab, then come back through Today
      await wait(600);
      const other = Array.from(d.querySelectorAll('.tab[data-view]')).find(t => t.dataset.view !== 'home');
      other.click(); await wait(600);
      check('  the report was left', w.eval('currentViewName') !== 'visit', String(w.eval('currentViewName')));
      d.querySelector('.tab[data-view="home"]').click(); await wait(900);
      check('  Today goes back into the report', w.eval('currentViewName') === 'visit');
      check('  the typed reading survived', d.getElementById('pool_chem_chlorine').value === '3');
      check('  Salt cell cleaned is still pressed after coming back', on('chkSaltCell'));
      check('  Filter backwashed is still pressed after coming back', on('chkBackwashed'));

      await walkVisit(w, d);                 // the pool
      set('spa_chem_chlorine', '4');
      await walkVisit(w, d);                 // the spa, which ends the visit
      check('  the visit finished', w.eval('currentViewName') === 'home', String(w.eval('currentViewName')));

      const saved = JSON.parse(w.localStorage.getItem('weir:readings:a') || '[]');
      check('  the pool reading records the salt cell as cleaned', saved[0] && saved[0].saltCellCleaned === true, JSON.stringify(saved[0]));
      check('  and the filter as backwashed', saved[0] && saved[0].filterBackwashed === true);

      w.eval("renderDateReport('a', '" + iso + "');");
      await wait(700);
      check('  the report shows Salt cell cleaned', /Salt cell cleaned/.test(w.eval('currentReportText') || ''), w.eval('currentReportText'));
      check('  the emailed report shows it too', /Salt cell cleaned/.test(w.eval('currentReportHtml') || ''));
      check('  and Filter backwashed', /Filter backwashed/.test(w.eval('currentReportText') || '') && /Filter backwashed/.test(w.eval('currentReportHtml') || ''));

      // The next customer starts with nothing pressed
      w.eval("openVisit('b');"); await wait(600);
      check('  the next customer\'s Salt cell button is not pressed', d.getElementById('chkSaltCell') && !on('chkSaltCell'));
      w.eval("discardVisitInProgress();"); await wait(300);

      // Sent back with Reservice: starts unpressed, and shows when it was last done
      w.eval("reserviceCustomer(customers.find(c => c.id === 'a'));"); await wait(400);
      w.eval("openVisit('a');"); await wait(700);
      check('  reopened, the buttons start unpressed', d.getElementById('chkSaltCell') && !on('chkSaltCell') && !on('chkBackwashed'));
      const note = d.getElementById('chkSaltCell').parentNode.lastChild.textContent;
      check('  and below the button it says when it was last done', /Last done today/.test(note), note);

      // Pressed then the report cancelled: nothing carries over
      d.getElementById('chkSaltCell').click();
      w.eval("discardVisitInProgress();"); await wait(300);
      w.eval("openVisit('a');"); await wait(700);
      check('  a cancelled report does not leave it pressed', !on('chkSaltCell'));
    }catch(e){ check('  salt cell visit', false, e.stack); }
  }

  // ---- The button says what it actually does ----
  for(const file of ['technician-app.html','admin-readings-app.html']){
    console.log('\n=== ' + file + ': the finish button names the next body ===');

    async function labels(bodies){
      const cust = {id:'a', name:'Alpha', day: today, active:true,
                    technicianId:'t1', hasPool:true};
      if(bodies.spa) cust.hasSpa = true;
      if(bodies.fountain) cust.fountains = [{id:'f1', name:'Front fountain'}];
      const dom = boot(file, Object.assign(seedFor(), {
        customers: [cust],
        settings: {showAfterPhotos:false, showBeforePhotos:false}
      }));
      await wait(1400);
      const w = dom.window, d = w.document;
      const set = (id,v)=>{ const e = d.getElementById(id); if(!e) return;
        e.value = v; e.dispatchEvent(new w.Event('input',{bubbles:true})); };
      w.eval("currentUser={id:'t1',name:'Alex'}; confirmDialog=()=>Promise.resolve(true); "
           + "alertDialog=()=>Promise.resolve(); renderHomeList(); openVisit('a');");
      await wait(400);
      const out = {};
      set('pool_chem_chlorine','3'); set('pool_dose_tabs','2');
      await wait(150);
      out.pool = d.getElementById('btnSaveReading').textContent.trim();
      if(bodies.spa){
        d.getElementById('btnSaveReading').click(); await wait(650);
        set('spa_chem_chlorine','4'); set('spa_dose_tabs','1'); await wait(150);
        out.spa = d.getElementById('btnSaveSpaReading').textContent.trim();
        if(bodies.fountain){
          d.getElementById('btnSaveSpaReading').click(); await wait(650);
          set('fountain_chem_chlorine','2'); await wait(200);
          out.fountain = d.getElementById('btnSaveFountainReading').textContent.trim();
        }
      }
      return out;
    }

    try{
      let L = await labels({});
      check('  a pool-only customer says Submit straight away',
            L.pool === 'Submit service report', L.pool);

      L = await labels({spa: true});
      check('  with a spa to come, the pool says Continue',
            /^Continue to Spa/.test(L.pool), L.pool);
      check('  and the spa says Submit',
            L.spa === 'Submit service report', L.spa);

      L = await labels({spa: true, fountain: true});
      check('  with a fountain to come, the spa names it',
            /^Continue to Front fountain/.test(L.spa), L.spa);
      check('  the body of water name is capitalised',
            /^Continue to [A-Z]/.test(L.pool), L.pool);
      check('  and the last fountain says Submit',
            L.fountain === 'Submit service report', L.fountain);
    }catch(e){ check('  finish button labels', false, e.message); }
  }

  // ---- Skipping a body of water ----
  for(const file of ['technician-app.html','admin-readings-app.html']){
    console.log('\n=== ' + file + ': a body of water can be skipped ===');
    const dom = boot(file, Object.assign(seedFor(), {
      customers: [{id:'a', name:'Alpha', email:'c@x.com', day: today, active:true,
                   technicianId:'t1', hasPool:true, hasSpa:true}]
    }));
    await wait(1400);
    const w = dom.window, d = w.document;
    const set = (id,v)=>{ const e = d.getElementById(id); if(!e) return;
      e.value = v; e.dispatchEvent(new w.Event('input',{bubbles:true})); };
    try{
      w.eval("currentUser={id:'t1',name:'Alex'}; confirmDialog=()=>Promise.resolve(true); "
           + "alertDialog=()=>Promise.resolve(); renderHomeList(); openVisit('a');");
      await wait(400);

      const row = d.getElementById('poolSkipRow');
      const checks = d.getElementById('poolServiceChecks');
      check('  there is a skip button on the readings step', !!row);
      check('  above the backwash and salt cell checks',
            !!row && !!checks && !!(row.compareDocumentPosition(checks) & 4));
      check('  and one for every body of water',
            !!d.getElementById('btnSpaSkip') && !!d.getElementById('btnFountainSkip'));

      set('pool_chem_chlorine','3.2');
      set('pool_dose_tabs','2');
      d.getElementById('btnSaveReading').click();
      await wait(700);
      check('  the pool was done normally', w.eval('currentVisibleSection') === 'spa');

      d.getElementById('btnSpaSkip').click();
      await wait(900);

      check('  the pool still reaches history',
            JSON.parse(w.eval("JSON.stringify(lsGet('readings:a') || [])")).length === 1);
      check('  the skipped spa records nothing',
            JSON.parse(w.eval("JSON.stringify(lsGet('spaReadings:a') || [])")).length === 0);
      const html = w.eval('currentReportHtml') || '';
      check('  the report covers the pool', html.indexOf('3.2') !== -1);
      check('  and does not mention the spa', html.indexOf('Spa') === -1);
      check('  the visit finishes rather than stalling',
            w.eval('currentViewName') === 'home', String(w.eval('currentViewName')));
    }catch(e){ check('  skipping a body of water', false, e.message); }
  }

  // ---- The selected body of water slides into view ----
  for(const file of ['technician-app.html','admin-readings-app.html']){
    console.log('\n=== ' + file + ': the selected tab scrolls to the left ===');
    const src = fs.readFileSync(file, 'utf8');
    check('  there is a helper for it',
          src.indexOf('function scrollSelectedSectionIntoView') !== -1);
    check('  the selected tab is marked so it can be found',
          src.indexOf("btn.dataset.selectedTab = '1';") !== -1);
    check('  it runs after the strip is drawn',
          src.indexOf('setTimeout(scrollSelectedSectionIntoView, 0);') !== -1);
    check('  and leaves a strip that already fits alone',
          src.indexOf('if(container.scrollWidth <= container.clientWidth + 1) return;') !== -1);

    // The maths, with widths faked because jsdom has no layout
    const dom = boot(file, seedFor());
    await wait(1200);
    const w = dom.window, d = w.document;
    try{
      const strip = d.getElementById('visitSectionButtons');
      const place = (scrollW, clientW, offset)=>{
        Object.defineProperty(strip, 'scrollWidth', {value: scrollW, configurable: true});
        Object.defineProperty(strip, 'clientWidth', {value: clientW, configurable: true});
        Object.defineProperty(strip, 'offsetLeft', {value: 0, configurable: true});
        strip.innerHTML = '';
        const b = d.createElement('button');
        b.dataset.selectedTab = '1';
        strip.appendChild(b);
        Object.defineProperty(b, 'offsetLeft', {value: offset, configurable: true});
        let to = null;
        strip.scrollTo = (o)=>{ to = o.left; };
        w.eval('scrollSelectedSectionIntoView();');
        return to;
      };
      check('  a strip that fits is not scrolled', place(300, 320, 0) === null);
      check('  an overflowing strip brings the tab to the left edge',
            place(900, 320, 190) === 186, String(place(900, 320, 190)));
      check('  and never scrolls to a negative position',
            place(900, 320, 0) === 0, String(place(900, 320, 0)));
    }catch(e){ check('  scroll maths', false, e.message); }
  }

  // ---- Skipping with proof required ----
  for(const file of ['technician-app.html','admin-readings-app.html']){
    console.log('\n=== ' + file + ': a skip can require a photo and a note ===');

    // Not required — skips as before
    let dom = boot(file, Object.assign(seedFor(), {
      technicians: [{id:'t1', name:'Alex', requireSkipProof: false}],
      customers: [{id:'a', name:'Alpha', email:'c@x.com', day: today, active:true,
                   technicianId:'t1', hasPool:true, hasSpa:true}]
    }));
    await wait(1400);
    let w = dom.window, d = w.document;
    try{
      w.eval("currentUser={id:'t1',name:'Alex',requireSkipProof:false}; "
           + "confirmDialog=()=>Promise.resolve(true); alertDialog=()=>Promise.resolve(); "
           + "renderHomeList(); openVisit('a');");
      await wait(400);
      d.getElementById('btnSpaSkip').click();
      await wait(500);
      check('  without the requirement there is no extra dialog',
            !d.querySelector('#skipProofSave'));
      check('  and the spa is skipped',
            w.eval("pendingVisit ? pendingVisit.doneSections.spa : null") === 'skipped');
    }catch(e){ check('  skip without proof', false, e.message); }

    // Required — refuses until both are supplied
    dom = boot(file, Object.assign(seedFor(), {
      technicians: [{id:'t1', name:'Alex', requireSkipProof: true}],
      customers: [{id:'a', name:'Alpha', email:'c@x.com', day: today, active:true,
                   technicianId:'t1', hasPool:true, hasSpa:true}]
    }));
    await wait(1400);
    w = dom.window; d = w.document;
    try{
      w.eval("currentUser={id:'t1',name:'Alex',requireSkipProof:true}; "
           + "confirmDialog=()=>Promise.resolve(true); alertDialog=()=>Promise.resolve(); "
           + "renderHomeList(); openVisit('a');");
      await wait(400);
      d.getElementById('btnSpaSkip').click();
      await wait(500);
      check('  with the requirement it asks for proof', !!d.querySelector('#skipProofSave'));

      d.querySelector('#skipProofSave').click();
      await wait(200);
      check('  nothing supplied is refused',
            /photo is required/i.test(d.querySelector('#skipProofErr').textContent));
      check('  and nothing is skipped',
            w.eval("pendingVisit.doneSections.spa") === undefined);

      d.querySelector('#skipProofNote').value = 'Spa drained for repairs';
      d.querySelector('#skipProofSave').click();
      await wait(200);
      check('  a note without a photo is still refused',
            w.eval("pendingVisit.doneSections.spa") === undefined);

      // Supply the photo the way the file handler does
      w.eval("resizeImageFile = ()=> Promise.resolve('data:image/webp;base64,AAAA');");
      const fileEl = d.querySelector('#skipProofFile');
      Object.defineProperty(fileEl, 'files', {value: [{name:'x.jpg'}], configurable: true});
      fileEl.dispatchEvent(new w.Event('change', {bubbles:true}));
      await wait(300);

      // The photo behaves like every other photo in the app
      check('  the photo can be opened full size', !!d.querySelector('#skipProofImg'));
      check('  and removed again', !!d.querySelector('#skipProofRemove'));
      d.querySelector('#skipProofRemove').click();
      await wait(200);
      check('  removing hides the preview',
            d.querySelector('#skipProofPreview').style.display === 'none');
      d.querySelector('#skipProofSave').click();
      await wait(200);
      check('  and the skip is refused again',
            w.eval("pendingVisit.doneSections.spa") === undefined);

      // Put it back, then finish
      fileEl.dispatchEvent(new w.Event('change', {bubbles:true}));
      await wait(300);
      d.querySelector('#skipProofSave').click();
      await wait(600);

      check('  with both, the dialog closes', !d.querySelector('#skipProofSave'));
      check('  and the spa is skipped',
            w.eval("pendingVisit ? pendingVisit.doneSections.spa : null") === 'skipped');

      const saved = JSON.parse(w.eval("JSON.stringify(lsGet('skipProof:a') || [])"));
      check('  the reason is recorded', saved.length === 1, String(saved.length));
      if(saved.length){
        check('  with the note', saved[0].note === 'Spa drained for repairs');
        check('  the photo', !!saved[0].photo);
        check('  and who skipped it', saved[0].technician === 'Alex');
      }
    }catch(e){ check('  skip with proof', false, e.message); }
  }

  // It is set on the website's Photo requirements tab, as a row of its own
  {
    const site = fs.readFileSync('customer-intake.html', 'utf8');
    check('the website sets it on the Photo requirements tab',
          site.indexOf("{step: 'skip', label: 'Require a photo and note to skip") !== -1);
    check('with one tick per technician, or Everyone',
          site.indexOf("step === 'skip' ? (t.requireSkipProof === true || photoEveryoneOn('skip', 'skip'))") !== -1);
    const admin = fs.readFileSync('admin-readings-app.html', 'utf8');
    check('the app no longer offers its own tick for it', admin.indexOf('tcRequireSkipProof') === -1);
    check('but still holds a technician to it', admin.indexOf("techRequires('requireSkipProof')") !== -1);
  }

  
// ---- A message clears the buttons at the bottom ----
{
  console.log('\n=== a message sits above the step button ===');
  ['technician-app.html', 'admin-readings-app.html'].forEach(file=>{
    const src = fs.readFileSync(file, 'utf8');
    const rule = (src.match(/\.toast\{[^}]*\}/) || [''])[0];
    check(file + ' places a message above both bars',
          /var\(--bottombar-height/.test(rule) && /var\(--stepbar-height/.test(rule), rule.slice(0, 140));
    check(file + ' no longer guesses at 80px', rule.indexOf('bottom:80px') === -1);
    check(file + ' measures the step bar, and treats it as nothing when hidden',
          /--stepbar-height/.test(src) && /showing \? Math\.round/.test(src));
    check(file + ' and measures again as a message appears',
          /function showToast\(msg\)\{\s*try\{ measureBottomBar\(\); \}catch/.test(src));
  });
}

// ---- The step bar sits on the tab bar, with no gap ----
{
  console.log('\n=== The step bar meets the tabs ===');
  ['technician-app.html', 'admin-readings-app.html'].forEach(file=>{
    const src = fs.readFileSync(file, 'utf8');
    const rule = (src.match(/\.step-bar\{[^}]*\}/) || [''])[0];
    check(file + ' places the step bar by the tab bar\u2019s real height',
          /bottom:var\(--bottombar-height/.test(rule), rule.slice(0, 120));
    check(file + ' no longer guesses at 74px', rule.indexOf('74px') === -1);
    check(file + ' measures that height from the bar itself',
          /function measureBottomBar\(\)/.test(src) && /getBoundingClientRect\(\)\.height/.test(src));
    check(file + ' measures again when the window changes size',
          /addEventListener\('resize', measureBottomBar\)/.test(src));
    check(file + ' and leaves room under the page for both bars',
          /body\.has-step-bar\{padding-bottom:calc\(var\(--bottombar-height/.test(src));
  });
}


// ---- Skip sits on the heading line, not a row of its own ----
{
  console.log('\n=== Skip this pool shares the heading line ===');
  ['technician-app.html', 'admin-readings-app.html'].forEach(file=>{
    const src = fs.readFileSync(file, 'utf8');
    check(file + ' moves the skip button onto the step heading',
          /head\.insertBefore\(skipBtn, back\)/.test(src), 'skip not moved');
    check(file + ' and hides the row it used to have to itself',
          /skipRow\.style\.display = 'none'/.test(src));
    check(file + ' no longer heads the service checks with "Service performed"',
          src.indexOf("eyebrow.textContent = 'Service performed'") === -1);
    // The report and the email still say it, which is where it belongs
    check(file + ' but the report still labels that section',
          src.indexOf('Service performed') !== -1);
  });
}


// ---- Every body of water starts at its before photo ----
// Moving on from the pool used to open the next one at the chemical readings,
// so the spa and every extra body of water never got a before photo.
{
  console.log('\n=== the next body of water opens at its before photo ===');
  ['technician-app.html', 'admin-readings-app.html'].forEach(file=>{
    const src = fs.readFileSync(file, 'utf8');
    check(file + ' opens the next section at its first step',
          /visitStepBySection\[next\] = 1;/.test(src));
    check(file + ' no longer jumps past it to the readings',
          src.indexOf("const readingsAt = steps.findIndex") === -1);
    check(file + ' and the before photo is still the first step when it is on',
          /if\(showsBeforePhotoStep\(type\)\)\{\s*steps\.push\('visit' \+ cap \+ 'BeforePhotoSection'\)/.test(src));
  });
}


// ---- A visit is dated when it happened ----
// Servicing a Wednesday customer on a Monday used to be recorded as Wednesday:
// the report showed the wrong date and they never appeared in Serviced today.
{
  console.log('\n=== a visit is dated by when the work was done ===');
  const src = fs.readFileSync('admin-readings-app.html', 'utf8');
  check('the visit date is today, whichever route is on screen',
        /function visitDateStr\(\)\{\s*return todayDateStr\(\);/.test(src));
  check('and so is the time stamped on the reading',
        /function visitTimestamp\(\)\{\s*return new Date\(\)\.toISOString\(\);/.test(src));
  check('the day being looked at is still known, for deciding what is due',
        /function routeDateStr\(\)/.test(src));
  check('nothing stamps work with the day being viewed any more',
        src.indexOf('stamped.setHours(now.getHours()') === -1);
  check('the technician app already did it this way',
        /date: new Date\(\)\.toISOString\(\)/.test(fs.readFileSync('technician-app.html', 'utf8')));
}


// ---- Rescheduling writes to the customer in the list, not a stale copy ----
{
  console.log('\n=== rescheduling survives the list being replaced ===');
  ['technician-app.html', 'admin-readings-app.html'].forEach(file=>{
    const src = fs.readFileSync(file, 'utf8');
    const modals = (src.match(/const liveCustomer = \(\) => customers\.find/g) || []).length;
    check(file + ' looks the customer up when the button is pressed', modals >= 1, String(modals));
    check(file + ' and never writes the day onto the captured copy',
          !/\n    customer\.day = newDay;/.test(src));
  });
}

// ---- Changing the regular day clears the one-off moves ----
// A move onto the new day would otherwise land them there twice: once for the
// move, once because it is now their day.
{
  console.log('\n=== changing the regular day clears old moves ===');
  ['technician-app.html', 'admin-readings-app.html'].forEach(file=>{
    const src = fs.readFileSync(file, 'utf8');
    check(file + ' has a way to clear a customer\u2019s moves',
          /function clearMovesFor\(customerId\)/.test(src));
    check(file + ' and does it whenever the regular day changes',
          (src.match(/clearMovesFor\(/g) || []).length >= 2, String((src.match(/clearMovesFor\(/g) || []).length));
  });

  // What it does with real data
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const today = DAYS[new Date().getDay()];
  const dom = boot('technician-app.html', {
    technicians: [{id: 't1', name: 'Pat'}],
    customers: [{id: 'a', name: 'Alpha', active: true, hasPool: true, day: today, technicianId: 't1'}],
    rescheduledVisits: [{id: 'r1', customerId: 'a', fromDate: '2026-01-01', toDate: '2026-01-03'}],
    settings: {}
  });
  const w = dom.window;
  w.console.warn = ()=>{};
  await wait(1200);
  try{
    check('a move is there to begin with',
          JSON.parse(w.localStorage.getItem('weir:rescheduledVisits') || '[]').length === 1);
    w.eval("clearMovesFor('a');");
    check('changing the day clears it',
          JSON.parse(w.localStorage.getItem('weir:rescheduledVisits') || '[]').length === 0,
          w.localStorage.getItem('weir:rescheduledVisits'));
    w.eval("lsSet('rescheduledVisits', [{id:'r2', customerId:'b', fromDate:'2026-01-01', toDate:'2026-01-03'}]); clearMovesFor('a');");
    check('and leaves everybody else\u2019s moves alone',
          JSON.parse(w.localStorage.getItem('weir:rescheduledVisits') || '[]').length === 1);
  }catch(e){ check('clearing moves', false, e.message); }
  w.close();
}

// ---- Moving a visit twice does not leave it on both days ----
// A customer already moved onto a day kept that first move when moved again,
// so they showed on the day they had been moved to and on the new one.
{
  console.log('\n=== moving a visit again replaces the first move ===');
  ['technician-app.html', 'admin-readings-app.html'].forEach(file=>{
    const src = fs.readFileSync(file, 'utf8');
    const matches = src.match(/r\.customerId === customer\.id\s*\n?\s*&& \(r\.fromDate === fromISO \|\| r\.toDate === fromISO\)/g) || [];
    check(file + ' clears any move off this day or onto it', matches.length >= 1, String(matches.length));
    check(file + ' and no longer clears only the ones off it',
          !/!\(r\.customerId === customer\.id && r\.fromDate === fromISO\)/.test(src));
  });
}


// ---- A photo step only appears when somebody must take one ----
// With the Settings switches gone, every step showed for everyone: a page to
// tap past, which is how a technician learns to stop reading the screen.
{
  console.log('\n=== photo steps appear only when they are required ===');
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const day = DAYS[new Date().getDay()];

  async function stepsFor(file, rules){
    const dom = boot(file, {
      technicians: [{id: 't1', name: 'Pat', photoRules: rules}],
      customers: [{id: 'a', name: 'Alpha', active: true, hasPool: true, day: day, technicianId: 't1'}],
      settings: {}
    });
    const w = dom.window;
    w.console.warn = ()=>{};
    w.localStorage.setItem('weirdevice:session', JSON.stringify({access_token: 't'}));
    w.localStorage.setItem('weirdevice:membership', JSON.stringify({
      technician_id: 't1', name: 'Pat', username: 'p',
      full_access: file.indexOf('admin') !== -1, removed: false, company_id: 'co'}));
    w.localStorage.setItem('weirdevice:company', JSON.stringify({id: 'co', name: 'Triffic'}));
    await wait(1300);
    w.Element.prototype.scrollIntoView = function(){};
    // The app read the device before these were set, so tell it again
    try{ w.eval("currentUser = fieldCurrentUser();"); }catch(e){}
    try{
      await w.eval("openVisit('a')");
      await wait(200);
      const out = JSON.parse(w.eval("JSON.stringify(visitStepCardsFor('pool'))"))
        .map(x => String(Array.isArray(x) ? x[0] : x));

      w.close();
      return out;
    }catch(e){ w.close(); return ['ERROR: ' + e.message]; }
  }

  for(const file of ['technician-app.html', 'admin-readings-app.html']){
    const none = await stepsFor(file, {});
    check(file + ': nothing asked means no before photo step',
          !none.some(c => /BeforePhotoSection/.test(c)), none.join(' | '));
    check(file + ': and no after photo step of its own',
          !none.some(c => /PhotoSection/.test(c) && !/Before/.test(c)), none.join(' | '));
    check(file + ': the readings are still there', none.some(c => /Products|Save|Section/.test(c)), none.join(' | '));

    const before = await stepsFor(file, {before: {pool: true}});
    check(file + ': asking for a before photo brings that step back',
          before.some(c => /BeforePhotoSection/.test(c)), before.join(' | '));

    const after = await stepsFor(file, {after: {pool: true}});
    check(file + ': asking for an after photo brings that one back',
          after.some(c => /PhotoSection/.test(c) && !/Before/.test(c)), after.join(' | '));
  }

  ['technician-app.html', 'admin-readings-app.html'].forEach(file=>{
    const src = fs.readFileSync(file, 'utf8');
    check(file + ": a customer's own setup can ask for one too",
          /lists && lists\.requireBeforePhoto === true/.test(src)
          && /lists && lists\.requireAfterPhoto === true/.test(src));
    check(file + ': and so can an extra photo, required or optional',
          /customPhotosShownOf\(type, 'before'\)\.length > 0/.test(src)
          && /customPhotosShownOf\(type, 'after'\)\.length > 0/.test(src));
  });
}


// ---- The serviced list can look back at earlier days ----
{
  console.log('\n=== Serviced: stepping back through days ===');
  ['technician-app.html', 'admin-readings-app.html'].forEach(file=>{
    const src = fs.readFileSync(file, 'utf8');
    check(file + ' has a day to step back and forward', /id="servicedPrevDay"/.test(src)
          && /id="servicedNextDay"/.test(src));
    check(file + ' shows which day is being looked at', /id="servicedDayLabel"/.test(src));
    check(file + ' the list follows that day rather than always today',
          /const today = servicedDateStr\(\);/.test(src));
    check(file + ' and it cannot step past today',
          /servicedDayOffset = Math\.min\(0, servicedDayOffset \+ by\)/.test(src));
    check(file + ' arriving at the tab starts on today',
          src.indexOf('servicedDayOffset = 0;') !== -1
          && src.split('servicedDayOffset = 0;').length >= 3,
          'only declared, never reset on arrival');
  });

  // What it actually shows
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const day = DAYS[new Date().getDay()];
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yesterday = new Date(y.getTime() - y.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const todayIso = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  const dom = boot('technician-app.html', {
    technicians: [{id: 't1', name: 'Pat'}],
    customers: [
      {id: 'a', name: 'Done Today', active: true, hasPool: true, day: day, technicianId: 't1', lastServicedDate: todayIso},
      {id: 'b', name: 'Done Yesterday', active: true, hasPool: true, day: day, technicianId: 't1', lastServicedDate: yesterday}
    ],
    settings: {}
  });
  const w = dom.window, d = w.document;
  w.console.warn = ()=>{};
  await wait(1300);
  try{
    w.eval("currentUser = {id:'t1', name:'Pat'}; switchView('serviced');");
    await wait(200);
    const names = () => Array.from(d.querySelectorAll('#servicedList .cust-name')).map(n => n.textContent.trim());
    check('today lists only what was done today', names().join() === 'Done Today', names().join(' | '));
    check('and the label says Today', d.getElementById('servicedDayLabel').textContent === 'Today');
    w.eval("stepServicedDay(-1)");
    await wait(200);
    check('stepping back lists what was done yesterday',
          names().join() === 'Done Yesterday', names().join(' | '));
    check('with the label saying Yesterday', d.getElementById('servicedDayLabel').textContent === 'Yesterday');
    w.eval("stepServicedDay(1)");
    await wait(200);
    check('stepping forward comes back to today', names().join() === 'Done Today', names().join(' | '));
    w.eval("stepServicedDay(1)");
    await wait(200);
    check('and it will not go past today', d.getElementById('servicedDayLabel').textContent === 'Today');
  }catch(e){ check('the serviced day stepper', false, e.message); }
  w.close();
}


// ---- Finishing a visit goes straight back to the route ----
// The report screen was filled in while the visit was still on screen, which
// showed as a flash of another page on the way out.
{
  console.log('\n=== finishing a visit lands on Today, with nothing in between ===');
  ['technician-app.html', 'admin-readings-app.html'].forEach(file=>{
    const src = fs.readFileSync(file, 'utf8');
    // The route is shown before anything is saved or cleared, so the visit
    // screen is not on show while its photos are emptied
    const at = src.indexOf('await commitVisitPackage(customerId);');
    const before = src.slice(Math.max(0, at - 400), at);
    check(file + ' leaves the visit screen before anything is cleared',
          /switchView\('home'\);/.test(before), before.slice(-140));
    check(file + ' and does not switch home twice',
          (src.match(/renderHomeList\(\);\s*\n\s*renderServicedList\(\);\s*\n\s*switchView\('home'\);/g) || []).length === 1);
  });
}


// ---- A day's route clears once the work is caught up ----
// Work is dated when it was done, so a Friday customer serviced on Monday has
// a later date than the day they were on. Friday's route kept listing them.
{
  console.log('\n=== catching up clears the day it was for ===');
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const yesterdayName = DAYS[(new Date().getDay() + 6) % 7];
  const y = new Date(); y.setDate(y.getDate() - 1);
  const todayIso = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  const dom = boot('technician-app.html', {
    technicians: [{id: 't1', name: 'Pat'}],
    customers: [
      {id: 'a', name: 'Caught Up', active: true, hasPool: true, day: yesterdayName,
       technicianId: 't1', lastServicedDate: todayIso},
      {id: 'b', name: 'Still Waiting', active: true, hasPool: true, day: yesterdayName,
       technicianId: 't1'}
    ],
    settings: {}
  });
  const w = dom.window, d = w.document;
  w.console.warn = ()=>{};
  await wait(1300);
  try{
    w.eval("currentUser = {id:'t1', name:'Pat'}; selectedHomeDay = '" + yesterdayName + "'; renderHomeList();");
    await wait(200);
    const names = Array.from(d.querySelectorAll('#homeCustomerList .cust-name')).map(n => n.textContent.trim());
    check('someone caught up today is off yesterday\u2019s route',
          names.indexOf('Caught Up') === -1, names.join(' | '));
    check('and anyone still waiting is still on it',
          names.indexOf('Still Waiting') !== -1, names.join(' | '));
  }catch(e){ check('catching up', false, e.message); }
  w.close();

  ['technician-app.html', 'admin-readings-app.html'].forEach(file=>{
    const src = fs.readFileSync(file, 'utf8');
    check(file + ' counts a later service as done for an earlier day',
          /lastServicedDate >= (selectedDayISO|iso|dayISO)/.test(src) && /function servicedForCovers/.test(src));
  });
}


// ---- Off, optional or required ----
// A row says what a photo is for everyone; a technician can be raised to
// required on their own. Optional means the step is there to be walked past.
{
  console.log('\n=== a photo can be off, optional or required ===');
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const day = DAYS[new Date().getDay()];

  async function stepsWith(defaults, rules){
    const dom = boot('technician-app.html', {
      technicians: [{id: 't1', name: 'Pat', photoRules: rules || {}}],
      customers: [{id: 'a', name: 'Alpha', active: true, hasPool: true, day: day, technicianId: 't1'}],
      photoDefaults: defaults,
      settings: {}
    });
    const w = dom.window;
    w.console.warn = ()=>{};
    w.localStorage.setItem('weirdevice:session', JSON.stringify({access_token: 't'}));
    w.localStorage.setItem('weirdevice:membership', JSON.stringify({
      technician_id: 't1', name: 'Pat', username: 'p', full_access: false, removed: false, company_id: 'co'}));
    w.localStorage.setItem('weirdevice:company', JSON.stringify({id: 'co', name: 'Triffic'}));
    await wait(1300);
    w.Element.prototype.scrollIntoView = function(){};
    try{ w.eval("currentUser = fieldCurrentUser();"); }catch(e){}
    let out = {steps: [], must: false};
    try{
      await w.eval("openVisit('a')");
      await wait(150);
      out.steps = JSON.parse(w.eval("JSON.stringify(visitStepCardsFor('pool'))"))
        .map(x => String(Array.isArray(x) ? x[0] : x));
      out.must = w.eval("techWantsPhoto('before', 'pool')") === true;
    }catch(e){ out.error = e.message; }
    w.close();
    return out;
  }

  const off = await stepsWith({before: 'off'});
  check('off means the step is not there',
        !off.steps.some(c => /BeforePhotoSection/.test(c)), off.steps.join(' | '));

  const optional = await stepsWith({before: 'optional'});
  check('optional means the step is there',
        optional.steps.some(c => /BeforePhotoSection/.test(c)), optional.steps.join(' | '));
  check('but nobody has to take it', optional.must === false);

  const required = await stepsWith({before: 'required'});
  check('required means the step is there', required.steps.some(c => /BeforePhotoSection/.test(c)));
  check('and everybody must take it', required.must === true);

  const exception = await stepsWith({before: 'optional'}, {before: {pool: true}});
  check('a technician asked by name must take an otherwise optional photo',
        exception.must === true);

  const src = fs.readFileSync('customer-intake.html', 'utf8');
  check('the office offers all three on every row',
        /const PHOTO_STATES = \['off', 'optional', 'required'\]/.test(src));
  check('and the setting reaches the phones',
        /'customerGroups', 'photoDefaults'/.test(src)
        && /'customerGroups', 'photoDefaults'/.test(fs.readFileSync('technician-app.html', 'utf8')));
}


// ---- A technician's route reads the order they actually have ----
// The technician route view kept an order of its own, so it showed a different
// order from the route that technician sees.
{
  console.log('\n=== a technician\u2019s route is in their order ===');
  const src = fs.readFileSync('admin-readings-app.html', 'utf8');
  check('the one-off order for that date comes first',
        /orders\['date:' \+ routeIso \+ '\|' \+ selectedTechId\]/.test(src));
  check('then the weekly order for that technician',
        /orders\[forThisTech\(selectedTechId\)\]/.test(src));
  check('older saves are still understood',
        /orders\['tech:' \+ forThisTech\(selectedTechId\)\]/.test(src));
  check('and the office order is the last word',
        /orders\[forThisTech\(\)\]/.test(src));
  check('dragging here saves where the route looks',
        /store\['day:' \+ techRouteDay \+ '\|' \+ selectedTechId\] = keys;/.test(src));
  check('and no longer under a key of its own',
        src.indexOf("store['tech:' + orderKeyName]") === -1);
}


// ---- Extra photos, Everyone and Optional on the phones ----
{
  const photo = {id: 'cp_1', label: 'Filter gauge', when: {before: true}, required: true};
  const cfg = extra => ({
    pool: Object.assign({chemicals: [], dosages: []}, extra), spa: Object.assign({chemicals: [], dosages: []}, extra),
    fountain: Object.assign({chemicals: [], dosages: []}, extra)});
  const startVisit = async (file, seedExtra, user)=>{
    const dom = boot(file, seedFor(Object.assign({chemConfig: cfg({customPhotos: [photo]})}, seedExtra)));
    await wait(1300);
    const w = dom.window, d = w.document;
    w.Element.prototype.scrollIntoView = function(){};
    w.eval("currentUser = " + JSON.stringify(Object.assign({id: 't1', name: 'Alex'}, user || {})) + ";");
    await w.eval("openVisit('a')");
    await wait(250);
    return {w, d};
  };
  const shown = el => !!el && !el.classList.contains('photo-part-off');

  for(const file of ['technician-app.html', 'admin-readings-app.html']){
    console.log('\n=== ' + file + ': extra photos and Everyone ===');

    // Everyone on the extra photo, pool only
    let {w, d} = await startVisit(file, {photoEveryone: {cp_1: {pool: true}}});
    try{
      const extra = d.getElementById('customPhotos_pool_before');
      check(file + ': an extra photo set for before appears on the before page, by its name',
            extra.style.display !== 'none' && /Filter gauge \(required\)/.test(extra.textContent), extra.textContent.slice(0, 40));
      check(file + ': and not on the after page', d.getElementById('customPhotos_pool_after').style.display === 'none');
      check(file + ': the regular before photo is not there when nobody asked for it',
            !shown(d.getElementById('visitPoolBeforePhotoSection').querySelector('h2'))
            && !shown(d.getElementById('btnTakePhotoBefore').parentElement));
      check(file + ': the extra photo itself stays', shown(extra));
      check(file + ': Everyone makes it required', w.eval("techWantsPhoto('cp_1', 'pool')") === true);
      check(file + ': but only on the bodies ticked', w.eval("photoStepShows('cp_1', 'spa')") === false);

    }catch(e){ check(file + ': extra photos', false, e.message); }
    w.close();

    // Each body keeps its own. Pressed on the photo blocks directly: inside a
    // full visit the page is still settling in the background here, which
    // swallows the press in this test setup (not on a phone).
    {
      const dom2 = boot(file, seedFor({chemConfig: cfg({customPhotos: [photo]}),
                                       photoEveryone: {cp_1: {pool: true, spa: true, fountain: true}}}));
      await wait(1300);
      w = dom2.window; d = w.document;
      w.eval("currentUser = {id: 't1', name: 'Alex'}; currentVisitCustomerId = null;");
      w.eval("captureFromCamera = async ()=> 'data:image/jpeg;base64,' + (currentVisitFountainId || window.__body);");
    }
    try{
      const take = async type => { w.__body = type; w.eval("renderCustomPhotoBlocks('" + type + "', 'before')");
        Array.from(d.querySelectorAll('#customPhotos_' + type + '_before button')).find(b => /Take photo/.test(b.textContent)).click();
        await wait(60); };
      const picture = type => { w.eval("renderCustomPhotoBlocks('" + type + "', 'before')");
        const img = d.querySelector('#customPhotos_' + type + '_before img');
        // The picture sits in its own box now, which is what shows and hides
        const shownNow = img && img.parentElement.style.display !== 'none' && img.getAttribute('src');
        return shownNow ? img.getAttribute('src').split(',')[1] : ''; };
      await take('pool');
      check(file + ': taking it on the pool stores it for the pool', picture('pool') === 'pool', picture('pool'));
      check(file + ': but does not count for the spa',
            w.eval("missingCustomPhoto('spa', 'before')") === 'Filter gauge');
      check(file + ': and the spa starts with no picture', picture('spa') === '');
      await take('spa');
      check(file + ': the spa then has its own, and the pool keeps its',
            picture('spa') === 'spa' && picture('pool') === 'pool', picture('spa') + ' / ' + picture('pool'));
      check(file + ': and it is no longer owed on the spa', w.eval("missingCustomPhoto('spa', 'before')") === '');
      w.eval("currentVisitFountainId = 'f1';");
      check(file + ': an extra body of water starts with no picture', picture('fountain') === '');
      await take('fountain');
      w.eval("currentVisitFountainId = 'f2';");
      check(file + ': and a second extra body has its own too', picture('fountain') === '');
      w.eval("currentVisitFountainId = 'f1';");
      check(file + ': the first keeps its picture', picture('fountain') === 'f1');
      const src = fs.readFileSync(file, 'utf8');
      check(file + ': each report files only its own body\u2019s extra photos',
            /customPhotoData\['pool'\] \|\| \{\}/.test(src) && /customPhotoData\['spa'\] \|\| \{\}/.test(src)
            && /customPhotoData\['fountain:' \+ fountainId\] \|\| \{\}/.test(src));
    }catch(e){ check(file + ': extra photos', false, e.message); }
    w.close();

    // Off: not ticked, not Optional
    ({w, d} = await startVisit(file, {photoEveryone: {}}));
    try{
      check(file + ': an extra photo nobody is asked for does not appear',
            d.getElementById('customPhotos_pool_before').style.display === 'none');
      check(file + ': and brings up no before page of its own', w.eval("showsBeforePhotoStep('pool')") === false);
    }catch(e){ check(file + ': off', false, e.message); }
    w.close();

    // Optional for this technician
    ({w, d} = await startVisit(file, {photoEveryone: {}}, {photoOptional: {cp_1: true, before: true}}));
    try{
      const extra = d.getElementById('customPhotos_pool_before');
      check(file + ': Optional shows it without "(required)"',
            extra.style.display !== 'none' && /Filter gauge/.test(extra.textContent) && !/required/.test(extra.textContent));
      check(file + ': and it is not owed', w.eval("missingCustomPhoto('pool', 'before')") === '');
      check(file + ': a regular before photo on Optional shows',
            shown(d.getElementById('visitPoolBeforePhotoSection').querySelector('h2')));
      check(file + ': Optional for Everyone counts too',
            (w.eval("currentUser.photoOptional = {}; localStorage.setItem('weir:photoEveryone', JSON.stringify({cp_1: {optional: true}}));"),
             w.eval("photoStepShows('cp_1', 'pool') && !techWantsPhoto('cp_1', 'pool')")) === true);
    }catch(e){ check(file + ': optional', false, e.message); }
    w.close();

    // The starting setting, the gate and the skip
    ({w, d} = await startVisit(file, {}));
    try{
      w.eval("localStorage.removeItem('weir:photoEveryone');");
      check(file + ': with nothing set, the pool after photo is required', w.eval("techWantsPhoto('after', 'pool')") === true);
      check(file + ': and the spa one is not', w.eval("techWantsPhoto('after', 'spa')") === false);
      w.eval("localStorage.setItem('weir:photoEveryone', JSON.stringify({gate: {gate: true}, skip: {skip: true}}));");
      check(file + ': Everyone on the gate asks it of this technician', w.eval("gatePhotoApplies()") === true);
      const src = fs.readFileSync(file, 'utf8');
      check(file + ': Everyone on the skip asks for proof',
            /if\(techRequires\('requireSkipProof'\) \|\| photoEveryoneOn\('skip', 'skip'\)\)\{/.test(src));
      check(file + ': an optional gate photo is shown without being required',
            (w.eval("localStorage.setItem('weir:photoEveryone', '{}'); currentUser.photoOptional = {gate: true};"),
             w.eval("techOptionalPhoto('gate') && !gatePhotoApplies()")) === true);
      check(file + ': Everyone travels down with the company setup', /'photoDefaults', 'photoEveryone'\]/.test(src));
    }catch(e){ check(file + ': start, gate and skip', false, e.message); }
    w.close();
  }
}


// ---- Today's list, jobs and the job page (Sept 24) ----
{
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const today = DAYS[new Date().getDay()];
  const iso = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const tomorrowIso = new Date(Date.now() + (new Date().getDay() === 6 ? -86400000 : 86400000) - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const other = today === 'Wednesday' ? 'Tuesday' : 'Wednesday';
  const seedJobs = {
    customers: [
      {id: 'a', name: 'Alpha Today', address: '1 A St', phone: '(623) 555-0101', gateCode: '4321', active: true, hasPool: true, hasSpa: true, day: today, technicianId: 't1'},
      {id: 'b', name: 'Bravo Today', address: '2 B St', active: true, hasPool: true, day: today, technicianId: 't1'},
      {id: 'w', name: 'Wendy Other', address: '9 W Ln', active: true, hasPool: true, day: other, technicianId: 't1'}],
    tasks: [{id: 'k1', title: 'Check seal', details: 'Drips overnight.', technicianId: 't1', date: iso, customerIds: ['a'], done: false},
            {id: 'k2', title: 'Not mine', technicianId: 't2', date: iso, customerIds: ['b'], done: false}],
    scheduledWorkOrders: [{id: 'w1', customerId: 'w', technicianId: 't1', date: iso, title: 'Replace cartridge', notes: 'In the truck.', status: 'scheduled'},
                          {id: 'w2', customerId: 'b', technicianId: 't1', date: tomorrowIso, title: 'Tomorrow job', status: 'scheduled'}],
    chemConfig: {pool: {chemicals: [{key: 'chlorine', label: 'Chlorine'}], dosages: [{key: 'tabs', label: 'Tabs'}]},
                 spa: {chemicals: [{key: 'chlorine', label: 'Chlorine'}], dosages: [{key: 'tabs', label: 'Tabs'}]},
                 fountain: {chemicals: [], dosages: []}}
  };
  for(const file of ['technician-app.html', 'admin-readings-app.html']){
    console.log('\n=== ' + file + ': jobs on Today, and the job page ===');
    const dom = boot(file, seedFor(seedJobs));
    await wait(1400);
    const w = dom.window, d = w.document;
    w.Element.prototype.scrollIntoView = function(){};
    try{
      w.eval("currentUser = {id: 't1', name: 'Pat', full_access: true, canReorderRoute: true};"
        + " if(typeof adminViewTechId !== 'undefined'){ adminViewTechId = 't1'; adminRouteStarted = true; }"
        + " window.__heads = []; dispatchHeadsUp = c => window.__heads.push(c.name);"
        + " confirmDialog = () => Promise.resolve(true); alertDialog = () => Promise.resolve(); attemptAutoSend = async () => {};"
        + " captureFromCamera = async () => 'data:image/jpeg;base64,job'; openPhotoFullSize = src => { window.__full = src; };"
        + " switchView('home'); renderHomeList();");
      await wait(500);   // taps are ignored for a moment after a screen change
      const list = () => Array.from(d.getElementById('homeCustomerList').children).map(r => r.classList.contains('route-job')
        ? 'job:' + Array.from(r.children).find(x => !x.classList.contains('route-grip')).textContent
        : (r.classList.contains('cust-row') ? 'svc:' + r.querySelector('.cust-name').textContent.trim() : '')).filter(Boolean);
      const order = list();
      check(file + ': a job sits under its customer\u2019s service that day', order.indexOf('job:Alpha Today \u2013 Check seal') === order.indexOf('svc:Alpha Today') + 1, order.join(' | '));
      check(file + ': a job whose customer is serviced another day goes at the bottom', order[order.length - 1] === 'job:Wendy Other \u2013 Replace cartridge', order.join(' | '));
      check(file + ': and never brings their service onto the day', order.indexOf('svc:Wendy Other') === -1);
      check(file + ': another technician\u2019s job is not shown', !order.some(x => /Not mine/.test(x)));
      check(file + ': a job on another day is not shown today', !order.some(x => /Tomorrow job/.test(x)));
      check(file + ': the jobs count counts each job', d.getElementById('homeJobCount').textContent === '2 of 2', d.getElementById('homeJobCount').textContent);
      const jobRow = Array.from(d.querySelectorAll('#homeCustomerList .route-job'))[0];
      check(file + ': a job row has a grip for rearranging', !!jobRow.querySelector('.route-grip'));
      check(file + ': and is saved in the route order as a job', /^job:/.test(jobRow.dataset.reorderKey));
      check(file + ': its arrow is styled like a service row\u2019s', jobRow.querySelector('.chev').getAttribute('style') === 'color: var(--gold);', jobRow.querySelector('.chev').getAttribute('style'));
      Array.from(jobRow.querySelectorAll('button')).find(b => b.textContent === 'On my way').click();
      check(file + ': On my way on a job goes to its customer', JSON.stringify(w.eval('window.__heads')) === '["Alpha Today"]', JSON.stringify(w.eval('window.__heads')));
      jobRow.click();
      const brief = d.querySelector('.route-job-brief');
      check(file + ': the drop-down shows address, phone, gate and the office\u2019s details',
            !!brief && /1 A St/.test(brief.textContent) && /555-0101/.test(brief.textContent) && /4321/.test(brief.textContent) && /Drips overnight/.test(brief.textContent));
      const start = Array.from(brief.querySelectorAll('button')).find(b => b.classList.contains('btn-primary'));
      check(file + ': with Directions and Start job', /Directions/.test(brief.textContent) && start.textContent === 'Start job');
      start.click();
      const page = d.getElementById('jobPage');
      check(file + ': Start job opens the job page', !!page && /Alpha Today \u2013 Check seal/.test(page.textContent));
      Array.from(page.querySelectorAll('button')).find(b => b.textContent === 'Take photo').click(); await wait(60);
      const thumb = page.querySelector('img');
      check(file + ': the job photo is a thumbnail', thumb.style.maxWidth === '25%' && thumb.parentElement.style.display === 'flex');
      thumb.click();
      check(file + ': tapping it opens it full size', w.eval('window.__full') === 'data:image/jpeg;base64,job');
      page.querySelector('textarea').value = 'Tightened the union.';
      Array.from(page.querySelectorAll('button')).find(b => /^Submit/.test(b.textContent)).click(); await wait(200);
      const subs = JSON.parse(w.localStorage.getItem('weir:jobSubmissions') || '[]');
      check(file + ': submitting keeps the notes and photo, filed under its day',
            subs.length === 1 && subs[0].notes === 'Tightened the union.' && !!subs[0].photo && subs[0].date === iso, JSON.stringify(subs.map(x => [x.notes, x.date])));
      check(file + ': the page closes and the job leaves the list', !d.getElementById('jobPage') && !list().some(x => /Check seal/.test(x)));
      check(file + ': the jobs count goes down', d.getElementById('homeJobCount').textContent === '1 of 2', d.getElementById('homeJobCount').textContent);

      // A job saved at the top of the route stays there
      w.eval("fieldRouteOrder[orderKey(selectedHomeDay, isoForDay(selectedHomeDay))] = ['job:work order:w1', 'a', 'b']; renderHomeList();");
      check(file + ': a job dragged to a new place stays there', list()[0] === 'job:Wendy Other \u2013 Replace cartridge', list().join(' | '));
      w.eval("fieldRouteOrder = {}; saveFieldRouteOrder(); renderHomeList();");

      // Submitting the service leaves the customer's jobs alone
      w.eval("localStorage.setItem('weir:tasks', JSON.stringify([{id:'k3',title:'Second task',technicianId:'t1',date:'" + iso + "',customerIds:['a'],done:false}])); renderHomeList();");
      w.eval("openVisit('a')"); await wait(400);
      const set = (id, v) => { const e = d.getElementById(id); if(!e) return; e.value = v; e.dispatchEvent(new w.Event('input', {bubbles: true})); };
      set('pool_chem_chlorine', '3'); set('pool_dose_tabs', '2'); d.getElementById('btnSaveReading').click(); await wait(700);
      set('spa_chem_chlorine', '4'); set('spa_dose_tabs', '1'); d.getElementById('btnSaveSpaReading').click(); await wait(1200);
      check(file + ': a finished customer leaves Today straight away', !list().some(x => x === 'svc:Alpha Today'), list().join(' | '));
      check(file + ': but their job stays on the list, on its own', list().some(x => /Second task/.test(x)), list().join(' | '));

      // Reschedule starts on today
      w.eval("openRescheduleModal(customers.find(c => c.id === 'b'));");
      check(file + ': Reschedule\u2019s New date starts on today', d.getElementById('rsDate').value === w.eval('todayDateStr()'));
    }catch(e){ check(file + ': jobs', false, e.message); }
    w.close();

    // Another day's job: only the admin app lets it be started
    const dom2 = boot(file, seedFor(seedJobs));
    await wait(1400);
    const w2 = dom2.window, d2 = w2.document;
    w2.Element.prototype.scrollIntoView = function(){};
    try{
      const tomorrow = DAYS[(new Date().getDay() === 6 ? 5 : new Date().getDay() + 1)];
      w2.eval("currentUser = {id: 't1', name: 'Pat', full_access: true};"
        + " if(typeof adminViewTechId !== 'undefined'){ adminViewTechId = 't1'; adminRouteStarted = true; }"
        + " selectedHomeDay = '" + tomorrow + "'; switchView('home'); renderHomeList();");
      await wait(500);
      const row = Array.from(d2.querySelectorAll('#homeCustomerList .route-job')).find(r => /Tomorrow job/.test(r.textContent));
      row.click();
      const btn = d2.querySelector('.route-job-brief .btn-primary');
      if(file === 'admin-readings-app.html'){
        check(file + ': a job on another day can be started in the admin app', btn.textContent === 'Start job' && !btn.disabled);
      } else {
        check(file + ': but not in the technician app', btn.textContent === 'Not today\u2019s job' && btn.disabled);
      }
    }catch(e){ check(file + ': another day', false, e.message); }
    w2.close();
  }

  // Extra photos: thumbnail, caption, and the red Skip button
  for(const file of ['technician-app.html', 'admin-readings-app.html']){
    console.log('\n=== ' + file + ': extra photo thumbnails, captions, and Skip ===');
    const photo = {id: 'cp_17902', label: 'Filter gauge', when: {before: true}, required: true};
    const dom = boot(file, seedFor({photoEveryone: {cp_17902: {pool: true}},
      chemConfig: {pool: {chemicals: [], dosages: [], customPhotos: [photo]}, spa: {chemicals: [], dosages: [], customPhotos: [photo]}, fountain: {chemicals: [], dosages: []}},
      customChemConfig: {a: {spa: {chemicals: [], dosages: [], customPhotos: [{id: 'cp_own', label: 'Heater panel', when: {after: true}, required: true}]}}}}));
    await wait(1300);
    const w = dom.window, d = w.document;
    try{
      w.eval("currentUser = {id: 't1', name: 'Pat'}; currentVisitCustomerId = null; captureFromCamera = async () => 'data:image/jpeg;base64,gauge'; openPhotoFullSize = s => { window.__full = s; };");
      w.eval("renderCustomPhotoBlocks('pool', 'before')");
      const host = d.getElementById('customPhotos_pool_before');
      Array.from(host.querySelectorAll('button')).find(b => /Take photo/.test(b.textContent)).click(); await wait(60);
      const img = host.querySelector('img');
      check(file + ': an extra photo shows as a small centred thumbnail',
            img.style.maxWidth === '25%' && img.style.minWidth === '96px' && img.parentElement.style.display === 'flex' && img.parentElement.style.justifyContent === 'center');
      img.click();
      check(file + ': tapping it opens it full size', w.eval('window.__full') === 'data:image/jpeg;base64,gauge');
      const caps = JSON.parse(w.eval("JSON.stringify(collectReportPhotos([{label:'Pool', reading:{customPhotos:{cp_17902:'data:x', cp_own:'data:y'}}}, {label:'Spa', reading:{customPhotos:{cp_gone:'data:z'}}}]).map(p => p.caption))"));
      check(file + ': emailed extra photos are captioned with their names',
            caps[0] === 'Pool Filter gauge' && caps[1] === 'Pool Heater panel' && caps[2] === 'Spa extra photo', JSON.stringify(caps));
      const skip = d.getElementById('btnPoolSkip');
      check(file + ': Skip this pool is filled red', /background:\s*var\(--rust\)/.test(skip.getAttribute('style')) && /color:\s*var\(--card\)/.test(skip.getAttribute('style')));
      check(file + ': and its row is centred', /justify-content:\s*center/.test(d.getElementById('poolSkipRow').getAttribute('style')));
      const src = fs.readFileSync(file, 'utf8');
      check(file + ': on the step\u2019s heading line it sits in the middle column',
            /head\.style\.gridTemplateColumns = '1fr auto 1fr';/.test(src) && /skipBtn\.style\.justifySelf = 'center'/.test(src));
    }catch(e){ check(file + ': thumbnails and captions', false, e.message); }
    w.close();
  }
}


// ---- Sept 24: jobs, the Today list, extra photos, rescheduling, Skip ----
{
  const isoToday = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const isoTomorrow = new Date(Date.now() + (new Date().getDay() === 6 ? -86400000 : 86400000) - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const other = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][(new Date().getDay() + 3) % 7];
  for(const file of ['technician-app.html', 'admin-readings-app.html']){
    console.log('\n=== ' + file + ': work orders and tasks on the route ===');
    const jobsSeed = seedFor({
      customers: [
        {id:'a', name:'Alpha One', day: today, active:true, technicianId:'t1', hasPool:true, hasSpa:true, address:'1 A St', phone:'555-0101', gateCode:'4321'},
        {id:'b', name:'Bravo Two', day: today, active:true, technicianId:'t1', hasPool:true},
        {id:'w', name:'Wendy Other', day: other, active:true, technicianId:'t1', hasPool:true}],
      tasks: [{id:'k1', title:'Check seal', details:'Drips overnight.', technicianId:'t1', date: isoToday, customerIds:['a'], done:false},
              {id:'k9', title:'Not mine', technicianId:'t2', date: isoToday, customerIds:['b'], done:false}],
      scheduledWorkOrders: [
        {id:'w1', customerId:'w', technicianId:'t1', date: isoToday, title:'Replace cartridge', notes:'In the truck.', status:'scheduled'},
        {id:'w2', customerId:'b', technicianId:'t1', date: isoToday, title:'Fix light', status:'scheduled'},
        {id:'w3', customerId:'a', technicianId:'t1', date: isoTomorrow, title:'Tomorrow job', status:'scheduled'}],
      photoEveryone: {}
    });
    const dom = boot(file, jobsSeed);
    await wait(1300);
    const w = dom.window, d = w.document;
    w.Element.prototype.scrollIntoView = function(){};
    try{
      w.eval("currentUser = {id:'t1', name:'Alex', full_access:true, canReorderRoute:true};"
        + " if(typeof adminViewTechId !== 'undefined'){ adminViewTechId = 't1'; adminRouteStarted = true; }"
        + " dispatchHeadsUp = c => (window.__heads = (window.__heads || [])).push(c.name);"
        + " switchView('home'); renderHomeList();");
      await wait(500);        // the app ignores taps for 0.4s after a screen change
      const list = () => Array.from(d.getElementById('homeCustomerList').children)
        .filter(e => e.classList.contains('cust-row') || e.classList.contains('route-job'))
        .map(e => e.classList.contains('route-job')
          ? 'job ' + Array.from(e.children).find(x => !x.classList.contains('route-grip')).textContent
          : 'service ' + (e.querySelector('.cust-name') || e).textContent.trim());
      const order = list();
      check(file + ': each job is its own row, "Customer – title"', order.indexOf('job Alpha One \u2013 Check seal') !== -1
            && order.indexOf('job Bravo Two \u2013 Fix light') !== -1, order.join(' | '));
      check(file + ': a job sits just under its customer\u2019s service that day',
            order.indexOf('job Alpha One \u2013 Check seal') === order.indexOf('service Alpha One') + 1
            && order.indexOf('job Bravo Two \u2013 Fix light') === order.indexOf('service Bravo Two') + 1, order.join(' | '));
      check(file + ': a job whose customer isn\u2019t serviced today goes at the bottom',
            order[order.length - 1] === 'job Wendy Other \u2013 Replace cartridge', order.join(' | '));
      check(file + ': and it never brings their service onto the day', order.indexOf('service Wendy Other') === -1);
      check(file + ': another technician\u2019s job isn\u2019t shown', !order.some(x => /Not mine/.test(x)));
      check(file + ': a job on another date isn\u2019t shown today', !order.some(x => /Tomorrow job/.test(x)));
      const jobRow = Array.from(d.querySelectorAll('#homeCustomerList .route-job')).find(r => /Check seal/.test(r.textContent));
      check(file + ': job text in the jobs-count gold', /var\(--gold\)/.test(jobRow.children[1].getAttribute('style') || jobRow.children[0].getAttribute('style')));
      check(file + ': every job counts: "3 of 3"', d.getElementById('homeJobCount').textContent === '3 of 3',
            d.getElementById('homeJobCount').textContent);
      check(file + ': jobs have the grip when rearranging is allowed', !!jobRow.querySelector('.route-grip'));
      const chev = jobRow.querySelector('.chev');
      check(file + ': the job\u2019s arrow is styled like a service row\u2019s (no extra padding)',
            !(chev.getAttribute('style') || '').includes('padding'), chev.getAttribute('style'));
      const onWay = Array.from(jobRow.querySelectorAll('button')).find(b => b.textContent === 'On my way');
      onWay.click();
      check(file + ': a job\u2019s On my way goes to its customer', JSON.stringify(w.__heads) === '["Alpha One"]', JSON.stringify(w.__heads));

      // The drop-down, the job page, Submit
      jobRow.click();
      const brief = d.querySelector('.route-job-brief');
      check(file + ': pressing a job shows the customer\u2019s details and the job',
            !!brief && /1 A St/.test(brief.textContent) && /555-0101/.test(brief.textContent) && /4321/.test(brief.textContent)
            && /Drips overnight/.test(brief.textContent), brief && brief.textContent.slice(0, 80));
      const start = Array.from(brief.querySelectorAll('button')).find(b => b.textContent === 'Start job');
      check(file + ': with Directions and Start job', !!start && Array.from(brief.querySelectorAll('button')).some(b => b.textContent === 'Directions'));
      start.click();
      const page = d.getElementById('jobPage');
      check(file + ': Start job opens the job page', !!page && /Alpha One \u2013 Check seal/.test(page.textContent));
      w.eval("captureFromCamera = async ()=> 'data:image/jpeg;base64,job';");
      Array.from(page.querySelectorAll('button')).find(b => b.textContent === 'Take photo').click();
      await wait(80);
      const thumb = page.querySelector('img');
      check(file + ': its photo shows as a thumbnail', thumb.parentElement.style.display === 'flex' && thumb.style.maxWidth === '25%');
      page.querySelector('textarea').value = 'Tightened it.';
      Array.from(page.querySelectorAll('button')).find(b => /^Submit/.test(b.textContent)).click();
      await wait(300);
      const saved = JSON.parse(w.localStorage.getItem('weir:jobSubmissions') || '[]');
      check(file + ': Submit keeps the notes and photo for that date', saved.length === 1 && saved[0].notes === 'Tightened it.'
            && !!saved[0].photo && saved[0].date === isoToday, JSON.stringify(saved.map(x => [x.key, x.date])));
      check(file + ': the job leaves the route', !d.getElementById('jobPage') && !list().some(x => /Check seal/.test(x)));
      check(file + ': and the count reads "2 of 3"', d.getElementById('homeJobCount').textContent === '2 of 3',
            d.getElementById('homeJobCount').textContent);

      // A dragged job stays where it was left
      w.eval("fieldRouteOrder[orderKey(selectedHomeDay, isoForDay(selectedHomeDay))] = ['job:work order:w1', 'a', 'b']; renderHomeList();");
      check(file + ': a job saved at the top of the route is drawn there', list()[0] === 'job Wendy Other \u2013 Replace cartridge', list().join(' | '));
      w.eval("fieldRouteOrder[orderKey(selectedHomeDay, isoForDay(selectedHomeDay))] = []; renderHomeList();");

      // Another day's job: technician app refuses, admin app allows
      w.eval("selectedHomeDay = '" + ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][(new Date().getDay() === 6 ? 5 : new Date().getDay() + 1)] + "'; renderHomeList();");
      await wait(450);
      const tomorrowRow = d.querySelector('#homeCustomerList .route-job');
      tomorrowRow.click();
      const tStart = d.querySelector('.route-job-brief .btn-primary');
      if(file === 'technician-app.html'){
        check(file + ': tomorrow\u2019s job can\u2019t be started today', tStart.disabled && /Not today/.test(tStart.textContent));
      } else {
        check(file + ': the admin app can start a job on any day', !tStart.disabled && tStart.textContent === 'Start job');
      }
    }catch(e){ check(file + ': jobs on the route', false, e.message); }
    w.close();

    // Servicing a customer leaves Today at once, and leaves their jobs alone
    console.log('\n=== ' + file + ': finishing a visit ===');
    {
      const dom2 = boot(file, seedFor({photoEveryone: {},
        tasks: [{id:'k1', title:'Check seal', technicianId:'t1', date: isoToday, customerIds:['a'], done:false}]}));
      await wait(1300);
      const w2 = dom2.window, d2 = w2.document;
      w2.Element.prototype.scrollIntoView = function(){};
      try{
        const set = (id, v)=>{ const e = d2.getElementById(id); if(!e) return; e.value = v; e.dispatchEvent(new w2.Event('input', {bubbles: true})); };
        w2.eval("currentUser = {id:'t1', name:'Alex', full_access:true};"
          + " if(typeof adminViewTechId !== 'undefined'){ adminViewTechId = 't1'; adminRouteStarted = true; }"
          + " confirmDialog = ()=>Promise.resolve(true); alertDialog = ()=>Promise.resolve(); attemptAutoSend = async ()=>{};"
          + " renderHomeList(); openVisit('a');");
        await wait(400);
        set('pool_chem_chlorine', '3'); set('pool_dose_tabs', '2');
        d2.getElementById('btnSaveReading').click(); await wait(700);
        set('spa_chem_chlorine', '4'); set('spa_dose_tabs', '1');
        d2.getElementById('btnSaveSpaReading').click(); await wait(1200);
        const text = d2.getElementById('homeCustomerList').textContent;
        const customerRows = Array.from(d2.querySelectorAll('#homeCustomerList .cust-row')).map(r => r.textContent);
        check(file + ': a finished customer leaves Today straight away', !customerRows.some(t => /Alpha One/.test(t)), customerRows.join(' | '));
        check(file + ': but their job stays until it\u2019s submitted', /Alpha One \u2013 Check seal/.test(text));
      }catch(e){ check(file + ': finishing a visit', false, e.message); }
      w2.close();
    }

    // The reschedule window, extra photo thumbnail and labels, and Skip
    console.log('\n=== ' + file + ': reschedule, extra photos, Skip ===');
    {
      const photo = {id:'cp_1', label:'Filter gauge', when:{before:true}, required:true};
      const dom3 = boot(file, seedFor({photoEveryone: {cp_1: {pool: true}},
        chemConfig: {pool:{chemicals:[], dosages:[], customPhotos:[photo]}, spa:{chemicals:[], dosages:[]}, fountain:{chemicals:[], dosages:[]}},
        customChemConfig: {a: {spa: {chemicals:[], dosages:[], customPhotos:[{id:'cp_2', label:'Heater panel', when:{after:true}}]}}}}));
      await wait(1300);
      const w3 = dom3.window, d3 = w3.document;
      try{
        w3.eval("currentUser = {id:'t1', name:'Alex', isAdmin:true}; openRescheduleModal(customers[0]);");
        check(file + ': Reschedule\u2019s New date starts on today', d3.getElementById('rsDate').value === w3.eval('todayDateStr()'),
              d3.getElementById('rsDate').value);
        d3.getElementById('rsCancel').click();

        w3.eval("currentVisitCustomerId = null; captureFromCamera = async ()=> 'data:image/jpeg;base64,g';"
          + " window.__opened = []; openPhotoFullSize = src => window.__opened.push(src); renderCustomPhotoBlocks('pool', 'before');");
        const host = d3.getElementById('customPhotos_pool_before');
        Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'Take photo').click();
        await wait(80);
        const img = host.querySelector('img');
        check(file + ': an extra photo shows as a small centred thumbnail',
              img.parentElement.style.display === 'flex' && img.style.maxWidth === '25%' && img.style.minWidth === '96px');
        img.click();
        check(file + ': tapping it opens it full size', w3.eval("window.__opened.length") === 1);

        const caps = JSON.parse(w3.eval("JSON.stringify(collectReportPhotos([{label:'Pool', reading:{customPhotos:{cp_1:'data:x'}}},"
          + "{label:'Spa', reading:{customPhotos:{cp_2:'data:y', cp_gone:'data:z'}}}]).map(p => p.caption))"));
        check(file + ': emailed extra photos are captioned with their name',
              caps.join('|') === 'Pool Filter gauge|Spa Heater panel|Spa extra photo', caps.join('|'));
        const src = fs.readFileSync(file, 'utf8');
        check(file + ': Skip is the filled red button', /id="btnPoolSkip" type="button" style="width:auto;background:var\(--rust\);color:var\(--card\)/.test(src));
        check(file + ': and sits in the middle of the heading line',
              /head\.style\.gridTemplateColumns = '1fr auto 1fr';/.test(src) && /skipBtn\.style\.justifySelf = 'center';/.test(src));
      }catch(e){ check(file + ': reschedule and photos', false, e.message); }
      w3.close();
    }
  }
}


// ---- Sept 24: jobs on the route, the job page, the jobs count, and the rest ----
{
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const iso = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + (new Date().getDay() === 6 ? -86400000 : 86400000));
  const tomorrowIso = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const otherDay = DAYS[(new Date().getDay() >= 5 ? new Date().getDay() - 3 : new Date().getDay() + 2)];
  const jobsSeed = extra => seedFor(Object.assign({
    customers: [
      {id:'a', name:'Alpha One', address:'1 A St', phone:'(623) 555-0101', gateCode:'4321', dogs:[{name:'Rex'}],
       day: today, active:true, technicianId:'t1', hasPool:true, hasSpa:true},
      {id:'b', name:'Bravo Two', address:'2 B St', day: today, active:true, technicianId:'t1', hasPool:true},
      {id:'w', name:'Wendy Other', address:'9 W Ln', day: otherDay, active:true, technicianId:'t1', hasPool:true}],
    tasks: [{id:'k1', title:'Check seal', details:'Drips overnight.', technicianId:'t1', date: iso, customerIds:['a'], done:false},
            {id:'k9', title:'Someone else', technicianId:'t2', date: iso, customerIds:['b'], done:false}],
    scheduledWorkOrders: [
      {id:'w1', customerId:'w', technicianId:'t1', date: iso, title:'Replace cartridge', notes:'In the truck.', status:'scheduled'},
      {id:'w2', customerId:'a', technicianId:'t1', date: tomorrowIso, title:'Tomorrow job', status:'scheduled'}]
  }, extra || {}));
  const listOf = d => Array.from(d.getElementById('homeCustomerList').children).map(r =>
    r.classList.contains('route-job') ? 'job:' + Array.from(r.children).find(x => !x.classList.contains('route-grip')).textContent
    : r.dataset.customerRow ? 'service:' + r.dataset.customerRow : (r.className || 'other'));

  for(const file of ['technician-app.html', 'admin-readings-app.html']){
    console.log('\n=== ' + file + ': jobs on the route ===');
    let dom = boot(file, jobsSeed());
    await wait(1300);
    let w = dom.window, d = w.document;
    w.Element.prototype.scrollIntoView = function(){};
    try{
      w.eval("currentUser = {id:'t1', name:'Alex', full_access:true, canReorderRoute:true}; if(typeof adminViewTechId !== 'undefined'){ adminViewTechId = 't1'; adminRouteStarted = true; } renderHomeList();");
      const order = listOf(d);
      check(file + ': a job sits under its customer\u2019s service that day',
            order.indexOf('job:Alpha One \u2013 Check seal') === order.indexOf('service:a') + 1, order.join(' | '));
      check(file + ': a job whose customer isn\u2019t serviced that day goes at the bottom',
            order[order.length - 1] === 'job:Wendy Other \u2013 Replace cartridge', order.join(' | '));
      check(file + ': and doesn\u2019t bring their service onto the day', order.indexOf('service:w') === -1);
      check(file + ': another technician\u2019s job isn\u2019t shown', !order.some(x => /Someone else/.test(x)));
      check(file + ': a job on another date isn\u2019t shown today', !order.some(x => /Tomorrow job/.test(x)));
      const jobRow = d.querySelector('#homeCustomerList .route-job');
      const text = Array.from(jobRow.children).find(x => !x.classList.contains('route-grip'));
      check(file + ': job rows are gold', /var\(--gold\)/.test(text.getAttribute('style')));
      check(file + ': with the same grip as a customer', !!jobRow.querySelector('.route-grip'));
      check(file + ': an On my way button', Array.from(jobRow.querySelectorAll('button')).some(b => b.textContent === 'On my way'));
      check(file + ': and the arrow styled like a service row\u2019s',
            !jobRow.querySelector('.chev').getAttribute('style') || !/padding/.test(jobRow.querySelector('.chev').getAttribute('style')));
      check(file + ': the jobs count counts every work order and task',
            d.getElementById('homeJobCount').textContent === '2 of 2', d.getElementById('homeJobCount').textContent);
      check(file + ': a job saved in a new place is drawn there',
            (w.eval("fieldRouteOrder[orderKey(selectedHomeDay, isoForDay(selectedHomeDay))] = ['job:work order:w1', 'a', 'b']; renderHomeList();"),
             listOf(d)[0] === 'job:Wendy Other \u2013 Replace cartridge'), listOf(d).join(' | '));
      w.eval("fieldRouteOrder = {}; renderHomeList();");

      // The drop-down and the job page
      await wait(500);
      d.querySelectorAll('#homeCustomerList .route-job')[0].click();
      const brief = d.querySelector('.route-job-brief');
      check(file + ': a job opens with the customer\u2019s details',
            !!brief && /1 A St/.test(brief.textContent) && /555-0101/.test(brief.textContent) && /4321/.test(brief.textContent)
            && /Rex/.test(brief.textContent) && /Drips overnight/.test(brief.textContent), brief ? brief.textContent.slice(0, 80) : '');
      check(file + ': with Directions and Start job',
            Array.from(brief.querySelectorAll('button')).map(b => b.textContent).join('|') === 'Directions|Start job');
      w.eval("captureFromCamera = async ()=> 'data:image/jpeg;base64,job';");
      Array.from(brief.querySelectorAll('button')).find(b => b.textContent === 'Start job').click();
      await wait(50);
      const page = d.getElementById('jobPage');
      check(file + ': Start job opens the job page', !!page && /Submit task/.test(page.textContent));
      Array.from(page.querySelectorAll('button')).find(b => b.textContent === 'Take photo').click();
      await wait(80);
      const thumb = page.querySelector('img');
      check(file + ': its photo is the small thumbnail', thumb.style.maxWidth === '25%' && thumb.parentElement.style.display === 'flex');
      page.querySelector('textarea').value = 'Tightened it.';
      Array.from(page.querySelectorAll('button')).find(b => /^Submit/.test(b.textContent)).click();
      await wait(150);
      const subs = JSON.parse(w.localStorage.getItem('weir:jobSubmissions') || '[]');
      check(file + ': submitting keeps the notes and photo on this phone',
            subs.length === 1 && subs[0].notes === 'Tightened it.' && !!subs[0].photo && subs[0].date === iso, JSON.stringify(subs).slice(0, 120));
      check(file + ': and takes that job off the route', !listOf(d).some(x => /Check seal/.test(x)));
      check(file + ': the count goes down', d.getElementById('homeJobCount').textContent === '1 of 2', d.getElementById('homeJobCount').textContent);
    }catch(e){ check(file + ': jobs on the route', false, e.message); }
    w.close();

    // Another day's job: only the admin app can start it
    dom = boot(file, jobsSeed());
    await wait(1300);
    w = dom.window; d = w.document;
    try{
      w.eval("currentUser = {id:'t1', name:'Alex', full_access:true}; if(typeof adminViewTechId !== 'undefined'){ adminViewTechId = 't1'; adminRouteStarted = true; }"
        + " selectedHomeDay = '" + DAYS[tomorrow.getDay()] + "'; renderHomeList();");
      await wait(500);
      const row = Array.from(d.querySelectorAll('#homeCustomerList .route-job')).find(r => /Tomorrow job/.test(r.textContent));
      row.click();
      const start = d.querySelector('.route-job-brief .btn-primary');
      if(file === 'admin-readings-app.html'){
        check(file + ': another day\u2019s job can be started here', start.textContent === 'Start job' && !start.disabled);
      } else {
        check(file + ': another day\u2019s job can\u2019t be started here', start.textContent === 'Not today\u2019s job' && start.disabled);
      }
    }catch(e){ check(file + ': another day', false, e.message); }
    w.close();

    // Finishing a service keeps its jobs, and the customer leaves Today at once
    console.log('\n=== ' + file + ': a service report doesn\u2019t touch jobs ===');
    dom = boot(file, jobsSeed({scheduledWorkOrders: [{id:'w3', customerId:'a', technicianId:'t1', date: iso, title:'Fix light', status:'scheduled'}]}));
    await wait(1300);
    w = dom.window; d = w.document;
    w.Element.prototype.scrollIntoView = function(){};
    try{
      w.eval("currentUser = {id:'t1', name:'Alex', full_access:true}; if(typeof adminViewTechId !== 'undefined'){ adminViewTechId = 't1'; adminRouteStarted = true; }"
        + " confirmDialog = ()=>Promise.resolve(true); alertDialog = ()=>Promise.resolve(); attemptAutoSend = async ()=>{}; renderHomeList();");
      const set = (id, v)=>{ const e = d.getElementById(id); if(e){ e.value = v; e.dispatchEvent(new w.Event('input', {bubbles: true})); } };
      w.eval("openVisit('a')"); await wait(400);
      set('pool_chem_chlorine', '3'); set('pool_dose_tabs', '2'); d.getElementById('btnSaveReading').click(); await wait(700);
      set('spa_chem_chlorine', '4'); set('spa_dose_tabs', '1'); d.getElementById('btnSaveSpaReading').click(); await wait(1200);
      const after = listOf(d);
      check(file + ': the serviced customer leaves Today straight away', after.indexOf('service:a') === -1, after.join(' | '));
      check(file + ': their jobs stay on the list', after.some(x => /Check seal/.test(x)) && after.some(x => /Fix light/.test(x)), after.join(' | '));
      // This setup's work orders are only "Fix light", plus the task: two jobs
      check(file + ': and in the count', /^2 of 2$/.test(d.getElementById('homeJobCount').textContent), d.getElementById('homeJobCount').textContent);
    }catch(e){ check(file + ': service and jobs', false, e.message); }
    w.close();

    // The rest of the day's phone changes
    console.log('\n=== ' + file + ': reschedule, extra photos and the skip button ===');
    dom = boot(file, seedFor({chemConfig: {pool: {chemicals: [], dosages: [], customPhotos: [{id:'cp_9', label:'Filter gauge', when:{after:true}, required:true}]},
                                          spa: {chemicals: [], dosages: []}, fountain: {chemicals: [], dosages: []}}}));
    await wait(1300);
    w = dom.window; d = w.document;
    try{
      w.eval("currentUser = {id:'t1', name:'Alex', isAdmin:true}; openRescheduleModal(customers[0]);");
      check(file + ': the reschedule window starts on today', d.getElementById('rsDate').value === w.eval('todayDateStr()'), d.getElementById('rsDate').value);
      d.getElementById('rsCancel').click();

      w.eval("currentVisitCustomerId = null; localStorage.setItem('weir:photoEveryone', JSON.stringify({cp_9: {pool: true}}));"
        + " captureFromCamera = async ()=> 'data:image/jpeg;base64,x'; window.__big = []; openPhotoFullSize = s => window.__big.push(s);"
        + " renderCustomPhotoBlocks('pool', 'after');");
      Array.from(d.querySelectorAll('#customPhotos_pool_after button')).find(b => /Take photo/.test(b.textContent)).click();
      await wait(60);
      const img = d.querySelector('#customPhotos_pool_after img');
      check(file + ': an extra photo shows as a centred thumbnail',
            img.style.maxWidth === '25%' && img.style.minWidth === '96px' && img.parentElement.style.display === 'flex'
            && img.parentElement.style.justifyContent === 'center');
      img.click();
      check(file + ': and tapping it opens it full size', w.eval("window.__big.length") === 1);

      const photos = JSON.parse(w.eval(`JSON.stringify(collectReportPhotos([{label:'Pool', reading:{customPhotos:{cp_9:'data:x', cp_gone:'data:y'}}}]).map(p => p.caption))`));
      check(file + ': the report email labels an extra photo by its name', photos[0] === 'Pool Filter gauge', photos.join(' | '));
      check(file + ': and one whose setup is gone as an extra photo', photos[1] === 'Pool extra photo', photos.join(' | '));

      const skip = d.getElementById('btnPoolSkip');
      check(file + ': Skip this pool is filled red', /background:\s*var\(--rust\)/.test(skip.getAttribute('style')));
      const src = fs.readFileSync(file, 'utf8');
      check(file + ': and sits in the middle of the heading line',
            /head\.style\.gridTemplateColumns = '1fr auto 1fr';/.test(src) && /skipBtn\.style\.justifySelf = 'center'/.test(src));
      check(file + ': a × button is drawn, not typed',
            /function drawCloseMarks\(\)/.test(src) && /button\[data-x-drawn\] > svg/.test(src));
    }catch(e){ check(file + ': reschedule, photos, skip', false, e.message); }
    w.close();
  }
}


// ---- Today's list: jobs as their own items, the job page, the count ----
{
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const todayName = DAYS[new Date().getDay()];
  const otherName = DAYS[(new Date().getDay() + 3) % 7];
  const iso = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const tomorrowIso = new Date(Date.now() + (new Date().getDay() === 6 ? -86400000 : 86400000) - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  for(const file of ['technician-app.html', 'admin-readings-app.html']){
    console.log('\n=== ' + file + ': jobs on Today ===');
    const dom = boot(file, {
      customers: [
        {id: 'a', name: 'Alpha Smith', address: '1 A St', phone: '555 0101', gateCode: '4321', active: true, hasPool: true, hasSpa: true, day: todayName, technicianId: 't1'},
        {id: 'b', name: 'Bravo Jones', address: '2 B St', active: true, hasPool: true, day: todayName, technicianId: 't1'},
        {id: 'w', name: 'Wendy Later', address: '9 W Ln', active: true, hasPool: true, day: otherName, technicianId: 't1'}],
      tasks: [{id: 'k1', title: 'Check seal', details: 'Drips overnight.', technicianId: 't1', date: iso, customerIds: ['a'], done: false},
              {id: 'k2', title: 'Other tech', technicianId: 't2', date: iso, customerIds: ['b'], done: false}],
      scheduledWorkOrders: [{id: 'w1', customerId: 'w', technicianId: 't1', date: iso, title: 'Replace cartridge', notes: 'In the truck.', status: 'scheduled'},
                            {id: 'w2', customerId: 'b', technicianId: 't1', date: tomorrowIso, title: 'Tomorrow job', status: 'scheduled'}],
      chemConfig: {pool: {chemicals: [{key: 'chlorine', label: 'Chlorine'}], dosages: [{key: 'tabs', label: 'Tabs'}]},
                   spa: {chemicals: [{key: 'chlorine', label: 'Chlorine'}], dosages: [{key: 'tabs', label: 'Tabs'}]},
                   fountain: {chemicals: [], dosages: []}}});
    await wait(1300);
    const w = dom.window, d = w.document;
    w.Element.prototype.scrollIntoView = function(){};
    try{
      w.eval("currentUser = {id: 't1', name: 'Pat', full_access: true, canReorderRoute: true};"
        + " if(typeof adminViewTechId !== 'undefined'){ adminViewTechId = 't1'; adminRouteStarted = true; }"
        + " captureFromCamera = async ()=> 'data:image/jpeg;base64,job'; attemptAutoSend = async ()=>{};"
        + " confirmDialog = ()=> Promise.resolve(true); alertDialog = ()=> Promise.resolve(); window.__heads = [];"
        + " dispatchHeadsUp = c => window.__heads.push(c.name); selectedHomeDay = '" + todayName + "'; switchView('home'); renderHomeList();");
      await wait(450);   // past the app's guard against a stray tap after a screen change
      const list = () => Array.from(d.getElementById('homeCustomerList').children).map(r =>
        r.classList.contains('route-job') ? 'job:' + Array.from(r.children).find(x => !x.classList.contains('route-grip')).textContent
        : (r.classList.contains('cust-row') ? 'svc:' + r.querySelector('.cust-name').textContent.trim() : ''))
        .filter(Boolean);
      const order = list();
      check(file + ': a job sits under its customer\u2019s service that day', order.indexOf('job:Alpha Smith \u2013 Check seal') === order.indexOf('svc:Alpha Smith') + 1, order.join(' | '));
      check(file + ': a job whose customer isn\u2019t serviced that day goes at the bottom', order[order.length - 1] === 'job:Wendy Later \u2013 Replace cartridge', order.join(' | '));
      check(file + ': and never brings their service onto the day', order.indexOf('svc:Wendy Later') === -1);
      check(file + ': another technician\u2019s task is not shown', !order.some(x => /Other tech/.test(x)));
      check(file + ': a job on another date is not shown', !order.some(x => /Tomorrow job/.test(x)));
      check(file + ': the jobs count counts every job', d.getElementById('homeJobCount').textContent === '2 of 2', d.getElementById('homeJobCount').textContent);
      const jobRow = Array.from(d.querySelectorAll('#homeCustomerList .route-job')).find(r => /Check seal/.test(r.textContent));
      check(file + ': a job row has the grip for rearranging', !!jobRow.querySelector('.route-grip'));
      const onWay = Array.from(jobRow.querySelectorAll('button')).find(b => b.textContent === 'On my way');
      onWay.click();
      check(file + ': On my way on a job goes to its customer', w.eval("window.__heads.join()") === 'Alpha Smith');
      check(file + ': the job\u2019s arrow matches a service row\u2019s', jobRow.querySelector('.chev').getAttribute('style') === 'color: var(--gold);' || jobRow.querySelector('.chev').style.padding === '',
            jobRow.querySelector('.chev').getAttribute('style'));

      // The drop-down and the job page
      jobRow.click(); await wait(50);
      const brief = d.querySelector('.route-job-brief');
      check(file + ': the job opens to the customer\u2019s details', !!brief && /12|1 A St/.test(brief.textContent) && /4321/.test(brief.textContent) && /Drips overnight/.test(brief.textContent));
      const start = Array.from(brief.querySelectorAll('button')).find(b => /Start job/.test(b.textContent));
      check(file + ': with Directions and Start job', !!start && Array.from(brief.querySelectorAll('button')).some(b => b.textContent === 'Directions'));
      start.click(); await wait(50);
      const page = d.getElementById('jobPage');
      check(file + ': Start job opens the job page', !!page && /Check seal/.test(page.textContent));
      Array.from(page.querySelectorAll('button')).find(b => b.textContent === 'Take photo').click(); await wait(60);
      const thumb = page.querySelector('img');
      check(file + ': the job photo is a thumbnail', thumb.style.maxWidth === '25%' && thumb.parentElement.style.display === 'flex');
      page.querySelector('textarea').value = 'Tightened it.';
      Array.from(page.querySelectorAll('button')).find(b => /^Submit/.test(b.textContent)).click(); await wait(300);
      const saved = JSON.parse(w.localStorage.getItem('weir:jobSubmissions') || '[]');
      check(file + ': submitting keeps the notes and photo, dated for the job', saved.length === 1 && saved[0].notes === 'Tightened it.' && !!saved[0].photo && saved[0].date === iso, JSON.stringify(saved));
      check(file + ': the job leaves the list and the count goes down', !list().some(x => /Check seal/.test(x)) && d.getElementById('homeJobCount').textContent === '1 of 2',
            d.getElementById('homeJobCount').textContent);

      // Servicing a customer never touches their jobs, and they leave Today at once
      w.eval("localStorage.setItem('weir:tasks', JSON.stringify([{id:'k3',title:'Swap valve',technicianId:'t1',date:'" + iso + "',customerIds:['a'],done:false}])); renderHomeList();");
      w.eval("openVisit('a')"); await wait(400);
      const set = (id, v)=>{ const e = d.getElementById(id); if(e){ e.value = v; e.dispatchEvent(new w.Event('input', {bubbles: true})); } };
      set('pool_chem_chlorine', '3'); set('pool_dose_tabs', '1'); d.getElementById('btnSaveReading').click(); await wait(700);
      set('spa_chem_chlorine', '3'); set('spa_dose_tabs', '1'); d.getElementById('btnSaveSpaReading').click(); await wait(1200);
      const after = list();
      check(file + ': a finished customer leaves Today straight away', after.indexOf('svc:Alpha Smith') === -1, after.join(' | '));
      check(file + ': but their job stays until it\u2019s submitted', after.some(x => /Swap valve/.test(x)), after.join(' | '));

      // A job dated another day
      w.eval("selectedHomeDay = '" + DAYS[new Date(Date.now() + (new Date().getDay() === 6 ? -86400000 : 86400000)).getDay()] + "'; renderHomeList();"); await wait(450);
      const tRow = Array.from(d.querySelectorAll('#homeCustomerList .route-job')).find(r => /Tomorrow job/.test(r.textContent));
      tRow.click(); await wait(50);
      const tStart = d.querySelector('.route-job-brief .btn-primary');
      if(file === 'technician-app.html'){
        check(file + ': a job on another day can\u2019t be started', tStart.disabled && /Not today/.test(tStart.textContent));
      } else {
        check(file + ': the admin app can start a job on any day', !tStart.disabled && tStart.textContent === 'Start job');
      }

      // Reschedule starts on today
      w.eval("openRescheduleModal(customers.find(c => c.id === 'b'));");
      check(file + ': Reschedule\u2019s New date starts on today', d.getElementById('rsDate').value === w.eval('todayDateStr()'));

      // The Skip button is red, and extra photos are thumbnails and named in the email
      const skip = d.getElementById('btnPoolSkip');
      check(file + ': Skip this pool is filled red', /var\(--rust\)/.test(skip.getAttribute('style')));
      w.eval("localStorage.setItem('weir:chemConfig', JSON.stringify({pool:{chemicals:[],dosages:[],customPhotos:[{id:'cp_9',label:'Filter gauge',when:{after:true},required:true}]},spa:{chemicals:[],dosages:[]},fountain:{chemicals:[],dosages:[]}})); chemConfig = JSON.parse(localStorage.getItem('weir:chemConfig'));"
        + " localStorage.setItem('weir:photoEveryone', JSON.stringify({cp_9:{pool:true}})); currentVisitCustomerId = null; renderCustomPhotoBlocks('pool','after');");
      Array.from(d.querySelectorAll('#customPhotos_pool_after button')).find(b => /Take photo/.test(b.textContent)).click(); await wait(60);
      const eImg = d.querySelector('#customPhotos_pool_after img');
      check(file + ': an extra photo shows as a thumbnail', eImg.style.maxWidth === '25%' && eImg.parentElement.style.display === 'flex');
      const caps = JSON.parse(w.eval("JSON.stringify(collectReportPhotos([{label:'Pool', reading:{customPhotos:{cp_9:'data:x', cp_gone:'data:y'}}}]).map(p => p.caption))"));
      check(file + ': the email labels an extra photo with its name', caps[0] === 'Pool Filter gauge' && caps[1] === 'Pool extra photo', JSON.stringify(caps));
    }catch(e){ check(file + ': jobs on Today', false, e.message); }
    w.close();
  }
}


// ---- Admin app: route order, Just today / Every week, and the website ----
{
  console.log('\n=== admin-readings-app.html: route order and the website ===');
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const day = DAYS[new Date().getDay()];
  const custs = [['a','Alpha'],['b','Bravo'],['c','Charlie'],['d','Delta']].map(([id, n], k) =>
    ({id, name: n, address: k + ' Main', active: true, hasPool: true, day, routeId: 'r1', technicianId: 't1'}));
  custs.push({id: 'h', name: 'Hidden', address: '9 Main', active: true, hasPool: true, day, routeId: 'r1', technicianId: 't9'});
  custs.push({id: 'z', name: 'Zed', address: '8 Main', active: true, hasPool: true, day, routeId: 'r2', technicianId: 't2'});
  const start = async ()=>{
    const dom = boot('admin-readings-app.html', {customers: custs,
      routeOrders: {[day]: {r1: ['a','b','h','c','d'], r2: ['z']}}});
    await wait(1300);
    const w = dom.window, d = w.document;
    w.eval("currentUser = {id: 't1', name: 'Pat', full_access: true, canReorderRoute: true, isAdmin: true};"
      + " adminViewTechId = 't1'; adminRouteStarted = true; confirmDialog = ()=> Promise.resolve(true);"
      + " window.__sent = []; fieldAuthed = async (path, o)=>{ window.__sent.push(JSON.parse(o.body)); return window.__reply || {ok: true, status: 200, body: {result: 'saved'}}; };"
      + " selectedHomeDay = '" + day + "'; switchView('home'); renderHomeList();");
    await wait(450);
    return {w, d, order: () => Array.from(d.querySelectorAll('#homeCustomerList .cust-row')).map(r => r.dataset.reorderKey).join(''),
            company: () => JSON.parse(w.localStorage.getItem('weir:routeOrders'))[day]};
  };
  // What a drag does when it's let go: the same as the page's own drag
  const drop = (w, ids) => w.eval("fieldRouteOrder[orderKey(selectedHomeDay, isoForDay(selectedHomeDay))] = " + JSON.stringify(ids)
    + "; saveFieldRouteOrder(); orderBeforeDrag = ['a','b','c','d']; showOrderBanner(" + JSON.stringify(ids) + ");");
  try{
    let {w, d, order, company} = await start();
    check('the admin app opens in the company\u2019s route order', order() === 'abcd', order());
    const src = fs.readFileSync('admin-readings-app.html', 'utf8');
    check('a drag shows the Just today / Every week bar', /fieldRouteOrder\[orderKey\(selectedHomeDay, isoForDay\(selectedHomeDay\)\)\] = ids;\s*saveFieldRouteOrder\(\);\s*showOrderBanner\(ids\);/.test(src));

    // Just today
    drop(w, ['b','c','d','a']);
    d.getElementById('orderTempBtn').click(); await wait(150);
    check('Just today keeps the new order on the phone', order() === 'bcda', order());
    check('and leaves the company\u2019s route order alone', company().r1.join('') === 'abhcd' && w.eval("window.__sent.length") === 0, company().r1.join(''));
    w.eval("localStorage.setItem('weir:routeOrders', JSON.stringify({'" + day + "': {r1: ['d','c','b','a','h'], r2: ['z']}})); renderHomeList();");
    check('today\u2019s own order wins for today over a change from the website', order() === 'bcda', order());
    w.close();

    // Every week
    ({w, d, order, company} = await start());
    drop(w, ['c','a','job:work order:w1','b','d']);
    d.getElementById('orderPermBtn').click(); await wait(200);
    // Saved per technician now: the old named route is turned into technicians' routes
    check('Every week makes it the company\u2019s route order, under the technician', (company().t1 || []).join('') === 'cabd', JSON.stringify(company()));
    check('anyone on another technician\u2019s route keeps their place, and no named route is left beside them',
          (company().t9 || []).join('') === 'h' && (company().t2 || []).join('') === 'z' && !company().r1 && !company().r2);
    const sent = JSON.parse(w.eval("JSON.stringify(window.__sent)"));
    check('and sends it to the office as the setup record the website reads',
          sent.length === 1 && sent[0].p_kind === 'setup' && sent[0].p_id === 'routeOrders' && (sent[0].p_changes.value.v[day].t1 || []).join('') === 'cabd');
    check('jobs are left out of route scheduling', !JSON.stringify(company()).includes('job:'));
    check('nothing is left waiting once it\u2019s gone', !JSON.parse(w.localStorage.getItem('weir:routeOrdersToSend')));
    w.eval("localStorage.setItem('weir:routeOrders', JSON.stringify({'" + day + "': {r1: ['d','c','b','a','h'], r2: ['z']}})); renderHomeList();");
    check('afterwards the admin app follows a change made on the website', order() === 'dcba', order());
    // No signal: held and sent with the next sync
    w.eval("window.__reply = {ok: false, status: 0, body: null, offline: true};");
    drop(w, ['a','b','c','d']); d.getElementById('orderPermBtn').click(); await wait(200);
    check('with no signal it\u2019s held', !!JSON.parse(w.localStorage.getItem('weir:routeOrdersToSend')));
    w.eval("window.__reply = null;"); await w.eval("pushCompanyRouteOrder()");
    check('and sent once there\u2019s signal', !JSON.parse(w.localStorage.getItem('weir:routeOrdersToSend')));
    check('every sync tries anything waiting', /await pushCompanyRouteOrder\(\);\s*\n\s*\/\/ Tasks ticked off and visits moved here/.test(src));
    w.close();

    // Remove changes
    ({w, d, order, company} = await start());
    drop(w, ['b','c','d','a']);
    d.getElementById('orderCloseBtn').click(); await wait(150);
    check('Remove changes puts the route back', order() === 'abcd' && w.eval("window.__sent.length") === 0, order());
    w.eval("localStorage.setItem('weir:routeOrders', JSON.stringify({'" + day + "': {r1: ['d','c','b','a','h'], r2: ['z']}})); renderHomeList();");
    check('and it goes back to following the website', order() === 'dcba', order());
    w.close();

    // The technician app keeps a technician\u2019s order to their own phone
    const tech = fs.readFileSync('technician-app.html', 'utf8');
    check('the technician app never changes the company\u2019s route order', !/saveCompanyRouteOrder|pushCompanyRouteOrder/.test(tech));
  }catch(e){ check('admin route order', false, e.message); }

  // Dragging: side by side only when items really sit on one line
  for(const file of ['technician-app.html', 'admin-readings-app.html', 'customer-intake.html']){
    const src = fs.readFileSync(file, 'utf8');
    check(file + ': a wide list row is treated as a list row, so the last place can be reached',
          src.indexOf('const horizontal = sideBySide;') !== -1 && src.indexOf('b.width > b.height * 1.6') === -1);
  }
  // The website redraws its route scheduling when an order arrives from a phone
  check('the website redraws route scheduling when a new order arrives',
        /routeOrders = lsGet\('routeOrders'\) \|\| \{\};[\s\S]{0,300}renderRoutesList\(\)/.test(fs.readFileSync('customer-intake.html', 'utf8')));
}


// ---- Sept 25: the phones ----
{
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const day = DAYS[new Date().getDay()], other = DAYS[(new Date().getDay() + 3) % 7];
  const iso = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const chem = {pool: {chemicals: [{key: 'chlorine', label: 'Chlorine'}], dosages: [{key: 'tabs', label: 'Tabs'}]},
                spa: {chemicals: [{key: 'chlorine', label: 'Chlorine'}], dosages: [{key: 'tabs', label: 'Tabs'}]}, fountain: {chemicals: [], dosages: []}};
  for(const file of ['technician-app.html', 'admin-readings-app.html']){
    console.log('\n=== ' + file + ': Sept 25 ===');
    const dom = boot(file, {
      customers: [
        {id: 'a', name: 'Alpha', address: '1 A St', active: true, hasPool: true, hasSpa: true, day, technicianId: 't1'},
        {id: 'e', name: 'Extra Day', active: true, hasPool: true, day: other, extraDays: [day], technicianId: 't1'},
        {id: 'z', name: 'Zed (Sam)', active: true, hasPool: true, day: other, technicianId: 't2'},
        {id: 'v', name: 'Visit Test', active: true, hasPool: true, hasSpa: true, day: other, technicianId: 't1'}],
      rescheduledVisits: [{id: 'r1', customerId: 'z', fromDate: '2026-01-01', toDate: iso}],
      routeOrders: {[day]: {r1: ['a', 'e'], t1: ['e', 'a']}},
      tasks: [{id: 'k1', title: 'Pick up chlorine', technicianId: 't1', date: iso, customerIds: [], done: false, photoRequired: true}],
      scheduledWorkOrders: [{id: 'j1', workOrderId: 'wo1', customerId: 'a', technicianId: 't1', date: iso, title: 'Fix light', status: 'scheduled'}],
      chemConfig: chem});
    await wait(1300);
    const w = dom.window, d = w.document;
    w.Element.prototype.scrollIntoView = function(){};
    try{
      w.eval("currentUser = {id: 't1', name: 'Pat', full_access: true, isAdmin: true, canReorderRoute: true};"
        + " if(typeof adminViewTechId !== 'undefined'){ adminViewTechId = 't1'; adminRouteStarted = true; }"
        + " captureFromCamera = async ()=> 'data:image/jpeg;base64,x'; attemptAutoSend = async ()=>{}; window.__asked = [];"
        + " confirmDialog = (m)=>{ window.__asked.push(m); return Promise.resolve(true); }; alertDialog = ()=> Promise.resolve();"
        + " fieldAuthed = async ()=>({ok: true, status: 200, body: {result: 'saved'}});"
        + " selectedHomeDay = '" + day + "'; switchView('home'); renderHomeList();");
      await wait(450);
      const names = () => Array.from(d.querySelectorAll('#homeCustomerList .cust-row .cust-name')).map(x => x.textContent.trim());
      const today = names();
      check(file + ': a customer shows once, never copied by an old route order beside a technician\u2019s', today.filter(n => n === 'Alpha').length === 1, today.join(','));
      check(file + ': an extra service day puts the customer on that day too', today.indexOf('Extra Day') !== -1);
      check(file + ': another technician\u2019s rescheduled customer isn\u2019t on this route', today.indexOf('Zed (Sam)') === -1);
      check(file + ': the order comes from the technician\u2019s route', today[0] === 'Extra Day', today.join(','));
      // A task with no customer is a row, and a required photo must be taken
      const loose = Array.from(d.querySelectorAll('#homeCustomerList .route-job')).find(r => /Pick up chlorine/.test(r.textContent));
      check(file + ': a task with no customer is a row on the day', !!loose && !(d.getElementById('routeTaskCard') && d.getElementById('routeTaskCard').style.display === 'block'));
      loose.click(); await wait(40);
      Array.from(d.querySelectorAll('.route-job-brief button')).find(b => /Start job/.test(b.textContent)).click(); await wait(40);
      const page = d.getElementById('jobPage');
      check(file + ': its page marks the photo Required', /Photo \u00b7 Required/.test(page.textContent));
      Array.from(page.querySelectorAll('button')).find(b => /^Submit/.test(b.textContent)).click(); await wait(80);
      check(file + ': it won\u2019t submit without the photo', !!d.getElementById('jobPage'));
      Array.from(page.querySelectorAll('button')).find(b => b.textContent === 'Take photo').click(); await wait(60);
      page.querySelector('textarea').value = 'Two buckets.';
      Array.from(page.querySelectorAll('button')).find(b => /^Submit/.test(b.textContent)).click(); await wait(200);
      const k1 = (JSON.parse(w.localStorage.getItem('weir:tasks')) || [])[0];
      check(file + ': submitting marks the task done with the notes, for the office', k1.done === true && k1.doneBy === 't1' && k1.doneNotes === 'Two buckets.');
      // A work order visit, the same
      await wait(450);
      const woRow = Array.from(d.querySelectorAll('#homeCustomerList .route-job')).find(r => /Fix light/.test(r.textContent));
      woRow.click(); await wait(40);
      Array.from(d.querySelectorAll('.route-job-brief button')).find(b => /Start job/.test(b.textContent)).click(); await wait(40);
      d.getElementById('jobPage').querySelector('textarea').value = 'New bulb.';
      Array.from(d.getElementById('jobPage').querySelectorAll('button')).find(b => /^Submit/.test(b.textContent)).click(); await wait(200);
      const j1 = (JSON.parse(w.localStorage.getItem('weir:scheduledWorkOrders')) || [])[0];
      check(file + ': submitting a work order visit marks it done with the notes', j1.status === 'done' && j1.doneNotes === 'New bulb.');
      const sends = JSON.parse(w.eval("(()=>{ const st={work:{known:{},seen:{},edits:{},refused:{}}}; syncScanWork(st, '2026-09-25T12:00:00Z'); return JSON.stringify(Object.keys(st.work.edits).reduce((o,k)=>{ o[k.replace('\\u0002',':')]=Object.keys(st.work.edits[k]).sort(); return o; },{})); })()"));
      check(file + ': and sends only what snippet 16 allows', JSON.stringify(sends['task:k1']) === '["done","doneAt","doneBy","doneNotes"]'
            && JSON.stringify(sends['work_order:j1']) === '["doneAt","doneBy","doneNotes","status"]', JSON.stringify(sends));
      // Every week, part of the day done: only those on screen swap places
      check(file + ': Every week partway through a day keeps the rest in place',
            w.eval("mergeVisibleOrder('ABCDEFGHIJKLMNOP'.split(''), ['P','M','N','O']).join('')") === 'ABCDEFGHIJKLPMNO');
      // Leaving Today closes an open row
      await wait(450);
      d.querySelector('#homeCustomerList .cust-row').click(); await wait(30);
      w.eval("switchView('options'); switchView('home');");
      check(file + ': leaving Today closes an open row', !d.querySelector('.route-brief'));
      // On my way has its heading
      w.eval("askHeadsUpWay({id:'a', name:'Alpha', email:'a@x.com', phone:'5550101'})");
      const hu = Array.from(d.querySelectorAll('.confirm-overlay')).pop();
      check(file + ': the On my way window has its heading', !!hu && hu.querySelector('h2') && hu.querySelector('h2').textContent === 'On my way');
      hu.remove();
      // An extra photo limited to some customers
      w.eval("chemConfig.pool.customPhotos = [{id:'cp1', label:'Heater', when:{after:true}, required:true, customerIds:['e']}];");
      check(file + ': a photo for chosen customers is asked at theirs only',
            w.eval("currentVisitCustomerId='e'; customPhotosFor('pool').length") === 1 && w.eval("currentVisitCustomerId='a'; customPhotosFor('pool').length") === 0);
      w.eval("chemConfig.pool.customPhotos = []; currentVisitCustomerId = null;");
      // The start and finish are saved on the visit's reports
      w.eval("visitLocation = {customerId: 'a', start: {lat: 33.45, lng: -112.58, acc: 8, at: '2026-09-25T15:00:00Z'}, end: {lat: 33.4502, lng: -112.5801, acc: 9, at: '2026-09-25T15:20:00Z'}};"
        + " localStorage.setItem('weir:visitPackage:a', JSON.stringify({sections: {pool: {id: 'rp1', date: '2026-09-25T15:20:00Z'}}}));");
      await w.eval("commitVisitPackage('a')");
      const rp = JSON.parse(w.eval("JSON.stringify((JSON.parse(localStorage.getItem('weir:readings:a')) || []).find(r => r.id === 'rp1') || null)"));
      check(file + ': the start and finish are saved on the report', !!rp && rp.visitLocation && rp.visitLocation.start.lat === 33.45 && rp.visitLocation.end.lat === 33.4502, JSON.stringify(rp));
      const src = fs.readFileSync(file, 'utf8');
      check(file + ': the finish is always a fresh position', /maximumAge: kind === 'end' \? 0 : 60000/.test(src));
      check(file + ': the map is never in the customer\u2019s email', src.slice(src.indexOf('function buildReportEmailHtml'), src.indexOf('function buildReportEmailHtml') + 8000).indexOf('visitLocation') === -1);
      // Return to route clears the whole report, and the last page has Back
      w.eval("openVisit('v')"); await wait(400);
      w.eval("goToVisitStep(visitStepCardsFor('pool').length)"); await wait(80);
      check(file + ': the last page has Back when no after photo is asked for', !!d.querySelector('#visitPoolSaveSection .step-back'));
      w.eval("goToVisitStep(1)"); await wait(80);
      await w.eval("skipBodyOfWater('pool')"); await wait(300);
      const spa = d.getElementById('spa_chem_chlorine'); spa.value = '4'; spa.dispatchEvent(new w.Event('input', {bubbles: true}));
      await wait(450);
      d.querySelector('.step-back').click(); await wait(400);
      w.eval("openVisit('v')"); await wait(400);
      check(file + ': Return to route cancels the whole report, a skipped body included',
            d.getElementById('spa_chem_chlorine').value === '' && w.eval("!(pendingVisit && pendingVisit.doneSections && pendingVisit.doneSections.pool)"));
      if(file === 'admin-readings-app.html'){
        check(file + ': Save report waits for the photo requirements', /const photosReady = !owing && !\(submitBtn && submitBtn\.disabled\);/.test(src));
      }
    }catch(e){ check(file + ': Sept 25', false, e.message); }
    w.close();
  }
  check('Android keeps Weir upright', JSON.parse(fs.readFileSync('manifest.json', 'utf8')).orientation === 'portrait');
}


// ---- A customer on two days: each day's visit on its own ----
{
  console.log('\n=== two days, each its own visit ===');
  for(const file of ['technician-app.html', 'admin-readings-app.html']){
    const dom = boot(file, {customers: [{id: 'j', name: 'John Tyler', active: true, hasPool: true, day: 'Wednesday', extraDays: ['Thursday'], technicianId: 't1'}]});
    await wait(1300);
    const w = dom.window, d = w.document;
    try{
      const wed = w.eval("isoForDay('Wednesday')"), thu = w.eval("isoForDay('Thursday')");
      const shows = day => { w.eval("currentUser={id:'t1',name:'Pat',full_access:true,isAdmin:true}; if(typeof adminViewTechId!=='undefined'){adminViewTechId='t1';} selectedHomeDay='" + day + "'; renderHomeList();");
        return /John Tyler/.test(d.getElementById('homeCustomerList').textContent); };
      // Serviced for Thursday (as a finished visit records it)
      w.eval("visitRouteDay = '" + thu + "'; const c = customers[0]; c.lastServicedDate = todayDateStr(); noteServicedFor(c);");
      check(file + ': servicing one day\u2019s visit keeps the other day', shows('Wednesday') && !shows('Thursday'));
      await w.eval("reserviceCustomer(customers[0])");
      check(file + ': Reservice brings back only that day', shows('Wednesday') && shows('Thursday'));
      // A weekly customer caught up on a day that isn't theirs is done for the missed day
      w.eval("customers[0].extraDays = []; customers[0].servicedFor = [{day: '" + thu + "', on: '" + thu + "'}];");
      check(file + ': a catch-up on another day still clears the missed day', !shows('Wednesday'));
    }catch(e){ check(file + ': two days', false, e.message); }
    w.close();
  }
}


// ---- Skip service acts like a submitted report ----
{
  console.log('\n=== skip service ===');
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const today = DAYS[new Date().getDay()], other = DAYS[new Date().getDay() === 0 ? 1 : new Date().getDay() - 1];
  for(const [file, SKIP, KEEP] of [['technician-app.html', today, other], ['admin-readings-app.html', 'Wednesday', 'Thursday']]){
    const dom = boot(file, {settings: {requireSkipReason: false, requireSkipPhoto: false},
      customers: [{id: 'j', name: 'John Tyler', active: true, hasPool: true, day: SKIP, extraDays: [KEEP], technicianId: 't1'}]});
    await wait(1300);
    const w = dom.window, d = w.document;
    try{
      w.eval("currentUser={id:'t1',name:'Pat',full_access:true,isAdmin:true}; if(typeof adminViewTechId!=='undefined'){adminViewTechId='t1'; adminRouteStarted=true;} confirmDialog=()=>Promise.resolve(true); alertDialog=()=>Promise.resolve();");
      const on = day => { w.eval("selectedHomeDay='" + day + "'; renderHomeList();"); return /John Tyler/.test(d.getElementById('homeCustomerList').textContent); };
      w.eval("selectedHomeDay='" + SKIP + "'; renderHomeList();");
      await w.eval("skipService(customers[0])"); await wait(200);
      check(file + ': a skip takes the customer off the skipped day', !on(SKIP));
      check(file + ': but not off their other day', on(KEEP));
      check(file + ': and puts them under Serviced today', w.eval("customers[0].lastServicedDate") === w.eval("todayDateStr()"));
      await w.eval("reserviceCustomer(customers[0])");
      check(file + ': Reservice brings back the skipped day', on(SKIP));
    }catch(e){ check(file + ': skip service', false, e.message); }
    w.close();
  }
}

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
  process.exit(fail ? 1 : 0);
})();
