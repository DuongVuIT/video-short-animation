#!/bin/bash
# Runs INSIDE the Salad render container, once per machine (the first job a machine gets calls it): the Linux libraries
# Chrome needs, @remotion/renderer with its own Chrome Headless Shell and ffmpeg. Safe to run again: it returns at once.
[ -f /app/.ok ] && exit 0
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq --no-install-recommends libnss3 libdbus-1-3 libatk1.0-0 libgbm1 libasound2 libxrandr2 libxkbcommon0 \
  libxfixes3 libxcomposite1 libxdamage1 libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 libgtk-3-0 libxshmfence1 \
  libx11-xcb1 libdrm2 libxss1 fonts-liberation ca-certificates libegl1 libgl1 libgles2 libglvnd0 libvulkan1 vulkan-tools \
  mesa-vulkan-drivers procps > /tmp/apt.log 2>&1
cd /app
echo '{"name":"salad-render","private":true,"type":"module","dependencies":{"@remotion/renderer":"4.0.290","@remotion/cli":"4.0.290"}}' > package.json
npm install --omit=dev --no-audit --no-fund > /tmp/npm.log 2>&1
node -e "import('@remotion/renderer').then(r => r.ensureBrowser({chromeMode:'headless-shell'})).then(() => console.log('chrome ok'))"
touch /app/.ok
