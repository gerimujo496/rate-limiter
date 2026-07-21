#!/usr/bin/env bash
# Prove shared rate limits across nginx → 2 API replicas.
# Expected (default 10/60s): ~10 x 200, then 429.

set -euo pipefail

BASE_URL="${BASE_URL:-https://api.gerimujo.com}"
PATH_UNDER_TEST="${PATH_UNDER_TEST:-/rate-limiter/token-bucket}"
COUNT="${COUNT:-15}"

echo "GET ${BASE_URL}${PATH_UNDER_TEST}  x${COUNT}"
echo "---"

for i in $(seq 1 "${COUNT}"); do
  code="$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${PATH_UNDER_TEST}")"
  echo "${i}: ${code}"
done
