/*
 * Dock, the home screen: wires the wallpaper, glass, clock, Markets card and dock together and
 * handles the remote (5-way, OK, Back, the colour keys) and the Magic Remote's pointer.
 */
(function () {
  'use strict';

  var KEY = {left: 37, up: 38, right: 39, down: 40, ok: 13, back: 461, red: 403, green: 404, yellow: 405, blue: 406};
  var $ = function (id) { return document.getElementById(id); };

  var body = document.body, sky = $('sky'), fx = $('fx'), gear = $('gear'), market = $('market'), dock = $('dock'), dockGlass = $('dockglass'), tiles = $('tiles');
  var caption = $('caption'), hint = $('hint'), sheet = $('sheet'), panel = sheet.querySelector('.panel'), content = sheet.querySelector('.content');
  var island = $('island'), clockEl = $('clock'), clockWx = document.querySelector('#clock .wx');

  var zone = 'dock', dockIndex = 0, sheetIndex = 0, sheetItems = [], sheetMode = '', editing = false;
  var lastLaunched = null, islandTimer = null, wallpaper = '', captionShown = false, ready = false;
  var idleAt = Date.now(), saverOn = false, shiftTimer = null;

  var ICON = {
    plus: '<svg viewBox="0 0 48 48"><path d="M24 11v26M11 24h26" stroke="#fff" stroke-width="4.6" stroke-linecap="round"/></svg>',
    grid: '<svg viewBox="0 0 48 48" fill="#fff"><rect x="8" y="8" width="13.5" height="13.5" rx="4"/><rect x="26.5" y="8" width="13.5" height="13.5" rx="4"/><rect x="8" y="26.5" width="13.5" height="13.5" rx="4"/><rect x="26.5" y="26.5" width="13.5" height="13.5" rx="4"/></svg>',
    photo: '<svg viewBox="0 0 48 48"><rect x="6" y="10" width="36" height="28" rx="6" fill="none" stroke="#fff" stroke-width="3.4"/><circle cx="17" cy="19.5" r="3.6" fill="#fff"/><path d="M8 35l10-9.5 6.5 6 6-4.5L41 34" fill="none" stroke="#fff" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round"/></svg>',
    chart: '<svg viewBox="0 0 48 48"><path d="M7 34l9.5-10.5 7.5 6.5 8.5-11.5L41 25" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    bolt: '<svg viewBox="0 0 48 48"><path d="M27.5 4L11 27h11.5L19.5 44 37 20H25.5z" fill="#fff"/></svg>',
    gear: '<svg viewBox="0 0 48 48"><g fill="#fff"><rect x="20.5" y="2" width="7" height="10" rx="2.6"/><rect x="20.5" y="2" width="7" height="10" rx="2.6" transform="rotate(45 24 24)"/><rect x="20.5" y="2" width="7" height="10" rx="2.6" transform="rotate(90 24 24)"/><rect x="20.5" y="2" width="7" height="10" rx="2.6" transform="rotate(135 24 24)"/><rect x="20.5" y="2" width="7" height="10" rx="2.6" transform="rotate(180 24 24)"/><rect x="20.5" y="2" width="7" height="10" rx="2.6" transform="rotate(225 24 24)"/><rect x="20.5" y="2" width="7" height="10" rx="2.6" transform="rotate(270 24 24)"/><rect x="20.5" y="2" width="7" height="10" rx="2.6" transform="rotate(315 24 24)"/></g><circle cx="24" cy="24" r="11.2" fill="none" stroke="#fff" stroke-width="7"/></svg>',
    info: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="17" fill="none" stroke="#fff" stroke-width="3.4"/><rect x="21.7" y="21" width="4.6" height="13" rx="2.3" fill="#fff"/><circle cx="24" cy="15.2" r="2.8" fill="#fff"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path fill="#fff" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    play: '<svg viewBox="0 0 48 48"><rect x="5" y="9" width="38" height="30" rx="7" fill="none" stroke="#fff" stroke-width="3.4"/><path d="M20 17.5v13l11-6.5z" fill="#fff"/></svg>',
    check: '<svg viewBox="0 0 42 42"><circle cx="21" cy="21" r="21" fill="#30d158"/><path d="M12.5 21.5l5.5 5.5 11.5-12" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chev: '<svg class="chev" viewBox="0 0 12 20"><path d="M2.5 2.5l7.5 7.5-7.5 7.5" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  var TINT = {
    blue: 'linear-gradient(160deg,#4aa3ff,#0a6cff)', indigo: 'linear-gradient(160deg,#7d7bff,#4a47d8)', teal: 'linear-gradient(160deg,#4fd1e8,#1b8fb3)',
    orange: 'linear-gradient(160deg,#ffb340,#ff7a00)', purple: 'linear-gradient(160deg,#d68bff,#9b3fe0)', gray: 'linear-gradient(160deg,#a1a1aa,#636370)',
    pink: 'linear-gradient(160deg,#ff7aa8,#e0306e)'
  };

  // MARK: - Wallpaper and glass

  function paintWallpaper() {
    var style = Dock.config().wallpaper || 'desert';
    wallpaper = style;
    Glass.setSource(Wallpaper.render(sky, style));
    FX.start(fx, style);
  }

  // MARK: - Focus

  function focusables(z) {
    if (z === 'dock') return Dock.elements();
    if (z === 'top') return [gear];
    return sheetItems;
  }

  function updateFocus() {
    var all = document.querySelectorAll('.focus');
    for (var i = 0; i < all.length; i++) all[i].classList.remove('focus');
    var items = focusables(zone);
    var idx = zone === 'dock' ? dockIndex : zone === 'top' ? 0 : sheetIndex;
    if (idx >= items.length) idx = items.length - 1;
    if (idx < 0) idx = 0;
    if (zone === 'dock') dockIndex = idx; else if (zone === 'sheet') sheetIndex = idx;
    var el = items[idx];
    if (!el) { hideCaption(); return; }
    el.classList.add('focus');
    if (zone === 'dock' && !editing) showCaption(el, idx); else hideCaption();
    if (zone === 'sheet' && sheetMode === 'picker' && el.scrollIntoView) el.scrollIntoView({block: 'nearest'});
    if (ready) Perf.watch(zone);
  }

  function showCaption(el, idx) {
    caption.firstChild.textContent = Dock.captionFor(idx);
    var x = Math.round(dock.offsetLeft + tiles.offsetLeft + el.offsetLeft + el.offsetWidth / 2);
    if (!captionShown) {
      caption.className = 'instant';
      caption.style.transform = 'translateX(' + x + 'px)';
      void caption.offsetWidth;
      captionShown = true;
    }
    caption.style.transform = 'translateX(' + x + 'px)';
    caption.className = 'on';
  }

  function hideCaption() {
    caption.className = '';
    captionShown = false;
  }

  function focusElement(el) {
    if (!el) return;
    var z = el.getAttribute('data-zone');
    if (z === 'dock') { if (editing) return; zone = 'dock'; dockIndex = Dock.elements().indexOf(el); }
    else if (z === 'top') { if (editing) return; zone = 'top'; }
    else if (z === 'sheet') { zone = 'sheet'; sheetIndex = sheetItems.indexOf(el); }
    else return;
    updateFocus();
  }

  // MARK: - Toast

  function toast(text, iconHtml) {
    island.querySelector('.tx').textContent = text;
    island.querySelector('.ic').innerHTML = iconHtml || ICON.check;
    island.className = 'on';
    clearTimeout(islandTimer);
    islandTimer = setTimeout(function () { island.className = ''; }, 2600);
  }

  function appIconHtml(id, done) {
    Apps.icon(id, function (uri) { done(uri ? '<img alt="" src="' + uri + '">' : ICON.check); });
  }

  // MARK: - Dock actions

  function openTile(i) {
    var t = Dock.tiles()[i];
    if (!t) { openPicker(); return; }
    Apps.launch(t.id, function (ok) {
      if (!ok) { toast('Couldn’t open ' + Dock.labelFor(t)); return; }
      lastLaunched = t;
    });
  }

  function startEdit() {
    if (!Dock.tiles().length) { openPicker(); return; }
    closeSheet();
    editing = true;
    zone = 'dock';
    if (dockIndex >= Dock.tiles().length) dockIndex = Dock.tiles().length - 1;
    dock.classList.add('editing');
    hint.querySelector('.content').innerHTML = '<span class="k">◀ ▶</span>Move<span class="gap"></span><span class="k red"></span>Remove<span class="gap"></span><span class="k">OK</span>Done';
    hint.className = 'glass on';
    Glass.paint(hint);
    updateFocus();
  }

  function stopEdit() {
    editing = false;
    dock.classList.remove('editing');
    hint.className = 'glass';
    updateFocus();
  }

  // MARK: - Sheets

  function row(o) {
    var r = document.createElement('div');
    r.className = 'row focusable';
    r.setAttribute('data-zone', 'sheet');
    var right = o.toggle !== undefined ? '<span class="sw' + (o.toggle ? ' on' : '') + '"></span>'
        : '<span class="val"><span class="v"></span>' + (o.chevron === false ? '' : ICON.chev) + '</span>';
    r.innerHTML = '<span class="ic" style="background:' + TINT[o.color] + '">' + ICON[o.icon] + '</span><span class="name"></span>' + right;
    r.querySelector('.name').textContent = o.label;
    if (o.value !== undefined) r.querySelector('.v').textContent = o.value;
    r.onactivate = o.action;
    return r;
  }

  function plainRow(label, value) {
    var r = document.createElement('div');
    r.className = 'row plain';
    r.innerHTML = '<span class="name"></span><span class="val"><span class="v"></span></span>';
    r.querySelector('.name').textContent = label;
    r.querySelector('.v').textContent = value;
    return r;
  }

  function group(rows) {
    var g = document.createElement('div');
    g.className = 'group';
    for (var i = 0; i < rows.length; i++) g.appendChild(rows[i]);
    return g;
  }

  function openSheet(title, sub, mode, nodes, keepIndex) {
    sheetMode = mode;
    sheet.className = mode === 'picker' ? 'wide' : '';
    content.innerHTML = '';
    var head = document.createElement('div');
    head.innerHTML = '<h2></h2><div class="sub"></div>';
    head.querySelector('h2').textContent = title;
    head.querySelector('.sub').textContent = sub || '';
    content.appendChild(head);
    for (var i = 0; i < nodes.length; i++) content.appendChild(nodes[i]);
    sheetItems = Array.prototype.slice.call(content.querySelectorAll('.focusable'));
    zone = 'sheet';
    sheetIndex = keepIndex ? Math.min(sheetIndex, sheetItems.length - 1) : 0;
    sheet.classList.add('open');
    Glass.paint(panel);
    updateFocus();
  }

  function closeSheet() {
    if (!sheet.classList.contains('open')) return;
    sheet.classList.remove('open');
    sheetItems = [];
    sheetMode = '';
    zone = 'top';
    updateFocus();
  }

  function openSettings(keepIndex) {
    var cfg = Dock.config(), after = saverAfter();
    openSheet('Settings', 'Dock ' + (window.DOCK_VERSION || '') + (Platform.model ? ' · ' + Platform.model : ''), 'settings', [
      group([
        row({icon: 'plus', color: 'blue', label: 'Add to Dock', action: openPicker}),
        row({icon: 'grid', color: 'indigo', label: 'Edit Dock', value: 'Move and remove', action: startEdit})
      ]),
      group([
        row({icon: 'photo', color: 'teal', label: 'Wallpaper', value: Wallpaper.name(cfg.wallpaper), action: function () {
          Dock.set('wallpaper', Wallpaper.next(cfg.wallpaper || 'desert'));
          paintWallpaper();
          openSettings(true);
        }}),
        row({icon: 'moon', color: 'indigo', label: 'Screen Saver', value: saverLabel(after), action: function () {
          Dock.set('saverAfter', SAVER_STEPS[(SAVER_STEPS.indexOf(after) + 1) % SAVER_STEPS.length]);
          openSettings(true);
        }}),
        row({icon: 'play', color: 'purple', label: 'Show Screen Saver', chevron: false, action: function () {
          closeSheet();
          zone = 'dock';
          showSaver();
        }})
      ]),
      group([
        row({icon: 'chart', color: 'orange', label: 'Markets', toggle: cfg.ticker !== false, action: function () {
          Dock.set('ticker', cfg.ticker === false);
          Ticker.setEnabled(Dock.config().ticker !== false);
          openSettings(true);
        }}),
        row({icon: 'bolt', color: 'pink', label: 'Close Apps When Leaving', toggle: cfg.closeOnLeave !== false, action: function () {
          Dock.set('closeOnLeave', cfg.closeOnLeave === false);
          openSettings(true);
        }})
      ]),
      group([
        row({icon: 'gear', color: 'gray', label: 'TV Settings', action: function () { Apps.launch('com.palm.app.settings'); }}),
        row({icon: 'info', color: 'gray', label: 'About This TV', action: openAbout})
      ])
    ], keepIndex);
  }

  function openPicker() {
    var cands = Dock.candidates();
    var nodes = [];
    if (!cands.length) {
      var e = document.createElement('div');
      e.className = 'empty';
      e.textContent = 'Everything this TV has is already on the dock.';
      nodes.push(e);
    } else {
      var grid = document.createElement('div');
      grid.className = 'pick';
      cands.forEach(function (c) {
        var cell = document.createElement('div');
        cell.className = 'cell focusable';
        cell.setAttribute('data-zone', 'sheet');
        cell.innerHTML = '<div class="icon"></div><div class="label"></div>';
        var icon = cell.querySelector('.icon');
        if (c.kind === 'input') {
          var look = Apps.inputLook(c.id, c.title);
          icon.style.background = look.bg;
          icon.innerHTML = look.svg;
        } else {
          var img = document.createElement('img');
          img.alt = '';
          icon.appendChild(img);
          Apps.icon(c.id, function (uri) { if (uri) img.src = uri; else img.style.visibility = 'hidden'; });
        }
        cell.querySelector('.label').textContent = c.title;
        cell.onactivate = function () {
          var at = Dock.add({kind: c.kind, id: c.id});
          closeSheet();
          zone = 'dock';
          dockIndex = at === false ? dockIndex : at;
          updateFocus();
          if (c.kind === 'app') appIconHtml(c.id, function (html) { toast(c.title + ' added to Dock', html); });
          else toast(c.title + ' added to Dock', '<span style="display:block;width:42px;height:42px;background:' + Apps.inputLook(c.id, c.title).bg + '"></span>');
        };
        grid.appendChild(cell);
      });
      nodes.push(grid);
    }
    openSheet('Add to Dock', cands.length ? cands.length + ' apps and inputs on this TV' : '', 'picker', nodes);
  }

  function openAbout() {
    var g = group([plainRow('Reading…', '')]);
    openSheet('About This TV', '', 'about', [g]);
    Platform.exec("echo MODEL=$(luna-send -n 1 -w 3000 luna://com.webos.service.tv.systemproperty/getSystemInfo '{\"keys\":[\"modelName\",\"firmwareVersion\",\"sdkVersion\"]}' </dev/null); " +
        "echo MEM=$(free -m | awk 'NR==2{print $7\" MB available of \"$2\" MB\"}'); echo UP=$(uptime | sed 's/.*up //; s/,  *load.*//'); " +
        "echo APPS=$(luna-send -n 1 -w 3000 luna://com.webos.applicationManager/running '{}' </dev/null | grep -o '\"id\":\"[^\"]*\"' | sed 's/\"id\":\"//; s/\"//' | tr '\\n' ' ')", function (out) {
      var m = /MODEL=(.*)/.exec(out || ''), mem = /MEM=(.*)/.exec(out || ''), up = /UP=(.*)/.exec(out || ''), apps = /APPS=(.*)/.exec(out || '');
      var info = {};
      try { info = JSON.parse(m ? m[1] : '{}'); } catch (e) {}
      g.innerHTML = '';
      [['Model', info.modelName || '?'], ['webOS', info.sdkVersion || '?'], ['Firmware', info.firmwareVersion || '?'],
        ['Memory', mem ? mem[1] : '?'], ['Up', up ? up[1] : '?'], ['Running', apps ? apps[1].trim() : '?'],
        ['Weather', (Dock.config().weatherPlace ? Dock.config().weatherPlace.name + ' · ' : '') + 'data by Open-Meteo.com (CC BY 4.0)'],
        ['Markets', 'data by ' + Ticker.feedName()],
        ['Dock', (window.DOCK_VERSION || '') + ' · rooted · Homebrew Channel']].forEach(function (p) { g.appendChild(plainRow(p[0], p[1])); });
      Glass.paint(panel);
    });
  }

  // MARK: - Screen saver (the lock screen)

  var SAVER_STEPS = [2, 5, 10, 0];   // minutes idle on the home screen; 0 = never

  function saverAfter() {
    var m = Dock.config().saverAfter;
    return typeof m === 'number' ? m : 2;
  }

  function saverLabel(m) { return m ? 'After ' + m + ' Minutes' : 'Off'; }

  function showSaver() {
    if (saverOn) return;
    saverOn = true;
    if (sheet.classList.contains('open')) closeSheet();
    if (editing) stopEdit();
    zone = 'dock';
    hideCaption();
    body.classList.add('fading');
    setTimeout(function () {
      if (!saverOn) return;
      body.classList.add('saver');
      if (market.style.display !== 'none') {
        market.style.right = 'auto';
        market.style.left = Math.round((1920 - market.offsetWidth) / 2) + 'px';
        Glass.paint(market);
      }
      FX.saver(true);
      shift();
      body.classList.remove('fading');
      Platform.log('lock screen on');
    }, 520);
  }

  // Every minute the lock screen moves a few pixels, so nothing sits still on the panel for hours.
  function shift() {
    clearTimeout(shiftTimer);
    if (!saverOn) return;
    var x = Math.round((Math.random() - 0.5) * 40), y = Math.round((Math.random() - 0.5) * 24);
    clockEl.style.transform = market.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    shiftTimer = setTimeout(shift, 60000);
  }

  function unsaver() {
    body.classList.remove('saver');
    clockEl.style.transform = market.style.transform = '';
    market.style.left = market.style.right = '';
    Glass.paint(market);
    FX.saver(false);
  }

  function hideSaver(instant) {
    if (!saverOn) return;
    saverOn = false;
    clearTimeout(shiftTimer);
    if (instant) {
      unsaver();
      body.classList.remove('fading');
      sky.style.transform = fx.style.transform = '';
      return;
    }
    body.classList.add('fading');
    // the drifting sky eases back instead of jumping: hold where the drift is, then let go
    var held = [sky, fx].map(function (el) { return getComputedStyle(el).transform; });
    setTimeout(function () {
      sky.style.transform = held[0] === 'none' ? '' : held[0];
      fx.style.transform = held[1] === 'none' ? '' : held[1];
      unsaver();
      void sky.offsetWidth;
      [sky, fx].forEach(function (el) {
        el.style.transition = 'transform 1.4s ease';
        el.style.transform = '';
        setTimeout(function () { el.style.transition = ''; }, 1500);
      });
      body.classList.remove('fading');
      updateFocus();
    }, 460);
  }

  /** Any button or pointer movement: counts as activity, and wakes the lock screen (that press does nothing else). */
  function poke() {
    idleAt = Date.now();
    if (!saverOn) return false;
    hideSaver();
    return true;
  }

  // LG asks the apps that registered before it shows its own screensaver. While Dock is on screen
  // the answer is no, and the lock screen shows instead.
  function holdLgSaver() {
    if (!Platform.webos) return;
    var first = true;
    Platform.subscribe('luna://com.webos.service.tvpower/power/registerScreenSaverRequest', {subscribe: true, clientName: Platform.self}, function (m) {
      if (first) {
        first = false;
        Platform.log('LG screensaver hook: ' + (m && m.returnValue !== false ? 'registered' : 'refused ' + JSON.stringify(m)));
      }
      if (!m || m.timestamp === undefined) return;
      var ours = !document.hidden && saverAfter() !== 0;
      Platform.luna('luna://com.webos.service.tvpower/power/responseScreenSaverRequest', {clientName: Platform.self, ack: !ours, timestamp: m.timestamp});
      Platform.log('LG screensaver asked: ' + (ours ? 'held, lock screen instead' : 'let through'));
      if (ours && zone !== 'sheet' && !editing) showSaver();
    });
  }

  setInterval(function () {
    var m = saverAfter();
    if (!m || saverOn || document.hidden || zone === 'sheet' || editing) return;
    if (Date.now() - idleAt >= m * 60000) showSaver();
  }, 5000);

  // MARK: - Keys

  function gridColumns() {
    if (sheetItems.length < 2) return 1;
    var top = sheetItems[0].offsetTop, n = 1;
    while (n < sheetItems.length && sheetItems[n].offsetTop === top) n++;
    return n;
  }

  function onKey(k) {
    if (zone === 'sheet') {
      var cols = sheetMode === 'picker' ? gridColumns() : 1;
      if (k === KEY.left) { if (cols > 1) sheetIndex = Math.max(0, sheetIndex - 1); }
      else if (k === KEY.right) { if (cols > 1) sheetIndex = Math.min(sheetItems.length - 1, sheetIndex + 1); }
      else if (k === KEY.up) { if (sheetIndex - cols >= 0) sheetIndex -= cols; }
      else if (k === KEY.down) { if (sheetIndex + cols < sheetItems.length) sheetIndex += cols; else if (cols > 1) sheetIndex = sheetItems.length - 1; }
      else if (k === KEY.ok) { var it = sheetItems[sheetIndex]; if (it && it.onactivate) it.onactivate(); return true; }
      else if (k === KEY.back) { if (sheetMode === 'settings') closeSheet(); else openSettings(); return true; }
      else return false;
      updateFocus();
      return true;
    }
    if (editing) {
      if (k === KEY.left) dockIndex = Dock.move(dockIndex, -1);
      else if (k === KEY.right) dockIndex = Dock.move(dockIndex, 1);
      else if (k === KEY.red) {
        var gone = Dock.labelFor(Dock.tiles()[dockIndex]);
        Dock.remove(dockIndex);
        toast(gone + ' removed');
        if (!Dock.tiles().length) { stopEdit(); return true; }
        if (dockIndex >= Dock.tiles().length) dockIndex = Dock.tiles().length - 1;
      }
      else if (k === KEY.ok || k === KEY.back) { stopEdit(); return true; }
      else return false;
      Glass.paint(dockGlass);
      updateFocus();
      return true;
    }
    if (zone === 'dock') {
      var n = Dock.elements().length;
      if (k === KEY.left) dockIndex = Math.max(0, dockIndex - 1);
      else if (k === KEY.right) dockIndex = Math.min(n - 1, dockIndex + 1);
      else if (k === KEY.up) zone = 'top';
      else if (k === KEY.ok) { openTile(dockIndex); return true; }
      else if (k === KEY.blue) { if (dockIndex < Dock.tiles().length) startEdit(); return true; }
      else if (k === KEY.back) return true;   // Home is the bottom: Back has nowhere to go
      else return false;
      updateFocus();
      return true;
    }
    if (zone === 'top') {
      if (k === KEY.down || k === KEY.left || k === KEY.back) zone = 'dock';
      else if (k === KEY.ok) { openSettings(); return true; }
      else return false;
      updateFocus();
      return true;
    }
    return false;
  }

  document.addEventListener('keydown', function (e) {
    if (poke()) { e.preventDefault(); return; }   // the first press only wakes the lock screen
    if (e.keyCode === KEY.yellow && zone === 'dock' && !editing) { showSaver(); e.preventDefault(); return; }
    if (onKey(e.keyCode)) e.preventDefault();
  });
  document.addEventListener('mousemove', function () { poke(); });

  // The Magic Remote's pointer: hovering focuses, clicking opens.
  function focusableOf(el) {
    while (el && el !== document.body && !(el.classList && el.classList.contains('focusable'))) el = el.parentNode;
    return el && el !== document.body ? el : null;
  }
  document.addEventListener('mouseover', function (e) { focusElement(focusableOf(e.target)); });
  document.addEventListener('click', function (e) {
    var el = focusableOf(e.target);
    if (!el) { if (zone === 'sheet' && e.target === sheet) closeSheet(); return; }
    focusElement(el);
    onKey(KEY.ok);
  });
  document.addEventListener('cursorStateChange', function (e) {
    var visible = !!(e.detail && e.detail.visibility);
    body.classList.toggle('pointer', visible);
  });

  // MARK: - Lifecycle

  function focusForeground() {
    Apps.foreground(function (id) {
      if (!id) return;
      var t = Dock.tiles();
      for (var i = 0; i < t.length; i++) if (t[i].id === id) { dockIndex = i; updateFocus(); return; }
    });
  }

  function refresh() {
    Apps.loadInputs(function () { Dock.render(); Glass.paint(dockGlass); updateFocus(); });
  }

  function cameBack() {
    if (window.PalmSystem && window.PalmSystem.activate) window.PalmSystem.activate();
    hideSaver(true);
    idleAt = Date.now();
    closeSheet();
    if (editing) stopEdit();
    zone = 'dock';
    Clock.refresh();
    Ticker.resume();
    if (lastLaunched && Dock.config().closeOnLeave !== false && lastLaunched.kind === 'app') {
      var id = lastLaunched.id;
      setTimeout(function () { Apps.close(id); }, 800);
    }
    lastLaunched = null;
    refresh();
  }

  document.addEventListener('webOSRelaunch', cameBack);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { Ticker.pause(); hideSaver(true); return; }
    cameBack();
  });

  // MARK: - Start

  function reveal() {
    if (ready) return;
    ready = true;
    Glass.paint(market);
    Glass.paint(gear);
    Glass.paint(dockGlass);
    body.classList.remove('booting');
    body.classList.add('ready');
    updateFocus();
    // once the entrance has played, drop it: finished animations would pin opacity and block the fades
    setTimeout(function () { body.classList.remove('ready'); body.classList.add('settled'); }, 1800);
  }

  Clock.start($('clock'));
  Dock.init(tiles, function () { Glass.paint(dockGlass); updateFocus(); });
  Dock.load(function (cfg, fromTv) {
    if (!wallpaper || cfg.wallpaper !== wallpaper) paintWallpaper();
    Dock.render();
    Glass.paint(dockGlass);
    if (!fromTv) {
      Ticker.init(market, cfg.ticker !== false);
      Weather.onChange(function () { Weather.render(clockWx); });
      Weather.start();
      holdLgSaver();
      Apps.load(function () {
        Apps.loadInputs(function () {
          Dock.seedInputs();
          Dock.render();
          Glass.paint(dockGlass);
          updateFocus();
          focusForeground();
          setTimeout(Apps.warm, 1500);
        });
      });
    } else {
      Ticker.setEnabled(cfg.ticker !== false);
    }
    updateFocus();
  });

  // Glass needs final sizes, which need the font: reveal once it's in (or after a second regardless).
  try { document.fonts.ready.then(reveal); } catch (e) {}
  setTimeout(reveal, 1200);

  var x = new XMLHttpRequest();
  x.onreadystatechange = function () { if (x.readyState === 4) { try { window.DOCK_VERSION = JSON.parse(x.responseText).version; } catch (e) {} } };
  try { x.open('GET', 'appinfo.json', true); x.send(); } catch (e) {}
})();
