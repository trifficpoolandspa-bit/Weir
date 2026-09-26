// Email sending is asynchronous, so it runs in its own process where each
// send can be awaited properly.
require('fake-indexeddb/auto');
const { JSDOM } = require('jsdom');
const fs = require('fs');

let pass = 0, fail = 0;
function check(name, ok, detail){
  if(ok){ pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  — ' + detail : '')); }
}

const seed = {
  companyName: 'Blue Water Pools',
  customers: [
    {id:'a', name:'Alpha One', active:true, email:'alpha@x.com'},
    {id:'b', name:'Bravo Two', active:true, email:'bravo@x.com'},
    {id:'c', name:'Charlie Three', active:true, email:''}
  ],
  filterGroups: [
    {id:'g1', name:'Tuesday north', customerIds:['a','b','c'], date:'2026-09-22'},
    {id:'g2', name:'Thursday south', customerIds:['b'], date:'2026-10-06'}
  ]
};

function boot(){
  return new JSDOM(fs.readFileSync('customer-intake.html','utf8'), {
    runScripts:'dangerously', pretendToBeVisual:true, url:'https://example.com/',
    beforeParse(w){
      // A company that has not ticked any photo for Everyone. New companies start
      // with the pool after photo required; that start is tested on its own.
      w.localStorage.setItem('weir:photoEveryone', '{}');
      w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
      w.scrollTo=()=>{}; w.scrollBy=()=>{}; w.alert=()=>{};
      w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){},fillRect(){}});
      w.console.warn=()=>{};
      w.Element.prototype.scrollIntoView=function(){};
      w.indexedDB = global.indexedDB; w.IDBKeyRange = global.IDBKeyRange;
      Object.keys(seed).forEach(k=> w.localStorage.setItem('weir:'+k, JSON.stringify(seed[k])));
    }
  });
}

(async ()=>{
  // ---- The Email tab ----
  console.log('\n=== Email tab: opens the owner\u2019s email app ===');
  {
    const dom = boot();
    await new Promise(r => setTimeout(r, 1500));
    const w = dom.window, d = w.document;
    try{
      // The mail app is opened by setting the address bar, so that is what is
      // watched here rather than anything being sent by the app
      w.eval("window.__opened = []; confirmDialog = ()=> Promise.resolve(true);"
        + " openMailApp = (href)=> window.__opened.push(href);");
      w.eval("switchView('workcenter');");
      Array.from(d.querySelectorAll('#workCenterTypeControl .history-type-btn'))
        .find(b => b.dataset.type === 'broadcast').click();
      d.getElementById('wcRecipientAll').click();
      d.getElementById('wcBroadcastOpen').click();
      await new Promise(r => setTimeout(r, 500));

      // jsdom reports the refused navigation, and its message carries the link
      const opened = JSON.parse(w.eval("JSON.stringify(window.__opened)"));
      check('  the email app is opened once, not once per customer', opened.length === 1, String(opened.length));
      const site = fs.readFileSync('customer-intake.html', 'utf8');
      check('  by clicking a link rather than navigating the page',
            /const link = document\.createElement\('a'\);[\s\S]{0,500}link\.click\(\);/.test(site));
      check('  and it says what to do if no email app is set up',
            /Copy the addresses" and paste them/.test(site) || /no email app set up/.test(site));
      const link = opened[0] || '';
      check('  with everybody in the Bcc line', link.indexOf('mailto:?bcc=') === 0, link.slice(0, 40));
      check('  both addresses are there',
            decodeURIComponent(link).indexOf('alpha@x.com') !== -1
            && decodeURIComponent(link).indexOf('bravo@x.com') !== -1);
      check('  nobody is in the To line, so no address is on show',
            link.indexOf('mailto:?') === 0);
      check('  the message is the one written',
            decodeURIComponent(link).indexOf('Turn your system on') !== -1);
      check('  and it says what to do next',
            d.getElementById('wcBroadcastNote').textContent.indexOf('press send there') !== -1,
            d.getElementById('wcBroadcastNote').textContent);
    }catch(e){ check('  email tab send', false, e.message); }
  }

  // ---- The editable message ----
  console.log('\n=== Filter clean email can be edited ===');
  {
    const dom = boot();
    await new Promise(r => setTimeout(r, 1500));
    const w = dom.window, d = w.document;
    try{
      w.eval("switchView('workcenter');");
      Array.from(d.querySelectorAll('#workCenterTypeControl .history-type-btn'))
        .find(b => b.dataset.type === 'filters').click();
      d.getElementById('btnEmailFilterGroups').click();
      await new Promise(r => setTimeout(r, 250));

      const picker = d.querySelector('.confirm-overlay');
      const labels = Array.from(picker.querySelectorAll('.btn-row button')).map(b => b.textContent);
      check('  Edit email sits between Send and Cancel',
            labels.join('|') === 'Send emails|Edit email|Cancel', labels.join('|'));

      Array.from(picker.querySelectorAll('button')).find(b => b.textContent === 'Edit email').click();
      await new Promise(r => setTimeout(r, 250));

      const editor = Array.from(d.querySelectorAll('.confirm-overlay')).pop();
      check('  the editor opens', !!editor.querySelector('textarea'));
      check('  it offers reset',
            Array.from(editor.querySelectorAll('button')).some(b => b.textContent === 'Reset to default'));

      check('  there is no preview block', editor.textContent.indexOf('Preview') === -1);

      // It must keep the date placeholder
      const ta = editor.querySelector('textarea');
      ta.value = 'No placeholder at all';
      Array.from(editor.querySelectorAll('button')).find(b => b.textContent === 'Save').click();
      await new Promise(r => setTimeout(r, 200));
      check('  it refuses to save without {dates}', !!d.querySelector('textarea'));

      // A real edit saves
      ta.value = 'Custom wording. Your clean: {dates}. From {company}.';
      Array.from(editor.querySelectorAll('button')).find(b => b.textContent === 'Save').click();
      await new Promise(r => setTimeout(r, 250));
      const saved = JSON.parse(w.eval("JSON.stringify(loadFilterEmail())"));
      check('  a valid edit is kept', saved.body.indexOf('Custom wording') !== -1, saved.body.slice(0, 40));
    }catch(e){ check('  filter email editor', false, e.message); }
  }

  // ---- Filter clean groups ----
  console.log('\n=== Filter cleans: one email per customer per group ===');
  {
    const dom = boot();
    await new Promise(r => setTimeout(r, 1500));
    const w = dom.window, d = w.document;
    try{
      w.eval("window.__sent = []; sendCustomerEmail = (to,s,m)=>{ window.__sent.push({to:to, subject:s, body:m}); return Promise.resolve(true); };");
      w.eval("switchView('workcenter');");
      Array.from(d.querySelectorAll('#workCenterTypeControl .history-type-btn'))
        .find(b => b.dataset.type === 'filters').click();
      d.getElementById('btnEmailFilterGroups').click();
      await new Promise(r => setTimeout(r, 300));

      const ov = d.querySelector('.confirm-overlay');
      check('  the picker opens', !!ov);
      check('  with no account-email demand',
            ov && ov.textContent.indexOf('account settings') === -1);

      Array.from(ov.querySelectorAll('input[type=checkbox]')).forEach(cb => cb.click());
      Array.from(ov.querySelectorAll('button')).find(b => b.textContent === 'Send emails').click();
      await new Promise(r => setTimeout(r, 700));

      const sent = JSON.parse(w.eval("JSON.stringify(window.__sent)"));
      check('  one email per person, not per group', sent.length === 2, sent.length + ' sent');
      check('  a customer with no email is skipped',
            !sent.some(s => !s.to), sent.map(s => s.to).join(','));

      const alpha = sent.find(s => s.to === 'alpha@x.com');
      const bravo = sent.find(s => s.to === 'bravo@x.com');
      check('  someone in one group gets one date',
            alpha && alpha.body.indexOf('September 22') !== -1
            && alpha.body.indexOf('October 6') === -1);
      check('  someone in two groups gets both, in one email',
            bravo && bravo.body.indexOf('September 22') !== -1
            && bravo.body.indexOf('October 6') !== -1,
            bravo && bravo.body.split('\n').find(l => l.indexOf('scheduled') !== -1));
      check('  two dates read naturally',
            bravo && bravo.body.indexOf('September 22, 2026 and Tuesday, October 6') !== -1);

      // Any number of groups, not just two
      check('  one date needs no joining',
            w.eval("joinDates(['Mon'])") === 'Mon');
      check('  three dates list correctly',
            w.eval("joinDates(['A','B','C'])") === 'A, B, and C',
            w.eval("joinDates(['A','B','C'])"));
      check('  five dates list correctly',
            w.eval("joinDates(['A','B','C','D','E'])") === 'A, B, C, D, and E',
            w.eval("joinDates(['A','B','C','D','E'])"));
      check('  and it is signed with the company',
            sent[0].body.trim().split('\n').pop() === 'Blue Water Pools');
    }catch(e){ check('  filter group send', false, e.message); }
  }

  // ---- Scheduling groups onto routes ----
  console.log('\n=== Scheduling filter clean groups ===');
  {
    const schedSeed = {
      companyName: 'Blue Water Pools',
      technicians: [{id:'t1', name:'Alex'}],
      customers: [{id:'a', name:'Alpha', active:true, email:'a@x.com'},
                  {id:'b', name:'Bravo', active:true, email:'b@x.com'}],
      filterGroups: [
        {id:'g1', name:'Ready one', customerIds:['a','b'], date:'2026-09-22', technicianId:'t1', finalized:false},
        {id:'g2', name:'Already on route', customerIds:['a'], date:'2026-10-06', technicianId:'t1', finalized:true},
        {id:'g3', name:'No technician', customerIds:['a'], date:'2026-10-20', technicianId:'', finalized:false},
        {id:'g4', name:'No date', customerIds:['b'], date:'', technicianId:'t1', finalized:false}
      ],
      scheduledFilterCleans: [{id:'x1', groupId:'g2', customerId:'a', technicianId:'t1',
                               date:'2026-10-06', status:'scheduled'}]
    };
    const dom = new JSDOM(fs.readFileSync('customer-intake.html','utf8'), {
      runScripts:'dangerously', pretendToBeVisual:true, url:'https://example.com/',
      beforeParse(w){
        // A company that has not ticked any photo for Everyone. New companies start
        // with the pool after photo required; that start is tested on its own.
        w.localStorage.setItem('weir:photoEveryone', '{}');
        w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
        w.scrollTo=()=>{}; w.scrollBy=()=>{}; w.alert=()=>{};
        w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){},fillRect(){}});
        w.console.warn=()=>{};
        w.Element.prototype.scrollIntoView=function(){};
        w.indexedDB = global.indexedDB; w.IDBKeyRange = global.IDBKeyRange;
        Object.keys(schedSeed).forEach(k=> w.localStorage.setItem('weir:'+k, JSON.stringify(schedSeed[k])));
      }
    });
    await new Promise(r => setTimeout(r, 1500));
    const w = dom.window, d = w.document;

    try{
      w.eval("switchView('workcenter');");
      Array.from(d.querySelectorAll('#workCenterTypeControl .history-type-btn'))
        .find(b => b.dataset.type === 'filters').click();

      const head = d.querySelector('#wcFiltersSection .section-head');
      const labels = Array.from(head.querySelectorAll('button')).map(b => b.textContent);
      check('  Schedule is in the heading', labels.indexOf('Schedule') !== -1, labels.join(','));
      check('  New group comes first',
            labels.indexOf('+ New group') === 0, labels.join(','));
      check('  then Schedule, then Email',
            labels.indexOf('+ New group') < labels.indexOf('Schedule')
            && labels.indexOf('Schedule') < labels.indexOf('Email'), labels.join(','));

      const inCard = Array.from(d.querySelectorAll('#filterGroupList button')).map(b => b.textContent);
      check('  no Schedule button inside a group', inCard.indexOf('Schedule') === -1, inCard.join(','));
      check('  no Unschedule button either', inCard.indexOf('Unschedule') === -1, inCard.join(','));

      d.getElementById('btnScheduleFilterGroups').click();
      await new Promise(r => setTimeout(r, 300));

      const ov = d.querySelector('.confirm-overlay');
      check('  the picker opens', !!ov);
      const rows = Array.from(ov.querySelectorAll('label'));
      check('  every group is listed', rows.length === 4, rows.length + ' listed');
      check('  a group already on route starts ticked',
            rows[1].querySelector('input').checked === true);
      check('  and is marked as on route', rows[1].textContent.indexOf('ON ROUTE') !== -1);
      check('  a group missing a technician cannot be ticked',
            rows[2].querySelector('input').disabled === true);
      check('  and says what it needs', rows[2].textContent.indexOf('no technician') !== -1);
      check('  a group missing a date cannot be ticked either',
            rows[3].querySelector('input').disabled === true);

      // Tick one, untick the other
      rows[0].querySelector('input').click();
      rows[1].querySelector('input').click();
      w.eval("confirmDialog = ()=> Promise.resolve(true);");
      Array.from(ov.querySelectorAll('button')).find(b => b.textContent === 'Apply').click();
      await new Promise(r => setTimeout(r, 400));

      // The confirmation must be visible, not hidden behind the picker
      const overlays = Array.from(d.querySelectorAll('.confirm-overlay'));
      const conf = overlays.find(o => o.querySelector('.confirm-box'));
      if(conf){
        const pick = overlays.find(o => !o.querySelector('.confirm-box'));
        const zOf = el => el.style.zIndex ? parseInt(el.style.zIndex) : 300;
        check('  the confirmation sits above the picker',
              !pick || zOf(conf) > zOf(pick),
              'confirmation ' + zOf(conf) + ' vs picker ' + (pick ? zOf(pick) : 'none'));
      }

      check('  ticking schedules the group',
            w.eval("filterGroups.find(g=>g.id==='g1').finalized") === true);
      check('  unticking takes the other off',
            w.eval("filterGroups.find(g=>g.id==='g2').finalized") === false);

      const sched = JSON.parse(w.localStorage.getItem('weir:scheduledFilterCleans'));
      check('  its route entries were created',
            sched.filter(s => s.groupId === 'g1').length === 2,
            sched.map(s => s.groupId).join(','));
      check('  and the removed one is gone from the route',
            sched.filter(s => s.groupId === 'g2').length === 0);
    }catch(e){ check('  filter group scheduling', false, e.message); }
  }

  // ---- The company name reaches every message ----
  console.log('\n=== The company name reaches mass emails ===');
  {
    const dom = new JSDOM(fs.readFileSync('customer-intake.html','utf8'), {
      runScripts:'dangerously', pretendToBeVisual:true, url:'https://example.com/',
      beforeParse(w){
        // A company that has not ticked any photo for Everyone. New companies start
        // with the pool after photo required; that start is tested on its own.
        w.localStorage.setItem('weir:photoEveryone', '{}');
        w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
        w.scrollTo=()=>{}; w.scrollBy=()=>{}; w.alert=()=>{};
        w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){},fillRect(){}});
        w.console.warn=()=>{}; w.console.error=()=>{};
        w.Element.prototype.scrollIntoView = function(){};
        w.indexedDB = global.indexedDB; w.IDBKeyRange = global.IDBKeyRange;
        w.localStorage.setItem('weir:customers',
          JSON.stringify([{id:'a', name:'Alpha', active:true, email:'a@x.com'}]));
      }
    });
    await new Promise(r => setTimeout(r, 1400));
    const w = dom.window, d = w.document;

    const openEmail = ()=>{
      w.eval("switchView('workcenter');");
      Array.from(d.querySelectorAll('#workCenterTypeControl .history-type-btn'))
        .find(b => b.dataset.type === 'broadcast').click();
    };
    const sign = ()=> d.getElementById('wcBroadcastBody').value.trim().split('\n').pop();
    const setName = async (n)=>{
      d.getElementById('btnAccount').click();
      const f = d.getElementById('acctCompanyName');
      f.value = n;
      f.dispatchEvent(new w.Event('change', {bubbles:true}));
      await new Promise(r => setTimeout(r, 150));
    };

    try{
      openEmail();
      check('  with no name set it falls back', sign() === 'Your pool service', sign());

      await setName('Trifific Pool and Spa');
      openEmail();
      check('  entering a name reaches an open message',
            sign() === 'Trifific Pool and Spa', sign());

      await setName('Clearwater Pools');
      openEmail();
      check('  renaming updates it again', sign() === 'Clearwater Pools', sign());

      check('  every template carries the name',
            w.eval("loadBroadcastTemplates().every(t => t.body.indexOf('Clearwater Pools') !== -1)"));
      check('  and none still shows the placeholder',
            w.eval("loadBroadcastTemplates().every(t => t.body.indexOf('{company}') === -1)"));

      // Picking a template afterwards must be right too
      const tpl = Array.from(d.querySelectorAll('#wcBroadcastTemplates button'))
        .find(b => /Freeze/.test(b.textContent));
      if(tpl){
        tpl.click();
        await new Promise(r => setTimeout(r, 150));
        check('  a template picked later is correct too', sign() === 'Clearwater Pools', sign());
      }

      // Something written by hand must survive a rename untouched
      d.getElementById('wcBroadcastBody').value = 'Something I wrote entirely myself.';
      await setName('Blue Water');
      openEmail();
      check('  a hand-written message is never rewritten',
            d.getElementById('wcBroadcastBody').value === 'Something I wrote entirely myself.',
            d.getElementById('wcBroadcastBody').value);
    }catch(e){ check('  company name in mass emails', false, e.message); }
  }

  
// ---- A broadcast goes from the owner's own email account ----
// Sending them from the app meant one shared sending key: a monthly cost, and
// a way in for anyone who reads the page source.
{
  console.log('\n=== broadcasts open in the owner\u2019s email app ===');
  const src = fs.readFileSync('customer-intake.html', 'utf8');
  check('the button says where it is going', /Open in your email app/.test(src));
  check('addresses go in the Bcc line, so nobody sees anyone else',
        /mailto:\?bcc=/.test(src));
  check('the subject and message are carried over',
        /&subject=' \+ encodeURIComponent\(subject\)/.test(src)
        && /&body=' \+ encodeURIComponent\(body\)/.test(src));
  check('a long list is handed over in batches rather than cut short',
        /maxLink: 1800/.test(src) && /Send the rest/.test(src));
  check('Gmail and Outlook each have their own button',
        /id="wcBroadcastGmail"[^>]*>Open in Gmail</.test(src)
        && /id="wcBroadcastOutlook"[^>]*>Open in Outlook</.test(src));
  check('and the addresses can be copied for a mail app that will not take a link',
        /id="wcBroadcastCopy"/.test(src) && /clipboard\.writeText/.test(src));
  check('nothing is sent by the app itself any more',
        !/for\(const cust of chosen\)[\s\S]{0,200}sendCustomerEmail/.test(src));
}


// ---- Gmail, Outlook and the email app, pressed as the owner presses them ----
{
  console.log('\n=== broadcasts: email app, Gmail and Outlook ===');
  const press = async (w, d, id, clip)=>{
    w.eval("window.__opened = []; window.__copied = []; confirmDialog = ()=> Promise.resolve(true);"
      + " openMailApp = (href)=> window.__opened.push(href);");
    Object.defineProperty(w.navigator, 'clipboard', {configurable: true,
      value: {writeText: t => { w.__copied.push(t); return clip === false ? Promise.reject(new Error('no')) : Promise.resolve(); }}});
    d.getElementById(id).click();
    await new Promise(r => setTimeout(r, 300));
    return {opened: JSON.parse(w.eval("JSON.stringify(window.__opened)")),
            copied: JSON.parse(w.eval("JSON.stringify(window.__copied)"))};
  };
  const pick = (w, d)=>{
    w.eval("switchView('workcenter');");
    Array.from(d.querySelectorAll('#workCenterTypeControl .history-type-btn'))
      .find(b => b.dataset.type === 'broadcast').click();
    d.getElementById('wcRecipientAll').click();
    d.getElementById('wcBroadcastSubject').value = 'Storm warning';
    d.getElementById('wcBroadcastBody').value = 'Turn your system on.\n\nThank you';
  };
  const param = (link, key)=> new URL(link).searchParams.get(key) || '';

  const dom = boot();
  await new Promise(r => setTimeout(r, 1500));
  const w = dom.window, d = w.document;
  try{
    pick(w, d);

    // Gmail
    let r = await press(w, d, 'wcBroadcastGmail');
    const g = r.opened[0] || '';
    check('  Gmail opens once', r.opened.length === 1, String(r.opened.length));
    check('  at Gmail\u2019s compose page', g.indexOf('https://mail.google.com/mail/?view=cm') === 0, g.slice(0, 50));
    check('  with both addresses in Bcc', param(g, 'bcc') === 'alpha@x.com,bravo@x.com', param(g, 'bcc'));
    check('  and nobody in To', !param(g, 'to'));
    check('  the subject carried over', param(g, 'su') === 'Storm warning', param(g, 'su'));
    check('  the message carried over, line breaks and all',
          param(g, 'body') === 'Turn your system on.\n\nThank you', JSON.stringify(param(g, 'body')));
    check('  the note says it went to Gmail',
          d.getElementById('wcBroadcastNote').textContent.indexOf('Opening Gmail') === 0,
          d.getElementById('wcBroadcastNote').textContent);

    // Outlook
    r = await press(w, d, 'wcBroadcastOutlook');
    const o = r.opened[0] || '';
    check('  Outlook opens once', r.opened.length === 1, String(r.opened.length));
    check('  at Outlook\u2019s compose page',
          o.indexOf('https://outlook.office.com/mail/deeplink/compose?') === 0, o.slice(0, 50));
    check('  with both addresses in Bcc', param(o, 'bcc') === 'alpha@x.com,bravo@x.com', param(o, 'bcc'));
    check('  and nobody in To', !param(o, 'to'));
    check('  subject and message carried over',
          param(o, 'subject') === 'Storm warning' && param(o, 'body').indexOf('Turn your system on') === 0);
    check('  the addresses are copied too, in case Bcc comes up empty',
          r.copied[0] === 'alpha@x.com, bravo@x.com', JSON.stringify(r.copied));
    check('  and the note says to paste them',
          /paste them into it/.test(d.getElementById('wcBroadcastNote').textContent));
    r = await press(w, d, 'wcBroadcastOutlook', false);
    check('  if copying fails it still opens, and says to use Copy the addresses',
          r.opened.length === 1 && /press "Copy the addresses"/.test(d.getElementById('wcBroadcastNote').textContent));

    // The email app
    r = await press(w, d, 'wcBroadcastOpen');
    check('  the email app still gets a Bcc email link',
          r.opened.length === 1 && r.opened[0].indexOf('mailto:?bcc=') === 0, (r.opened[0] || '').slice(0, 30));
    check('  and its note points at Gmail and Outlook if nothing opened',
          /"Open in Gmail", "Open in Outlook"/.test(d.getElementById('wcBroadcastNote').textContent));

    // Nobody chosen
    d.getElementById('wcRecipientNone') && d.getElementById('wcRecipientNone').click();
    w.eval("broadcastPicked.clear();");
    r = await press(w, d, 'wcBroadcastGmail');
    check('  nobody chosen opens nothing', r.opened.length === 0);
  }catch(e){ check('  broadcast routes', false, e.message); }
  w.close();
}

{
  console.log('\n=== broadcasts: where each one opens ===');
  const dom = boot();
  await new Promise(r => setTimeout(r, 1500));
  const w = dom.window, d = w.document;
  try{
    // The real openMailApp, watching the link it presses
    w.eval("window.__targets = []; HTMLAnchorElement.prototype.click = function(){ window.__targets.push(this.target); };");
    w.eval("openMailApp('mailto:?bcc=a%40x.com'); openMailApp('https://mail.google.com/mail/?view=cm');");
    const t = JSON.parse(w.eval("JSON.stringify(window.__targets)"));
    check('  an email link stays in this tab, so no blank tab is left behind', t[0] === '', JSON.stringify(t));
    check('  Gmail and Outlook open in a new tab', t[1] === '_blank', JSON.stringify(t));
  }catch(e){ check('  where each opens', false, e.message); }
  w.close();
}

{
  console.log('\n=== broadcasts: a long list goes in batches, by the same route ===');
  const saved = seed.customers;
  seed.customers = Array.from({length: 400}, (_, i)=> ({id: 'c' + i, name: 'Customer ' + i,
    active: true, email: 'someone.with.a.long.address.' + i + '@example-pool-customer.com'}));
  const dom = boot();
  seed.customers = saved;
  await new Promise(r => setTimeout(r, 1500));
  const w = dom.window, d = w.document;
  try{
    w.eval("switchView('workcenter');");
    Array.from(d.querySelectorAll('#workCenterTypeControl .history-type-btn'))
      .find(b => b.dataset.type === 'broadcast').click();
    d.getElementById('wcRecipientAll').click();
    d.getElementById('wcBroadcastBody').value = 'Turn your system on.';
    w.eval("window.__opened = []; confirmDialog = ()=> Promise.resolve(true);"
      + " openMailApp = (href)=> window.__opened.push(href);");
    d.getElementById('wcBroadcastGmail').click();
    await new Promise(r => setTimeout(r, 300));
    const more = d.getElementById('wcBroadcastMore');
    check('  too many for one opens a first batch and offers Send the rest',
          more.style.display !== 'none', more.style.display);
    let guard = 0;
    while(more.style.display !== 'none' && guard++ < 50){
      more.click();
      await new Promise(r => setTimeout(r, 50));
    }
    const opened = JSON.parse(w.eval("JSON.stringify(window.__opened)"));
    check('  every batch goes to Gmail, not the email app',
          opened.every(l => l.indexOf('https://mail.google.com/') === 0));
    check('  no link is longer than Gmail will take', opened.every(l => l.length <= 7000),
          String(Math.max(...opened.map(l => l.length))));
    const all = [].concat(...opened.map(l => new URL(l).searchParams.get('bcc').split(',')));
    check('  all 400 are sent to, none twice', all.length === 400 && new Set(all).size === 400, String(all.length));
    check('  and Send the rest goes away after the last batch', more.style.display === 'none');

    // The email app takes much shorter links, so the same list needs more batches
    w.eval("window.__opened = [];");
    d.getElementById('wcBroadcastOpen').click();
    await new Promise(r => setTimeout(r, 300));
    guard = 0;
    while(more.style.display !== 'none' && guard++ < 100){
      more.click();
      await new Promise(r => setTimeout(r, 30));
    }
    const app = JSON.parse(w.eval("JSON.stringify(window.__opened)"));
    check('  the email app keeps every link under 1800 characters',
          app.every(l => l.indexOf('mailto:') === 0 && l.length <= 1800),
          String(Math.max(...app.map(l => l.length))));
    check('  and still reaches all 400',
          [].concat(...app.map(l => decodeURIComponent(l.split('bcc=')[1].split('&')[0]).split(','))).length === 400);
  }catch(e){ check('  batches', false, e.message); }
  w.close();
}


// ---- The send buttons: remembered, labelled, one filled ----
{
  console.log('\n=== broadcasts: the button last used comes first ===');
  const row = d => Array.from(d.getElementById('wcBroadcastOpen').parentElement.children)
    .filter(b => ['wcBroadcastOpen', 'wcBroadcastGmail', 'wcBroadcastOutlook'].indexOf(b.id) !== -1);
  const openEmailTab = (w, d)=>{
    w.eval("switchView('workcenter');");
    Array.from(d.querySelectorAll('#workCenterTypeControl .history-type-btn')).find(b => b.dataset.type === 'broadcast').click();
  };
  {
    const dom = boot();
    await new Promise(r => setTimeout(r, 1500));
    const w = dom.window, d = w.document;
    try{
      openEmailTab(w, d);
      check('  before anything is used, the email app comes first', row(d)[0].id === 'wcBroadcastOpen');
      check('  and is the only filled button of the three',
            row(d).filter(b => b.classList.contains('btn-primary')).map(b => b.id).join() === 'wcBroadcastOpen');

      // What the confirmation says for each
      w.eval("window.__asks = []; confirmDialog = (msg, label)=>{ window.__asks.push({msg: msg, label: label}); return Promise.resolve(false); };");
      d.getElementById('wcRecipientAll').click();
      d.getElementById('wcBroadcastGmail').click(); await new Promise(r => setTimeout(r, 100));
      d.getElementById('wcBroadcastOutlook').click(); await new Promise(r => setTimeout(r, 100));
      d.getElementById('wcBroadcastOpen').click(); await new Promise(r => setTimeout(r, 100));
      const asks = JSON.parse(w.eval("JSON.stringify(window.__asks)"));
      check('  the confirmation button says Open Gmail, Open Outlook or Open email app',
            asks.map(a => a.label).join('|') === 'Open Gmail|Open Outlook|Open email app', asks.map(a => a.label).join('|'));
      check('  Gmail\u2019s confirmation says how to send if Send is off screen',
            /zoom out with Ctrl \+ minus/.test(asks[0].msg) && /Ctrl \+ Enter/.test(asks[0].msg) && /Cmd \+ Enter/.test(asks[0].msg));
      check('  and only Gmail\u2019s', !/Ctrl \+ Enter/.test(asks[1].msg) && !/Ctrl \+ Enter/.test(asks[2].msg));
      check('  cancelling saves no preference', !w.localStorage.getItem('weir:broadcastRoute'));

      // Accepting saves it and moves it to the front
      w.eval("confirmDialog = ()=> Promise.resolve(true); openMailApp = ()=>{};");
      d.getElementById('wcBroadcastOutlook').click(); await new Promise(r => setTimeout(r, 150));
      check('  the one used moves to the front', row(d)[0].id === 'wcBroadcastOutlook', row(d).map(b => b.id).join());
      check('  and becomes the filled button, the others outlined',
            row(d)[0].classList.contains('btn-primary') && row(d).slice(1).every(b => b.classList.contains('btn-ghost')));
      check('  saved on this computer', JSON.parse(w.localStorage.getItem('weir:broadcastRoute')) === 'outlook');
    }catch(e){ check('  send buttons', false, e.message); }
    w.close();
  }
  {
    // A reload keeps the order
    seed.broadcastRoute = 'gmail';
    const dom = boot();
    delete seed.broadcastRoute;
    await new Promise(r => setTimeout(r, 1500));
    const d = dom.window.document;
    check('  after a reload the saved one is still first and filled',
          row(d)[0].id === 'wcBroadcastGmail' && row(d)[0].classList.contains('btn-primary'));
    dom.window.close();
  }

  console.log('\n=== broadcasts: coming back to the Email tab starts with nobody chosen ===');
  {
    const dom = boot();
    await new Promise(r => setTimeout(r, 1500));
    const w = dom.window, d = w.document;
    try{
      openEmailTab(w, d);
      d.getElementById('wcRecipientAll').click();
      const picked = () => w.eval('broadcastPicked.size');
      check('  choosing everyone picks them', picked() > 0, String(picked()));
      Array.from(d.querySelectorAll('#workCenterTypeControl .history-type-btn')).find(b => b.dataset.type === 'broadcast').click();
      check('  pressing Email while on it keeps the choices', picked() > 0, String(picked()));
      Array.from(d.querySelectorAll('#workCenterTypeControl .history-type-btn')).find(b => b.dataset.type === 'quotes').click();
      Array.from(d.querySelectorAll('#workCenterTypeControl .history-type-btn')).find(b => b.dataset.type === 'broadcast').click();
      check('  leaving for another WorkCenter tab and coming back clears them', picked() === 0, String(picked()));
      d.getElementById('wcRecipientAll').click();
      w.eval("switchView('customers');");
      openEmailTab(w, d);
      check('  and so does leaving for another page', picked() === 0, String(picked()));
    }catch(e){ check('  coming back', false, e.message); }
    w.close();
  }
}


{
  console.log('\n=== quotes are emailed in the service report style ===');
  const saved = seed.customers;
  seed.companyName = 'Triffic Pool and Spa';
  seed.accountPhone = '(623) 555-0100';
  const dom = boot();
  delete seed.companyName; delete seed.accountPhone;
  await new Promise(r => setTimeout(r, 1500));
  const w = dom.window, d = w.document;
  try{
    w.eval("window.__calls=[]; sbFetch = async (path, o)=>{ window.__calls.push({path: path, body: JSON.parse(o.body)}); return {ok: true, status: 200, body: {sent: true}}; };"
      + " confirmDialog = ()=>Promise.resolve(true); switchView('workcenter');");
    d.querySelector('#wcTypeToggle [data-wctype="Quote"]').click();
    w.eval("wcSelectedCustomerIds=['a']; renderWcCustomerChips(); currentLineItems=[{description:'Acid wash',qty:1,price:'250'},{description:'Filter clean',qty:2,price:'85'}]; renderLineItems();");
    d.getElementById('wcNotes').value = 'Price holds for 30 days.';
    d.getElementById('btnSendWorkOrder').click();
    await new Promise(r => setTimeout(r, 400));
    const calls = JSON.parse(w.eval("JSON.stringify(window.__calls)"));
    const c = calls[0] || {body: {}};
    check('  a quote goes through the report function', calls.length === 1 && c.path === '/functions/v1/send-report', JSON.stringify(calls.map(x => x.path)));
    check('  to the customer', c.body.to === 'alpha@x.com', c.body.to);
    check('  with the company\u2019s own name in the subject', /^Quote from Triffic Pool and Spa \u2014 /.test(c.body.subject || ''), c.body.subject);
    const html = c.body.html || '';
    check('  laid out like the report: header, item table, total, notes, sign-off',
          /<table/.test(html) && /Triffic Pool and Spa/.test(html) && /Acid wash/.test(html) && /\$170\.00/.test(html)
          && /\$420\.00/.test(html) && /Price holds for 30 days\./.test(html) && /Just reply to this email/.test(html));
    check('  and the contact line', /555-0100/.test(html));
    check('  no company name written into the page', !/Triffic Pool &(amp;)? Spa/.test(fs.readFileSync('customer-intake.html', 'utf8')));
    w.eval("window.__calls=[]; window.__plain=[]; sbFetch = async ()=>({ok:false,status:0,body:null,offline:true}); sendCustomerEmail = async (to, subj, msg)=>{ window.__plain.push(msg); return true; };");
    w.eval("wcSelectedCustomerIds=['a']; renderWcCustomerChips(); currentLineItems=[{description:'Acid wash',qty:1,price:'250'}]; renderLineItems();");
    d.getElementById('btnSendWorkOrder').click();
    await new Promise(r => setTimeout(r, 400));
    check('  if the report function can\u2019t be reached, the plain email still goes',
          JSON.parse(w.eval("JSON.stringify(window.__plain)")).length === 1);

    console.log('\n=== quotes: Customize email ===');
    const btn = d.getElementById('btnCustomizeQuoteEmail');
    check('  Customize email sits beside Send on the Quote tab', btn && btn.style.display !== 'none');
    d.querySelector('#wcTypeToggle [data-wctype="Work Order"]').click();
    check('  and not on Work Order', btn.style.display === 'none');
    d.querySelector('#wcTypeToggle [data-wctype="Quote"]').click();
    btn.click();
    const ov = d.getElementById('quoteEmailOverlay');
    check('  it opens its window', ov.style.display === 'flex');
    check('  with the current wording', d.getElementById('qeClosing').value === 'Questions, or ready to go ahead? Just reply to this email.'
          && d.getElementById('qeHeader').placeholder === 'Triffic Pool and Spa');
    d.getElementById('qeHeader').value = 'Triffic Pools';
    d.getElementById('qeSubheader').value = 'Licensed & insured';
    d.getElementById('qeClosing').value = 'Call us to book.';
    d.getElementById('qeSignoff').value = 'Cheers, Tyrus';
    d.getElementById('qeContact').checked = false;
    const preview = w.eval("quoteEmailHtml(customers[0], 'Quote', 'Today', [{description:'X',qty:1,price:1}], 1, '', quoteEmailFormValues())");
    check('  Preview uses what is typed before saving', /Triffic Pools/.test(preview) && !/Triffic Pools/.test(w.eval("quoteEmailHtml(customers[0],'Quote','Today',[],0,'')")));
    d.getElementById('btnSaveQuoteEmail').click();
    check('  Save closes the window', ov.style.display === 'none');
    const html2 = w.eval("quoteEmailHtml(customers[0], 'Quote', 'Today', [{description:'X',qty:1,price:1}], 1, '')");
    check('  and every quote then uses it',
          /Triffic Pools/.test(html2) && /Licensed &amp; insured/.test(html2) && /Call us to book\./.test(html2) && /Cheers, Tyrus/.test(html2));
    check('  hiding phone, email and website works', !/555-0100/.test(html2));
    { const site = fs.readFileSync('customer-intake.html', 'utf8'); const keys = site.slice(site.indexOf('const SYNC_SETUP_KEYS'), site.indexOf('];', site.indexOf('const SYNC_SETUP_KEYS')));
      check('  it travels with the company setup', /'quoteEmailStyle'/.test(keys)); }
    btn.click();
    w.eval("window.__asked = []; confirmDialog = (msg, label)=>{ window.__asked.push(label); return Promise.resolve(false); };");
    d.getElementById('btnQeReset').click();
    await new Promise(r => setTimeout(r, 50));
    check('  Reset asks first, and saying no changes nothing',
          JSON.parse(w.eval("JSON.stringify(window.__asked)"))[0] === 'Reset' && d.getElementById('qeHeader').value === 'Triffic Pools');
    w.eval("confirmDialog = ()=>Promise.resolve(true);");
    d.getElementById('btnQeReset').click();
    await new Promise(r => setTimeout(r, 50));
    check('  saying yes puts the defaults back in the boxes',
          d.getElementById('qeHeader').value === '' && d.getElementById('qeContact').checked === true,
          JSON.stringify([d.getElementById('qeHeader').value, d.getElementById('qeContact').checked]));
    check('  and saves them there and then', !/Triffic Pools/.test(w.eval("quoteEmailHtml(customers[0],'Quote','Today',[],0,'')")));
    d.getElementById('btnCancelQuoteEmail').click();
    check('  Cancel closes the window', d.getElementById('quoteEmailOverlay').style.display === 'none');
  }catch(e){ check('  quote emails', false, e.message); }
  w.close();
}

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
  process.exit(fail ? 1 : 0);
})();
