/*
 * Glass: each .glass element gets a canvas behind its content showing the blurred wallpaper that
 * sits behind it on screen, magnified a touch at the centre like light bending through a lens.
 * The tint, the specular sheen and the bright rim are CSS on top (dock.css). Positions come from
 * the layout (offsetLeft/Top), so entrance animations and focus transforms don't throw them off.
 */
var Glass = (function () {
  'use strict';

  var src = null, els = [];
  var LENS = 0.045;

  function layout(el) {
    var x = 0, y = 0, n = el;
    while (n) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return {x: x, y: y, w: el.offsetWidth, h: el.offsetHeight};
  }

  function paint(el) {
    if (!el) return;
    if (els.indexOf(el) < 0) els.push(el);
    if (!src || !el.offsetWidth) return;
    var c = el._glass;
    if (!c) {
      c = document.createElement('canvas');
      c.className = 'glass-bg';
      el.insertBefore(c, el.firstChild);
      el._glass = c;
    }
    var r = layout(el), w = Math.max(1, Math.round(r.w)), h = Math.max(1, Math.round(r.h));
    if (c.width !== w) c.width = w;
    if (c.height !== h) c.height = h;
    var g = c.getContext('2d'), k = src.scale;
    var sw = r.w / k * (1 - LENS), sh = r.h / k * (1 - LENS);
    var sx = src.pad + (r.x + r.w / 2) / k - sw / 2, sy = src.pad + (r.y + r.h / 2) / k - sh / 2;
    g.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in g) g.imageSmoothingQuality = 'high';
    g.clearRect(0, 0, w, h);
    g.drawImage(src.canvas, sx, sy, sw, sh, 0, 0, w, h);
  }

  return {
    paint: paint,
    setSource: function (s) {
      src = s;
      for (var i = 0; i < els.length; i++) paint(els[i]);
    },
    repaint: function () { for (var i = 0; i < els.length; i++) paint(els[i]); }
  };
})();
