/*
 * Life in the night sky: a few stars that twinkle and, now and then, a shooting star. Only
 * opacity and transform animate, so the compositor does the work. Also Perf, which times the
 * frames of a focus move and logs them on the TV (/tmp/dock.log).
 */
var FX = (function () {
  'use strict';

  var el = null, timer = null, seed = 7, often = false, night = false;
  // Open sky only: not behind the clock, the Markets card, the moon or the dock
  var KEEP_OUT = [[60, 40, 940, 340], [1040, 40, 1900, 320], [1560, 560, 1740, 700], [0, 700, 1920, 1080]];

  function rnd() {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  }

  function open(x, y) {
    for (var i = 0; i < KEEP_OUT.length; i++) {
      var k = KEEP_OUT[i];
      if (x >= k[0] && x <= k[2] && y >= k[1] && y <= k[3]) return false;
    }
    return true;
  }

  function twinkles(n) {
    var placed = 0, tries = 0;
    while (placed < n && tries++ < 400) {
      var x = 40 + rnd() * 1840, y = 30 + rnd() * 640;
      if (!open(x, y)) continue;
      var s = document.createElement('i');
      s.className = 'tw';
      var size = 2 + rnd() * 2;
      s.style.left = Math.round(x) + 'px';
      s.style.top = Math.round(y) + 'px';
      s.style.width = s.style.height = size.toFixed(1) + 'px';
      s.style.animationDuration = (2.4 + rnd() * 3.6).toFixed(2) + 's';
      s.style.animationDelay = (-rnd() * 6).toFixed(2) + 's';
      el.appendChild(s);
      placed++;
    }
  }

  function shoot() {
    if (!el || document.hidden) { timer = setTimeout(shoot, 20000); return; }
    var wrap = document.createElement('div');
    wrap.className = 'shootwrap';
    wrap.style.left = Math.round(620 + rnd() * 700) + 'px';
    wrap.style.top = Math.round(110 + rnd() * 300) + 'px';
    wrap.style.transform = 'rotate(' + (18 + rnd() * 20).toFixed(1) + 'deg)';
    var s = document.createElement('i');
    s.className = 'shoot';
    wrap.appendChild(s);
    el.appendChild(wrap);
    setTimeout(function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 1600);
    timer = setTimeout(shoot, often ? 7000 + rnd() * 12000 : 22000 + rnd() * 38000);
  }

  return {
    start: function (container, style) {
      el = container;
      el.innerHTML = '';
      clearTimeout(timer);
      seed = 7;
      night = style !== 'liquid';
      if (!night) return;
      twinkles(style === 'aurora' ? 12 : 18);
      timer = setTimeout(shoot, 9000);
    },
    /** On the lock screen the sky is the show: shooting stars come more often. */
    saver: function (on) {
      often = on;
      if (!night) return;
      clearTimeout(timer);
      timer = setTimeout(shoot, on ? 2500 : 22000);
    }
  };
})();

var Perf = (function () {
  'use strict';
  var budget = 12;
  return {
    /** Times the frames for 700 ms after something moves; logs the frame count and the worst gap. */
    watch: function (label) {
      if (budget <= 0 || !window.requestAnimationFrame || !window.performance) return;
      budget--;
      var start = performance.now(), last = start, worst = 0, frames = 0;
      function tick(now) {
        if (frames++) worst = Math.max(worst, now - last);
        last = now;
        if (now - start < 700) requestAnimationFrame(tick);
        else Platform.log('perf ' + label + ': ' + frames + ' frames in ' + Math.round(now - start) + ' ms, worst gap ' + Math.round(worst) + ' ms');
      }
      requestAnimationFrame(tick);
    }
  };
})();
