# SlopBro, vendored

Source: https://github.com/throwaway96/slopbro at commit `21023d56ca424607bb03d2939609cc658c655fc7` (2026-09-28, "add workaround for LG's patch attempt"), fetched file by file from raw.githubusercontent.com at that commit on 2026-10-25. License: AGPL-3.0 (`COPYING`). Not modified.

What it does, from reading it: pairs with the TV over LG's remote API (you press Allow), serves `wwwroot/` from this Mac, and has one of LG's own built-in apps open that page; the page then runs `wwwroot/autoroot.sh`, which installs Homebrew Channel 0.7.3 from webosbrew's official GitHub release and makes root persist. The only hosts it contacts are this Mac and github.com. It toasts each step on the TV. Compiles on this Mac's Python 3.9.

SHA-256 of the files as fetched:

```
1a64f7050b3682ab1ac50a3e2998946a93c07abba0dffca0c4b8afc77403d75f  slopbro.py
16bedff5ee8f8c754e6e302e3251dfc904f6aa7ca71c0b0483f7e5fc6bbb3611  wwwroot/autoroot.sh
0430d93c45885de73ba5f3e2f32b1e4ef9e713234de818162f0cb8ac20a1ff36  wwwroot/index.html
3a6830ac858bb71f0bd0b9f45514ff1fd85d707170f59941e6771d454102f791  wwwroot/main.js
f573657cb5db54fd8b0f724ae69d8f8fd6903ec6ca0f038ce2b47e4f45ef1ef0  wwwroot/package.json
```

The pairing key it saves (`*.key`) is git-ignored.
