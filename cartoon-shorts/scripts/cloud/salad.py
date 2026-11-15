#!/usr/bin/env python3
"""AI pictures and AI video clips on SaladCloud GPUs (RTX 5090 / 4090): start the machines, run a batch, stop them.

Pictures: Z-Image in ComfyUI, full precision. A rented machine makes a 2048x1152 picture in about 20 seconds, and
several machines work side by side.
Video:    Wan 2.2 TI2V-5B turns a still picture into a 5 second 1280x704 clip (mist drifting, water moving, leaves).
Nothing is built or uploaded: the machines run Salad's ready-made image (ghcr.io/saladtechnologies/comfyui-api), download
the models when they start, and take their work from a Salad job queue (no time limit per job, failed jobs are retried).

    python3 scripts/cloud/salad.py check                          key, organisation, GPU classes and prices (starts nothing)
    python3 scripts/cloud/salad.py img cloud/salad/jobs-example.json --out out/salad/x
                                                            start machines, make every picture, STOP the machines
    python3 scripts/cloud/salad.py video cloud/salad/video-example.json --out out/salad/v
    python3 scripts/cloud/salad.py img jobs.json --keep           ... but leave them running for the next batch
    python3 scripts/cloud/salad.py up img|video [--replicas 2]    start and wait until a machine is ready
    python3 scripts/cloud/salad.py status                         what is running, and what it costs per hour
    python3 scripts/cloud/salad.py down                           stop everything (billing stops; the groups stay for next time)
    python3 scripts/cloud/salad.py rm                             delete the groups and queues
    python3 scripts/cloud/salad.py img jobs.json --dry-run        print what would be sent (no key needed)

Settings come from .env in this project folder (see .env.example): SALAD_API_KEY, SALAD_ORG, SALAD_PROJECT.

picture jobs:  {"defaults": {"width": 2048, "height": 1152, "quality": "turbo"},
                "jobs": [{"name": "bia", "prompt": "...", "seeds": [11, 27, 53]}, ...]}      -> <out>/<name>_<seed>.png
   A job may set width, height (up to 2048), quality and, for "best", negative (what must not be in the picture).
   quality "turbo" = Z-Image Turbo, 8 steps: the look of the channel's pictures. "best" = the base Z-Image model, 25 steps
   with guidance: a different, flatter line-art look, not simply a finer one (compared on 2026-11-10).
video jobs:    {"defaults": {"width": 1280, "height": 704, "seconds": 5},
                "jobs": [{"name": "song", "image": "path/to/still.png", "prompt": "what moves, how the camera moves",
                          "seeds": [1, 2]}, ...]}                                             -> <out>/<name>_<seed>.mp4
   The still is cropped to the clip's shape. Paths are relative to the jobs file.
A result that already exists is skipped, so an interrupted batch continues where it stopped.

Money: a machine is billed per second while it runs (also while it downloads the models at every start: 33 GB for
pictures (12 GB of it in the background, for "best"), 18 GB for video). A batch always stops its group when it ends, fails or is interrupted with Ctrl-C, unless
--keep is given; --max-minutes stops it even if the batch is not finished. If this script is killed outright, run `down`.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
API = "https://api.salad.com/api/public"
# Salad's ComfyUI server image (github.com/SaladTechnologies/comfyui-api, release 1.19.2 of 2026-09-18); no model inside
IMAGE = "ghcr.io/saladtechnologies/comfyui-api:comfy0.35.0-api1.19.2-torch2.13.0-cuda13.0-runtime"
PORT = 3000
# The job-queue worker is one small program that Salad's guide adds to the image; here the container fetches it when it
# starts and then runs the image's own server, so no image has to be built and pushed.
WORKER_URL = "https://github.com/SaladTechnologies/salad-cloud-job-queue-worker/releases/latest/download/salad-http-job-queue-worker_x86_64.tar.gz"
# Salad's API refuses many command lines without saying why ("container_group_update_exception"; found by trial on
# 2026-11-10: fallbacks with wget / curl, a shell variable for the URL, the URL written more than once). This exact
# form is accepted: one download with the image's own python, then the worker in the background, then the server.
BOOT = ("python3 -c \"import urllib.request as u;u.urlretrieve('" + WORKER_URL + "','/tmp/w.tgz')\"; "
        "tar xzf /tmp/w.tgz -C /tmp; (SALAD_LOG_LEVEL=warn /tmp/salad-http-job-queue-worker &); exec ./comfyui-api")
ZT = "https://huggingface.co/Comfy-Org/z_image_turbo/resolve/main/split_files"
ZB = "https://huggingface.co/Comfy-Org/z_image/resolve/main/split_files"
W22 = "https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files"
W21 = "https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files"
M = "/opt/ComfyUI/models"
# One group of machines and one queue per kind of work. Every model here is Apache-2.0 (commercial use allowed) and is
# the file the official ComfyUI template uses (image_z_image_turbo, image_z_image, video_wan2_2_5B_ti2v).
PROFILES = {
    "img": {
        "group": "zimg", "queue": "zimage", "title": "Z-Image, cartoon-shorts", "per_machine": 12, "max_minutes": 90,
        "models": [(f"{ZT}/diffusion_models/z_image_turbo_bf16.safetensors", f"{M}/diffusion_models/z_image_turbo_bf16.safetensors"),
                   (f"{ZT}/text_encoders/qwen_3_4b.safetensors", f"{M}/text_encoders/qwen_3_4b.safetensors"),
                   (f"{ZT}/vae/ae.safetensors", f"{M}/vae/ae.safetensors")],
        # the base model ("best") downloads in the background after the server is up, so Turbo work starts 12 GB sooner
        "later": [(f"{ZB}/diffusion_models/z_image_bf16.safetensors", f"{M}/diffusion_models/z_image_bf16.safetensors")],
    },
    "video": {
        "group": "wan", "queue": "wan", "title": "Wan 2.2 video, cartoon-shorts", "per_machine": 2, "max_minutes": 180,
        "models": [(f"{W22}/diffusion_models/wan2.2_ti2v_5B_fp16.safetensors", f"{M}/diffusion_models/wan2.2_ti2v_5B_fp16.safetensors"),
                   (f"{W21}/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors", f"{M}/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors"),
                   (f"{W22}/vae/wan2.2_vae.safetensors", f"{M}/vae/wan2.2_vae.safetensors")],
    },
}
# picture quality -> (model file, steps, guidance)
QUALITY = {"turbo": ("z_image_turbo_bf16.safetensors", 8, 1.0), "best": ("z_image_bf16.safetensors", 25, 4.0)}
MAX_REPLICAS = 8             # the organisation's quota is 10 machines
# GPU classes are matched by name against the organisation's list (`check` prints it)
GPU_WANT = ["5090", "4090"]
wanted = lambda name: any(w in name for w in GPU_WANT) and "Laptop" not in name   # the two fastest desktop cards (24 / 32 GB)
PRIORITY = "high"            # high | medium | low | batch: cheaper tiers are interrupted more often
# More CPU or memory would not make a picture faster (the GPU does the work) but fewer machines would qualify
CPU, MEMORY_MB, DISK_BYTES = 4, 30720, 60 * 1024 ** 3
# 2048x1152 Turbo measured 21-23 s a picture on Salad (2026-11-10) and is clearly finer than 1536x864 (8 s)
IMG_DEFAULTS = {"width": 2048, "height": 1152, "quality": "turbo", "negative": ""}
VIDEO_DEFAULTS = {"width": 1280, "height": 704, "seconds": 5, "steps": 20,
                  # the negative prompt of the official Wan template (over-saturated, static, blurry, subtitles, deformed ...)
                  "negative": "色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走"}
FPS = 24


def die(msg: str) -> None:
    print(f"salad: {msg}", file=sys.stderr)
    raise SystemExit(1)


def load_env() -> dict[str, str]:
    env = dict(os.environ)
    f = ROOT / ".env"
    if f.exists():
        for line in f.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    return env


class Salad:
    def __init__(self) -> None:
        env = load_env()
        self.key = env.get("SALAD_API_KEY", "")
        self.org = env.get("SALAD_ORG", "")
        self.project = env.get("SALAD_PROJECT", "default")
        if not self.key or not self.org:
            die(f"fill SALAD_API_KEY and SALAD_ORG in {ROOT / '.env'} (copy .env.example)")
        self.proj = f"{API}/organizations/{self.org}/projects/{self.project}"
        self.base = f"{self.proj}/containers"

    def call(self, method: str, url: str, body: dict | None = None, timeout: float = 60) -> tuple[int, dict | str]:
        """one request with the key in the Salad-Api-Key header -> (status, parsed JSON or text); no exception for 4xx/5xx"""
        data = json.dumps(body).encode() if body is not None else None
        headers = {"Salad-Api-Key": self.key, "Accept": "application/json", "User-Agent": "cartoon-shorts-salad/2",
                   "Content-Type": "application/merge-patch+json" if method == "PATCH" else "application/json"}
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                status, raw = r.status, r.read()
        except urllib.error.HTTPError as e:
            status, raw = e.code, e.read()
        except OSError as e:   # a dropped connection while polling is not an error of the batch
            return 0, str(e)
        text = raw.decode("utf-8", "replace")
        try:
            return status, json.loads(text) if text else {}
        except json.JSONDecodeError:
            return status, text

    # ---- the organisation ----
    def gpu_classes(self) -> list[dict]:
        st, d = self.call("GET", f"{API}/organizations/{self.org}/gpu-classes")
        if st != 200 or not isinstance(d, dict):
            die(f"cannot list GPU classes ({st}): {str(d)[:300]}  (check SALAD_API_KEY and SALAD_ORG)")
        return d.get("items", [])

    def pick_gpus(self) -> list[dict]:
        items = self.gpu_classes()
        picked = [g for g in items if wanted(g.get("name", ""))]
        if not picked:
            die("none of the wanted GPUs (" + ", ".join(GPU_WANT) + ") in this organisation: " + ", ".join(g.get("name", "?") for g in items))
        return picked

    # ---- groups and queues ----
    def group(self, name: str) -> dict | None:
        st, d = self.call("GET", f"{self.base}/{name}")
        if st == 404:
            return None
        if st != 200 or not isinstance(d, dict):
            die(f"cannot read group {name} ({st}): {str(d)[:300]}")
        return d

    def instances(self, name: str) -> list[dict]:
        st, d = self.call("GET", f"{self.base}/{name}/instances")
        return d.get("instances", []) if st == 200 and isinstance(d, dict) else []

    def action(self, name: str, what: str) -> None:
        st, d = self.call("POST", f"{self.base}/{name}/{what}")
        if st not in (200, 202):
            die(f"cannot {what} group {name} ({st}): {str(d)[:300]}")

    def ensure_queue(self, name: str) -> None:
        st, _ = self.call("GET", f"{self.proj}/queues/{name}")
        if st == 200:
            return
        st, d = self.call("POST", f"{self.proj}/queues", {"name": name, "display_name": name, "description": "cartoon-shorts batch jobs"})
        if st not in (200, 201):
            die(f"cannot create queue {name} ({st}): {str(d)[:400]}")

    def ensure_group(self, kind: str, replicas: int) -> None:
        """the group exists with this many machines and is started (created, or recreated if it has no job queue)"""
        name = PROFILES[kind]["group"]
        self.ensure_queue(PROFILES[kind]["queue"])
        g = self.group(name)
        if g is not None and not g.get("queue_connection"):
            print(f"group '{name}' was made without a job queue: recreating it")
            self.call("DELETE", f"{self.base}/{name}")
            for _ in range(60):
                if self.group(name) is None:
                    break
                time.sleep(5)
            g = None
        if g is None:
            print(f"creating group '{name}' with {replicas} machine(s): {IMAGE}")
            body = create_body(kind, replicas, [x["id"] for x in self.pick_gpus()])
            for _ in range(12):   # a deleted group's name stays taken for a while (the old name "zimage" for more than 10 min)
                st, d = self.call("POST", self.base, body)
                if not (st == 400 and isinstance(d, dict) and d.get("type") == "name_conflict"):
                    break
                time.sleep(15)
            if st not in (200, 201):
                die(f"cannot create group {name} ({st}): {json.dumps(d, ensure_ascii=False)[:800] if isinstance(d, dict) else str(d)[:800]}")
            return
        env = (g.get("container") or {}).get("environment_variables") or {}
        if env.get("MANIFEST_JSON") != manifest_json(kind):   # the model list changed since the group was made
            st, d = self.call("PATCH", f"{self.base}/{name}", {"container": {"environment_variables": {"MANIFEST_JSON": manifest_json(kind)}}})
            print(f"model list of '{name}' updated" if st in (200, 202) else f"(could not update the model list of '{name}': {st} {str(d)[:200]})")
        if g.get("replicas") != replicas:
            st, d = self.call("PATCH", f"{self.base}/{name}", {"replicas": replicas})
            if st not in (200, 202):
                print(f"(could not change the machine count of '{name}' to {replicas}: {st} {str(d)[:200]})")
        if (g.get("current_state") or {}).get("status") in ("stopped", "failed"):
            print(f"starting group '{name}' with {replicas} machine(s)")
            self.action(name, "start")


def manifest_json(kind: str) -> str:
    """what a machine downloads: `models` before it takes work, `later` in the background afterwards"""
    p = PROFILES[kind]
    files = lambda key: [{"url": u, "local_path": path} for u, path in p.get(key, [])]
    return json.dumps({"models": {"before_start": files("models"), "after_start": files("later")}})


def create_body(kind: str, replicas: int, gpu_ids: list[str]) -> dict:
    p = PROFILES[kind]
    return {
        "name": p["group"], "display_name": p["title"],   # display name: letters, digits, space , - . only
        "container": {
            "image": IMAGE, "priority": PRIORITY, "command": ["bash", "-c", BOOT],
            "resources": {"cpu": CPU, "memory": MEMORY_MB, "gpu_classes": gpu_ids, "storage_amount": DISK_BYTES},
            "environment_variables": {"MANIFEST_JSON": manifest_json(kind)},
        },
        "autostart_policy": True, "restart_policy": "always", "replicas": replicas,
        # every job of the queue is POSTed to ComfyUI's /prompt on a machine whose /ready answers (models downloaded)
        "queue_connection": {"path": "/prompt", "port": PORT, "queue_name": p["queue"]},
        "readiness_probe": {"http": {"path": "/ready", "port": PORT, "scheme": "http", "headers": []},
                            "initial_delay_seconds": 0, "period_seconds": 5, "timeout_seconds": 5, "success_threshold": 1, "failure_threshold": 3},
    }


# ---------------- workflows (ComfyUI API form of the official templates) ----------------
def picture_workflow(j: dict) -> dict:
    model, steps0, cfg = QUALITY[j["quality"]]
    # Turbo runs without guidance (the negative is a zeroed copy of the prompt); the base model takes a negative prompt
    negative = ({"class_type": "ConditioningZeroOut", "inputs": {"conditioning": ["5", 0]}} if cfg == 1 else
                {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": j.get("negative", "")}})
    return {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": model, "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen_3_4b.safetensors", "type": "lumina2", "device": "default"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": "ae.safetensors"}},
        "4": {"class_type": "ModelSamplingAuraFlow", "inputs": {"model": ["1", 0], "shift": 3}},
        "5": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": j["prompt"]}},
        "6": negative,
        "7": {"class_type": "EmptySD3LatentImage", "inputs": {"width": j["width"], "height": j["height"], "batch_size": 1}},
        "8": {"class_type": "KSampler", "inputs": {"model": ["4", 0], "positive": ["5", 0], "negative": ["6", 0], "latent_image": ["7", 0],
                                                   "seed": j["seed"], "steps": j.get("steps") or steps0, "cfg": cfg,
                                                   "sampler_name": "res_multistep", "scheduler": "simple", "denoise": 1}},
        "9": {"class_type": "VAEDecode", "inputs": {"samples": ["8", 0], "vae": ["3", 0]}},
        "10": {"class_type": "SaveImage", "inputs": {"images": ["9", 0], "filename_prefix": j["name"]}},
    }


def video_workflow(j: dict, image_b64: str) -> dict:
    frames = int(j["seconds"] * FPS) // 4 * 4 + 1   # Wan wants 4n + 1 frames (121 = 5 s)
    return {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": "wan2.2_ti2v_5B_fp16.safetensors", "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": "umt5_xxl_fp8_e4m3fn_scaled.safetensors", "type": "wan", "device": "default"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": "wan2.2_vae.safetensors"}},
        "4": {"class_type": "ModelSamplingSD3", "inputs": {"model": ["1", 0], "shift": 8}},
        "5": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": j["prompt"]}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": j["negative"]}},
        "7": {"class_type": "LoadImage", "inputs": {"image": image_b64, "upload": "image"}},
        "8": {"class_type": "Wan22ImageToVideoLatent", "inputs": {"vae": ["3", 0], "start_image": ["7", 0], "width": j["width"],
                                                                  "height": j["height"], "length": frames, "batch_size": 1}},
        "9": {"class_type": "KSampler", "inputs": {"model": ["4", 0], "positive": ["5", 0], "negative": ["6", 0], "latent_image": ["8", 0],
                                                   "seed": j["seed"], "steps": j["steps"], "cfg": 5, "sampler_name": "uni_pc",
                                                   "scheduler": "simple", "denoise": 1}},
        "10": {"class_type": "VAEDecode", "inputs": {"samples": ["9", 0], "vae": ["3", 0]}},
        "11": {"class_type": "CreateVideo", "inputs": {"images": ["10", 0], "fps": FPS}},
        "12": {"class_type": "SaveVideo", "inputs": {"video": ["11", 0], "filename_prefix": j["name"], "format": "auto", "codec": "auto"}},
    }


def still_b64(path: Path, width: int, height: int) -> str:
    """the still, scaled to cover width x height and cropped in the middle, as a base64 JPEG (macOS sips)"""
    if not path.exists():
        die(f"still not found: {path}")
    out = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(path)], capture_output=True, text=True).stdout
    try:
        w, h = (int(out.split(k + ":")[1].split()[0]) for k in ("pixelWidth", "pixelHeight"))
    except (IndexError, ValueError):
        die(f"cannot read the size of {path}")
    k = max(width / w, height / h)
    with tempfile.TemporaryDirectory() as tmp:
        t = Path(tmp) / "still.jpg"
        subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "92", "-z", str(round(h * k)), str(round(w * k)), str(path), "--out", str(t)],
                       check=True, capture_output=True)
        subprocess.run(["sips", "-c", str(height), str(width), str(t)], check=True, capture_output=True)
        return base64.b64encode(t.read_bytes()).decode()


def read_jobs(kind: str, path: str, out: Path) -> list[dict]:
    """every (job, seed) of the file -> {name, file, make(): the request body for ComfyUI's /prompt, ...}"""
    src = Path(path)
    spec = json.loads(src.read_text(encoding="utf-8"))
    d = {**(IMG_DEFAULTS if kind == "img" else VIDEO_DEFAULTS), **spec.get("defaults", {})}
    todo = []
    for j in spec["jobs"]:
        for seed in j.get("seeds", [1]):
            x = {**d, **{k: v for k, v in j.items() if k != "seeds"}, "seed": int(seed)}
            if kind == "img":
                if x["quality"] not in QUALITY:
                    die(f"job {j['name']}: quality must be one of {', '.join(QUALITY)}")
                x["file"] = out / f"{j['name']}_{seed}.png"
                x["make"] = lambda x=x: {"prompt": picture_workflow(x)}
            else:
                still = (src.parent / x["image"]).resolve() if not Path(x["image"]).is_absolute() else Path(x["image"])
                x["file"] = out / f"{j['name']}_{seed}.mp4"
                x["make"] = lambda x=x, still=still: {"prompt": video_workflow(x, still_b64(still, x["width"], x["height"]))}
            todo.append(x)
    return todo


def machines(s: Salad, name: str) -> str:
    inst = s.instances(name)
    ready = sum(1 for i in inst if i.get("ready"))
    states = ", ".join(sorted(i.get("state", "?") for i in inst)) or "none yet"
    return f"machines: {states}; {ready} ready"


def run_batch(s: Salad, kind: str, a: argparse.Namespace) -> None:
    p = PROFILES[kind]
    name, out = p["group"], Path(a.out)
    todo = [j for j in read_jobs(kind, a.jobs, out) if not j["file"].exists()]
    todo.sort(key=lambda j: j.get("quality") == "best")   # "best" pictures last: their model arrives after the others
    if not todo:
        print("every result of this batch already exists")
        return
    replicas = a.replicas or max(1, min(MAX_REPLICAS, -(-len(todo) // p["per_machine"])))
    max_minutes = a.max_minutes or p["max_minutes"]
    print(f"{len(todo)} job(s) on {replicas} machine(s), at most {max_minutes:.0f} min")
    out.mkdir(parents=True, exist_ok=True)
    jobs_url = f"{s.proj}/queues/{p['queue']}/jobs"
    t0 = time.time()
    pending: dict[str, dict] = {}   # queue job id -> job
    done, failed = 0, []

    def submit(j: dict) -> None:
        st, d = s.call("POST", jobs_url, {"input": j["make"](), "metadata": {"file": j["file"].name}})
        if st not in (200, 201) or not isinstance(d, dict) or not d.get("id"):
            die(f"cannot queue {j['file'].name} ({st}): {str(d)[:300]}")
        j["tries"] = j.get("tries", 0) + 1
        pending[d["id"]] = j

    try:
        s.ensure_group(kind, replicas)
        for j in todo:
            submit(j)
        print(f"queued {len(pending)} job(s); waiting for the machines (they download the models first)")
        last_line, last_print = "", 0.0
        while pending:
            if time.time() - t0 > max_minutes * 60:
                print(f"--max-minutes reached: cancelling {len(pending)} job(s)")
                for jid, j in pending.items():
                    s.call("DELETE", f"{jobs_url}/{jid}")
                    failed.append(f"{j['file'].name}: not finished in time")
                pending.clear()
                break
            for jid in list(pending):
                st, d = s.call("GET", f"{jobs_url}/{jid}")
                if st != 200 or not isinstance(d, dict):
                    continue
                status, j = d.get("status"), pending[jid]
                if status == "succeeded":
                    o = d.get("output")
                    if isinstance(o, dict) and o.get("images"):
                        j["file"].write_bytes(base64.b64decode(o["images"][0]))
                        done += 1
                        del pending[jid]
                        print(f"[{done}/{len(todo)}] {j['file'].name}  (at {(time.time() - t0) / 60:.1f} min)", flush=True)
                        continue
                    status = "failed"   # finished without a result
                if status in ("failed", "cancelled"):
                    del pending[jid]
                    if status == "failed" and j["tries"] < 2:   # Salad already ran it 4 times; queue it once more
                        print(f"{j['file'].name} failed on the machines: queued again", flush=True)
                        submit(j)
                    else:
                        failed.append(f"{j['file'].name}: {status} ({str(d.get('output'))[:200]})")
                        print(f"FAILED {j['file'].name}", flush=True)
            line = machines(s, name)
            if line != last_line or time.time() - last_print > 300:
                print(f"[{(time.time() - t0) / 60:4.1f} min] {line}; {len(pending)} job(s) left", flush=True)
                last_line, last_print = line, time.time()
            if pending:
                time.sleep(8 if len(pending) <= 30 else 20)
    finally:
        if a.keep:
            print(f"--keep: group '{name}' is STILL RUNNING and billed. Stop it with: python3 scripts/cloud/salad.py down")
        elif s.group(name) is None:
            print("no group was created: nothing is running")
        else:
            s.action(name, "stop")
            print("machines stopped")
    print(f"{done} of {len(todo)} in {out}/ after {(time.time() - t0) / 60:.1f} min" + (f"; {len(failed)} failed:" if failed else ""))
    for f in failed:
        print("  " + f)
    if failed:
        raise SystemExit(1)


def hourly(group: dict, gpus: list[dict], running: int) -> str:
    """rough cost per hour of the running machines: the dearest GPU class the group may get, at its priority"""
    prio = (group.get("container") or {}).get("priority") or PRIORITY
    ids = set(((group.get("container") or {}).get("resources") or {}).get("gpu_classes") or [])
    prices = [float(x["price"]) for g in gpus if g["id"] in ids for x in g.get("prices", []) if x.get("priority") == prio]
    return f"at most ~${max(prices) * running:.2f}/hour for {running} machine(s)" if prices and running else "nothing running"


def main() -> None:
    ap = argparse.ArgumentParser(description="AI pictures and video on SaladCloud GPUs", epilog=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    for c in ("check", "status", "down", "rm"):
        sub.add_parser(c)
    up = sub.add_parser("up")
    up.add_argument("kind", choices=list(PROFILES))
    up.add_argument("--replicas", type=int, default=1)
    for c in ("img", "video"):
        b = sub.add_parser(c)
        b.add_argument("jobs")
        b.add_argument("--out", default="out/salad")
        b.add_argument("--keep", action="store_true", help="leave the machines running afterwards")
        b.add_argument("--dry-run", action="store_true")
        b.add_argument("--max-minutes", type=float, default=0, help="stop the batch and the machines after this long (default 90 for pictures, 180 for video)")
        b.add_argument("--replicas", type=int, default=0, help="machines side by side (default: 1 per 12 pictures / 2 clips, at most 8)")
    a = ap.parse_args()

    if a.cmd in ("img", "video") and a.dry_run:
        todo = read_jobs(a.cmd, a.jobs, Path(a.out))
        print(json.dumps(create_body(a.cmd, a.replicas or 1, ["<gpu class ids from `check`>"]), indent=1)[:2600])
        print(f"\n{len(todo)} job(s); the first one sends:")
        print(json.dumps(todo[0]["make"](), ensure_ascii=False)[:1500])
        return
    s = Salad()
    names = [p["group"] for p in PROFILES.values()]
    if a.cmd == "check":
        gpus = s.gpu_classes()
        print(f"key OK. organisation {s.org}, project {s.project}. GPU classes (USD per hour: high / medium / low / batch):")
        for g in sorted(gpus, key=lambda g: g.get("name", "")):
            pr = {x.get("priority"): x.get("price") for x in g.get("prices", [])}
            print(f" {'*' if wanted(g.get('name', '')) else ' '} {g.get('name', '?'):42s} " + " / ".join(str(pr.get(k, "-")) for k in ("high", "medium", "low", "batch")))
        print(f"* = what the groups may use (priority {PRIORITY})")
    elif a.cmd == "status":
        gpus = s.gpu_classes()
        for n in names:
            g = s.group(n)
            if g is None:
                print(f"group '{n}': does not exist")
                continue
            inst = s.instances(n)
            running = sum(1 for i in inst if i.get("state") == "running")
            print(f"group '{n}': {(g.get('current_state') or {}).get('status')}, wanted {g.get('replicas')} machine(s); {machines(s, n)}; "
                  + hourly(g, gpus, running))
    elif a.cmd == "up":
        s.ensure_group(a.kind, a.replicas)
        n, t0 = PROFILES[a.kind]["group"], time.time()
        while not any(i.get("ready") for i in s.instances(n)):
            if time.time() - t0 > 45 * 60:
                die("no machine was ready after 45 min (the group is still on: run `down` to stop paying)")
            print(f"[{(time.time() - t0) / 60:4.1f} min] {machines(s, n)}", flush=True)
            time.sleep(20)
        print(f"ready after {(time.time() - t0) / 60:.1f} min. The machines are RUNNING and billed until: python3 scripts/cloud/salad.py down")
    elif a.cmd == "down":
        for n in names:
            if s.group(n) is not None:
                s.action(n, "stop")
                print(f"group '{n}' stopped")
    elif a.cmd == "rm":
        for n, q in [(p["group"], p["queue"]) for p in PROFILES.values()]:
            st, _ = s.call("DELETE", f"{s.base}/{n}")
            st2, _ = s.call("DELETE", f"{s.proj}/queues/{q}")
            print(f"group '{n}': {'deleted' if st in (200, 202, 204) else 'not there'}; queue: {'deleted' if st2 in (200, 202, 204) else 'not there'}")
    else:
        run_batch(s, a.cmd, a)


if __name__ == "__main__":
    main()
