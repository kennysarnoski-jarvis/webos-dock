#!/usr/bin/env python3
"""Packs app/ into an LG webOS IPK, the way ares-package does, with no LG tools.

    python3 tools/build-ipk.py            # -> dist/<id>_<version>_all.ipk

The ar + tar layout follows Free My TV's webos/build.py (MIT, Free My TV contributors).
"""
import io
import json
import os
import tarfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(ROOT, 'app')
DIST = os.path.join(ROOT, 'dist')


def tar_gz(entries):
    """A .tar.gz from [(name, bytes or None for a directory)], owned by root."""
    buf = io.BytesIO()
    now = int(time.time())
    with tarfile.open(fileobj=buf, mode='w:gz', format=tarfile.PAX_FORMAT) as tar:
        for name, data in entries:
            info = tarfile.TarInfo(name)
            info.mtime = now
            info.uid = info.gid = 0
            if data is None:
                info.type = tarfile.DIRTYPE
                info.mode = 0o755
                tar.addfile(info)
            else:
                info.size = len(data)
                info.mode = 0o644
                tar.addfile(info, io.BytesIO(data))
    return buf.getvalue()


def ar(members):
    out = io.BytesIO()
    out.write(b'!<arch>\n')
    now = int(time.time())
    for name, data in members:
        out.write(('%-16s%-12d%-6d%-6d%-8s%-10d`\n' % (name, now, 0, 0, '100644', len(data))).encode('ascii'))
        out.write(data)
        if len(data) % 2:
            out.write(b'\n')
    return out.getvalue()


def build():
    with open(os.path.join(APP, 'appinfo.json'), encoding='utf-8') as f:
        info = json.load(f)
    app_id, version = info['id'], info['version']

    files = {}
    for dirpath, dirnames, filenames in os.walk(APP):
        dirnames[:] = sorted(d for d in dirnames if not d.startswith('.'))
        for name in sorted(filenames):
            if name.startswith('.'):
                continue
            path = os.path.join(dirpath, name)
            with open(path, 'rb') as f:
                files[os.path.relpath(path, APP).replace(os.sep, '/')] = f.read()

    base = 'usr/palm/applications/' + app_id
    entries = [('usr', None), ('usr/palm', None), ('usr/palm/applications', None), (base, None)]
    dirs = set()
    for rel in sorted(files):
        parts = rel.split('/')[:-1]
        for i in range(1, len(parts) + 1):
            d = '/'.join(parts[:i])
            if d not in dirs:
                dirs.add(d)
                entries.append((base + '/' + d, None))
        entries.append((base + '/' + rel, files[rel]))
    package = json.dumps({'id': app_id, 'version': version, 'app': app_id}, indent=2).encode('utf-8')
    entries += [('usr/palm/packages', None), ('usr/palm/packages/' + app_id, None),
                ('usr/palm/packages/' + app_id + '/packageinfo.json', package)]

    size = sum(len(d) for d in files.values()) + len(package)
    control = ('Package: %s\nVersion: %s\nSection: misc\nPriority: optional\nArchitecture: all\nInstalled-Size: %d\n'
               'Maintainer: %s\nDescription: %s\n'
               'webOS-Package-Format-Version: 2\nwebOS-Packager-Version: 1.0.0\n'
               % (app_id, version, size, info.get('vendor', 'unknown'), info.get('title', app_id)))
    data = ar([('debian-binary', b'2.0\n'), ('control.tar.gz', tar_gz([('control', control.encode('utf-8'))])),
               ('data.tar.gz', tar_gz(entries))])

    os.makedirs(DIST, exist_ok=True)
    out = os.path.join(DIST, '%s_%s_all.ipk' % (app_id, version))
    with open(out, 'wb') as f:
        f.write(data)
    print('%s %d KB, %d files' % (out, len(data) // 1024, len(files)))
    return out


if __name__ == '__main__':
    build()
