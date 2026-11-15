#!/bin/zsh
# Final render of one short on Modal (modal.com): same result as scripts/render/render.sh, but the frame range is split into
# chunks that render in parallel on Modal GPU containers (optionally a share also renders on this machine at the same time),
# then the H.264 chunks are joined in order without re-encoding and the sound mix is muxed in exactly like render.sh.
# Everything temporary lives in out/cloud/render-<comp> and is deleted at the end.
# usage: scripts/render/render-cloud.sh <CompositionId> <mix.wav> <dst.mp4> [scale=1.3333] [workers=auto]
#   e.g. EPISODE=bridge scripts/render/render-cloud.sh BridgeShort shorts/bridge/audio/mix.wav exports/bridge_2k.mp4
#        EPISODE=bridge WORKERS=10 LOCAL_SHARE=0.15 scripts/render/render-cloud.sh BridgeShort shorts/bridge/audio/mix.wav exports/bridge_2k.mp4
# env:
#   EPISODE=<name>        live progress (one lane per chunk) in shorts/<name>/progress.json via scripts/xuong.py
#                         (XUONG_EP works too, as in render.sh)
#   WORKERS=<n>           Modal containers; default auto = the fewest that finish in ~TARGET_MIN minutes (cheapest:
#                         every container pays its own start-up). More = faster, slightly dearer; the Starter plan
#                         runs at most 10 GPU containers at once, so WORKERS=10 is the fastest useful value.
#   TARGET_MIN=10         wall-time goal for the auto worker count
#   GPU=A10G,T4           Modal GPU type, or a fallback list (first available). A10G is the cheapest per frame
#                         (~4 frames/s per container); T4 costs less per hour but is 2-4x slower; L4 often waits for capacity
#   LOCAL_SHARE=0         fraction of the frames (the last ones) rendered on this machine in parallel, e.g. 0.15;
#   LOCAL_CONCURRENCY=2   Chrome tabs for that local part (the machine gets laggy while it renders)
#   CLOUD_MODE=gpu|cpu    cpu = SwiftShader on 32-core CPU-only containers: same picture, but ~40x slower per container
#                         and ~50x dearer per frame; only a fallback if GPUs are unavailable
#   CLOUD_CHUNKS=<n>      number of Modal chunks (default ~3 per container, >= 60 frames each: containers that finish
#                         early pick up the next chunk, so heavy shots don't leave one container working alone)
#   CLOUD_ARGS="..."      extra options for cloud/remotion_modal.py::render (e.g. "--concurrency 4 --cpu 8")
#   KEEP_TMP=1            keep out/cloud/render-<comp> (bundle, chunks, logs, stats.json) for debugging
#   MODAL=<path>          Modal CLI (default ~/.local/bin/modal)
set -e
cd "$(dirname "$0")/../.."
comp=$1; mix=$2; dst=$3; scale=${4:-1.3333}; workers=${5:-${WORKERS:-0}}
[[ -n $comp && -f $mix && -n $dst ]] || { echo "usage: scripts/render/render-cloud.sh <Comp> <mix.wav> <dst.mp4> [scale] [workers]"; exit 1; }
modal=${MODAL:-$HOME/.local/bin/modal}
ep=${EPISODE:-${XUONG_EP:-}}
x() { [[ -n $ep ]] && python3 scripts/xuong.py "$@" >/dev/null 2>&1 || true; }
tmp="$PWD/out/cloud/render-$comp"
rm -rf "$tmp"; mkdir -p "$tmp/chunks" "$(dirname "$dst")"
local_pid=""
fail() {
  [[ -n $local_pid ]] && kill $local_pid 2>/dev/null
  x fail "$ep" render "cloud render: $1"
  echo "render-cloud: $1 (temp files kept in $tmp)" >&2; exit 1
}
TRAPZERR() { fail "a step failed (exit $?)"; }
TRAPINT() { fail "interrupted"; }
t0=$SECONDS

# 1. bundle once locally (+ read the composition's length)
meta=$(node cloud/bundle.mjs "$comp" "$tmp/bundle" | tail -1)
frames=$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["durationInFrames"])' "$meta")
nloc=$(python3 -c 'import sys; s=min(1.0, max(0.0, float(sys.argv[1]))); print(round(s * int(sys.argv[2])))' "${LOCAL_SHARE:-0}" "$frames")
nmod=$((frames - nloc))
echo "render-cloud: $comp, $frames frames at scale $scale: $nmod on Modal, $nloc on this machine"

# 2a. optional local share: the LAST nloc frames, rendered by scripts/render/render.mjs (its own progress is folded into
#     the Modal entrypoint's report as the last lane, so XUONG_EP is not passed down)
if (( nloc > 0 )); then
  ( unset XUONG_EP; REMOTION_TMP="$tmp/local-tmp" exec node scripts/render/render.mjs "$comp" "$tmp/local.mp4" "$scale" \
      --frames "$nmod-$((frames - 1))" --concurrency "${LOCAL_CONCURRENCY:-2}" ) > "$tmp/local.log" 2>&1 &
  local_pid=$!
fi

# 2b. frames [0, nmod) on Modal -> $tmp/chunks/chunk_NNN.mp4 + list.txt
: > "$tmp/chunks/list.txt"
if (( nmod > 0 )); then
  CLOUD_GPU="${GPU:-A10G,T4}" "$modal" run -q cloud/remotion_modal.py::render --bundle "$tmp/bundle" --comp "$comp" --frames "$nmod" \
    --out "$tmp/chunks" --scale "$scale" --workers "$workers" --target-min "${TARGET_MIN:-10}" --mode "${CLOUD_MODE:-gpu}" \
    ${CLOUD_CHUNKS:+--chunks} ${CLOUD_CHUNKS:+$CLOUD_CHUNKS} --episode "$ep" --stats "$tmp/stats.json" \
    ${local_pid:+--local-frames} ${local_pid:+$nloc} ${local_pid:+--local-log} ${local_pid:+$tmp/local.log} \
    ${local_pid:+--local-pid} ${local_pid:+$local_pid} ${=CLOUD_ARGS}
fi
if [[ -n $local_pid ]]; then
  wait $local_pid || fail "the local part failed, see $tmp/local.log"
  local_pid=""
  # render.mjs writes a silent audio track: keep only the picture so it joins the Modal chunks
  ffmpeg -y -v error -i "$tmp/local.mp4" -map 0:v:0 -c copy "$tmp/chunks/chunk_local.mp4"
  echo "file 'chunk_local.mp4'" >> "$tmp/chunks/list.txt"
fi

# 3. join the chunks in frame order without re-encoding (each chunk starts on a keyframe; same encoder settings)
(cd "$tmp/chunks" && ffmpeg -y -v error -f concat -safe 0 -i list.txt -c copy "$tmp/picture.mp4")
n=$(ffprobe -v error -select_streams v:0 -count_packets -show_entries stream=nb_read_packets -of default=nw=1:nk=1 "$tmp/picture.mp4")
[[ $n == "$frames" ]] || fail "joined picture has $n frames, the composition has $frames"

# 4. take the picture from the render and the sound from the mix (exactly as render.sh)
ffmpeg -y -v error -i "$tmp/picture.mp4" -i "$mix" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -shortest "$dst"

took=$((SECONDS - t0))
summary="$frames frames in ${took}s"
[[ -f $tmp/stats.json ]] && summary+=" · $(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["text"])' "$tmp/stats.json")"
(( nloc > 0 )) && summary+=" · local $nloc frames"
[[ -n $KEEP_TMP ]] || rm -rf "$tmp"
if [[ -n $ep ]]; then
  # a few frames of the finished video for the dashboard's film strip (as render.sh)
  th="$PWD/out/thumbs/$ep"; rm -rf "$th"; mkdir -p "$th"
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$dst")
  for k in 1 2 3 4 5 6 7 8; do
    ffmpeg -y -v error -ss $(( dur * (k - 0.5) / 8 )) -i "$dst" -frames:v 1 -vf scale=360:-2 -q:v 3 "$th/t$k.jpg"
    x frame "$ep" "$th/t$k.jpg"
  done
  x done "$ep" render "$summary"
  x artifact "$ep" "Video 2K" "$dst"
fi
echo "done: $dst ($summary)"
