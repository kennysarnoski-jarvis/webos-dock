/*
 * The Markets card: BTC, ETH and SOL with 24-hour sparklines, prices flashing green or red as they
 * tick. Prices come from CoinGecko's free public API (no key, no account): quotes every 60 s and
 * the 24-hour line every 15 minutes, well inside its rate limit. A script loaded before this one
 * may define window.PrivateFeed ({name, tokenPath, period, quotes(), spark()}); when the TV holds
 * that feed's token it is used instead, CoinGecko fills in whenever it stops answering, and the
 * private feed is tried again every 10 minutes.
 */
var Ticker = (function () {
  'use strict';

  var GECKO = 'https://api.coingecko.com/api/v3';
  var GECKO_ID = {BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana'};
  var GECKO_PERIOD = {quote: 60000, spark: 900000};
  var RETRY_MS = 600000;
  var PRIV = null;   // window.PrivateFeed, read at init

  var LOGO = {
    BTC: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#F7931A"/><path fill="#fff" d="M22.2 14.1c.3-2.1-1.3-3.2-3.4-3.9l.7-2.8-1.7-.4-.7 2.7-1.4-.3.7-2.7-1.7-.4-.7 2.8-1.1-.3-2.4-.6-.4 1.8s1.3.3 1.2.3c.7.2.8.6.8 1l-.8 3.2.2.1h-.2l-1.1 4.5c-.1.2-.3.5-.8.4 0 0-1.2-.3-1.2-.3l-.8 1.9 2.2.6 1.2.3-.7 2.8 1.7.4.7-2.8 1.4.4-.7 2.7 1.7.4.7-2.8c2.9.5 5.1.3 6-2.3.7-2.1 0-3.3-1.5-4.1 1.1-.3 1.9-1 2.2-2.5zm-3.9 5.4c-.5 2.1-4 1-5.2.7l.9-3.7c1.2.3 4.8.9 4.3 3zm.5-5.5c-.5 1.9-3.4.9-4.3.7l.8-3.3c1 .2 4 .7 3.5 2.6z"/></svg>',
    ETH: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#627EEA"/><g fill="#fff"><path fill-opacity=".6" d="M16.5 4v8.9l7.5 3.3z"/><path d="M16.5 4L9 16.2l7.5-3.3z"/><path fill-opacity=".6" d="M16.5 22v6l7.5-10.4z"/><path d="M16.5 28v-6L9 17.6z"/><path fill-opacity=".2" d="M16.5 20.6l7.5-4.4-7.5-3.3z"/><path fill-opacity=".6" d="M9 16.2l7.5 4.4v-7.7z"/></g></svg>',
    SOL: '<svg viewBox="0 0 32 32"><defs><linearGradient id="solg" x1="7" y1="24" x2="25" y2="8" gradientUnits="userSpaceOnUse"><stop stop-color="#9945FF"/><stop offset="1" stop-color="#14F195"/></linearGradient></defs><circle cx="16" cy="16" r="16" fill="#101018"/>' +
        '<g fill="url(#solg)"><path d="M10.7 19.8c.1-.1.3-.2.5-.2h12.6c.3 0 .5.4.2.6l-2.5 2.5c-.1.1-.3.2-.5.2H8.4c-.3 0-.5-.4-.2-.6z"/><path d="M10.7 9.1c.1-.1.3-.2.5-.2h12.6c.3 0 .5.4.2.6l-2.5 2.5c-.1.1-.3.2-.5.2H8.4c-.3 0-.5-.4-.2-.6z"/><path d="M21.3 14.4c-.1-.1-.3-.2-.5-.2H8.2c-.3 0-.5.4-.2.6l2.5 2.5c.1.1.3.2.5.2h12.6c.3 0 .5-.4.2-.6z"/></g></svg>'
  };

  var root, coinsEl, liveEl, token = '', coins = ['BTC', 'ETH', 'SOL'], ui = {};
  var source = 'gecko', retryAt = 0;   // 'gecko' or 'private'
  var quoteTimer = null, sparkTimer = null, running = false, enabled = true, failures = 0;
  var lastSpark = {}, lastPrice = {};

  // MARK: - Feeds

  function request(url, bearer, done) {
    var x = new XMLHttpRequest();
    x.open('GET', url, true);
    if (bearer) x.setRequestHeader('Authorization', 'Bearer ' + bearer);
    x.timeout = 8000;
    x.onreadystatechange = function () {
      if (x.readyState !== 4) return;
      var body = null;
      if (x.status === 200) { try { body = JSON.parse(x.responseText); } catch (e) {} }
      done(body, x.status);
    };
    x.ontimeout = function () { done(null, 0); };
    try { x.send(); } catch (e) { done(null, 0); }
  }

  // the desktop preview makes its prices up, unless the page was opened with ?markets=live
  function mocked() { return !!(window.PREVIEW && !window.PREVIEW.liveMarkets); }

  /** Quotes as {feed, quotes: {SYM: {last, chg, pct}}}; done(null, status) when the feed fails. */
  function fetchQuotes(done) {
    if (mocked()) { mockQuotes(done); return; }
    if (source === 'private') { PRIV.quotes(request, token, coins, done); return; }
    var ids = coins.map(function (s) { return GECKO_ID[s]; }).join(',');
    request(GECKO + '/simple/price?ids=' + ids + '&vs_currencies=usd&include_24hr_change=true', '', function (body, code) {
      var q = {}, any = false;
      coins.forEach(function (s) {
        var row = body && body[GECKO_ID[s]];
        if (!row || typeof row.usd !== 'number') return;
        var pct = typeof row.usd_24h_change === 'number' ? row.usd_24h_change : 0;
        q[s] = {last: row.usd, pct: pct, chg: row.usd - row.usd / (1 + pct / 100)};
        any = true;
      });
      done(any ? {feed: 'gecko', quotes: q} : null, code);
    });
  }

  /** 24 hourly closes per coin as {closes: {SYM: [...]}}; done(null) when the feed fails. */
  function fetchSpark(done) {
    if (mocked()) { mockSpark(done); return; }
    if (source === 'private') { PRIV.spark(request, token, coins, done); return; }
    // CoinGecko answers with 5-minute points for the last day, one coin per request
    var closes = {}, i = 0;
    (function next() {
      if (i >= coins.length) { done({closes: closes}); return; }
      var sym = coins[i++];
      request(GECKO + '/coins/' + GECKO_ID[sym] + '/market_chart?vs_currency=usd&days=1', '', function (body) {
        if (body && body.prices && body.prices.length > 1) closes[sym] = hourly(body.prices);
        setTimeout(next, 1200);   // its free tier dislikes bursts
      });
    })();
  }

  /** [[ms, price], ...] at any spacing -> the last price of each of the last 24 clock hours. */
  function hourly(points) {
    var byHour = {}, hours = [];
    for (var i = 0; i < points.length; i++) {
      var h = Math.floor(points[i][0] / 3600000);
      if (byHour[h] === undefined) hours.push(h);
      byHour[h] = points[i][1];
    }
    var out = [];
    for (var j = Math.max(0, hours.length - 24); j < hours.length; j++) out.push(byHour[hours[j]]);
    return out;
  }

  // The browser preview's market: a random walk from one day's prices
  var walk = {BTC: 80552, ETH: 2350.4, SOL: 101.65}, open = {BTC: 80845, ETH: 2357.6, SOL: 102.33};
  function mockQuotes(done) {
    var q = {};
    coins.forEach(function (s) {
      walk[s] *= 1 + (Math.random() - 0.5) * 0.0012;
      q[s] = {last: walk[s], chg: walk[s] - open[s], pct: (walk[s] / open[s] - 1) * 100};
    });
    done({feed: PRIV ? 'live' : 'gecko', quotes: q}, 200);
  }
  function mockSpark(done) {
    var closes = {};
    coins.forEach(function (s, n) {
      var v = open[s], a = [];
      for (var i = 0; i < 24; i++) { v *= 1 + Math.sin(i * 0.7 + n * 2) * 0.0016 + (Math.random() - 0.5) * 0.0024; a.push(v); }
      a[23] = walk[s];
      closes[s] = a;
    });
    done({closes: closes});
  }

  // MARK: - Drawing

  function money(n) {
    var digits = n >= 1000 ? 0 : 2;
    try { return '$' + n.toLocaleString('en-US', {minimumFractionDigits: digits, maximumFractionDigits: digits}); } catch (e) { return '$' + n.toFixed(digits); }
  }

  function build() {
    coinsEl.innerHTML = '';
    coins.forEach(function (sym) {
      var d = document.createElement('div');
      d.className = 'coin';
      d.innerHTML = '<div class="r1"><span class="logo">' + (LOGO[sym] || '') + '</span><span class="sym">' + sym + '</span>' +
          '<span class="chg"><i></i><b>—</b></span></div><div class="price">—</div><canvas width="380" height="92"></canvas>';
      coinsEl.appendChild(d);
      ui[sym] = {price: d.querySelector('.price'), chg: d.querySelector('.chg'), pct: d.querySelector('.chg b'), canvas: d.querySelector('canvas'), up: true};
    });
  }

  function drawSpark(sym) {
    var u = ui[sym], closes = lastSpark[sym];
    if (!u || !closes || closes.length < 2) return;
    var c = u.canvas, ctx = c.getContext('2d'), w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);
    var min = Math.min.apply(null, closes), max = Math.max.apply(null, closes), span = max - min || 1;
    var rgb = u.up ? '48,209,88' : '255,69,58';
    var pts = [];
    for (var i = 0; i < closes.length; i++) pts.push([10 + (w - 26) * i / (closes.length - 1), 12 + (h - 24) * (1 - (closes[i] - min) / span)]);
    // area
    ctx.beginPath();
    ctx.moveTo(pts[0][0], h);
    for (i = 0; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineTo(pts[pts.length - 1][0], h);
    ctx.closePath();
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(' + rgb + ',0.32)');
    g.addColorStop(1, 'rgba(' + rgb + ',0)');
    ctx.fillStyle = g;
    ctx.fill();
    // line, with a soft glow under it
    ctx.beginPath();
    for (i = 0; i < pts.length; i++) { if (i) ctx.lineTo(pts[i][0], pts[i][1]); else ctx.moveTo(pts[i][0], pts[i][1]); }
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(' + rgb + ',0.35)';
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.strokeStyle = 'rgb(' + rgb + ')';
    ctx.lineWidth = 4;
    ctx.stroke();
    // now
    var e = pts[pts.length - 1];
    ctx.fillStyle = 'rgba(' + rgb + ',0.30)';
    ctx.beginPath(); ctx.arc(e[0], e[1], 11, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(e[0], e[1], 5, 0, 6.2832); ctx.fill();
  }

  function status(kind, text) {
    liveEl.className = 'live ' + kind;
    liveEl.querySelector('b').textContent = text;
  }

  function feedStatus(feed) {
    if (feed === 'live') status('ok', 'Live');
    else if (feed === 'backup') status('backup', 'Backup feed');
    else status(token ? 'backup' : 'ok', 'CoinGecko');
  }

  function flash(el, up) {
    el.className = 'price';
    void el.offsetWidth;
    el.className = 'price ' + (up ? 'flash-up' : 'flash-down');
    setTimeout(function () { el.className = 'price'; }, 120);
  }

  // MARK: - Polling

  function failed(code) {
    failures++;
    if (source === 'private' && failures >= 3) {
      // the private feed is down, or the token is refused: CoinGecko until it answers again
      source = 'gecko';
      retryAt = Date.now() + RETRY_MS;
      failures = 0;
      schedule();
      return;
    }
    if (failures >= 3) status('off', 'Offline');
  }

  function quotes() {
    if (!running) return;
    if (source === 'gecko' && token && Date.now() >= retryAt) { schedule(); return; }
    fetchQuotes(function (res, code) {
      if (!res) { failed(code); return; }
      failures = 0;
      feedStatus(res.feed);
      coins.forEach(function (sym) {
        var q = res.quotes[sym], u = ui[sym];
        if (!q || !u) return;
        var prev = lastPrice[sym];
        u.price.textContent = money(q.last);
        if (prev !== undefined && Math.abs(q.last - prev) > 1e-9) flash(u.price, q.last > prev);
        lastPrice[sym] = q.last;
        u.up = q.pct >= 0;
        u.chg.className = 'chg ' + (u.up ? 'up' : 'down');
        u.pct.textContent = Math.abs(q.pct).toFixed(2) + '%';
        if (lastSpark[sym]) drawSpark(sym);
      });
    });
  }

  function spark() {
    if (!running) return;
    fetchSpark(function (res) {
      if (!res) return;
      coins.forEach(function (sym) {
        if (res.closes[sym] && res.closes[sym].length) { lastSpark[sym] = res.closes[sym]; drawSpark(sym); }
      });
    });
  }

  function schedule() {
    clearInterval(quoteTimer);
    clearInterval(sparkTimer);
    if (!running) return;
    // with a token, the private feed is the feed; after a failure CoinGecko fills in until the retry is due
    if (source === 'gecko' && token && Date.now() >= retryAt) { source = 'private'; failures = 0; }
    quotes();
    spark();
    var p = source === 'private' ? (PRIV.period || GECKO_PERIOD) : GECKO_PERIOD;
    quoteTimer = setInterval(quotes, mocked() ? 2000 : p.quote);
    sparkTimer = setInterval(spark, p.spark);
  }

  return {
    init: function (container, on) {
      root = container;
      coinsEl = root.querySelector('.coins');
      liveEl = root.querySelector('.live');
      enabled = on !== false;
      build();
      root.style.display = enabled ? '' : 'none';
      status('off', 'Connecting');
      PRIV = window.PrivateFeed || null;
      if (!PRIV) { token = ''; source = 'gecko'; running = enabled; schedule(); return; }
      Platform.readFile(PRIV.tokenPath, function (text) {
        token = (text || '').replace(/\s+/g, '');
        source = token ? 'private' : 'gecko';
        running = enabled;
        schedule();
      });
    },
    setEnabled: function (on) {
      enabled = on;
      root.style.display = on ? '' : 'none';
      running = on && !document.hidden;
      schedule();
    },
    pause: function () { running = false; schedule(); },
    resume: function () { if (enabled) { running = true; schedule(); } },
    /** What the prices come from right now, for the About sheet. */
    feedName: function () { return source === 'private' ? PRIV.name : 'CoinGecko'; }
  };
})();
