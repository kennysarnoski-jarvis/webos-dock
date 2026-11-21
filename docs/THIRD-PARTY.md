# Third-party code and data

Dock's own code is MIT (see `LICENSE`). It carries or uses:

- **SlopBro** (https://github.com/throwaway96/slopbro), AGPL-3.0, by throwaway96: the root. Vendored unmodified in `vendor/slopbro-21023d5/` at a pinned commit, with its license and the SHA-256 of each file in its `SOURCE.md`. Its license is its own; nothing here links against it.
- **Homebrew Channel** (https://github.com/webosbrew/webos-homebrew-channel), the webosbrew project: installed on the TV by SlopBro from webosbrew's official release; its boot hooks, `exec` service and sshd are what Dock and the tools build on. Not part of this repository.
- **hagezi DNS blocklists** (https://github.com/hagezi/dns-blocklists), GPL-3.0: `tv/hosts-block-lg.txt` is derived from `native.lgwebos`, so that file is GPL-3.0.
- **Free My TV** (https://github.com/simbasjungles/free-my-tv), MIT License, Copyright (c) 2026 Free My TV contributors: the `luna()` bridge in `app/js/platform.js` and the ar/tar packing in `tools/build-ipk.py` follow its `web/tv.js` and `webos/build.py`. Its license text is below.
- **cleanyourtv-WebOS** (https://github.com/lasharor/cleanyourtv-WebOS): the idea of stubbing LG's on-demand services with a bind mount, and of mounting a replacement over LG's Home, follows it.
- **AltHome** (https://github.com/kitsuned/AltHome), GPL-2.0: read for its Home-key technique during the research; no code taken.
- **Open-Meteo** (https://open-meteo.com): weather and geocoding data, CC BY 4.0, fetched live by the TV; credited in Dock's About sheet.
- **CoinGecko** (https://www.coingecko.com/en/api): market data from its free public API, fetched live by the TV; credited in Dock's About sheet and on the Markets card.
- **Inter** (https://github.com/rsms/inter) v4.1, SIL Open Font License 1.1: `app/fonts/InterVariable.woff2`, unmodified, with its license in `app/fonts/LICENSE.txt`.
- **Feather Icons** (https://feathericons.com), MIT: the crescent-moon path in `app/js/weather.js` and the Screen Saver row icon.

```
MIT License

Copyright (c) 2026 Free My TV contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
