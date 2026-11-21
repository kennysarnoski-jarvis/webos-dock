# Research: rooting, de-LG-ing and replacing Home on a webOS 6 TV

Researched 2026-10-25 for the author's two 2021 LGs (a 75NANO85APA and a 55UP7670PUC on webOS 6.5.3, firmware 03.53.45). Claims link to sources; anything not verified is marked as such. The sections kept their numbers from the original notes.

## 2. The viral projects, and why they don't drop in

- **Simba (@SimbasJungles), "Free My TV"**: a TCL **Google TV**. Removed the bloatware and ads, and replaced the launcher with an Apple TV-style one: RAM down 282 MB to 96 MB, a TMDB trending row, and a theme that darkens at sunset ([tweet](https://x.com/SimbasJungles/status/2112231637840765012), [coverage](https://techaeris.com/2026/10/18/android-tv-debloat-tvos-style-makeover/)).
- **Gathin23, "Clean Your TV" / tv-vibehack**: debloats any **Android/Google TV** over Wi-Fi with ADB and installs an Apple TV-style home. `tools/restore.sh` reverses it. Explicitly not for Tizen, webOS or Fire TV ([repo](https://github.com/Gathin23/tv-vibehack), [TechCrunch](https://techcrunch.com/2026/10/19/people-are-using-ai-to-make-their-smart-tvs-dumb-again/)).
- **codila's prompt**: also ADB-only. Its own rule for a non-Android TV is to use only the official local-network control. Its guardrails are good and we follow them: back up first, keep everything reversible, propose before changing anything, install only from official sources, never sign in for the owner.

So the ADB playbook doesn't transfer to webOS at all. But since the tweet, **Simba ported Free My TV to LG and Samsung** ([repo](https://github.com/simbasjungles/free-my-tv), MIT, 4.5k stars):
- **Releases:** v1.0 (2026-10-20) added "Samsung and LG". v1.1 (10-22) fixed app listing on webOS 6. v1.2 (10-24) added "your own photos" ([releases](https://github.com/simbasjungles/free-my-tv/releases)).
- **What it is:** the same glass shelf of apps, an inputs drawer, weather, and a day/night theme, written in plain HTML/CSS/JS for old TV Chromium with no frameworks (`web/`). `web/tv.js` already handles LG's quirks: launching apps, HDMI input status, keeping the screensaver off.
- **How it installs on LG:** through LG Developer Mode (you sign in to a free LG developer account on the TV), or through the Homebrew Channel repo `https://freemytv.io/webos/apps.json` on a rooted TV.
- **Limits on LG:**
  - It can't own the Home button; you hold a number key to open it.
  - Dev Mode apps on webOS 6+ can't list installed apps, so it guesses the well-known ones or asks the TV over SSAP.
- **What it fetches from the internet:** TMDB (your own key, for picks), Open-Meteo (weather and sunset), Binance crypto prices (**on by default**), and optionally Bing's photo of the day.

Other webOS forks: [webos-vibehack](https://github.com/OmkarK97/webos-vibehack) relaunches its launcher from a watcher running on another device, and [Razdva122's fork](https://github.com/Razdva122/clean-your-tv-lg-webos) runs that helper on the TV.

## 3. What a stock 2021 LG looks like

- **Home bar: 41 entries** on the 75" (29 on the 55"). 133 apps installed (102 system). Eleven of the home-bar entries are **"stub" apps**: LG promo placeholders that aren't even installed until you click them. They're 8 Ball Pool, LG Gaming Portal, LG Movies & TV, LG Radio+, LG Sports Playbook, LG Streaming Week, LG Travel+, ShopTime, Weekend Games, Pluto TV and Tubi. Ads wearing app icons.
- **Privacy state, read from the TV** (the same on both sets):

| Setting | Was |
|---|---|
| Live Plus (ACR: fingerprints whatever is on screen, HDMI inputs included) | **on** |
| ACR viewing-info agreement (`acrOnAllowed`) | accepted |
| ACR-based ads (`acrAdAllowed`) | accepted |
| Interest-based / custom ads (`customAdAllowed`) | accepted |
| Voice information agreements (`voiceAllowed`, `voice2Allowed`) | accepted |
| Marketing, shopping, "additional data" | accepted |
| Third-party sharing, remote diagnostics, cookies | declined |

- **Hola VPN was installed** on one of them (`com.brd.test`). Hola's free tier makes the device a peer in **Bright Data's residential proxy network**: other people's traffic can exit through your internet connection ([Wikipedia](https://en.wikipedia.org/wiki/Hola_(VPN))). Unconfirmed for the TV build, but the app ID literally starts with `brd` (Bright Data). If it is on yours, delete it.

## 4. Rooting the LG

Firmware 03.53.45 against every known exploit, from the CanI.RootMy.TV dataset ([webosbrew/caniroot](https://github.com/webosbrew/caniroot)):

| Exploit | Patched at | On 03.53.45 |
|---|---|---|
| RootMyTV v1/v2 | 03.30.10 | dead |
| WTA | 03.40.70 | dead |
| crashd / ASM | 03.40.80 | dead |
| DejaVuln | 03.41.00 | dead |
| faultmanager | 03.52.60 | dead |
| **SlopBro** | none yet | **works**: latest known vulnerable build is 03.53.45 |

**SlopBro** ([repo](https://github.com/throwaway96/slopbro), AGPL-3.0, by throwaway96, who also wrote the dejavuln and faultmanager roots) exploits LG's `jsserver`. It's reported working on webOS 4 through 11, and it got a workaround for LG's patch attempt on 2026-09-28.
- **Confirmed on this exact firmware:** an EU OLED C1 on 03.53.45 / 6.5.3-47 ([#1](https://github.com/throwaway96/slopbro/issues/1)), and an EU 2021 LCD on 03.53.45 that survived a cold boot ([#54](https://github.com/throwaway96/slopbro/issues/54), filed 2026-10-25).
- **The known risk:** a **US** 2021 OLED on 03.53.45 where the entry app launches but never loads the exploit page ([#7](https://github.com/throwaway96/slopbro/issues/7), still open). The script's own comments say the `adoverlay` entry "doesn't always work on 6.5.3" and `dangbei-overlay` can be region-blocked on 6.5.x. All five entry apps were present on the author's (US) TVs (voiceweb, adoverlayex, adoverlay, acroverlay, dangbei-overlay), and `voiceweb` worked first time on both.
- **What it does** (I read the payload): pairs over SSAP and launches one of LG's own ad/ACR overlay apps pointed at a page served from your computer. That page runs `wwwroot/autoroot.sh` as root, which marks Dev Mode as enabled for persistence, installs **Homebrew Channel 0.7.3 from webosbrew's official GitHub release**, and elevates its service. It also guards against LG's start-devmode script wiping it. It contacts nothing except GitHub and your computer, and toasts each step on screen.
- **Rules:** LG's **Dev Mode app must not be installed** while rooting or after (it wipes root). Turn **off automatic software updates first**, because a newer build may patch it. Homebrew Channel also disables updates once installed. Disable Quick Start+ if Homebrew Channel doesn't show up after a reboot ([dejavuln README](https://github.com/throwaway96/dejavuln-autoroot)).
- **Risk and undo:** software-only root, low brick risk ([webosbrew.org/rooting](https://www.webosbrew.org/rooting/)). A **factory reset removes it**, and there's no other unroot. The author calls it "lightly tested".
- **A snag that didn't happen:** the entry points are LG's ad and ACR overlay apps, so there was a worry they wouldn't load with ads or ACR declined. On these sets they did, with Live Plus already off. Root first anyway and do the full opt-outs afterward: they revert at boot until the hook enforces them.
- **What root unlocks:** Homebrew Channel (app store), SSH, a root `exec` Luna service, boot scripts in `/var/lib/webosbrew/init.d`, built-in telemetry blocking, and hosts-file ad blocking ([Homebrew Channel](https://github.com/webosbrew/webos-homebrew-channel)).

## 5. Owning the Home button

- **With root: AltHome** ([repo](https://github.com/kitsuned/AltHome), GPL-2.0, "replacement for the stock home app on LG TVs running webOS 6+", last commit 2026-03-02). I read the code. A small root service injects a JS key filter into LG's surface manager through `luna://com.webos.service.config/setConfigs` (`com.webos.surfacemanager.keyFilters`). The filter catches the Home key and launches the replacement app, and it falls through to LG's home if the replacement isn't installed. Another routine **kills the stock home app** to free RAM. It re-applies at boot. We can use the same technique to point Home at our own full-screen launcher.
- **Without root:** you can't remap Home or replace the launcher. The fallbacks are turning **Home Auto Launch** off so the TV boots to the last input (All Settings > General > System > Additional Settings > Home Settings, [LG](https://www.lg.com/us/support/help-library/lg-tv-how-to-set-specific-input-startup--20153529242384)), and **Quick Access** (long-press a number key to open our launcher). Our app would run in **Dev Mode**, whose sessions now last **1000 hours** and can be extended from the CLI ([LG dev forum](https://forum.webostv.developer.lge.com/t/whats-the-way-to-extend-dev-time-with-webos-cli/28033)). Some users report it expiring early.
- **A no-root trick that works:** SSAP can't write settings (401), but an alert whose close action points at an internal `luna://` call runs it anyway. That's the trick [bscpylgtv](https://github.com/chros73/bscpylgtv) uses, and `tools/lgtv.py luna` implements it. Live Plus can be turned off this way before rooting. It's fire-and-forget: no data comes back.

## 6. Building the launcher

- **Engine:** webOS 6 web apps run on Chromium 79 ([LG](https://webostv.developer.lge.com/develop/specifications/web-api-and-web-engine)) and render at 1920x1080 even on the 4K panel; only video is 4K ([LG](https://webostv.developer.lge.com/develop/specifications/app-resolution)). Works: CSS variables, grid, transform/opacity animations, WebP, WOFF2, `backdrop-filter` (expensive). Missing: flex `gap`, `?.`/`??`, AVIF, `:focus-visible`, `inset`, `aspect-ratio`, ES modules from `file://`. LG staff recommend under 250 MB per app; background apps get killed under memory pressure, and the HTTP cache is dropped when an app exits ([LG forum](https://forum.webostv.developer.lge.com/t/this-app-will-now-restart-to-free-up-memory/5605)).
- **Toolchain:** `@webos-tools/cli` 3.2.6 (Node 20+; LG's install page still says 14–16) gives `ares-package`, `ares-install`, `ares-launch`, `ares-inspect` (remote devtools) and `ares-device -r` (CPU and RAM) ([repo](https://github.com/webos-tools/cli), [LG](https://webostv.developer.lge.com/develop/tools/cli-dev-guide)). An IPK is an `ar` archive of two tarballs, which Free My TV's `webos/build.py` builds in Python. On a rooted TV, Homebrew Channel installs from a URL and updates from a JSON repo ([HBC](https://github.com/webosbrew/webos-homebrew-channel)).
- **What an unrooted (Dev Mode) app can do:** launch any app, HDMI input (`com.webos.app.hdmi1`–`4`) or Settings through `luna://com.webos.applicationManager/launch`; read the inputs through `com.webos.service.eim/getAllInputStatus` (labels, CEC names, `hdmiPlugIn`); time and locale; toasts ([LG](https://webostv.developer.lge.com/develop/references/application-manager)). **Denied:** listing installed apps (`listApps`, `listLaunchPoints`, `getAppInfo`, `getForegroundAppInfo`) ([Free My TV #228](https://github.com/simbasjungles/free-my-tv/issues/228)), which is why Free My TV ships a catalog of known app ids and checks each with `getAppLoadStatus`. **With root,** Homebrew Channel's `exec` service, or an elevated service of our own, does everything, including the full app list with icons.
- **Remote:** arrows 37–40, OK 13, Back 461, color keys 403–406; read `keyCode`, since `key` can come back "Unidentified" ([LG](https://webostv.developer.lge.com/develop/guides/magic-remote)). Pointing the Magic Remote fires normal mouse events plus `cursorStateChange`; `webOSSystem.setCursorHidden(true)` hides the cursor. Ignore Back at the top level, since `platformBack()` pops an exit dialog on webOS 6 ([LG](https://webostv.developer.lge.com/develop/guides/back-button)). Holding a number key binds it to the app (Quick Access).
- **Prior art** (checked on GitHub on 2026-10-25):

| Project | Root? | Notes |
|---|---|---|
| [simbasjungles/free-my-tv](https://github.com/simbasjungles/free-my-tv) (MIT, 4.5k stars) | no | Glass shelf, inputs drawer, TMDB picks, weather, crypto; LG port since 10-20 |
| [HarshInvader/webos-launcher](https://github.com/HarshInvader/webos-launcher) (MIT) | no | tvOS-style grid in Preact, tuned for 60 fps: animates only transform and opacity, pre-bakes blurs, re-renders two tiles per move |
| [partridgeworks/webos-launcher](https://github.com/partridgeworks/webos-launcher) (MIT) | no | Its parent; tested on webOS 6.5; unmaintained since 09-23 |
| [kitsuned/AltHome](https://github.com/kitsuned/AltHome) (GPL-2) | yes | Home-key takeover and stock-home kill (section 5) |
| [marc-fischer/webos-custom-home](https://github.com/marc-fischer/webos-custom-home) (MIT) | yes | React, tested on 6.5.3, root service |
| [lasharor/cleanyourtv-WebOS](https://github.com/lasharor/cleanyourtv-WebOS) | yes | Home replacement plus an optional debloat of LG ads and telemetry |
| [ecklf/lg-luma](https://github.com/ecklf/lg-luma) (MIT) | yes | Native Rust/SDL launcher |
| [Simon34545/lginputhook](https://github.com/Simon34545/lginputhook) (BSD-3) | yes | Remaps remote buttons |

- **Companion API (what `tools/lgtv.py` speaks):** pairing with a PROMPT manifest, then `listLaunchPoints`, `system.launcher/launch`, `tv/switchInput`, toasts, `tv/executeOneShot` screenshots, and internal luna calls through the alert trick ([bscpylgtv](https://github.com/chros73/bscpylgtv), [aiowebostv](https://github.com/home-assistant-libs/aiowebostv)). Both ports (3000 and 3001) answer on these sets.

## 7. Is the LG listening?

- **No microphone in the TV.** LG's webOS 6 launch release lists the 2021 series with hands-free voice ("Hands-free applied series: R1, Z1, M1, G1, NANO9Z, NANO9X, NANO99, NANO95"); NANO85 isn't one ([LG](https://lg.com/us/press-release/lgs-webos-6-0-smart-tv-platform-designed-for-how-viewers-consume-content-today)). Voice, LG's and Alexa's, only works while you hold the mic button on the Magic Remote. So this set can't listen continuously, and declining the voice agreements shuts the rest off.
- **It was watching, though.** Live Plus is LG's ACR. LG's Sept 2026 statement says it fingerprints the audio stream in the TV's audio processor, takes no screenshots, and covers live TV, HDMI inputs and LG Channels but not Netflix or YouTube ([LG](https://www.lg.com/global/newsroom/news/statements/statement-understanding-privacy-on-lg-smart-tvs/)). Texas alleged screenshots every 500 ms, and a 2024 academic audit saw ACR traffic during HDMI use ([IMC '24](https://arxiv.org/html/2409.06203v1)). Either way it fingerprints whatever is on the HDMI inputs: consoles, boxes, a computer. It is **on** out of the box; the privacy hook turns it off and keeps it off.
- **The law caught up.** Texas sued Samsung, LG, Sony, Hisense and TCL over ACR on 2025-12-15. Samsung settled in Feb 2026; LG settled on 2026-05-11: no ACR without informed consent, an on-screen disclosure and opt-out, no viewing data to China, no fine, no admission ([Texas AG](https://texasattorneygeneral.gov/news/releases/attorney-general-ken-paxton-secures-major-agreement-lg-protect-texans-privacy-and-stop-data-being), [FOX 7](https://www.fox7austin.com/news/lg-smart-tv-acr-data-collection-texas-settlement)).
- **Accepted on a stock TV:** both voice agreements, viewing information, interest-based ads, marketing. All optional: only the Terms of Use and Privacy Policy are required for apps to work ([LG](https://www.lg.com/us/support/help-library/how-to-accept-the-updated-user-agreements-on-your-lg-tv-CT10000018-20155426555618)). Paths in section 8.

## 8. Ads and tracking: settings and DNS

**LG webOS 6 (Settings > All Settings):**
- General > System > Additional Settings > **Home Settings**: Home Promotion off, Content Recommendation off, Power On Screen = Recent Input ([LG](https://www.lg.com/us/support/help-library/lg-tv-advertising-messages-or-images-appear-when-im-watching-tv--20154629490906)).
- General > System > Additional Settings > **Live Plus** off (done by API), and **Advertisement**: Limit AD Tracking on, Reset AD ID ([The Markup](https://themarkup.org/privacy/2023/12/12/your-smart-tv-knows-what-youre-watching)).
- Support > Privacy & Terms > **User Agreements**: uncheck Viewing Information, both Voice Information agreements, and the ad agreements ([LG](https://www.lg.com/us/support/help-library/lg-tv-how-to-agree-to-the-user-agreements--20155154186594)). **Do Not Sell My Personal Information** is in the same Privacy & Terms menu.
- LG Channels can't be deleted on webOS 6; disable it inside the app: LG Channels > MY > Settings > Disable LG Channels ([LG](https://www.lg.com/africa/support/product-help/CT20080005-20155062553396)).

**DNS blocking:**
- Lists: hagezi's `native.lgwebos` (231 rules, rebuilt daily) ([hagezi](https://github.com/hagezi/dns-blocklists)); `tv/hosts-block-lg.txt` is derived from it. Checked line by line: it has the ACR endpoint (`alphonso.tv`), `lgsmartad.com`, `lgads.tv`, the `lgtvcommon.com` beacons and `rdx2.lgtvsdp.com`, and it does **not** touch the hosts that break the TV. Perflyst's SmartTV list is broader and has known breakage: blocking `us.lgtvsdp.com` resets the clock to 2019 and breaks certificates ([#117](https://github.com/Perflyst/PiHoleBlocklist/issues/117)), the country `nextlgsdp.com` hosts break the Content Store and casting ([#172](https://github.com/Perflyst/PiHoleBlocklist/issues/172)).
- Never block: `lgtvsdp.com`, `us.lgtvsdp.com`, `lgappstv.com`, `us.nextlgsdp.com`, or `*.lge.com` wholesale. (LG's update servers `snu`/`su`/`nsu.lge.com` can be blocked on purpose, as a second lock on firmware updates.)
- YouTube's in-app ads come from the same hosts as the video, so DNS can't remove them ([Pi-hole forum](https://discourse.pi-hole.net/t/youtube-adverts-and-same-domain-issue/48179)); that takes a modded YouTube app.
- Where to run it: on a rooted LG the hosts file in the privacy hook does most of this on the TV itself; what it can't catch (subdomains, the first seconds of a boot) needs a resolver on the network: AdGuard Home or Pi-hole with the hagezi list, applied to the TV only, the TV's DNS set by hand (General > Network > Wi-Fi Connection > Advanced Wi-Fi Settings > Edit), and a fixed address for whatever runs it. The TVs can't do encrypted DNS. Whether they hardcode a fallback resolver is unknown; a query log shows it, and a router can block outbound 53/853 from the TV.

