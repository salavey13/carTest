#!/usr/bin/env bash
# Evening Summary Prepayment Section Shell Validation Tests

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SUMMARY_SCRIPT="$PROJECT_ROOT/boss-commands/evening-summary.sh"

[[ ! -f "$SUMMARY_SCRIPT" ]] && { echo "❌ FATAL: Script not found"; exit 1; }

echo "════════════════════════════════════════════════════════════════"
echo "Evening Summary Prepayment Section Tests"
echo "════════════════════════════════════════════════════════════════"
echo "Script: $SUMMARY_SCRIPT"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Test functions
test_1_vars() {
  local vars=("PREPAYMENTS_DATA" "PREPAYMENT_COUNT" "PREPAYMENT_TOTAL" "PREPAYMENT_SECTION")
  for v in "${vars[@]}"; do
    grep -q "$v" "$SUMMARY_SCRIPT" || return 1
  done
  echo "✅ Test 1: Variables present"
}

test_2_query() {
  grep -q "transaction_type=eq.income_prepayment" "$SUMMARY_SCRIPT" || return 1
  grep -q "supabase_query.*cash_transactions" "$SUMMARY_SCRIPT" || return 1
  echo "✅ Test 2: Query present"
}

test_3_jq() {
  grep -q "jq 'length'" "$SUMMARY_SCRIPT" || return 1
  grep -q "jq.*add" "$SUMMARY_SCRIPT" || return 1
  grep -q "bike_names" "$SUMMARY_SCRIPT" || return 1
  echo "✅ Test 3: jq formatting present"
}

test_4_message() {
  grep -q "ПРЕДОПЛАТЫ" "$SUMMARY_SCRIPT" || return 1
  grep -q "не в выручке" "$SUMMARY_SCRIPT" || return 1
  grep -q "Итого предоплат" "$SUMMARY_SCRIPT" || return 1
  echo "✅ Test 4: Message section present"
}

test_5_syntax() {
  head -1 "$SUMMARY_SCRIPT" | grep -q '#!/usr/bin/env bash' || return 1
  echo "✅ Test 5: Shebang present"
}

test_6_placement() {
  sed -n '/Тест-драйвы/,/ХОЗРАСХОДЫ/p' "$SUMMARY_SCRIPT" | grep -q "PREPAYMENT_SECTION" || return 1
  echo "✅ Test 6: Correct placement"
}

test_7_conditional() {
  grep -q "PREPAYMENT_COUNT.*-gt 0" "$SUMMARY_SCRIPT" || return 1
  grep -q '\[\[ -n "\$PREPAYMENT_SECTION"' "$SUMMARY_SCRIPT" || return 1
  echo "✅ Test 7: Conditional rendering present"
}

test_8_cars_data() {
  grep -q "CARS_DATA.*supabase_query.*cars" "$SUMMARY_SCRIPT" || return 1
  grep -q "PREPAYMENT_DETAIL.*\$CARS_DATA" "$SUMMARY_SCRIPT" || return 1
  echo "✅ Test 8: CARS_DATA available"
}

# Run tests
passed=0
failed=0

test_1_vars && ((passed++)) || ((failed++))
test_2_query && ((passed++)) || ((failed++))
test_3_jq && ((passed++)) || ((failed++))
test_4_message && ((passed++)) || ((failed++))
test_5_syntax && ((passed++)) || ((failed++))
test_6_placement && ((passed++)) || ((failed++))
test_7_conditional && ((passed++)) || ((failed++))
test_8_cars_data && ((passed++)) || ((failed++))

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "Results: $passed passed, $failed failed (exit code will reflect actual result)"
echo "════════════════════════════════════════════════════════════════"

[[ $passed -eq 8 ]] && { echo "✅ ALL TESTS PASSED"; exit 0; } || { echo "❌ SOME TESTS FAILED"; exit 1; }
