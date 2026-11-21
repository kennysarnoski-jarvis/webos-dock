/* The clock, iOS lock-screen style: the date small above, the time large below. On the minute. */
var Clock = (function () {
  'use strict';
  var timeEl, dateEl, timer = null, onMinute = null;
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function render() {
    var d = new Date();
    var h = d.getHours() % 12 || 12, m = d.getMinutes();
    timeEl.textContent = h + ':' + (m < 10 ? '0' : '') + m;
    dateEl.textContent = DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate();
    if (onMinute) onMinute(d);
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(function () { render(); schedule(); }, 60000 - (Date.now() % 60000) + 50);
  }

  return {
    start: function (el, minuteHook) {
      timeEl = el.querySelector('.time');
      dateEl = el.querySelector('.date');
      onMinute = minuteHook || null;
      render();
      schedule();
    },
    refresh: render
  };
})();
