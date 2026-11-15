#!/bin/bash
# Runs when the Salad render container starts (the group's command downloads this file from Salad storage).
# It starts Salad's job-queue worker and agent.py; everything else (Chrome, Remotion, the bundle) is installed by the
# first job a machine receives, so this file never has to change.
mkdir -p /app /tmp/jq
python3 -c "import urllib.request as u;u.urlretrieve('https://github.com/SaladTechnologies/salad-cloud-job-queue-worker/releases/latest/download/salad-http-job-queue-worker_x86_64.tar.gz','/tmp/w.tgz')"
tar xzf /tmp/w.tgz -C /tmp/jq
(SALAD_LOG_LEVEL=warn /tmp/jq/salad-http-job-queue-worker &)
cat > /app/agent.py <<'AGENT'
__AGENT__
AGENT
exec python3 /app/agent.py
