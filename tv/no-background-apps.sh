#!/bin/sh
# TV project: close apps that sit in the background. webOS keeps the app you leave
# paused in RAM (and LG preloads favourites on top). This closes an app once it has
# been in the background for two checks in a row (about 40 s, long past any launch).
# Apps that belong in the background stay: the inputs, Home, AirPlay, Homebrew Channel.
# Started at boot by 20-tvproject-privacy; pause with /var/lib/webosbrew/tvproject/DISABLE.
export PATH=/usr/bin:/usr/sbin:/bin:/sbin:$PATH
D=/var/lib/webosbrew/tvproject
KEEP="com.webos.app.home com.webos.app.hdmi1 com.webos.app.hdmi2 com.webos.app.hdmi3 com.webos.app.hdmi4 com.webos.app.livetv airplay org.webosbrew.hbchannel"

# LG's preload-manager relaunches favourite apps in the background every few minutes.
# Its policy API turns that off per app (tv/no-preload-apps) but only in memory, so it
# is applied once the service answers, and again every 30 minutes.
apply_preload_policy() {
    luna-send -n 1 -w 5000 luna://com.webos.service.preloadmanager/getPreloadPolicy '{}' </dev/null | grep -q '"returnValue":true' || return 1
    for id in $(cat "$D/no-preload-apps" 2>/dev/null); do
        luna-send -n 1 -w 5000 luna://com.webos.service.preloadmanager/setPreloadPolicy \
            "{\"application\":{\"id\":\"$id\",\"isEnabled\":false}}" </dev/null >/dev/null 2>&1
    done
    echo "$(date '+%H:%M:%S') preload policy applied"
}

prev=""; tick=0; policy_at=-1
while :; do
    sleep 20
    [ -e "$D/DISABLE" ] && continue
    tick=$((tick + 1))
    if [ "$policy_at" -lt 0 ] || [ $((tick - policy_at)) -ge 90 ]; then
        apply_preload_policy && policy_at=$tick
    fi
    fg=$(luna-send -n 1 -w 5000 luna://com.webos.applicationManager/getForegroundAppInfo '{}' </dev/null | sed -n 's/.*"appId":"\([^"]*\)".*/\1/p')
    running=$(luna-send -n 1 -w 5000 luna://com.webos.applicationManager/running '{}' </dev/null | grep -o '"id":"[^"]*"' | sed 's/"id":"//; s/"$//')
    now=""; still=""
    for id in $running; do
        [ "$id" = "$fg" ] && continue
        case " $KEEP " in *" $id "*) continue ;; esac
        # already asked to close and still here: a system app that ignores it; leave it
        case " $closed " in *" $id "*) still="$still $id"; now="$now $id"; continue ;; esac
        case " $prev " in *" $id "*)
            luna-send -n 1 -w 5000 luna://com.webos.applicationManager/closeByAppId "{\"id\":\"$id\"}" </dev/null >/dev/null 2>&1
            echo "$(date '+%H:%M:%S') closed background app $id"
            still="$still $id" ;;
        esac
        now="$now $id"
    done
    prev="$now"; closed="$still"
done
