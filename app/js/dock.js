/*
 * The dock: its tiles (inputs and apps), the saved configuration, adding, moving and removing
 * tiles, and the picker of everything else the TV has.
 */
var Dock = (function () {
  'use strict';

  var CONFIG_PATH = '/var/lib/webosbrew/tvproject/dock.json';
  var LS_KEY = 'dock.config';

  // The first run on a TV puts its connected inputs ahead of these (trySeed)
  var DEFAULT = {
    version: 2,
    tiles: [
      {kind: 'app', id: 'youtube.leanback.v4'},
      {kind: 'app', id: 'netflix'},
      {kind: 'app', id: 'amazon'},
      {kind: 'app', id: 'com.apple.appletv'}
    ],
    ticker: true,
    closeOnLeave: true,
    wallpaper: 'desert'
  };

  var cfg = null, tilesEl = null, onChange = null, focusables = [];
  var needSeed = false, inputsKnown = false;

  // MARK: - Saved configuration

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /** A saved configuration, upgraded to the current version; null if it isn't one. */
  function upgrade(c) {
    if (!c || !c.tiles || c.tiles.length === undefined) return null;
    if (c.version === 1) {
      c.version = 2;
      if (!c.wallpaper) c.wallpaper = DEFAULT.wallpaper;
    }
    return c.version === 2 ? c : null;
  }

  function load(done) {
    var local = null;
    try { local = upgrade(JSON.parse(localStorage.getItem(LS_KEY))); } catch (e) {}
    cfg = local || clone(DEFAULT);
    done(cfg, false);
    Platform.readFile(CONFIG_PATH, function (text) {
      var saved = null;
      try { saved = upgrade(JSON.parse(text)); } catch (e) {}
      if (saved && JSON.stringify(saved) !== JSON.stringify(cfg)) {
        cfg = saved;
        try { localStorage.setItem(LS_KEY, JSON.stringify(cfg)); } catch (e) {}
        done(cfg, true);
      } else if (!saved && local) {
        save();   // an older file: the current settings go to the TV
      } else if (!saved) {
        needSeed = true;   // first run on this TV: the dock starts with what is plugged in
        trySeed();
      }
    });
  }

  /** First run, once the TV has listed its inputs: the connected ones, in port order, ahead of the default apps. */
  function trySeed() {
    if (!needSeed || !inputsKnown) return;
    needSeed = false;
    var ids = Apps.inputIds, all = Apps.inputs(), seeded = [];
    for (var i = 0; i < ids.length; i++) if (all[ids[i]] && all[ids[i]].connected) seeded.push({kind: 'input', id: ids[i]});
    cfg.tiles = seeded.concat(cfg.tiles);
    save();
    if (tilesEl) render();
  }

  function save() {
    var text = JSON.stringify(cfg, null, 2);
    try { localStorage.setItem(LS_KEY, text); } catch (e) {}
    Platform.writeFile(CONFIG_PATH, text);
    if (onChange) onChange(cfg);
  }

  // MARK: - Tiles

  function labelFor(t) {
    if (t.label) return t.label;
    if (t.kind === 'input') return Apps.inputLabel(t.id);
    var a = Apps.get(t.id);
    return a ? a.title : (Apps.knownTitle(t.id) || t.id);
  }

  function tileEl(t, i) {
    var d = document.createElement('div');
    d.className = 'tile focusable';
    d.setAttribute('data-zone', 'dock');
    d.setAttribute('data-i', i);
    d.style.setProperty('--glow', 'rgba(' + Apps.glow(t.id, t.label) + ',0.70)');
    d.innerHTML = '<div class="glow"></div><div class="icon"><div class="shine"></div></div><div class="minus"></div><div class="dot"></div>';
    var icon = d.querySelector('.icon');
    if (t.kind === 'input') {
      var look = Apps.inputLook(t.id, labelFor(t));
      icon.className = 'icon input';
      icon.style.background = look.bg;
      icon.insertAdjacentHTML('afterbegin', look.svg);
      var inp = Apps.inputs()[t.id];
      if (inp && inp.connected) d.className += ' on';
    } else {
      var img = document.createElement('img');
      img.alt = '';
      icon.insertBefore(img, icon.firstChild);
      Apps.icon(t.id, function (uri) {
        if (uri) { img.src = uri; return; }
        icon.removeChild(img);
        icon.className = 'icon letter';
        icon.insertAdjacentHTML('afterbegin', '<span>' + labelFor(t).charAt(0).toUpperCase() + '</span>');
      });
    }
    return d;
  }

  function sep() {
    var s = document.createElement('div');
    s.className = 'sep';
    return s;
  }

  function render() {
    tilesEl.innerHTML = '';
    focusables = [];
    var tiles = cfg.tiles;
    for (var i = 0; i < tiles.length; i++) {
      if (i > 0 && tiles[i].kind !== tiles[i - 1].kind) tilesEl.appendChild(sep());
      var el = tileEl(tiles[i], i);
      tilesEl.appendChild(el);
      focusables.push(el);
    }
    if (tiles.length) tilesEl.appendChild(sep());
    var add = document.createElement('div');
    add.className = 'tile add focusable';
    add.setAttribute('data-zone', 'dock');
    add.setAttribute('data-i', tiles.length);
    add.style.setProperty('--glow', 'rgba(255,255,255,0.45)');
    add.innerHTML = '<div class="glow"></div><div class="icon add">' + Apps.glyph('plus') + '<div class="shine"></div></div>';
    tilesEl.appendChild(add);
    focusables.push(add);
  }

  function move(i, dir) {
    var j = i + dir;
    if (i < 0 || i >= cfg.tiles.length || j < 0 || j >= cfg.tiles.length) return i;
    var t = cfg.tiles[i];
    cfg.tiles[i] = cfg.tiles[j];
    cfg.tiles[j] = t;
    save();
    render();
    return j;
  }

  function remove(i) {
    if (i < 0 || i >= cfg.tiles.length) return;
    cfg.tiles.splice(i, 1);
    save();
    render();
  }

  function add(entry) {
    for (var i = 0; i < cfg.tiles.length; i++) if (cfg.tiles[i].id === entry.id) return false;
    // inputs join the other inputs, apps go after the apps
    var at = cfg.tiles.length;
    if (entry.kind === 'input') {
      at = 0;
      while (at < cfg.tiles.length && cfg.tiles[at].kind === 'input') at++;
    }
    cfg.tiles.splice(at, 0, entry);
    save();
    render();
    return at;
  }

  /** Everything the TV has that isn't on the dock yet: inputs first, then apps by name. */
  function candidates() {
    var on = {};
    for (var i = 0; i < cfg.tiles.length; i++) on[cfg.tiles[i].id] = true;
    var out = [];
    var have = Apps.inputs(), any = false, k, id;
    for (k = 0; k < Apps.inputIds.length; k++) if (have[Apps.inputIds[k]]) any = true;
    for (k = 0; k < Apps.inputIds.length; k++) {
      id = Apps.inputIds[k];
      // only the ports this TV has (the 55" has two); all four until the TV has answered
      if ((!any || have[id]) && !on[id]) out.push({kind: 'input', id: id, title: Apps.inputLabel(id)});
    }
    var apps = Apps.list();
    for (var j = 0; j < apps.length; j++) if (!on[apps[j].id]) out.push({kind: 'app', id: apps[j].id, title: apps[j].title});
    return out;
  }

  return {
    init: function (container, changed) { tilesEl = container; onChange = changed || null; },
    load: load,
    seedInputs: function () { inputsKnown = true; trySeed(); },
    render: render,
    elements: function () { return focusables; },
    tiles: function () { return cfg.tiles; },
    config: function () { return cfg; },
    set: function (key, value) { cfg[key] = value; save(); },
    labelFor: labelFor,
    captionFor: function (i) { return i < cfg.tiles.length ? labelFor(cfg.tiles[i]) : 'Add to Dock'; },
    move: move,
    remove: remove,
    add: add,
    candidates: candidates
  };
})();
