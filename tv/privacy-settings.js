#!/usr/bin/node
// TV project: the privacy settings we want, applied now and again at every boot (the privacy hook
// starts this in the background), because LG's own pieces put some of them back: SAM keeps a copy
// of the user agreements in /var/luna/preferences/eula and the agreement flags and LG Channels were
// found switched on again after a reboot. Idempotent: it reads first and writes only what differs.
// Node 8 (the TV's /usr/bin/node). Log: /tmp/tvproject-settings.log. Undo: docs/CHANGES.md.
'use strict';
const {execSync} = require('child_process');
const fs = require('fs');

const WANT = {
  general: {homePromotion: 'off', screenSaverAd: 'off', adCookie: 'off', voiceLongDistance: 'off'},
  other: {contentRecommendation: 'off'},
  option: {livePlus: 'off', livePromotion: 'off', webOSPromotionVideo: 'off', channelplus: 'off', appUpdateMode: 'manual'}
};
// user agreements declined: ACR viewing info and ACR ads, voice (both), interest-based ads, marketing,
// additional data, shopping, "take on", LG Channels. Terms of Use and the network agreement stay.
const EULA_OFF = ['acrOnAllowed', 'acrAdAllowed', 'voiceAllowed', 'voice2Allowed', 'customAdAllowed', 'marketingOnAllowed',
  'additionalDataAllowed', 'shoppingOnAllowed', 'takeOnAllowed', 'chpAllowed'];
const SAM_EULA_CACHE = '/var/luna/preferences/eula';

function log(s) { console.log(new Date().toTimeString().slice(0, 8) + ' ' + s); }

function luna(uri, payload, ms) {
  ms = ms || 8000;
  const arg = JSON.stringify(payload).replace(/'/g, "'\\''");
  try {
    const out = execSync("luna-send -n 1 -w " + ms + " '" + uri + "' '" + arg + "' </dev/null", {encoding: 'utf8', timeout: ms + 3000});
    return JSON.parse(out.trim().split('\n').pop());
  } catch (e) { return null; }
}
const SS = 'luna://com.webos.settingsservice/';

function waitForSettings() {
  for (let i = 0; i < 90; i++) {
    const r = luna(SS + 'getSystemSettings', {category: 'option', keys: ['livePlus']}, 4000);
    if (r && r.returnValue) return true;
    execSync('sleep 2');
  }
  return false;
}

function applyCategory(category, want) {
  const r = luna(SS + 'getSystemSettings', {category: category, keys: Object.keys(want)});
  const have = (r && r.settings) || {};
  const diff = {};
  Object.keys(want).forEach(function (k) { if (have[k] !== want[k]) diff[k] = want[k]; });
  if (!Object.keys(diff).length) return;
  const w = luna(SS + 'setSystemSettings', {category: category, settings: diff});
  log(category + ': ' + Object.keys(diff).map(function (k) { return k + ' ' + JSON.stringify(have[k]) + ' -> ' + diff[k]; }).join(', ') +
      (w && w.returnValue ? '' : ' FAILED ' + JSON.stringify(w)));
}

function applyEula() {
  const r = luna(SS + 'getSystemSettings', {keys: ['eulaStatus']});
  const e = r && r.settings && r.settings.eulaStatus;
  if (!e) { log('eulaStatus: not readable ' + JSON.stringify(r)); return; }
  const changed = EULA_OFF.filter(function (k) { return e[k] !== false; });
  if (changed.length) {
    changed.forEach(function (k) { e[k] = false; });
    const w = luna(SS + 'setSystemSettings', {settings: {eulaStatus: e}});
    log('agreements declined: ' + changed.join(', ') + (w && w.returnValue ? '' : ' FAILED ' + JSON.stringify(w)));
  }
  // SAM's own copy, which it reads back at boot; normally it follows the settings write by itself
  try {
    const c = JSON.parse(fs.readFileSync(SAM_EULA_CACHE, 'utf8'));
    const stale = EULA_OFF.filter(function (k) { return c.eulaStatus && c.eulaStatus[k] !== false; });
    if (stale.length) {
      stale.forEach(function (k) { c.eulaStatus[k] = false; });
      fs.writeFileSync(SAM_EULA_CACHE + '.tvproject', JSON.stringify(c));
      fs.renameSync(SAM_EULA_CACHE + '.tvproject', SAM_EULA_CACHE);
      execSync('sync');
      log('sam eula cache: ' + stale.join(', ') + ' -> false');
    }
  } catch (err) { log('sam eula cache: ' + err.message); }
}

function applyUpdates() {
  // "Allow Automatic Updates" off: the update service's NSU (network software update) mode
  const r = luna('luna://com.webos.service.update/getNSUMode', {});
  if (!r || !r.returnValue) { log('update mode: not readable ' + JSON.stringify(r)); return; }
  if (r.mode === 'user') return;
  const w = luna('luna://com.webos.service.update/setNSUMode', {mode: 'user'});
  const back = luna('luna://com.webos.service.update/getNSUMode', {});
  log('automatic updates: mode ' + r.mode + ' -> ' + (back && back.mode) + (w && w.returnValue ? '' : ' FAILED ' + JSON.stringify(w)));
}

function pass(n) {
  Object.keys(WANT).forEach(function (c) { applyCategory(c, WANT[c]); });
  applyEula();
  applyUpdates();
  log('privacy settings checked (pass ' + n + ')');
}

if (!waitForSettings()) { log('settingsservice never answered'); process.exit(1); }
pass(1);
// LG's own re-syncs at boot (the agreements app talks to LG's servers) can land after the first pass
execSync('sleep 120');
pass(2);
