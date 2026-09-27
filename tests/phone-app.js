// The technician and admin phone apps are one file now: app.html. It shows the
// admin extras to someone signed in with admin access.
//
// Checks written for either of the old apps load app.html as that kind of
// person: 'technician-app.html' is app.html for a technician, and
// 'admin-readings-app.html' is app.html for an admin (the phone remembers an
// admin signed in last). Required first thing by every suite.
const fs = require('fs'), path = require('path');
const realRead = fs.readFileSync;
const MARK = '<!--weir-test-as:';
fs.readFileSync = function(p, ...rest){
  const base = path.basename(String(p));
  if(base === 'technician-app.html' || base === 'admin-readings-app.html'){
    const src = realRead.call(fs, path.join(path.dirname(String(p)), 'app.html'), ...rest);
    if(typeof src !== 'string') return src;
    return src + MARK + (base === 'admin-readings-app.html' ? 'admin' : 'technician') + '-->';
  }
  return realRead.call(fs, p, ...rest);
};
const jsdom = require('jsdom');
const Original = jsdom.JSDOM;
class JSDOM extends Original {
  constructor(html, opts){
    opts = opts || {};
    if(typeof html === 'string' && html.includes(MARK + 'admin-->')){
      const theirs = opts.beforeParse;
      opts = Object.assign({}, opts, {beforeParse(w){
        // Whoever last signed in on this phone had admin access (live and beta)
        ['weirdevice:', 'weirdevice:beta-'].forEach(p =>
          w.localStorage.setItem(p + 'membership', JSON.stringify({full_access: true})));
        if(typeof theirs === 'function') theirs(w);
      }});
    }
    super(html, opts);
  }
}
jsdom.JSDOM = JSDOM;
module.exports = {MARK};
