/*
 * The TV's apps and inputs: the full list with icons (as root, which Developer Mode apps can't
 * get on webOS 6), opening and closing them, and the look of each tile: input icons drawn here,
 * the glow colour a focused tile throws.
 */
var Apps = (function () {
  'use strict';

  var HIDDEN = /^(com\.webos\.app\.(livetv|hdmi\d|home|homeconnect|discovery|launcher|inputpicker|voice|lgchannels|igallery|sportsteamsettings|livepick-full|roomconnect|mediadiscovery)|com\.palm\.app\.settings|amazon\.alexa\.view|org\.webosdock\.app)$/;
  var INPUT_IDS = ['com.webos.app.hdmi1', 'com.webos.app.hdmi2', 'com.webos.app.hdmi3', 'com.webos.app.hdmi4'];

  // The colour a focused tile glows: the brand's, as "r,g,b"
  var GLOW = {
    'netflix': '229,9,20', 'youtube.leanback.v4': '255,0,51', 'amazon': '0,168,225', 'com.apple.appletv': '205,212,230',
    'spotify-beehive': '30,215,96', 'com.disney.disneyplus-prod': '40,110,255', 'com.wbd.stream': '70,95,255', 'hulu': '28,231,131',
    'com.peacock.tv': '255,200,0', 'com.cbs-all-access.webapp.prod': '0,100,255', 'com.espn.espnplus-prod': '255,45,45',
    'com.twc.csg.redbox': '226,35,26', 'com.rumble.webos.app': '133,199,66', 'com.angel.tv2': '244,197,66',
    'com.movenetworks.app.sling-tv-sling-production': '30,144,255', 'vudu': '61,125,255', 'org.webosbrew.hbchannel': '255,90,160',
    'com.webos.app.browser': '90,169,255'
  };

  var DARK = 'rgba(0,0,0,0.30)';
  var GLYPH = {
    'switch': '<svg viewBox="0 0 64 64"><path fill="#fff" d="M15 11h11v42H15a9 9 0 0 1-9-9V20a9 9 0 0 1 9-9zM38 11h11a9 9 0 0 1 9 9v24a9 9 0 0 1-9 9H38z"/>' +
        '<rect x="28" y="11" width="8" height="42" rx="2" fill="#fff" opacity="0.42"/><circle cx="16.5" cy="22" r="3.8" fill="' + DARK + '"/>' +
        '<circle cx="16.5" cy="33.2" r="1.9" fill="' + DARK + '"/><circle cx="16.5" cy="40.8" r="1.9" fill="' + DARK + '"/><circle cx="12.7" cy="37" r="1.9" fill="' + DARK + '"/><circle cx="20.3" cy="37" r="1.9" fill="' + DARK + '"/>' +
        '<circle cx="47.5" cy="18.2" r="1.9" fill="' + DARK + '"/><circle cx="47.5" cy="25.8" r="1.9" fill="' + DARK + '"/><circle cx="43.7" cy="22" r="1.9" fill="' + DARK + '"/><circle cx="51.3" cy="22" r="1.9" fill="' + DARK + '"/>' +
        '<circle cx="47.5" cy="38" r="3.8" fill="' + DARK + '"/></svg>',
    'xbox': '<svg viewBox="0 0 64 64"><path fill="#fff" d="M19.5 17.5h25c6.9 0 12.5 4.6 13.8 11.4l3 15.6c1 5-2.8 9.5-7.8 9.5-3 0-5.7-1.7-7-4.4L44 45H20l-2.5 4.6c-1.3 2.7-4 4.4-7 4.4-5 0-8.8-4.5-7.8-9.5l3-15.6C7 22.1 12.6 17.5 19.5 17.5z"/>' +
        '<circle cx="19.5" cy="28.5" r="4.2" fill="' + DARK + '"/><circle cx="32" cy="24.5" r="2.6" fill="' + DARK + '"/>' +
        '<circle cx="45" cy="24" r="2.3" fill="' + DARK + '"/><circle cx="49.5" cy="28.5" r="2.3" fill="' + DARK + '"/><circle cx="40.5" cy="28.5" r="2.3" fill="' + DARK + '"/><circle cx="45" cy="33" r="2.3" fill="' + DARK + '"/>' +
        '<rect x="21" y="37" width="10" height="3" rx="1.5" fill="' + DARK + '"/><rect x="24.5" y="33.5" width="3" height="10" rx="1.5" fill="' + DARK + '"/><circle cx="39" cy="39" r="4" fill="' + DARK + '"/></svg>',
    'box': '<svg viewBox="0 0 64 64"><rect x="7" y="13" width="50" height="33" rx="6" fill="#fff"/><path d="M28 22.5v14l12-7z" fill="' + DARK + '"/>' +
        '<rect x="22" y="50" width="20" height="4" rx="2" fill="#fff" opacity="0.8"/></svg>',
    'soundbar': '<svg viewBox="0 0 64 64"><rect x="4" y="25" width="56" height="14" rx="7" fill="#fff"/><circle cx="14" cy="32" r="2.4" fill="' + DARK + '"/>' +
        '<circle cx="22" cy="32" r="2.4" fill="' + DARK + '"/><circle cx="42" cy="32" r="2.4" fill="' + DARK + '"/><circle cx="50" cy="32" r="2.4" fill="' + DARK + '"/></svg>',
    'hdmi': '<svg viewBox="0 0 64 64"><path fill="#fff" d="M10 22h44a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4h-6l-4 6H20l-4-6h-6a4 4 0 0 1-4-4v-8a4 4 0 0 1 4-4z"/></svg>',
    'plus': '<svg viewBox="0 0 64 64"><path d="M32 17v30M17 32h30" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg>'
  };

  // The look of an input tile, by what is plugged into the port (never by port number: the TVs differ)
  var LOOKS = {
    'switch': {glyph: 'switch', bg: 'linear-gradient(155deg, #ff5a52 0%, #e60012 52%, #9c000b 100%)', glow: '255,40,40'},
    'xbox': {glyph: 'xbox', bg: 'linear-gradient(155deg, #4cd64c 0%, #128a12 55%, #0a520a 100%)', glow: '40,200,60'},
    'playstation': {glyph: 'xbox', bg: 'linear-gradient(155deg, #6a9cff 0%, #2456e0 55%, #102c8a 100%)', glow: '70,120,255'},
    'game': {glyph: 'xbox', bg: 'linear-gradient(155deg, #ffb35c 0%, #f0761a 55%, #9a4208 100%)', glow: '255,140,40'},
    'audio': {glyph: 'soundbar', bg: 'linear-gradient(155deg, #9a9aa6 0%, #55555f 55%, #2e2e36 100%)', glow: '170,170,190'},
    'box': {glyph: 'box', bg: 'linear-gradient(155deg, #b98cff 0%, #7a3cf0 55%, #461aa0 100%)', glow: '150,90,255'},
    'hdmi': {glyph: 'hdmi', bg: 'linear-gradient(155deg, #888, #444)', glow: '200,200,210'}
  };

  /** What an input is, from its labels (the tile's, then the TV's) and what the TV detected on it. */
  function classify(id, label) {
    var i = inputs[id] || {};
    var text = ((label || '') + ' ' + (i.label || '') + ' ' + (i.brand || '')).toLowerCase();
    if (/nintendo|switch/.test(text)) return 'switch';
    if (/xbox/.test(text)) return 'xbox';
    if (/playstation|\bps[345]\b|sony/.test(text)) return 'playstation';
    if (/sound ?bar|home ?theat|audio|receiver|speaker|sonos|denon|yamaha|bose/.test(text) || i.kind === 'audio') return 'audio';
    if (/game|console/.test(text) || i.kind === 'game') return 'game';
    if (/box|stick|roku|fire ?tv|apple ?tv|chromecast|shield|cable|set.?top|stb|dvr|tivo|xfinity|dish|directv|blu.?ray|dvd|player/.test(text) || i.kind === 'box') return 'box';
    return 'hdmi';
  }

  /** game, audio, box or '', from the TV's own icon for the port and the device type it detected. */
  function kindOf(icon, serviceType) {
    icon = icon.toLowerCase(); serviceType = serviceType.toLowerCase();
    if (/game/.test(icon) || serviceType === 'game') return 'game';
    if (/theater|audio|sound|speaker/.test(icon) || serviceType === 'audio') return 'audio';
    if (/settop|stb|streaming|ott|box|bluray|dvd|player/.test(icon) || /stb|ott|cable|satellite|streaming/.test(serviceType)) return 'box';
    return '';
  }

  var TITLES = {'netflix': 'Netflix', 'youtube.leanback.v4': 'YouTube', 'amazon': 'Prime Video', 'com.apple.appletv': 'Apple TV',
    'spotify-beehive': 'Spotify', 'com.disney.disneyplus-prod': 'Disney+', 'com.wbd.stream': 'Max', 'hulu': 'Hulu', 'com.peacock.tv': 'Peacock',
    'com.cbs-all-access.webapp.prod': 'Paramount+', 'com.espn.espnplus-prod': 'ESPN', 'com.webos.app.browser': 'Web Browser',
    'org.webosbrew.hbchannel': 'Homebrew Channel', 'com.angel.tv2': 'Angel Studios', 'com.movenetworks.app.sling-tv-sling-production': 'Sling TV'};

  var list = [], byId = {}, inputs = {}, icons = {};

  function hexToRgb(hex) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
    return m ? parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16) : '';
  }

  function iconPath(a) {
    var cands = [a.extraLargeIcon, a.largeIcon, a.mediumLargeIcon, a.icon];
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      if (!c || /^https?:/.test(c)) continue;
      if (c.charAt(0) === '/') return c;
      if (a.folderPath) return a.folderPath + '/' + c;
    }
    return '';
  }

  /** The TV's apps, as root (listApps), minus the inputs and LG's own pieces; done(list). */
  function load(done) {
    // Only the fields the tiles need: the full list is 130 KB, past what exec can carry.
    var props = {properties: ['id', 'title', 'folderPath', 'icon', 'largeIcon', 'extraLargeIcon', 'visible', 'type', 'iconColor']};
    Platform.lunaRoot('luna://com.webos.applicationManager/listApps', props, function (res) {
      var apps = res && res.apps ? res.apps : [];
      list = [];
      byId = {};
      for (var i = 0; i < apps.length; i++) {
        var a = apps[i];
        if (!a.id || a.id === Platform.self || a.visible === false || a.type === 'stub' || HIDDEN.test(a.id)) continue;
        var app = {id: a.id, title: TITLES[a.id] || a.title || a.id, iconPath: iconPath(a), glow: GLOW[a.id] || hexToRgb(a.iconColor) || '255,255,255'};
        if (app.glow === '0,0,0') app.glow = '200,205,220';
        list.push(app);
        byId[a.id] = app;
      }
      list.sort(function (x, y) { var a = x.title.toLowerCase(), b = y.title.toLowerCase(); return a < b ? -1 : a > b ? 1 : 0; });
      if (done) done(list);
    });
  }

  /** The HDMI inputs: what's plugged in and what the TV calls them; done(inputs). */
  function loadInputs(done) {
    function take(res) {
      var devices = res && res.devices ? res.devices : [];
      for (var i = 0; i < devices.length; i++) {
        var d = devices[i];
        if (!d.appId || INPUT_IDS.indexOf(d.appId) < 0) continue;
        var sub = d.subList && d.subList[0] ? d.subList[0] : {};
        inputs[d.appId] = {
          label: d.label && !/^hdmi\s*\d$/i.test(d.label) ? d.label : '',
          connected: d.connected === true,
          brand: sub.brandName || sub.labelName || '',
          kind: kindOf((d.icon || '').split('/').pop(), sub.serviceType || '')
        };
      }
      if (done) done(inputs);
    }
    Platform.luna('luna://com.webos.service.eim/getAllInputStatus', {}, function (res) {
      if (res) take(res);
      else Platform.lunaRoot('luna://com.webos.service.eim/getAllInputStatus', {}, take);
    });
  }

  /** An app's icon as a data URI, from the TV's own files, cached; done(uri or ''). */
  function icon(id, done) {
    if (window.PREVIEW) { done(window.PREVIEW.icon(id)); return; }
    if (icons[id]) { done(icons[id]); return; }
    var cached = null;
    try { cached = localStorage.getItem('dock.icon.' + id); } catch (e) {}
    if (cached) { icons[id] = cached; done(cached); return; }
    var app = byId[id];
    if (!app || !app.iconPath) { done(''); return; }
    Platform.readFileB64(app.iconPath, function (b64) {
      if (!b64) { done(''); return; }
      var uri = 'data:image/png;base64,' + b64;
      icons[id] = uri;
      try { localStorage.setItem('dock.icon.' + id, uri); } catch (e) {}
      done(uri);
    });
  }

  /** Loads every app's icon in the background, one at a time, so the picker opens complete. */
  function warm(done) {
    var i = 0;
    (function next() {
      if (i >= list.length) { if (done) done(); return; }
      icon(list[i++].id, function () { setTimeout(next, 80); });
    })();
  }

  function launch(id, done) {
    Platform.luna('luna://com.webos.applicationManager/launch', {id: id}, function (res) {
      if (res) { if (done) done(true); return; }
      Platform.lunaRoot('luna://com.webos.applicationManager/launch', {id: id}, function (res2) { if (done) done(!!res2); });
    });
  }

  function close(id, done) {
    Platform.lunaRoot('luna://com.webos.applicationManager/closeByAppId', {id: id}, function (res) { if (done) done(!!res); });
  }

  function foreground(done) {
    Platform.lunaRoot('luna://com.webos.applicationManager/getForegroundAppInfo', {}, function (res) {
      done(res && res.appId ? res.appId : '');
    });
  }

  return {
    load: load, loadInputs: loadInputs, icon: icon, warm: warm, launch: launch, close: close, foreground: foreground,
    list: function () { return list; },
    get: function (id) { return byId[id] || null; },
    knownTitle: function (id) { return TITLES[id] || ''; },
    inputs: function () { return inputs; },
    isInput: function (id) { return INPUT_IDS.indexOf(id) >= 0; },
    inputIds: INPUT_IDS,
    glyph: function (name) { return GLYPH[name] || ''; },
    inputLook: function (id, label) { var s = LOOKS[classify(id, label)]; return {svg: GLYPH[s.glyph], bg: s.bg, glow: s.glow}; },
    glow: function (id, label) { return INPUT_IDS.indexOf(id) >= 0 ? LOOKS[classify(id, label)].glow : (byId[id] && byId[id].glow) || GLOW[id] || '255,255,255'; },
    inputLabel: function (id) { var i = inputs[id]; return (i && i.label) || ('HDMI ' + id.replace(/\D/g, '')); }
  };
})();
