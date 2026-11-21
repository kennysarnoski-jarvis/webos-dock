#!/usr/bin/env python3
"""Tiny LG webOS remote-control client, standard library only.

Talks to the TV's official local-network API (SSAP, the protocol LG's own
phone remote uses) over a WebSocket: wss on port 3001, plain ws on 3000 as a
fallback. Pair once; the client key is saved to .secrets/lgtv.json.

    python3 tools/lgtv.py pair                 # press Allow on the TV
    python3 tools/lgtv.py info                 # model, webOS and firmware versions
    python3 tools/lgtv.py apps                 # installed apps
    python3 tools/lgtv.py launchpoints         # home bar, in order
    python3 tools/lgtv.py inputs               # HDMI inputs and what's plugged in
    python3 tools/lgtv.py foreground           # app on screen right now
    python3 tools/lgtv.py snapshot DIR         # all of the above as JSON, for backups
    python3 tools/lgtv.py call URI [JSON]      # any ssap:// request
    python3 tools/lgtv.py luna URI JSON        # internal luna:// call, no reply
    python3 tools/lgtv.py key RIGHT RIGHT ENTER   # press remote buttons (LEFT UP DOWN BACK HOME RED ...)

Set LGTV_HOST to talk to a different TV.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import socket
import ssl
import struct
import time
import sys
from pathlib import Path



def default_host() -> str:
    """LGTV_HOST, else the first TV listed in tools/tvs.conf (see tvs.conf.example), else empty."""
    host = os.environ.get("LGTV_HOST", "")
    if host:
        return host
    try:
        for line in (Path(__file__).resolve().parent / "tvs.conf").read_text().splitlines():
            parts = line.split()
            if parts and not parts[0].startswith("#") and len(parts) > 1:
                return parts[1]
    except OSError:
        pass
    return ""


HOST = default_host()
KEY_FILE = Path(__file__).resolve().parent.parent / ".secrets" / "lgtv.json"

# Same unsigned registration manifest Home Assistant's aiowebostv sends.
PERMISSIONS = [
    "APP_TO_APP", "CLOSE", "CONTROL_AUDIO", "CONTROL_DISPLAY",
    "CONTROL_INPUT_JOYSTICK", "CONTROL_INPUT_MEDIA_PLAYBACK",
    "CONTROL_INPUT_MEDIA_RECORDING", "CONTROL_INPUT_TEXT", "CONTROL_INPUT_TV",
    "CONTROL_MOUSE_AND_KEYBOARD", "CONTROL_POWER", "CONTROL_TV_SCREEN",
    "LAUNCH", "LAUNCH_WEBAPP", "READ_APP_STATUS", "READ_COUNTRY_INFO",
    "READ_CURRENT_CHANNEL", "READ_INPUT_DEVICE_LIST", "READ_INSTALLED_APPS",
    "READ_LGE_SDX", "READ_LGE_TV_INPUT_EVENTS", "READ_NETWORK_STATE",
    "READ_NOTIFICATIONS", "READ_POWER_STATE", "READ_RUNNING_APPS",
    "READ_SETTINGS", "READ_TV_CHANNEL_LIST", "READ_TV_CURRENT_TIME",
    "READ_UPDATE_INFO", "SEARCH", "TEST_OPEN", "TEST_PROTECTED", "TEST_SECURE",
    "UPDATE_FROM_REMOTE_APP", "WRITE_NOTIFICATION_ALERT",
    "WRITE_NOTIFICATION_TOAST", "WRITE_SETTINGS",
]

# Identifiers we never need to print or store.
PRIVATE_KEYS = {"device_id", "serialNumber", "serial_number"}


class WebSocket:
    """Just enough RFC 6455 for SSAP: masked text frames out, pings, close."""

    def __init__(self, host: str, timeout: float = 10.0, port: int | None = None, secure: bool = True, path: str = "/"):
        errors = []
        attempts = [(port, secure)] if port else [(3001, True), (3000, False)]
        for port, secure in attempts:
            try:
                sock = socket.create_connection((host, port), timeout=timeout)
                if secure:
                    ctx = ssl.create_default_context()
                    ctx.check_hostname = False
                    ctx.verify_mode = ssl.CERT_NONE  # the TV's certificate is self-signed
                    sock = ctx.wrap_socket(sock, server_hostname=host)
                self.sock = sock
                self.buf = self._handshake(host, port, path)
                return
            except (OSError, ConnectionError) as e:
                errors.append(f"port {port}: {e}")
        raise ConnectionError("can't reach the TV (" + "; ".join(errors) + ")")

    def _handshake(self, host: str, port: int, path: str = "/") -> bytes:
        key = base64.b64encode(os.urandom(16)).decode()
        self.sock.sendall(
            f"GET {path} HTTP/1.1\r\nHost: {host}:{port}\r\nUpgrade: websocket\r\n"
            f"Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n\r\n".encode()
        )
        data = b""
        while b"\r\n\r\n" not in data:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise ConnectionError("closed during handshake")
            data += chunk
        head, _, rest = data.partition(b"\r\n\r\n")
        status = head.split(b"\r\n", 1)[0].decode(errors="replace")
        if status.split(" ")[1:2] != ["101"]:
            raise ConnectionError(f"handshake refused: {status}")
        return rest

    def _frame(self, opcode: int, data: bytes) -> None:
        n = len(data)
        if n < 126:
            header = struct.pack("!BB", 0x80 | opcode, 0x80 | n)
        elif n < 1 << 16:
            header = struct.pack("!BBH", 0x80 | opcode, 0x80 | 126, n)
        else:
            header = struct.pack("!BBQ", 0x80 | opcode, 0x80 | 127, n)
        mask = os.urandom(4)
        self.sock.sendall(header + mask + bytes(b ^ mask[i & 3] for i, b in enumerate(data)))

    def _read(self, n: int) -> bytes:
        while len(self.buf) < n:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise ConnectionError("TV closed the connection")
            self.buf += chunk
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def send(self, obj: dict) -> None:
        self._frame(0x1, json.dumps(obj).encode())

    def recv(self, deadline: float | None = None) -> dict:
        """The next message. Pings are answered and don't count as messages, so a TV that pings
        regularly but never answers would keep this waiting: a deadline (time.time()-based) ends it."""
        message = b""
        while True:
            if deadline is not None and time.time() >= deadline:
                raise socket.timeout("no message before the deadline")
            b1, b2 = self._read(2)
            n = b2 & 0x7F
            if n == 126:
                n = struct.unpack("!H", self._read(2))[0]
            elif n == 127:
                n = struct.unpack("!Q", self._read(8))[0]
            mask = self._read(4) if b2 & 0x80 else b""
            payload = self._read(n)
            if mask:
                payload = bytes(b ^ mask[i & 3] for i, b in enumerate(payload))
            opcode = b1 & 0x0F
            if opcode == 0x8:
                raise ConnectionError("TV closed the connection")
            if opcode == 0x9:
                self._frame(0xA, payload)
            elif opcode in (0x0, 0x1, 0x2):
                message += payload
                if b1 & 0x80:
                    return json.loads(message)


def load_key(host: str) -> str | None:
    try:
        return json.loads(KEY_FILE.read_text()).get(host)
    except (OSError, ValueError):
        return None


def save_key(host: str, key: str) -> None:
    KEY_FILE.parent.mkdir(parents=True, exist_ok=True)
    try:
        data = json.loads(KEY_FILE.read_text())
    except (OSError, ValueError):
        data = {}
    data[host] = key
    KEY_FILE.write_text(json.dumps(data, indent=2) + "\n")
    os.chmod(KEY_FILE, 0o600)


class TV:
    def __init__(self, host: str = HOST, pairing_timeout: float = 90.0):
        self.ws = WebSocket(host)
        self.counter = 0
        saved = load_key(host)
        payload = {
            "forcePairing": False,
            "pairingType": "PROMPT",
            "manifest": {"appVersion": "1.1", "manifestVersion": 1, "permissions": PERMISSIONS},
        }
        if saved:
            payload["client-key"] = saved
        self.ws.send({"type": "register", "id": "register_0", "payload": payload})
        self.ws.sock.settimeout(pairing_timeout)
        while True:
            msg = self.ws.recv()
            if msg.get("id") != "register_0":
                continue
            if msg.get("type") == "registered":
                key = msg["payload"]["client-key"]
                if key != saved:
                    save_key(host, key)
                break
            if msg.get("type") == "error":
                raise PermissionError(msg.get("error") or "pairing refused")
            if not saved:
                print("Waiting for Allow on the TV...", file=sys.stderr, flush=True)
        self.ws.sock.settimeout(15)

    def request(self, uri: str, payload: dict | None = None) -> dict:
        self.counter += 1
        rid = f"req_{self.counter}"
        msg = {"type": "request", "id": rid, "uri": uri}
        if payload is not None:
            msg["payload"] = payload
        self.ws.send(msg)
        while True:
            reply = self.ws.recv()
            if reply.get("id") == rid:
                if reply.get("type") == "error":
                    raise RuntimeError(f"{uri}: {reply.get('error')}")
                return reply.get("payload", {})


def press(tv: TV, names: list[str], gap: float = 0.35) -> None:
    """Press remote buttons through the TV's pointer-input socket (what LG's phone remote uses)."""
    import re
    import time
    res = tv.request("ssap://com.webos.service.networkinput/getPointerInputSocket")
    m = re.match(r"(wss?)://([^:/]+):(\d+)(/.*)", res["socketPath"])
    if not m:
        raise RuntimeError(f"odd socket path: {res}")
    ws = WebSocket(m.group(2), port=int(m.group(3)), secure=m.group(1) == "wss", path=m.group(4))
    for name in names:
        name = name.upper()
        if name == "CLICK":
            ws._frame(0x1, b"type:click\n\n")
        else:
            ws._frame(0x1, f"type:button\nname:{name}\n\n".encode())
        time.sleep(gap)
    ws.sock.close()


def info(tv: TV) -> dict:
    out = {}
    for uri in (
        "ssap://system/getSystemInfo",
        "ssap://com.webos.service.update/getCurrentSWInformation",
    ):
        try:
            out.update(tv.request(uri))
        except RuntimeError as e:
            out[uri] = str(e)
    return {k: v for k, v in out.items() if k not in PRIVATE_KEYS}


def apps(tv: TV) -> list:
    return tv.request("ssap://com.webos.applicationManager/listApps").get("apps", [])


def launchpoints(tv: TV) -> list:
    return tv.request("ssap://com.webos.applicationManager/listLaunchPoints").get("launchPoints", [])


def inputs(tv: TV) -> list:
    return tv.request("ssap://tv/getExternalInputList").get("devices", [])


def foreground(tv: TV) -> dict:
    return tv.request("ssap://com.webos.applicationManager/getForegroundAppInfo")


def luna(tv: TV, uri: str, params: dict) -> dict:
    """Fire-and-forget call to an internal luna:// API.

    SSAP doesn't expose luna, but an alert's close action can call it (the
    trick bscpylgtv uses). The luna reply never comes back to us.
    """
    target = {"uri": f"luna://{uri}", "params": params}
    alert = tv.request("ssap://system.notifications/createAlert", {
        "message": " ",
        "buttons": [{"label": "", "onClick": target["uri"], "params": params}],
        "onclose": target,
        "onfail": target,
    })
    if "alertId" not in alert:
        raise RuntimeError(f"createAlert returned no alertId: {alert}")
    return tv.request("ssap://system.notifications/closeAlert", {"alertId": alert["alertId"]})


def print_apps(items: list) -> None:
    def key(a):
        return (not a.get("visible", True), bool(a.get("systemApp")), a.get("title", "").lower())

    for a in sorted(items, key=key):
        flags = [name for name, on in (
            ("system", a.get("systemApp")),
            ("removable", a.get("removable")),
            ("hidden", not a.get("visible", True)),
        ) if on]
        print(f"{a.get('id', ''):48} {a.get('title', ''):32} {a.get('type', ''):7} "
              f"{a.get('version', ''):14} {','.join(flags)}")


def print_launchpoints(items: list) -> None:
    for i, lp in enumerate(items, 1):
        print(f"{i:3} {lp.get('id', ''):48} {lp.get('title', ''):32} "
              f"{'removable' if lp.get('removable') else ''}")


def print_inputs(items: list) -> None:
    for d in items:
        device = " / ".join(
            str(d[k]) for k in ("spdVendorName", "spdProductDescription", "spdSourceDeviceInfo") if d.get(k)
        )
        print(f"{d.get('id', ''):10} label={d.get('label', '')!r:24} "
              f"connected={str(d.get('connected')):5} app={d.get('appId', ''):24} {device}")


def main() -> int:
    p = argparse.ArgumentParser(description="LG webOS SSAP client")
    sub = p.add_subparsers(dest="cmd", required=True)
    for name in ("pair", "info", "foreground"):
        sub.add_parser(name)
    for name in ("apps", "launchpoints", "inputs"):
        sub.add_parser(name).add_argument("--json", action="store_true")
    sub.add_parser("snapshot").add_argument("dir")
    call = sub.add_parser("call")
    call.add_argument("uri")
    call.add_argument("payload", nargs="?")
    luna_cmd = sub.add_parser("luna")
    luna_cmd.add_argument("uri")
    luna_cmd.add_argument("payload")
    sub.add_parser("key").add_argument("names", nargs="+")
    args = p.parse_args()

    if not HOST:
        print("No TV address: set LGTV_HOST, or list the TV in tools/tvs.conf (copy tools/tvs.conf.example).", file=sys.stderr)
        return 2
    try:
        tv = TV()
    except socket.timeout:
        print("Timed out waiting for the TV. Is it on, and did you press Allow?", file=sys.stderr)
        return 1
    except (ConnectionError, PermissionError) as e:
        print(f"Couldn't connect: {e}", file=sys.stderr)
        return 1

    try:
        return run(tv, args)
    except RuntimeError as e:  # the TV answered with an error, e.g. 401 or 404
        print(e, file=sys.stderr)
        return 1


def run(tv: TV, args: argparse.Namespace) -> int:
    if args.cmd == "pair":
        print(f"Paired. Client key saved to {KEY_FILE}")
    elif args.cmd in ("info", "foreground"):
        print(json.dumps({"info": info, "foreground": foreground}[args.cmd](tv), indent=2, sort_keys=True))
    elif args.cmd in ("apps", "launchpoints", "inputs"):
        items = {"apps": apps, "launchpoints": launchpoints, "inputs": inputs}[args.cmd](tv)
        if args.json:
            print(json.dumps(items, indent=2, sort_keys=True))
        else:
            {"apps": print_apps, "launchpoints": print_launchpoints, "inputs": print_inputs}[args.cmd](items)
    elif args.cmd == "snapshot":
        out = Path(args.dir)
        out.mkdir(parents=True, exist_ok=True)
        for name, fn in (("info", info), ("apps", apps), ("launchpoints", launchpoints),
                         ("inputs", inputs), ("foreground", foreground)):
            (out / f"{name}.json").write_text(json.dumps(fn(tv), indent=2, sort_keys=True) + "\n")
        print(f"Snapshot written to {out}")
    elif args.cmd == "call":
        payload = json.loads(args.payload) if args.payload else None
        print(json.dumps(tv.request(args.uri, payload), indent=2, sort_keys=True))
    elif args.cmd == "luna":
        print(json.dumps(luna(tv, args.uri, json.loads(args.payload)), indent=2, sort_keys=True))
    elif args.cmd == "key":
        press(tv, args.names)
        print("pressed:", " ".join(n.upper() for n in args.names))
    return 0


if __name__ == "__main__":
    sys.exit(main())
