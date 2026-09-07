#!/usr/bin/env bash
# Synthetic test of the evening-summary prepayment jq filter (3 cases)
set -euo pipefail

JQ_FILTER='
  if type != "array" then ""
  else
    def bikename:
      ([((.rentals.cars // {}).make // ""), ((.rentals.cars // {}).model // "")]
       | map(select(length > 0)) | join(" "));
    (map(select(((.amount // 0) | tonumber? // 0) > 0))) as $rows
    | if ($rows | length) == 0 then ""
      else
        (["💳 Предоплаты (не в выручке):"] +
         [$rows[] |
          "• \(if bikename != "" then bikename else "Без байка" end): \(.description // "Предоплата") — \((.amount // 0) | round) ₽"] +
         ["── Итого предоплат: \([$rows[] | ((.amount // 0) | tonumber? // 0)] | add | round) ₽"])
        | join("\n")
      end
  end
'

echo "── Case 1: two prepayments (with + without rental link) ──"
echo '[
  {"id":"1","amount":5000,"description":"Предоплата за бронь BMW","rental_id":"r1","rentals":{"cars":{"make":"BMW","model":"R 1250 GS"}}},
  {"id":"2","amount":3000,"description":"Частичная предоплата","rental_id":null,"rentals":null}
]' | jq -r "$JQ_FILTER"

echo ""
echo "── Case 2: empty array (must print nothing) ──"
OUT2=$(echo '[]' | jq -r "$JQ_FILTER")
echo "len=${#OUT2} content=[${OUT2}]"

echo ""
echo "── Case 3: PostgREST error object (must print nothing) ──"
OUT3=$(echo '{"code":"42501","message":"permission denied"}' | jq -r "$JQ_FILTER")
echo "len=${#OUT3} content=[${OUT3}]"

echo ""
echo "── Case 4: zero-amount row filtered out ──"
echo '[{"id":"3","amount":0,"description":"ноль","rental_id":null,"rentals":null}]' | jq -r "$JQ_FILTER"
echo "(empty above = ok)"
