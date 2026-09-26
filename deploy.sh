#!/bin/sh
# Bygger och startar appen med versionsinfo (commit, datum, meddelande och om
# commiten är pushad), som visas på profilsidan.
#
#   ./deploy.sh                                   den riktiga appen (port 8090)
#   ./deploy.sh -f docker-compose.test.yml        testmiljön (port 8091)
set -e
cd "$(dirname "$0")"

json() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

commit=$(git rev-parse --short HEAD)
date=$(git log -1 --format=%cI)
subject=$(git log -1 --format=%s)
pushed=false
if upstream=$(git rev-parse '@{u}' 2>/dev/null) && [ "$upstream" = "$(git rev-parse HEAD)" ]; then
	pushed=true
fi
dirty=false
[ -n "$(git status --porcelain --untracked-files=no)" ] && dirty=true

APP_VERSION=$(printf '{"commit":"%s","date":"%s","subject":"%s","pushed":%s,"dirty":%s,"built":"%s"}' \
	"$commit" "$date" "$(json "$subject")" "$pushed" "$dirty" "$(date -u +%Y-%m-%dT%H:%M:%SZ)")
export APP_VERSION

docker compose "$@" up -d --build
echo "Deployad: $commit $subject"
