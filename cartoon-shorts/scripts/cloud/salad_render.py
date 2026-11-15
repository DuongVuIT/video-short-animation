#!/usr/bin/env python3
"""Final render of a Remotion composition on SaladCloud GPUs (driven by scripts/render-salad.sh).
See cloud/salad-render/README.md. Subcommands are added below; `probe` is the first."""
from __future__ import annotations

import base64, importlib.util, json, mimetypes, sys, time, uuid, urllib.request, urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
HERE = ROOT / "cloud" / "salad-render"
_spec = importlib.util.spec_from_file_location("salad", ROOT / "scripts" / "salad.py")
salad = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(salad)
S4 = "https://storage-api.salad.com"
GROUP = QUEUE = "render"
IMAGE = "node:22-bookworm"
CPU, MEMORY_MB, DISK = 8, 16384, 20 * 1024 ** 3


def s4_put(s, name: str, data: bytes, mime: str = "application/octet-stream") -> str:
    """upload to Salad storage -> a signed download URL (30 days)"""
    b = "----salad" + uuid.uuid4().hex
    parts = []
    for k, v in (("mimeType", mime), ("sign", "true")):
        parts.append(f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    parts.append(f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="{Path(name).name}"\r\nContent-Type: {mime}\r\n\r\n'.encode() + data + b"\r\n")
    parts.append(f"--{b}--\r\n".encode())
    req = urllib.request.Request(f"{S4}/organizations/{s.org}/files/{name}", data=b"".join(parts), method="PUT",
                                 headers={"Salad-Api-Key": s.key, "Content-Type": f"multipart/form-data; boundary={b}", "User-Agent": "cartoon-shorts-salad/2"})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return json.loads(r.read())["url"]
    except urllib.error.HTTPError as e:
        salad.die(f"upload of {name} failed ({e.code}): {e.read()[:300]!r}")


def boot_script() -> bytes:
    return (HERE / "boot.sh").read_text().replace("__AGENT__", (HERE / "agent.py").read_text()).encode()


def fetch(url: str, dst: str) -> str:
    """shell: download a signed Salad storage URL with python (always in the image). Salad storage answers 403 to
    python's default User-Agent, so one is set."""
    return ("python3 -c \"import urllib.request as u;o=u.build_opener();o.addheaders=[('User-Agent','curl/8')];"
            "u.install_opener(o);u.urlretrieve('" + url + "','" + dst + "')\"")


def body(replicas: int, gpu_ids: list[str], boot_url: str, name: str = GROUP, autostart: bool = True) -> dict:
    cmd = fetch(boot_url, "/tmp/boot.sh") + "; exec bash /tmp/boot.sh"
    return {
        "name": name, "display_name": "Remotion render, cartoon-shorts",
        "container": {"image": IMAGE, "priority": "high", "command": ["bash", "-c", cmd],
                      "resources": {"cpu": CPU, "memory": MEMORY_MB, "gpu_classes": gpu_ids, "storage_amount": DISK},
                      "environment_variables": {"NVIDIA_DRIVER_CAPABILITIES": "all", "NVIDIA_VISIBLE_DEVICES": "all"}},
        "autostart_policy": autostart, "restart_policy": "always", "replicas": replicas,
        "queue_connection": {"path": "/run", "port": 3000, "queue_name": QUEUE},
        "readiness_probe": {"http": {"path": "/ready", "port": 3000, "scheme": "http", "headers": []},
                            "initial_delay_seconds": 0, "period_seconds": 5, "timeout_seconds": 5, "success_threshold": 1, "failure_threshold": 3},
    }


def submit(s, cmd: str, timeout: int = 3000) -> str:
    st, d = s.call("POST", f"{s.proj}/queues/{QUEUE}/jobs", {"input": {"cmd": cmd, "timeout": timeout}})
    if st not in (200, 201):
        salad.die(f"cannot queue a job ({st}): {str(d)[:300]}")
    return d["id"]


def wait(s, jid: str, minutes: float = 40, quiet: bool = False) -> dict:
    t0 = time.time(); last = ""
    while time.time() - t0 < minutes * 60:
        st, d = s.call("GET", f"{s.proj}/queues/{QUEUE}/jobs/{jid}")
        if st == 200 and d.get("status") in ("succeeded", "failed", "cancelled"):
            return d
        line = salad.machines(s, GROUP)
        if line != last and not quiet:
            print(f"[{(time.time() - t0) / 60:4.1f} min] {line}", flush=True); last = line
        time.sleep(8)
    return {"status": "timeout"}


def run(s, cmd: str, timeout: int = 3000, minutes: float = 40) -> dict:
    d = wait(s, submit(s, cmd, timeout), minutes)
    o = d.get("output") if isinstance(d.get("output"), dict) else {}
    return {"status": d.get("status"), "rc": o.get("rc"), "out": o.get("out", str(d.get("output"))[:2000]), "seconds": o.get("seconds")}


def get_file(s, url: str, dst: str) -> str:
    return fetch(url, dst)


def push(s, name: str, path: Path, mime: str = "application/octet-stream") -> str:
    return s4_put(s, f"render/{name}", path.read_bytes(), mime)


if __name__ == "__main__":
    s = salad.Salad()
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "testcmd":   # is the command line accepted? (a group with 0 machines, deleted again)
        url = s4_put(s, "render/boot.sh", boot_script(), "text/x-shellscript")
        print("boot url length", len(url), "| chars:", "".join(sorted(set(c for c in url if not c.isalnum()))))
        name = "rtest-" + uuid.uuid4().hex[:6]
        st, d = s.call("POST", s.base, body(0, [g["id"] for g in s.pick_gpus()], url, name, False))
        print("create ->", st, "ok" if st in (200, 201) else json.dumps(d)[:400])
        if st in (200, 201):
            s.call("DELETE", f"{s.base}/{name}")
    elif cmd == "up":
        s.ensure_queue(QUEUE)
        url = s4_put(s, "render/boot.sh", boot_script(), "text/x-shellscript")
        n = int(sys.argv[2]) if len(sys.argv) > 2 else 1
        b = body(n, [g["id"] for g in s.pick_gpus()], url)
        if s.group(GROUP) is None:
            st, d = s.call("POST", s.base, b)
            print("create ->", st, "ok" if st in (200, 201) else json.dumps(d)[:400])
        else:   # the boot script's signed URL changes with every upload: point the group at the new one
            st, d = s.call("PATCH", f"{s.base}/{GROUP}", {"replicas": n, "container": {"command": b["container"]["command"]}})
            print("update ->", st, "ok" if st in (200, 202) else json.dumps(d)[:400])
            if (s.group(GROUP).get("current_state") or {}).get("status") in ("stopped", "failed"):
                s.action(GROUP, "start"); print("started")
    elif cmd == "sh":
        r = run(s, sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 3000)
        print(f"[{r['status']} rc={r['rc']} {r['seconds']} s]\n{r['out']}")
    elif cmd == "setup":   # install Chrome + Remotion on whichever machine takes the job, show the tail of its log
        u1, u2 = push(s, "setup.sh", HERE / "setup.sh"), push(s, "worker.mjs", ROOT / "cloud" / "worker.mjs")
        r = run(s, f"{get_file(s, u1, '/app/setup.sh')} && {get_file(s, u2, '/app/worker.mjs')} && bash /app/setup.sh 2>&1 | tail -5; tail -3 /tmp/apt.log /tmp/npm.log", 1500)
        print(f"[{r['status']} rc={r['rc']} {r['seconds']} s]\n{r['out']}")
    elif cmd == "down":
        s.action(GROUP, "stop"); print("stopped")
    elif cmd == "start":
        s.action(GROUP, "start"); print("started")
    elif cmd == "status":
        g = s.group(GROUP); print((g or {}).get("current_state", {}).get("status") if g else "no group", "|", salad.machines(s, GROUP) if g else "")
