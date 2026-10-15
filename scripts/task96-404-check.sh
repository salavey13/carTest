#!/usr/bin/env bash
# task96 — 404 doublecheck on map-riders + network tab (prod build, local)
BASE=http://localhost:3457
echo "== core routes =="
for p in "/franchize/vip-bike/map-riders" "/franchize/discovery" "/franchize/vip-bike" "/franchize/vip-bike/rider/413553377" "/franchize/vip-bike/community" "/franchize/vip-bike/salary-coefficients" "/franchize/moto-selection" "/crews/moto-selection" "/crews/georg-electro"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$p")
  echo "$code  $p"
done
echo
echo "== api endpoints used by map-riders/network (401/405 OK — auth-gated; 404 = broken) =="
for p in "/api/map-riders/overview" "/api/map-riders/batch-points" "/api/map-riders/location"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE$p" -H 'Content-Type: application/json' -d '{}')
  echo "$code  POST $p"
done
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/map-riders/overview")
echo "$code  GET  /api/map-riders/overview"
echo
echo "== assets referenced by map-riders HTML =="
HTML=$(curl -s "$BASE/franchize/vip-bike/map-riders")
echo "$HTML" | rg -o 'src="[^"]+\.js[^"]*"' | sed 's/src="//;s/"$//' | while read -r a; do
  case "$a" in
    http*) url="$a" ;;
    /*) url="$BASE$a" ;;
    *) url="$BASE/$a" ;;
  esac
  code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  [ "$code" != "200" ] && echo "$code  $url"
done
echo "(only non-200 assets listed above; silence = all JS chunks 200)"
echo
echo "== css/other links =="
echo "$HTML" | rg -o 'href="[^"]+\.(css|ico|png)[^"]*"' | sed 's/href="//;s/"$//' | while read -r a; do
  case "$a" in
    http*) url="$a" ;;
    /*) url="$BASE$a" ;;
    *) url="$BASE/$a" ;;
  esac
  code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  [ "$code" != "200" ] && echo "$code  $url"
done
echo "(only non-200 assets listed above)"
echo
echo "== sanity: network model SSR markers on map page =="
echo "$HTML" | rg -c "Сеть экипажей|Сеть" || echo "no network strings found"
