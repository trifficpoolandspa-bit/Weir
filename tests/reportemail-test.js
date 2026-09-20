// The emailed service report. Built separately from the on-screen version
// because email clients strip stylesheets, so this checks it stays email-safe.
require('fake-indexeddb/auto');
const { JSDOM } = require('jsdom');
const fs = require('fs');

let pass = 0, fail = 0;
function check(name, ok, detail){
  if(ok){ pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  — ' + detail : '')); }
}

function boot(file, seed){
  return new JSDOM(fs.readFileSync(file, 'utf8'), {
    runScripts:'dangerously', pretendToBeVisual:true, url:'https://example.com/',
    beforeParse(w){
      w.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
      w.scrollTo=()=>{}; w.scrollBy=()=>{}; w.alert=()=>{};
      w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){},fillRect(){}});
      w.console.warn=()=>{}; w.console.error=()=>{};
      w.Element.prototype.scrollIntoView = function(){};
      w.indexedDB = global.indexedDB; w.IDBKeyRange = global.IDBKeyRange;
      Object.keys(seed).forEach(k=> w.localStorage.setItem('weir:'+k, JSON.stringify(seed[k])));
    }
  });
}

const iso = new Date(Date.now() - new Date().getTimezoneOffset()*60000)
  .toISOString().slice(0,10);

const base = {
  companyName: 'Smith & Sons Pool Care',
  accountPhone: '(623) 555-0142',
  accountEmail: 'service@smithsons.com',
  licenseNumber: 'ROC-284419',
  customers: [{id:'a', name:'Alpha One', address:'123 Palm Way', active:true, hasPool:true}],
  chemConfig: {pool:{chemicals:[{key:'chlorine',label:'Free chlorine',full:'Free chlorine'},
                               {key:'ph',label:'pH level',full:'pH level'}],
                     dosages:[{key:'tabs',label:'Chlorine tabs'}]},
               spa:{chemicals:[],dosages:[]}, fountain:{chemicals:[],dosages:[]}},
  'readings:a': [{id:'r1', date: iso + 'T10:14:00.000Z', chlorine:'3.0', ph:'7.4',
                  tabs:'2', filterBackwashed:true}]
};

(async ()=>{
  for(const file of ['technician-app.html','admin-readings-app.html']){
    console.log('\n=== ' + file + ': the emailed report ===');
    const dom = boot(file, base);
    await new Promise(r => setTimeout(r, 1500));
    const w = dom.window;

    try{
      w.eval("renderDateReport('a', '" + iso + "');");
      await new Promise(r => setTimeout(r, 600));

      const html = w.eval('currentReportHtml');
      check('  an HTML version is built', html && html.length > 500, String(html).length + ' chars');

      // Email-safe: no stylesheet dependency
      check('  no CSS variables', html.indexOf('var(--') === -1);
      check('  no class attributes', html.indexOf('class=') === -1);
      check('  laid out with tables', (html.match(/<table/g) || []).length >= 3);
      check('  styles are inline', html.indexOf('style="') !== -1);

      // Content
      check('  the company is in the header',
            html.indexOf('Smith &amp; Sons Pool Care') !== -1);
      check('  an ampersand is escaped, not raw',
            html.indexOf('Smith & Sons') === -1);
      check('  the customer is named', html.indexOf('Alpha One') !== -1);
      check('  with their address', html.indexOf('123 Palm Way') !== -1);
      check('  readings are included',
            html.indexOf('Free chlorine') !== -1 && html.indexOf('3.0') !== -1);
      check('  chemicals added are included', html.indexOf('Chlorine tabs') !== -1);
      check('  service performed is included', html.indexOf('Filter backwashed') !== -1);
      check('  the license is in the footer', html.indexOf('ROC-284419') !== -1);
      check('  contact details show', html.indexOf('(623) 555-0142') !== -1);

      // The plain text must survive as a fallback
      check('  the plain text version still exists',
            w.eval('currentReportText').length > 0);

      // Customisation is honoured
      w.eval("lsSet('reportEmailStyle', {colour:'#8C3B2A', greeting:'Custom opening.', "
             + "signoff:'Custom closing.', showContact:false, showReadings:false});");
      w.eval("renderDateReport('a', '" + iso + "');");
      await new Promise(r => setTimeout(r, 600));
      const styled = w.eval('currentReportHtml');

      // The technician's name replaces the old canned greeting
      const withTech = w.eval("buildReportEmailHtml({name:'A Customer'}, 'today', "
        + "[{label:'Pool', readingPairs:[['x','1']], productPairs:[], servicePairs:[]}], "
        + "{technician:'Alex Rivera'})");
      check('  the technician who did the work is named',
            withTech.indexOf('Alex Rivera') !== -1);
      check('  and labelled, so it is clear whose name it is',
            withTech.indexOf('Technician: Alex Rivera') !== -1);
      const noTech = w.eval("buildReportEmailHtml({name:'A Customer'}, 'today', "
        + "[{label:'Pool', readingPairs:[['x','1']], productPairs:[], servicePairs:[]}], {})");
      check('  and left out cleanly when there is none',
            noTech.indexOf('undefined') === -1 && noTech.length > 400);
      check('  the canned greeting is gone by default',
            html.indexOf('Here is the report from') === -1);

      check('  a chosen colour is used', styled.indexOf('#8C3B2A') !== -1);
      check('  a custom opening line appears', styled.indexOf('Custom opening.') !== -1);
      check('  a custom closing line appears', styled.indexOf('Custom closing.') !== -1);
      check('  contact details can be hidden',
            styled.indexOf('(623) 555-0142') === -1);
      check('  readings can be left out', styled.indexOf('Free chlorine') === -1);
      check('  but chemicals added remain', styled.indexOf('Chlorine tabs') !== -1);

      // A missing company name must not produce a blank header
      w.eval("lsSet('companyName', '');");
      w.eval("renderDateReport('a', '" + iso + "');");
      await new Promise(r => setTimeout(r, 600));
      check('  a blank company name falls back',
            w.eval('currentReportHtml').indexOf('Your pool service') !== -1);
    }catch(e){
      check('  emailed report', false, e.message);
    }
  }

  // The settings tab on the website
  console.log('\n=== customer-intake.html: the Email tab ===');
  {
    const dom = boot('customer-intake.html', base);
    await new Promise(r => setTimeout(r, 1500));
    const w = dom.window, d = w.document;

    try{
      d.getElementById('btnAccount').click();
      const tabs = Array.from(d.querySelectorAll('#accountTabControl .history-type-btn'))
        .map(b => b.textContent);
      check('  Email is a tab on the Account page', tabs.indexOf('Email') !== -1, tabs.join('|'));

      Array.from(d.querySelectorAll('#accountTabControl .history-type-btn'))
        .find(b => b.dataset.acct === 'email').click();
      check('  it opens its own panel',
            d.getElementById('acctEmailPanel').style.display === 'block');
      check('  with a colour picker', !!d.getElementById('acctEmailColour'));
      check('  an opening line', !!d.getElementById('acctEmailGreeting'));
      check('  and a closing line', !!d.getElementById('acctEmailSignoff'));

      const g = d.getElementById('acctEmailGreeting');
      g.value = 'Your pool was serviced today.';
      g.dispatchEvent(new w.Event('change', {bubbles:true}));
      check('  editing saves', w.eval("loadEmailStyle().greeting") === 'Your pool was serviced today.');

      d.getElementById('acctEmailReadings').click();
      check('  readings can be switched off', w.eval('loadEmailStyle().showReadings') === false);

      d.getElementById('btnEmailPreview').click();
      await new Promise(r => setTimeout(r, 300));
      check('  a preview opens', !!d.querySelector('.confirm-overlay iframe'));

      const prev = w.eval('previewReportEmail()');
      check('  the preview reflects the changes',
            prev.indexOf('Your pool was serviced today') !== -1
            && prev.indexOf('Free chlorine') === -1);
    }catch(e){
      check('  email settings tab', false, e.message);
    }
  }

  // ---- Both apps must actually SEND the html ----
  console.log('\n=== the HTML is what gets sent, in both apps ===');
  {
    ['technician-app.html','admin-readings-app.html'].forEach(file=>{
      const src = fs.readFileSync(file, 'utf8');
      check(file + ' sends the HTML version as the message',
            src.indexOf('message: currentReportHtml || currentReportText') !== -1);
      check(file + ' and a plain-text copy alongside it',
            src.indexOf('message_text: currentReportText') !== -1);
      check(file + ' never sends only the plain text',
            src.indexOf('message: currentReportText\n') === -1);
    });
  }

  // ---- Every photo taken is sent, not just the first ----
  console.log('\n=== All the visit photos are attached ===');
  {
    ['technician-app.html','admin-readings-app.html'].forEach(file=>{
      const src = fs.readFileSync(file, 'utf8');
      check(file + ' collects every photo from the visit',
            src.indexOf('function collectReportPhotos') !== -1);
      check(file + ' sends them as numbered attachments',
            src.indexOf("templateParams['photo_' + (idx + 1)]") !== -1);
      check(file + ' names each one so they are recognisable',
            src.indexOf("templateParams['photo_' + (idx + 1) + '_name']") !== -1);
      check(file + ' and says how many there are',
            src.indexOf('templateParams.photo_count') !== -1);
      check(file + ' with a sensible ceiling',
            /MAX_REPORT_PHOTOS = [1-9]/.test(src));

      // WebP is not always offered as an attachment content type, and some
      // mail clients still will not preview it
      check(file + ' converts photos to JPEG for the email',
            src.indexOf('function webpToJpegDataUrl') !== -1);
      check(file + ' and names them .jpg to match',
            src.indexOf("'-after.jpg'") !== -1 || src.indexOf("+ '-after.jpg'") !== -1
            || src.indexOf('.jpg') !== -1);
      check(file + ' converting them all at once, not one by one',
            src.indexOf('await Promise.all(photos.map') !== -1);
      check(file + ' and giving up rather than hanging forever',
            src.indexOf('setTimeout(()=> finish(dataUrl), 4000)') !== -1);

      // The old single-attachment slot must not be sent alongside the numbered
      // ones, or the first photo arrives twice
      check(file + ' does not also send the old single slot',
            src.indexOf('templateParams.photo_attachment') === -1);

      // Mail clients turn phone numbers and addresses into blue underlined
      // links, which is unreadable on the dark header
      check(file + ' asks clients not to auto-link the contact line',
            src.indexOf('format-detection') !== -1);
      check(file + ' and overrides them where they do it anyway',
            src.indexOf('x-apple-data-detectors') !== -1);
      // The contact line lives in the footer under the company name now, on a
      // light background, so it needs a dark colour rather than white
      check(file + ' the contact line is not in the dark header',
            src.indexOf("+ (contact ? '<div style=\"font-size:12.5px;color:#FFFFFF") === -1);
      check(file + ' it sits under the company name at the foot',
            src.indexOf("color:#4A5A58;margin-top:4px") !== -1);
      check(file + ' with each part wrapped rather than linked',
            src.indexOf("'<span style=\"color:#4A5A58;text-decoration:none;\">'") !== -1);
    });
  }

  
// ---- The photos inside a report sent from the office ----
// The Edge Function is TypeScript for Deno, which cannot run here. The part
// worth checking is how it builds the page, so that is lifted out and run.
(function(){
  console.log('\n=== send-report: photos inside the report ===');
  const fs2 = require('fs');
  const where = ['send-report.ts', 'functions/send-report/index.ts', 'supabase/functions/send-report/index.ts']
    .find(f => { try{ fs2.accessSync(f); return true; }catch(e){ return false; } });
  if(!where){
    check('the send-report function is here to check', false, 'put send-report.ts beside the tests');
    return;
  }
  const src = fs2.readFileSync(where, 'utf8');

  const shown = [{id: 'photo-1', name: 'pool-before.jpg', caption: 'Pool before', link: 'https://example.test/full-1'},
                 {id: 'photo-2', name: 'pool-after.jpg', caption: 'Pool after', link: 'https://example.test/full-2'}];
  const piece = src.slice(src.indexOf('const kindOf ='), src.indexOf('const from ='));
  const strip = code => code
    .replace(/\(name\s*:\s*string\)/g, '(name)')
    .replace(/\(page\s*:\s*string\)/g, '(page)')
    .replace(/\(p\s*:\s*\{[^}]*\},\s*label\s*:\s*string\)/g, '(p, label)')
    .replace(/\(p\s*:\s*\{[^}]*\}\)/g, '(p)')
    .replace(/const rows\s*:\s*Array<[^=]+>\s*=/g, 'const rows =')
    .replace(/ as any/g, '');
  // leftOut is counted while the photos are gathered, which is above the piece
  // being lifted out, so it is passed in
  const build = (list, leftOut) => new Function('shown', 'leftOut', strip(piece)
    + '; return {photoSection, withPhotos};')(list, leftOut || 0);
  const {photoSection, withPhotos} = build(shown, 0);

  // A photo too big to carry is named, not silently dropped
  const crowded = build([{id: 'p1', name: 'pool-after.jpg', caption: 'Pool after', link: ''}], 2).photoSection();
  check('a photo that will not fit is mentioned rather than dropped',
        /2 more photos were/.test(crowded), crowded.slice(-160));

  // The browser blocks the whole request if the app sends a header the
  // function has not said it accepts. That looked exactly like no signal.
  const allowed = (src.match(/'Access-Control-Allow-Headers':\s*'([^']+)'/) || [])[1] || '';
  ['authorization', 'apikey', 'content-type'].forEach(h=>{
    check('  the function accepts the ' + h + ' header', allowed.indexOf(h) !== -1, allowed);
  });
  check('  and answers the browser\'s question before the send', /OPTIONS/.test(src));

  const section = photoSection();
  check('each photo is shown in the page', (section.match(/<img src="cid:photo-/g) || []).length === 2, section.slice(0, 120));
  check('with a heading that matches how many there are', /Photos from this visit/.test(section));
  check('each photo says which body of water it is',
        /Pool before/.test(section) && /Pool after/.test(section), section.slice(0, 300));
  const spa = build([{id: 's1', name: 'spa-after.jpg', caption: 'Spa after', link: ''}]);
  check('a spa photo says spa, not just after', /Spa after/.test(spa.photoSection()), spa.photoSection().slice(0, 200));
  const older = build([{id: 'o1', name: 'pool-before.jpg', caption: '', link: ''},
                       {id: 'o2', name: 'pool-after.jpg', caption: '', link: ''}]);
  check('a phone that sends no caption still gets before and after',
        /Before/.test(older.photoSection()) && /After/.test(older.photoSection()));
  check('each photo is 240 wide, declared where mail apps will obey it',
        (section.match(/width="240"/g) || []).length >= 2 && /width:240px/.test(section), section.slice(0, 300));
  check('and each one links to a full-size copy',
        /<a href="https:\/\/example.test\/full-1"/.test(section) && /full-2/.test(section), section.slice(0, 300));
  const photoRowsIn = html => (html.slice(html.indexOf('<table')).match(/<tr>/g) || []).length;
  check('before and after sit side by side',
        photoRowsIn(section) === 1
        && (section.match(/valign="top"/g) || []).length === 2, section.slice(0, 260));

  // A body's own before and after always pair, whatever else came along
  const mixed = build([
    {id: 'a', name: 'spa-before.jpg', caption: 'Spa before', link: ''},
    {id: 'b', name: 'gate.jpg', caption: 'Gate', link: ''},
    {id: 'c', name: 'spa-after.jpg', caption: 'Spa after', link: ''},
    {id: 'd', name: 'pool-after.jpg', caption: 'Pool after', link: ''}
  ]).photoSection();
  const firstRow = mixed.slice(mixed.indexOf('<tr>'), mixed.indexOf('</tr>'));
  check('the spa before and after pair up, even with other photos between them',
        /Spa before/.test(firstRow) && /Spa after/.test(firstRow), firstRow.slice(0, 200));
  check('and the leftovers pair up two to a row', photoRowsIn(mixed) === 2, String(photoRowsIn(mixed)));
  const secondRow = mixed.slice(mixed.lastIndexOf('<tr>'));
  check('so the gate and the lone pool photo share a row',
        /Gate/.test(secondRow) && /Pool after/.test(secondRow), secondRow.slice(0, 200));

  const lone = build([{id: 'z', name: 'gate.jpg', caption: 'Gate', link: ''}]).photoSection();
  check('a single photo keeps its place rather than stretching',
        (lone.match(/valign="top"/g) || []).length === 1 && /<td style="width:240px;"><\/td>/.test(lone),
        lone.slice(0, 200));
  check('the heading is nudged down from what is above it', /margin:8px 0 12px/.test(section), section.slice(0, 160));
  check('the file name is never used as the caption', section.indexOf('.jpg<') === -1);
  const onlyAfter = build([{id: 'photo-1', name: 'pool-after.jpg', caption: '', link: ''}]);
  check('a photo with nothing to say carries no caption',
        build([{id: 'x', name: 'photo.jpg', caption: '', link: ''}]).photoSection().indexOf('margin-top:5px') === -1);
  check('and a single photo is the same size', /width:240px/.test(onlyAfter.photoSection()));
  check('a photo with no full-size copy is still shown, just not a link',
        onlyAfter.photoSection().indexOf('<a href') === -1 && /cid:photo-1/.test(onlyAfter.photoSection()));
  const three = build([{id: 'a', name: 'before.jpg', caption: 'Pool before', link: ''},
                       {id: 'b', name: 'after.jpg', caption: 'Pool after', link: ''},
                       {id: 'c', name: 'gate.jpg', caption: 'Gate', link: ''}]);
  check('three photos make two rows, not three',
        photoRowsIn(three.photoSection()) === 2, three.photoSection().slice(0, 160));

  const page = '<html><body><table><tr><td>The report</td></tr>'
    + '<tr><td style="padding:26px;">Thank you for your business.<div>Triffic Pool and Spa</div></td></tr>'
    + '</table></body></html>';
  const withThem = withPhotos(page);
  check('the photos sit above the thank-you and the company name',
        withThem.indexOf('cid:photo-1') < withThem.indexOf('Thank you for your business'),
        withThem.slice(withThem.indexOf('The report'), withThem.indexOf('The report') + 160));
  check('and below what was done on the visit', withThem.indexOf('The report') < withThem.indexOf('cid:photo-1'));
  check('the report itself is untouched', withThem.indexOf('The report') !== -1);

  const none = build([]);
  check('a report with no photos is left exactly as it was', none.withPhotos(page) === page);
})();

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
  process.exit(fail ? 1 : 0);
})();
