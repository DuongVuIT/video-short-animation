#!/bin/zsh
# Final render of one short: picture at 2K (1440x2560), muxed with its sound mix, written to exports/.
# Everything temporary (Remotion bundle, silent picture) lives in out/render-<comp> and is deleted at the end.
# usage: scripts/render/render.sh <CompositionId> <mix.wav> <exports/name.mp4> [scale=1.3333]
#   e.g. XUONG_EP=bridge scripts/render/render.sh BridgeShort shorts/bridge/audio/mix.wav exports/bridge_2k.mp4
# XUONG_EP=<episode> shows the render live on the Xưởng phim dashboard (AutoVideo Studio). CONCURRENCY=n sets the
# number of Chrome tabs rendering at once (Remotion's default otherwise).
set -e
cd "$(dirname "$0")/../.."
comp=$1; mix=$2; dst=$3; scale=${4:-1.3333}
[[ -n $comp && -f $mix && -n $dst ]] || { echo "usage: scripts/render/render.sh <Comp> <mix.wav> <exports/name.mp4> [scale]"; exit 1; }
ep=${XUONG_EP:-}
x() { [[ -n $ep ]] && python3 scripts/xuong.py "$@" 2>/dev/null || true; }
tmp="$PWD/out/render-$comp"
rm -rf "$tmp"; mkdir -p "$tmp" "$(dirname "$dst")"
REMOTION_TMP="$tmp" node scripts/render/render.mjs "$comp" "$tmp/picture.mp4" "$scale" --ep "$ep" ${CONCURRENCY:+--concurrency $CONCURRENCY} \
  || { x fail "$ep" render "render lỗi, xem terminal"; exit 1; }
# Remotion writes a silent audio track: take the picture from the render and the sound from the mix
ffmpeg -y -v error -i "$tmp/picture.mp4" -i "$mix" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -shortest "$dst"
rm -rf "$tmp"
if [[ -n $ep ]]; then
  # a few frames of the finished video for the dashboard's film strip
  th="$PWD/out/thumbs/$ep"; rm -rf "$th"; mkdir -p "$th"
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$dst")
  for k in 1 2 3 4 5 6 7 8; do
    ffmpeg -y -v error -ss $(( dur * (k - 0.5) / 8 )) -i "$dst" -frames:v 1 -vf scale=360:-2 -q:v 3 "$th/t$k.jpg"
    x frame "$ep" "$th/t$k.jpg"
  done
  read w h n _ <<< "$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height,nb_frames -of csv=p=0 "$dst" | tr ',' ' ')"
  x done "$ep" render "${w}x${h}, $n khung, $(printf '%.1f' "$dur") s"
  x artifact "$ep" "Video 2K" "$dst"
fi
echo "done: $dst"
