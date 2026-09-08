#!/usr/bin/env bash
# Verify Avito reply readiness using the SAME creds the app reads from env.
# 1) token mint with scope (as lib/avito-messenger.ts does)
# 2) read probe GET /messenger/v2/accounts/{AVITO_USER_ID}/chats?limit=1
set -euo pipefail
cd /home/z/cartest
set -a; source .env.local; set +a

echo "== client_id: ${AVITO_CLIENT_ID:0:6}…  user_id: $AVITO_USER_ID"

TOKEN=$(curl -s -X POST https://api.avito.ru/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=client_credentials" \
  --data-urlencode "client_id=$AVITO_CLIENT_ID" \
  --data-urlencode "client_secret=$AVITO_CLIENT_SECRET" \
  --data-urlencode "scope=messenger:read messenger:write")

echo "$TOKEN" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('token:', 'OK len='+str(len(d.get('access_token',''))) if d.get('access_token') else 'MISSING')
print('scope echo:', d.get('scope','(none)'))
print('expires_in:', d.get('expires_in'))
print('error:', d.get('error'), d.get('error_description',''))
" 
AT=$(echo "$TOKEN" | python3 -c "import json,sys; print(json.load(sys.stdin).get('access_token',''))")
[ -z "$AT" ] && { echo "NO TOKEN — aborting"; exit 1; }

echo "== read probe (rental chats, limit=1)"
curl -s -o /tmp/avito-read.json -w "HTTP %{http_code}\n" \
  "https://api.avito.ru/messenger/v2/accounts/$AVITO_USER_ID/chats?limit=1" \
  -H "Authorization: Bearer $AT"
python3 -c "
import json
d=json.load(open('/tmp/avito-read.json'))
chats=d.get('chats',[])
print('chats returned:', len(chats))
if chats:
    c=chats[0]
    print('sample chat id:', c.get('id'), '| users:', [u.get('id') for u in c.get('context_value',{}).get('users',c.get('users',[]))][:3])
"
