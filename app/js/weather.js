/*
 * Weather from Open-Meteo (free, no key). The place is the ZIP the TV was set up with (LG's own
 * Location setting), geocoded once and kept in the dock config; the time zone's city if there's
 * no ZIP. Current temperature and conditions with today's high and low, every 20 minutes.
 */
var Weather = (function () {
  'use strict';

  var API = 'https://api.open-meteo.com/v1/forecast';
  var GEO = 'https://geocoding-api.open-meteo.com/v1/search';
  var REFRESH_MS = 20 * 60000;

  var now = null, listeners = [], timer = null, place = null;

  function get(url, done) {
    var x = new XMLHttpRequest();
    x.open('GET', url, true);
    x.timeout = 10000;
    x.onreadystatechange = function () {
      if (x.readyState !== 4) return;
      var body = null;
      if (x.status === 200) { try { body = JSON.parse(x.responseText); } catch (e) {} }
      done(body);
    };
    x.ontimeout = function () { done(null); };
    try { x.send(); } catch (e) { done(null); }
  }

  function geocode(query, done) {
    get(GEO + '?name=' + encodeURIComponent(query) + '&count=1&language=en&format=json&countryCode=US', function (b) {
      var r = b && b.results && b.results[0];
      done(r ? {name: r.name, region: r.admin1 || '', lat: r.latitude, lon: r.longitude} : null);
    });
  }

  function setting(category, key, done) {
    Platform.lunaRoot('luna://com.webos.settingsservice/getSystemSettings', {category: category, keys: [key]}, function (res) {
      done(res && res.settings ? res.settings[key] : null);
    });
  }

  function locate(done) {
    var saved = Dock.config().weatherPlace;
    if (saved && typeof saved.lat === 'number') { done(saved); return; }
    function keep(p) {
      if (p) {
        Dock.set('weatherPlace', p);
        Platform.log('weather: located ' + p.name + ', ' + p.region);
      }
      done(p);
    }
    function byZone() {
      setting('time', 'timeZone', function (tz) {
        if (tz && tz.City) geocode(tz.City, keep); else done(null);
      });
    }
    setting('option', 'zipcode', function (zip) {
      if (zip && /^\d{5}$/.test(zip)) geocode(zip, function (p) { if (p) keep(p); else byZone(); });
      else byZone();
    });
  }

  function refresh() {
    if (!place) return;
    get(API + '?latitude=' + place.lat + '&longitude=' + place.lon +
        '&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min' +
        '&temperature_unit=fahrenheit&timezone=auto&forecast_days=1', function (b) {
      if (!b || !b.current) { Platform.log('weather: no answer from Open-Meteo'); return; }
      now = {
        temp: Math.round(b.current.temperature_2m),
        code: b.current.weather_code,
        day: b.current.is_day === 1,
        hi: b.daily ? Math.round(b.daily.temperature_2m_max[0]) : null,
        lo: b.daily ? Math.round(b.daily.temperature_2m_min[0]) : null,
        place: place.name
      };
      for (var i = 0; i < listeners.length; i++) listeners[i](now);
    });
  }

  // MARK: - Conditions and icons (WMO weather codes)

  function kind(code) {
    if (code === 0) return 'clear';
    if (code === 1 || code === 2) return 'partly';
    if (code === 3) return 'cloudy';
    if (code === 45 || code === 48) return 'fog';
    if (code >= 51 && code <= 57) return 'drizzle';
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if (code >= 95) return 'storm';
    return 'cloudy';
  }

  var LABEL = {clear: 'Clear', partly: 'Partly Cloudy', cloudy: 'Cloudy', fog: 'Fog', drizzle: 'Drizzle', rain: 'Rain', snow: 'Snow', storm: 'Thunderstorms'};

  function sun(cx, cy, r) {
    var rays = '';
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
      rays += '<line x1="' + (cx + c * (r + 5)).toFixed(1) + '" y1="' + (cy + s * (r + 5)).toFixed(1) +
          '" x2="' + (cx + c * (r + 10)).toFixed(1) + '" y2="' + (cy + s * (r + 10)).toFixed(1) + '"/>';
    }
    return '<g stroke="#FFD60A" stroke-width="3.6" stroke-linecap="round">' + rays + '</g><circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#FFD60A"/>';
  }
  function moon(tx, ty, s) {
    return '<path fill="#F7EFCF" transform="translate(' + tx + ' ' + ty + ') scale(' + s + ')" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
  }
  function cloud(tx, ty, s, fill) {
    return '<g fill="' + fill + '" transform="translate(' + tx + ' ' + ty + ') scale(' + s + ')"><circle cx="22" cy="38" r="10"/>' +
        '<circle cx="34" cy="30" r="13"/><circle cx="46" cy="38" r="10"/><rect x="22" y="38" width="24" height="10"/></g>';
  }
  var DROPS = '<g stroke="#64D2FF" stroke-width="3.6" stroke-linecap="round"><line x1="23" y1="48" x2="20" y2="57"/><line x1="33" y1="48" x2="30" y2="57"/><line x1="43" y1="48" x2="40" y2="57"/></g>';
  var DRIZZLE = '<g stroke="#64D2FF" stroke-width="3.6" stroke-linecap="round"><line x1="24" y1="49" x2="23" y2="53"/><line x1="34" y1="49" x2="33" y2="53"/><line x1="44" y1="49" x2="43" y2="53"/></g>';
  var FLAKES = '<g fill="#fff"><circle cx="23" cy="52" r="3"/><circle cx="33" cy="56" r="3"/><circle cx="43" cy="52" r="3"/></g>';
  var BOLT = '<path fill="#FFD60A" d="M34 40l-8 12h7l-3 10 11-14h-7l3-8z"/>';
  var FOG = '<g stroke="#C7CCD6" stroke-width="3.6" stroke-linecap="round"><line x1="14" y1="50" x2="50" y2="50"/><line x1="20" y1="57" x2="44" y2="57"/></g>';

  function icon(code, day) {
    var k = kind(code), svg;
    if (k === 'clear') svg = day ? sun(32, 32, 11) : moon(8, 6, 2.2);
    else if (k === 'partly') svg = (day ? sun(23, 23, 8) : moon(8, 2, 1.6)) + cloud(6, 6, 0.86, '#F2F4FA');
    else if (k === 'cloudy') svg = cloud(-4, -6, 0.78, '#8E97AA') + cloud(6, 6, 0.86, '#F2F4FA');
    else {
      svg = cloud(2, -5, 0.88, k === 'storm' ? '#AEB5C4' : '#F2F4FA');
      svg += k === 'rain' ? DROPS : k === 'drizzle' ? DRIZZLE : k === 'snow' ? FLAKES : k === 'storm' ? BOLT : FOG;
    }
    return '<svg viewBox="0 0 64 64" aria-hidden="true">' + svg + '</svg>';
  }

  /** Fills an element with the icon, the temperature and "Clear · H 78° L 53°". */
  function render(el) {
    if (!el) return;
    if (!now) { el.innerHTML = ''; el.style.display = 'none'; return; }
    var label = now.code === 1 ? 'Mostly Clear' : LABEL[kind(now.code)];
    var hilo = now.hi !== null ? ' · H ' + now.hi + '° L ' + now.lo + '°' : '';
    el.style.display = '';
    el.innerHTML = '<span class="wx-ic">' + icon(now.code, now.day) + '</span><span class="wx-t">' + now.temp + '°</span>' +
        '<span class="wx-d"></span>';
    el.querySelector('.wx-d').textContent = label + hilo;
  }

  return {
    start: function () {
      locate(function (p) {
        place = p;
        if (!p) { Platform.log('weather: no ZIP or time zone to go by'); return; }
        refresh();
        clearInterval(timer);
        timer = setInterval(refresh, REFRESH_MS);
      });
    },
    refresh: refresh,
    onChange: function (fn) { listeners.push(fn); if (now) fn(now); },
    render: render,
    current: function () { return now; }
  };
})();
