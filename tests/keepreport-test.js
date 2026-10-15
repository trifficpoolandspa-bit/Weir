require('./phone-app.js');
// Oct 14: Tyrus took an after photo, turned the phone off, and it was gone.
// Leaving for another tab or another app keeps a report as it was; if the phone
// closes the app meanwhile, the report (photos too) comes back on opening.
let pass = 0, fail = 0;
function check(name, ok, detail){ if(ok){ pass++; console.log('  PASS  ' + name); } else { fail++; console.log('  FAIL  ' + name + (detail ? '  — ' + detail : '')); } }
require('fake-indexeddb/auto');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const today = DAYS[new Date().getDay()];
const seed = {technicians:[{id:'t1',name:'Alex'}], customers:[{id:'a',name:'Alpha One',day:today,active:true,technicianId:'t1',hasPool:true}],
  afterPhotoDefaultFixed:true, chemConfig:{pool:{chemicals:[{key:'chlorine',label:'Free chlorine'}],dosages:[]},spa:{chemicals:[],dosages:[]},fountain:{chemicals:[],dosages:[]}}};
let ls = null;
function boot(file){
  return new JSDOM(fs.readFileSync(file,'utf8'), {runScripts:'dangerously', pretendToBeVisual:true, url:'https://example.com/'+file,
    beforeParse(w){
      w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
      w.scrollTo=()=>{}; w.scrollBy=()=>{}; w.alert=()=>{};
      w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){},fillRect(){}});
      w.console.warn=()=>{}; w.console.error=()=>{};
      w.indexedDB = global.indexedDB; w.IDBKeyRange = global.IDBKeyRange;
      if(ls){ Object.keys(ls).forEach(k=> w.localStorage.setItem(k, ls[k])); }
      else { w.localStorage.setItem('weir:photoEveryone','{}'); Object.keys(seed).forEach(k=> w.localStorage.setItem('weir:'+k, JSON.stringify(seed[k]))); }
    }});
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const P = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4TBYAAAAvAAAAAAfQ//73v/+BiOh/AAA=';
(async()=>{
 for(const file of ['technician-app.html','admin-readings-app.html']){
  ls=null;
  let dom = boot(file); await wait(1400);
  let w = dom.window, d = w.document;
  const hasPhoto = ()=> !!w.eval("poolPhotoController.getData()");
  w.eval("currentUser={id:'t1',name:'Alex'}; confirmDialog=()=>Promise.resolve(true); alertDialog=()=>Promise.resolve(); renderHomeList(); openVisit('a');");
  await wait(500);
  w.eval("poolPhotoController.setData('"+P+"');"); await wait(200);
  const set=(id,v)=>{const e=d.getElementById(id); if(e){e.value=v; e.dispatchEvent(new w.Event('input',{bubbles:true}));}};
  set('pool_chem_chlorine','3.3');
  console.log('\n=== ' + file + ': a report survives the screen going off and the app being closed ===');
  check('the after photo is taken', hasPhoto());
  const vis = h => { Object.defineProperty(d,'hidden',{configurable:true,get:()=>h}); Object.defineProperty(d,'visibilityState',{configurable:true,get:()=>h?'hidden':'visible'}); d.dispatchEvent(new w.Event('visibilitychange')); };
  vis(true); await wait(300); vis(false); await wait(800);
  check('screen off and on: the photo is still there', hasPhoto() && w.eval('currentViewName') === 'visit');
  for(const v of ['customers','serviced','report','options']){
    try{ w.eval("switchView('"+v+"')"); }catch(e){}
    await wait(300);
    vis(true); await wait(200); vis(false); await wait(500);
    try{ w.eval("document.querySelector('.tab[data-view=\"home\"]').click()"); }catch(e){ console.log('tab click err', e.message); }
    await wait(700);
    check('away to ' + v + ' and the app put away, then Today: the photo is still there', hasPhoto() && w.eval('currentViewName') === 'visit');
  }
  // OS kills the app while off: reload with the same storage
  ls = {}; for(let i=0;i<w.localStorage.length;i++){ const k=w.localStorage.key(i); ls[k]=w.localStorage.getItem(k); }
  w.dispatchEvent(new w.Event('pagehide'));
  dom.window.close();
  dom = boot(file); await wait(1600); w = dom.window; d = w.document;
  try{ w.eval("currentUser={id:'t1',name:'Alex'}; confirmDialog=()=>Promise.resolve(true); alertDialog=()=>Promise.resolve(); restoreVisitInProgress().then(r=>{window.__r=r});"); }catch(e){ console.log('err',e.message); }
  await wait(1200);
  check('after the phone closed the app, opening it brings the report back', w.eval('window.__r') === true && w.eval('currentViewName') === 'visit');
  check('with the after photo', hasPhoto());
  check('and what was typed', (d.getElementById('pool_chem_chlorine')||{}).value === '3.3');
  // Cancelling the report lets it go: nothing comes back next time
  // As Cancel report does: the report thrown away, and back to Today
  await w.eval("discardVisitInProgress().then(()=>{ visitDraft = {customerId: null, values: {}, section: null, step: 1}; forgetVisitInProgress(); visitLeftOpenFor = null; switchView('home'); })");
  await wait(300);
  const vis2 = h => { Object.defineProperty(d,'hidden',{configurable:true,get:()=>h}); d.dispatchEvent(new w.Event('visibilitychange')); };
  vis2(true); await wait(300); vis2(false); await wait(2300);
  const again = await w.eval("vipDo('readonly', st => st.get('current'))");
  check('once the report is finished with, it is let go', !again);
  dom.window.close();
 }
 console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
 process.exit(fail ? 1 : 0);
})();
