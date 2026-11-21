/*
 * The TV's side: Luna (the TV's service bus) through PalmServiceBridge, and root through
 * Homebrew Channel's exec service. The luna() call follows Free My TV's tv.js (MIT).
 */
var Platform = (function () {
  'use strict';

  var webos = typeof window.PalmServiceBridge !== 'undefined';
  var calls = [];   // a bridge is collected if nothing holds it before its reply arrives
  var self = 'org.webosdock.app';
  if (webos && window.PalmSystem && window.PalmSystem.identifier) self = window.PalmSystem.identifier.split(' ')[0];
  var model = '';   // the TV's model name, for the Settings sheet
  if (webos && window.PalmSystem && window.PalmSystem.deviceInfo) { try { model = JSON.parse(window.PalmSystem.deviceInfo).modelName || ''; } catch (e) {} }

  /**
   * One Luna call; done(result or null on failure, raw reply). A service that never answers
   * (one the hub can't start) gets null after `timeout` ms instead of leaving the caller hanging.
   */
  function luna(uri, params, done, timeout) {
    if (!webos) {
      if (done) setTimeout(function () { done(null, null); }, 0);
      return;
    }
    var bridge = new window.PalmServiceBridge();
    calls.push(bridge);
    var finished = false;
    function finish(message) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      var i = calls.indexOf(bridge);
      if (i >= 0) calls.splice(i, 1);
      var result = null;
      try { result = JSON.parse(message); } catch (e) {}
      if (done) done(result && result.returnValue !== false ? result : null, result);
    }
    var timer = setTimeout(function () { finish('{"returnValue":false,"errorText":"no answer from ' + uri + '"}'); }, timeout || 20000);
    bridge.onservicecallback = finish;
    bridge.call(uri, JSON.stringify(params || {}));
  }

  /** A Luna subscription: onMessage(parsed) for every reply. The bridge is kept for good (a collected one drops it). */
  function subscribe(uri, params, onMessage) {
    if (!webos) return null;
    var bridge = new window.PalmServiceBridge();
    calls.push(bridge);
    bridge.onservicecallback = function (message) {
      var m = null;
      try { m = JSON.parse(message); } catch (e) {}
      onMessage(m);
    };
    bridge.call(uri, JSON.stringify(params || {}));
    return bridge;
  }

  /** A shell command as root, through Homebrew Channel; done(stdout or null, stderr). */
  function exec(command, done) {
    luna('luna://org.webosbrew.hbchannel.service/exec', {command: command}, function (res, raw) {
      if (!done) return;
      if (!res) { done(null, (raw && (raw.errorText || raw.error)) || 'exec failed'); return; }
      done(res.stdoutString || '', res.stderrString || '');
    }, 30000);
  }

  function shq(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'"; }

  /** A Luna call the app itself isn't allowed to make, made as root; done(result or null). */
  function lunaRoot(uri, params, done) {
    exec('luna-send -n 1 -w 8000 ' + uri + ' ' + shq(JSON.stringify(params || {})) + ' </dev/null', function (out) {
      var r = null;
      try { r = JSON.parse(out); } catch (e) {}
      done(r && r.returnValue !== false ? r : null);
    });
  }

  function readFile(path, done) {
    exec('cat ' + shq(path) + ' 2>/dev/null', function (out) { done(out); });
  }

  function readFileB64(path, done) {
    exec('base64 < ' + shq(path) + ' 2>/dev/null | tr -d "\\n"', function (out) { done(out || null); });
  }

  function writeFile(path, text, done) {
    var tag = 'DOCK_EOF_' + Math.random().toString(36).slice(2);
    var dir = path.replace(/\/[^\/]*$/, '');
    exec('mkdir -p ' + shq(dir) + ' && cat > ' + shq(path) + " <<'" + tag + "'\n" + text + '\n' + tag + '\n',
        function (out) { if (done) done(out !== null); });
  }

  // A log on the TV (/tmp/dock.log) for debugging without devtools; capped so a loop can't flood the bus.
  var logBudget = 300;
  function log(msg) {
    if (!webos || logBudget-- <= 0) return;
    exec("printf '%s\\n' " + shq(new Date().toTimeString().slice(0, 8) + ' ' + msg) + ' >> /tmp/dock.log');
  }
  window.addEventListener('error', function (e) {
    log('ERROR ' + (e.message || e) + ' @' + (e.filename || '').replace(/.*\//, '') + ':' + (e.lineno || ''));
  });

  return {webos: webos, self: self, model: model, luna: luna, subscribe: subscribe, exec: exec, lunaRoot: lunaRoot, shq: shq,
    readFile: readFile, readFileB64: readFileB64, writeFile: writeFile, log: log};
})();
