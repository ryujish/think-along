#!/usr/bin/env bash
set -euo pipefail

release=$(realpath "$1")
application=$(realpath "$2")
revision=$3
backup="${release}-previous"

test -f "$release/.next/BUILD_ID"
test -f "$application/data/db.json"
test ! -e "$backup"
test ! -e "$release/data"
test ! -L "$release/data"

cd "$release"
npm ci --omit=dev
for environment in "$application"/.env*; do
  if [[ -f "$environment" ]]; then cp -p "$environment" "$release/"; fi
done
data=$(realpath "$application/data")
if [[ "$data" == "$application/"* ]]; then data="$backup/${data#"$application/"}"; fi
ln -s "$data" "$release/data"

rollback() {
  result=$?
  trap - ERR
  if [[ -d "$backup" ]]; then
    sudo systemctl stop thingalong || true
    if [[ -d "$application" ]]; then mv "$application" "${release}-failed"; fi
    mv "$backup" "$application"
  fi
  sudo systemctl start thingalong
  exit "$result"
}
trap rollback ERR
sudo systemctl stop thingalong
checksum=$(sha256sum "$application/data/db.json")
mv "$application" "$backup"
mv "$release" "$application"
test "$(sha256sum "$application/data/db.json")" = "$checksum"
sudo systemctl start thingalong

for attempt in {1..30}; do
  if [[ "$(curl --fail --silent --max-time 2 http://127.0.0.1:3000/release.txt)" == "$revision" ]] &&
    curl --fail --silent --max-time 2 http://127.0.0.1:3000/projects >/dev/null; then
    trap - ERR
    printf 'Activated %s; database preserved; previous release: %s\n' "$revision" "$backup"
    exit 0
  fi
  sleep 2
done
printf 'Release health check failed; restoring previous release.\n' >&2
false
