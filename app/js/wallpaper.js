/*
 * The wallpapers, drawn on a canvas when the home screen starts (no image files):
 *   desert  the Milky Way over moonlit dunes (the original mockup)
 *   aurora  northern lights over dark peaks
 *   liquid  deep colour fields with glass orbs that bend the light behind them
 * Each render also returns a small blurred, saturated copy that the glass panels use as what's
 * "behind" them (Glass), so the UI looks frosted without live backdrop-filter on a 2021 TV GPU.
 * Grain is dithered in at the end so the dark gradients don't band on the panel.
 */
var Wallpaper = (function () {
  'use strict';

  var W = 1920, H = 1080;
  var STYLES = ['desert', 'aurora', 'liquid'];
  var NAMES = {desert: 'Desert Night', aurora: 'Aurora', liquid: 'Liquid Glass'};

  function rng(seed) {   // mulberry32: the same stars in the same places every time
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function gauss(r) {
    return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(6.2831853 * r());
  }

  function layer(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  // The TV's canvas is slow at making gradient objects and fast at drawing images, so the soft
  // shapes are drawn once into small sprites and stamped, with globalAlpha for strength.
  var cache = {};
  function sprite(rgb) {
    var k = 'o' + rgb;
    if (cache[k]) return cache[k];
    var c = layer(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(' + rgb + ',1)');
    gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return (cache[k] = c);
  }
  function stamp(g, rgb, x, y, rad, a) {
    g.globalAlpha = a;
    g.drawImage(sprite(rgb), x - rad, y - rad, rad * 2, rad * 2);
  }
  /** A 1 px wide vertical gradient from stops [[offset, rgb, alpha]], to stretch over a column. */
  function strip(key, stops) {
    if (cache[key]) return cache[key];
    var c = layer(1, 128), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128);
    for (var i = 0; i < stops.length; i++) gr.addColorStop(stops[i][0], 'rgba(' + stops[i][1] + ',' + stops[i][2] + ')');
    g.fillStyle = gr;
    g.fillRect(0, 0, 1, 128);
    return (cache[key] = c);
  }
  function fill(rgb, a) {   // rgba() strings, made once per colour and alpha step
    var q = Math.round(a * 40), k = 'f' + rgb + q;
    return cache[k] || (cache[k] = 'rgba(' + rgb + ',' + (q / 40).toFixed(3) + ')');
  }

  /** A soft elliptical glow of rgb at alpha a, fading to nothing. */
  function glow(ctx, x, y, rx, ry, rgb, a) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')');
    g.addColorStop(1, 'rgba(' + rgb + ',0)');
    ctx.fillStyle = g;
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  }

  function vgrad(ctx, stops) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function star(ctx, x, y, r, scale) {
    var m = r(), a = (0.12 + Math.pow(r(), 2.4) * 0.88) * scale, tint = r();
    var col = tint < 0.68 ? '222,230,255' : tint < 0.94 ? '255,241,224' : '255,208,186';
    if (m < 0.988) {
      ctx.fillStyle = fill(col, a);
      var s = m < 0.82 ? 1 : 1.7;
      ctx.fillRect(x, y, s, s);
    } else {
      // a bright star: a soft halo and a hot core
      var rad = 1.6 + r() * 3.4;
      stamp(ctx, col, x, y, rad * 4, a * 0.5);
      stamp(ctx, col, x, y, rad, Math.min(1, a + 0.45));
      ctx.globalAlpha = 1;
    }
  }

  function stars(ctx, r, n, maxY, scale) {
    for (var i = 0; i < n; i++) star(ctx, r() * W, Math.pow(r(), 1.25) * maxY, r, scale);
  }

  function vignette(ctx, strength) {
    var v = ctx.createRadialGradient(W / 2, H * 0.46, 520, W / 2, H * 0.46, 1380);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,' + strength + ')');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  // MARK: - Desert night

  function milkyWay(ctx, r, cx, cy, angle) {
    var s = 4, cos = Math.cos(angle), sin = Math.sin(angle);
    var c = layer(W / s, H / s), g = c.getContext('2d');
    function at(u, v) { return [cx + u * cos - v * sin, cy + u * sin + v * cos]; }
    var i, p, rad, grd;

    function blob(x, y, radius, rgb, a) { stamp(g, rgb, x / s, y / s, radius / s, a); }
    // blue-violet along the band to warm cream at the core, in five steps (one sprite each)
    var TINTS = ['118,128,236', '150,149,220', '186,170,204', '220,191,188', '255,212,172'];

    // The glow: soft blobs along the axis
    g.globalCompositeOperation = 'lighter';
    for (i = 0; i < 1400; i++) {
      var u = (r() * 2 - 1) * 1550;
      var core = Math.exp(-Math.pow((u + 420) / 480, 2));
      p = at(u, gauss(r) * (50 + 60 * core));
      var warm = core * (0.5 + r() * 0.5);
      blob(p[0], p[1], 22 + r() * 54 + core * 60, TINTS[Math.min(4, Math.floor(warm * 5))], 0.006 + 0.019 * core + r() * 0.005);
    }
    // a little hydrogen-red nebulosity near the core
    for (i = 0; i < 14; i++) {
      p = at(-420 + gauss(r) * 260, gauss(r) * 70);
      blob(p[0], p[1], 40 + r() * 70, '255,110,150', 0.020 + r() * 0.02);
    }
    // Dust lanes: fine dark filaments that wander along the middle of the band
    g.globalCompositeOperation = 'destination-out';
    for (i = 0; i < 900; i++) {
      var u2 = (r() * 2 - 1) * 1350;
      var lane = 16 * Math.sin(u2 / 170) + 8 * Math.sin(u2 / 61 + 1.3);
      p = at(u2, lane + gauss(r) * (r() < 0.3 ? 30 : 12));
      blob(p[0], p[1], 5 + r() * 15, '0,0,0', 0.10 + r() * 0.22);
    }
    g.globalAlpha = 1;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(c, 0, 0, W, H);
    ctx.restore();

    // Its stars, crowded along the band: the grain that makes it read as the Milky Way
    for (i = 0; i < 7000; i++) {
      p = at((r() * 2 - 1) * 1650, gauss(r) * 88);
      if (p[1] < H * 0.84) star(ctx, p[0], p[1], r, 0.42);
    }
  }

  function moon(ctx, x, y, rad) {
    glow(ctx, x, y, rad * 11, rad * 11, '255,226,196', 0.07);
    glow(ctx, x, y, rad * 3.4, rad * 3.4, '255,238,214', 0.20);
    var g = ctx.createRadialGradient(x - rad * 0.35, y - rad * 0.35, rad * 0.1, x, y, rad);
    g.addColorStop(0, '#fffbf2');
    g.addColorStop(1, '#eadfca');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.2832); ctx.fill();
    ctx.fillStyle = 'rgba(150,140,128,0.16)';
    var maria = [[-0.32, -0.18, 0.30], [0.22, 0.08, 0.24], [0.02, -0.38, 0.17], [-0.12, 0.34, 0.2], [0.38, -0.3, 0.12]];
    for (var i = 0; i < maria.length; i++) {
      ctx.beginPath(); ctx.arc(x + maria[i][0] * rad, y + maria[i][1] * rad, maria[i][2] * rad, 0, 6.2832); ctx.fill();
    }
  }

  function dunes(ctx, r, moonX) {
    var layers = [
      {base: 0.795, amp: 26, len: 1.25, top: '#1b1530', bot: '#0f0b1d', rim: '190,172,238', rimA: 0.42, haze: 0.12, ripples: 0},
      {base: 0.838, amp: 44, len: 1.0, top: '#21182f', bot: '#0c0816', rim: '216,190,240', rimA: 0.48, haze: 0.09, ripples: 0},
      {base: 0.895, amp: 68, len: 0.82, top: '#2a1c2b', bot: '#0a060e', rim: '248,206,212', rimA: 0.54, haze: 0.06, ripples: 4},
      {base: 0.975, amp: 86, len: 0.66, top: '#20141c', bot: '#040205', rim: '250,214,214', rimA: 0.42, haze: 0, ripples: 6}
    ];
    for (var li = 0; li < layers.length; li++) {
      var L = layers[li], base = L.base * H, waves = [], i, x;
      for (var w = 0; w < 3; w++) {
        waves.push({k: 6.2832 / ((980 - w * 360) * L.len), p: r() * 6.2832, a: L.amp * [1, 0.5, 0.22][w]});
      }
      var ys = [];
      for (x = -8; x <= W + 8; x += 4) {
        var y = 0;
        for (var j = 0; j < waves.length; j++) {
          var t = x * waves[j].k + waves[j].p;
          t = t + 0.62 * Math.sin(t);            // skewed: long windward slope, steep lee side
          y += waves[j].a * (0.5 - 0.5 * Math.cos(t));
        }
        ys.push(base - y);
      }
      // body
      ctx.beginPath();
      ctx.moveTo(-8, H);
      for (i = 0; i < ys.length; i++) ctx.lineTo(i * 4 - 8, ys[i]);
      ctx.lineTo(W + 8, H);
      ctx.closePath();
      var g = ctx.createLinearGradient(0, base - L.amp * 1.7, 0, H);
      g.addColorStop(0, L.top);
      g.addColorStop(1, L.bot);
      ctx.fillStyle = g;
      ctx.fill();
      // shading: faces turned toward the moon (the right) catch silver light, the others fall into
      // shadow. Drawn at quarter size, one fading column per 4 px, and stretched back up: soft, no stripes.
      var sh = layer(W / 4, H / 4), sg = sh.getContext('2d');
      for (i = 3; i < ys.length - 3; i++) {
        var slope = (ys[i + 3] - ys[i - 3]) / 24;   // over 24 px: broad lit and shaded faces, not streaks
        var light = Math.max(-1, Math.min(1, slope * 2.4));
        if (Math.abs(light) < 0.02) continue;
        var cx = (i * 4 - 8) / 4, cy = ys[i] / 4, depth = L.amp * 1.7 / 4;
        sg.globalAlpha = light > 0 ? light * 0.20 : -light * 0.42;
        sg.drawImage(light > 0 ? strip('lit', [[0, '206,190,238', 1], [1, '206,190,238', 0]]) : strip('shade', [[0, '0,0,8', 1], [1, '0,0,8', 0]]),
            cx, cy, 1.1, depth);
      }
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-8, H);
      for (i = 0; i < ys.length; i++) ctx.lineTo(i * 4 - 8, ys[i]);
      ctx.lineTo(W + 8, H);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(sh, 0, 0, W, H);
      ctx.restore();
      // wind ripples on the near dunes
      for (var rp = 1; rp <= L.ripples; rp++) {
        ctx.beginPath();
        for (i = 0; i < ys.length; i += 2) {
          var yy = ys[i] + rp * 15 + 4 * Math.sin(i * 0.11 + rp * 1.7);
          if (i) ctx.lineTo(i * 4 - 8, yy); else ctx.moveTo(-8, yy);
        }
        ctx.strokeStyle = 'rgba(255,225,235,' + (0.035 - rp * 0.004).toFixed(3) + ')';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      // moonlit rim along the crest, brightest under the moon
      ctx.lineCap = 'round';
      for (i = 0; i < ys.length - 10; i += 10) {
        var mid = i * 4 + 12, near = Math.exp(-Math.pow((mid - moonX) / 520, 2));
        var ra = L.rimA * (0.28 + 1.0 * near);
        ctx.beginPath();
        ctx.moveTo(i * 4 - 8, ys[i]);
        for (var q = i + 1; q <= i + 10; q++) ctx.lineTo(q * 4 - 8, ys[q]);
        if (near > 0.05) {
          ctx.strokeStyle = 'rgba(' + L.rim + ',' + (ra * 0.26 * near).toFixed(3) + ')';
          ctx.lineWidth = 10;
          ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(' + L.rim + ',' + Math.min(1, ra).toFixed(3) + ')';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      // haze at this layer's foot, before the nearer one
      if (L.haze) {
        var hz = ctx.createLinearGradient(0, base - 6, 0, base + 96);
        hz.addColorStop(0, 'rgba(150,122,196,0)');
        hz.addColorStop(1, 'rgba(150,122,196,' + L.haze + ')');
        ctx.fillStyle = hz;
        ctx.fillRect(0, base - 6, W, 102);
      }
    }
  }

  function desert(ctx) {
    var r = rng(20261025);
    mark('start');
    vgrad(ctx, [[0, '#010207'], [0.34, '#030716'], [0.58, '#090d25'], [0.70, '#16132f'], [0.79, '#2f2347'], [1, '#110b19']]);
    glow(ctx, W * 0.50, H * 0.80, 1300, 170, '150,110,205', 0.30);    // the horizon glowing under the stars
    glow(ctx, W * 0.80, H * 0.78, 760, 190, '255,168,140', 0.16);     // moonlit sky on the right
    glow(ctx, W * 0.30, H * 0.20, 900, 520, '50,60,160', 0.08);       // a cool lift in the upper sky
    mark('sky');
    milkyWay(ctx, r, W * 0.57, H * 0.40, -0.56);
    mark('milkyway');
    stars(ctx, r, 1500, H * 0.8, 1);
    mark('stars');
    moon(ctx, W * 0.855, H * 0.59, 30);
    dunes(ctx, r, W * 0.855);
    mark('dunes');
    vignette(ctx, 0.55);
  }

  // MARK: - Aurora

  function curtains(ctx, r) {
    var bands = [
      {y: 0.30, amp: 70, k1: 0.0021, k2: 0.0057, h: 340, low: '70,255,170', high: '150,90,255', a: 1.0},
      {y: 0.43, amp: 46, k1: 0.0016, k2: 0.0043, h: 250, low: '80,240,190', high: '90,130,255', a: 0.6},
      {y: 0.21, amp: 36, k1: 0.0027, k2: 0.0069, h: 200, low: '120,255,205', high: '210,90,230', a: 0.4}
    ];
    var s = 2, c = layer(W / s, H / s), g = c.getContext('2d');
    g.globalCompositeOperation = 'lighter';
    for (var b = 0; b < bands.length; b++) {
      var B = bands[b], p1 = r() * 6.28, p2 = r() * 6.28;
      // one ray, faint violet at the top to bright green at the foot, stretched over every column
      var ray = strip('ray' + b, [[0, B.high, 0], [0.55, B.high, 0.21], [0.9, B.low, 1], [1, B.low, 0]]);
      for (var x = -40; x < W + 40; x += 3) {
        var y = B.y * H + B.amp * Math.sin(x * B.k1 + p1) + B.amp * 0.5 * Math.sin(x * B.k2 + p2);
        var wave = 0.5 + 0.5 * Math.sin(x * 0.011 + p2 * 3) * Math.sin(x * 0.0047 + p1);
        var k = (0.30 + 0.70 * wave * wave) * (0.72 + r() * 0.56) * B.a;
        var h = B.h * (0.7 + 0.5 * r());
        g.globalAlpha = Math.min(1, 0.24 * k);
        g.drawImage(ray, x / s, (y - h) / s, 3 / s + 0.6, (h + 26) / s);
      }
    }
    g.globalAlpha = 1;
    // a soft glow pass (the layer drawn small and stretched back up), then the sharp rays
    var soft = layer(W / 16, H / 16);
    soft.getContext('2d').drawImage(c, 0, 0, W / 16, H / 16);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.9;
    ctx.drawImage(soft, 0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.drawImage(c, 0, 0, W, H);
    ctx.restore();
  }

  function peaks(ctx, r, base, amp, top, bot, rim) {
    var p1 = r() * 6, p2 = r() * 6, p3 = r() * 6, ys = [], x, i;
    for (x = 0; x <= W + 6; x += 6) {
      var y = base - amp * (0.58 * (1 - Math.abs(Math.sin(x * 0.0029 + p1))) + 0.28 * (1 - Math.abs(Math.sin(x * 0.0081 + p2))) +
          0.14 * (1 - Math.abs(Math.sin(x * 0.023 + p3))));
      ys.push(y + (r() - 0.5) * 2.5);
    }
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (i = 0; i < ys.length; i++) ctx.lineTo(i * 6, ys[i]);
    ctx.lineTo(W, H);
    ctx.closePath();
    var g = ctx.createLinearGradient(0, base - amp, 0, H);
    g.addColorStop(0, top);
    g.addColorStop(1, bot);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    for (i = 0; i < ys.length; i++) { if (i) ctx.lineTo(i * 6, ys[i]); else ctx.moveTo(0, ys[i]); }
    ctx.strokeStyle = rim;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  function aurora(ctx) {
    var r = rng(11);
    vgrad(ctx, [[0, '#010309'], [0.45, '#03101a'], [0.72, '#062126'], [1, '#020507']]);
    stars(ctx, r, 1300, H * 0.78, 0.85);
    curtains(ctx, r);
    glow(ctx, W * 0.5, H * 0.78, 1300, 220, '60,255,180', 0.07);
    peaks(ctx, r, H * 0.80, 170, '#061820', '#03090c', 'rgba(110,255,200,0.16)');
    peaks(ctx, r, H * 0.90, 130, '#03090c', '#010304', 'rgba(110,255,200,0.10)');
    vignette(ctx, 0.5);
  }

  // MARK: - Liquid glass

  function orb(ctx, behind, x, y, rad, caustic) {
    // contact shadow
    glow(ctx, x + rad * 0.18, y + rad * 0.42, rad * 1.25, rad * 0.9, '0,0,0', 0.38);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, 6.2832);
    ctx.clip();
    // refraction: what's behind, shrunk and turned upside down, as a glass ball does
    ctx.translate(x, y);
    ctx.scale(1, -1);
    var m = 1.7;
    ctx.drawImage(behind, x - rad * m, y - rad * m, rad * 2 * m, rad * 2 * m, -rad, -rad, rad * 2, rad * 2);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // body: clear in the middle, milky and bright at the edge
    var ig = ctx.createRadialGradient(x - rad * 0.2, y - rad * 0.25, rad * 0.05, x, y, rad);
    ig.addColorStop(0, 'rgba(255,255,255,0.08)');
    ig.addColorStop(0.62, 'rgba(255,255,255,0.02)');
    ig.addColorStop(0.9, 'rgba(255,255,255,0.10)');
    ig.addColorStop(1, 'rgba(255,255,255,0.34)');
    ctx.fillStyle = ig;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    // light gathered at the bottom right
    glow(ctx, x + rad * 0.42, y + rad * 0.5, rad * 0.55, rad * 0.4, caustic, 0.30);
    ctx.restore();
    // specular highlight, top left
    ctx.save();
    ctx.translate(x - rad * 0.36, y - rad * 0.46);
    ctx.rotate(-0.62);
    ctx.scale(1, 0.38);
    var hg = ctx.createRadialGradient(0, 0, 0, 0, 0, rad * 0.46);
    hg.addColorStop(0, 'rgba(255,255,255,0.58)');
    hg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(-rad * 0.46, -rad * 0.46, rad * 0.92, rad * 0.92);
    ctx.restore();
    // the rim: faint all round, bright where the light hits
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.20)';
    ctx.beginPath(); ctx.arc(x, y, rad - 1, 0, 6.2832); ctx.stroke();
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.62)';
    ctx.beginPath(); ctx.arc(x, y, rad - 2, Math.PI * 1.06, Math.PI * 1.62); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath(); ctx.arc(x, y, rad - 2, Math.PI * 0.12, Math.PI * 0.42); ctx.stroke();
    ctx.restore();
  }

  function liquid(ctx) {
    var r = rng(5);
    ctx.fillStyle = '#04050b';
    ctx.fillRect(0, 0, W, H);
    var s = 8, c = layer(W / s, H / s), g = c.getContext('2d');
    var fields = [
      [0.16, 0.92, 0.58, '112,38,230', 0.85], [0.44, 1.06, 0.42, '236,40,128', 0.55], [0.88, 0.10, 0.52, '28,92,255', 0.78],
      [0.70, 0.56, 0.30, '0,196,214', 0.32], [0.30, 0.18, 0.30, '70,40,180', 0.30]
    ];
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i], rad = f[2] * W / s;
      var grd = g.createRadialGradient(f[0] * W / s, f[1] * H / s, 0, f[0] * W / s, f[1] * H / s, rad);
      grd.addColorStop(0, 'rgba(' + f[3] + ',' + f[4] + ')');
      grd.addColorStop(1, 'rgba(' + f[3] + ',0)');
      g.fillStyle = grd;
      g.globalCompositeOperation = 'lighter';
      g.fillRect(0, 0, W / s, H / s);
    }
    ctx.drawImage(c, 0, 0, W, H);
    stars(ctx, r, 260, H * 0.7, 0.5);
    var behind = layer(W, H);
    behind.getContext('2d').drawImage(ctx.canvas, 0, 0);
    orb(ctx, behind, W * 0.70, H * 0.47, 250, '120,190,255');
    orb(ctx, behind, W * 0.31, H * 0.56, 138, '255,120,200');
    orb(ctx, behind, W * 0.50, H * 0.25, 64, '160,140,255');
    vignette(ctx, 0.45);
  }

  // MARK: - Finishing

  /**
   * Grain: a 256 px tile of random 0-2 levels added over everything, which breaks up banding in the
   * dark gradients. A pattern fill, not a pixel loop: reading 8 MB back from the TV's GPU is slow.
   */
  function dither(ctx) {
    if (!cache.grain) {
      var t = layer(256, 256), tg = t.getContext('2d'), img = tg.createImageData(256, 256), d = img.data, s = 2463534242;
      for (var i = 0; i < d.length; i += 4) {
        s ^= s << 13; s ^= s >>> 17; s ^= s << 5;   // xorshift32: no pattern for the eye to find
        d[i] = d[i + 1] = d[i + 2] = (s >>> 0) % 3;
        d[i + 3] = 255;
      }
      tg.putImageData(img, 0, 0);
      cache.grain = t;
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = ctx.createPattern(cache.grain, 'repeat');
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /** The glass panels' backdrop: a quarter-size copy, blurred and saturated, with a margin. */
  function backdrop(canvas) {
    var k = 4, pad = 18, w = W / k, h = H / k;
    var c = layer(w + pad * 2, h + pad * 2), g = c.getContext('2d');
    g.drawImage(canvas, 0, 0, c.width, c.height);     // stretched first, for plausible colour in the margin
    g.drawImage(canvas, pad, pad, w, h);
    var out = layer(c.width, c.height), og = out.getContext('2d');
    if ('filter' in og) {
      og.filter = 'blur(9px) saturate(1.8) brightness(1.06)';
      og.drawImage(c, 0, 0);
      og.filter = 'none';
    } else {
      var tiny = layer(c.width / 6, c.height / 6);
      tiny.getContext('2d').drawImage(c, 0, 0, tiny.width, tiny.height);
      og.drawImage(tiny, 0, 0, out.width, out.height);
    }
    return {canvas: out, pad: pad, scale: k};
  }

  var DRAW = {desert: desert, aurora: aurora, liquid: liquid};
  var marks = [], t0 = 0;
  function mark(name) { marks.push(name + ' ' + (Date.now() - t0)); }

  return {
    styles: STYLES,
    name: function (style) { return NAMES[style] || NAMES.desert; },
    next: function (style) { return STYLES[(STYLES.indexOf(style) + 1) % STYLES.length]; },
    /** Draws a wallpaper onto the full-screen canvas; returns the glass backdrop. */
    render: function (canvas, style) {
      var ctx = canvas.getContext('2d');
      t0 = Date.now();
      marks = [];
      ctx.save();
      (DRAW[style] || desert)(ctx);
      ctx.restore();
      mark('drawn');
      dither(ctx);
      mark('dither');
      var b = backdrop(canvas);
      mark('backdrop');
      Platform.log('wallpaper ' + style + ': ' + (Date.now() - t0) + ' ms [' + marks.join(', ') + ']');
      return b;
    }
  };
})();
