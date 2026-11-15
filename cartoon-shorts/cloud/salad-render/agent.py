#!/usr/bin/env python3
"""Runs INSIDE the Salad render container (started by boot.sh). A tiny HTTP server on port 3000 for the Salad job-queue
worker: every queue job is POSTed to /run as {"cmd": "<shell>", "timeout": seconds} and the reply {"rc", "out", "seconds"}
becomes the job's output (Salad allows at most 10 MB, so `out` keeps only its tail). GET /ready answers the readiness
probe. The container holds no secret: files come from signed URLs, results go back in the reply."""
import json, subprocess, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import socket

KEEP = 6_500_000  # bytes of output kept (the reply must stay under 10 MB as JSON)


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def reply(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(b)))
        self.end_headers(); self.wfile.write(b)

    def do_GET(self):
        self.reply(200, {"ok": True})

    def do_POST(self):
        try:
            job = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))) or b"{}")
            t0 = time.time()
            p = subprocess.run(["bash", "-c", job["cmd"]], capture_output=True, timeout=float(job.get("timeout", 3000)), cwd="/app")
            out = (p.stdout + p.stderr).decode("utf-8", "replace")
            self.reply(200, {"rc": p.returncode, "out": out[-KEEP:], "seconds": round(time.time() - t0, 1)})
        except subprocess.TimeoutExpired as e:
            self.reply(200, {"rc": -1, "out": "TIMEOUT\n" + ((e.stdout or b"") + (e.stderr or b"")).decode("utf-8", "replace")[-20000:], "seconds": -1})
        except Exception as e:  # a reply that is not 200 makes Salad run the job again
            self.reply(200, {"rc": -2, "out": repr(e), "seconds": 0})


class S(ThreadingHTTPServer):
    address_family = socket.AF_INET6

    def server_bind(self):
        self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)  # IPv4 and IPv6 (Salad probes over IPv6)
        super().server_bind()


S(("::", 3000), H).serve_forever()
