/*
 * Browser preview: when the page isn't running on the TV, stand-ins for the TV's services, so the
 * design can be worked on in a desktop browser. Serve the repo root and open /app/index.html; the
 * app icons come from preview/icons/ (pulled from the TV, not committed). Does nothing on the TV.
 */
(function () {
  'use strict';
  if (Platform.webos) return;

  var APPS = [
    ['netflix', 'Netflix'], ['youtube.leanback.v4', 'YouTube'], ['amazon', 'Prime Video'], ['com.apple.appletv', 'Apple TV'],
    ['spotify-beehive', 'Spotify - Music and Podcasts'], ['com.disney.disneyplus-prod', 'Disney+'], ['com.wbd.stream', 'Max'],
    ['hulu', 'Hulu'], ['com.peacock.tv', 'Peacock'], ['com.cbs-all-access.webapp.prod', 'Paramount+'],
    ['com.espn.espnplus-prod', 'ESPN'], ['com.movenetworks.app.sling-tv-sling-production', 'Sling TV'],
    ['com.rumble.webos.app', 'Rumble'], ['com.twc.csg.redbox', 'Redbox'], ['vudu', 'VUDU'],
    ['com.angel.tv2', 'Angel Studios: TV & Movies'], ['com.webos.app.browser', 'Web Browser'],
    ['org.webosbrew.hbchannel', 'Homebrew Channel'], ['smartstb', 'Smart STB']
  ];
  var INPUTS = [
    {appId: 'com.webos.app.hdmi1', label: 'Nintendo Switch', connected: true},
    {appId: 'com.webos.app.hdmi2', label: 'Xbox', connected: true},
    {appId: 'com.webos.app.hdmi3', label: 'Samsung Sound Bar', connected: false},
    {appId: 'com.webos.app.hdmi4', label: 'Streaming Box', connected: true}
  ];

  // ?markets=live makes the Markets card use the real public feed instead of made-up prices
  window.PREVIEW = {icon: function (id) { return '../preview/icons/' + id + '.png'; }, liveMarkets: /[?&]markets=live\b/.test(location.search)};

  Platform.lunaRoot = function (uri, params, done) {
    var r = {returnValue: true};
    if (/listApps$/.test(uri)) {
      r.apps = APPS.map(function (a) { return {id: a[0], title: a[1], folderPath: '/preview', icon: a[0] + '.png', visible: true, type: 'web'}; });
    } else if (/getAllInputStatus$/.test(uri)) {
      r.devices = INPUTS;
    } else if (/getForegroundAppInfo$/.test(uri)) {
      r.appId = 'com.webos.app.hdmi4';
    } else if (/getSystemSettings$/.test(uri)) {
      r.settings = params && params.category === 'time' ? {timeZone: {City: 'New York'}} : {zipcode: '10001'};
    }
    setTimeout(function () { done(r); }, 30);
  };
  Platform.luna = function (uri, params, done) {
    Platform.lunaRoot(uri, params, function (r) { if (done) done(r, r); });
  };
  Platform.exec = function (command, done) {
    if (done) done('MODEL={"modelName":"75NANO85APA","firmwareVersion":"03.53.45","sdkVersion":"6.5.3"}\n' +
        'MEM=799 MB available of 1837 MB\nUP=1:42\nAPPS=com.webos.app.home airplay\n', '');
  };
  Platform.readFile = function (path, done) {
    var tokenPath = window.PrivateFeed && window.PrivateFeed.tokenPath;
    setTimeout(function () { done(tokenPath && path === tokenPath && !window.PREVIEW.liveMarkets ? 'preview' : ''); }, 20);
  };
  Platform.readFileB64 = function (path, done) { done(null); };
  Platform.writeFile = function (path, text, done) { if (done) done(true); };
})();
