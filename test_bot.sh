#!/bin/bash
# DawaiSaathi — Meta Cloud API Bot Test Suite

WEBHOOK="http://localhost:3000/api/webhook/whatsapp"
PHONE="916378419374"
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'
PASS=0
FAIL=0

send_meta() {
  local text="$1"
  local name="${2:-Devansh}"
  curl -s -X POST "$WEBHOOK" \
    -H "Content-Type: application/json" \
    -d "{
      \"object\":\"whatsapp_business_account\",
      \"entry\":[{\"changes\":[{\"field\":\"messages\",\"value\":{
        \"messaging_product\":\"whatsapp\",
        \"contacts\":[{\"profile\":{\"name\":\"$name\"}}],
        \"messages\":[{\"from\":\"$PHONE\",\"id\":\"wamid.$(date +%s)\",\"timestamp\":\"$(date +%s)\",\"type\":\"text\",\"text\":{\"body\":\"$text\"}}]
      }}]}]
    }"
}

test_cmd() {
  local label="$1"; local input="$2"
  printf "${CYAN}Testing:${NC} %-20s → " "$label"
  local result=$(send_meta "$input")
  if echo "$result" | grep -q '"processed"'; then
    printf "${GREEN}✅ PASS${NC}\n"; PASS=$((PASS + 1))
  else
    printf "${RED}❌ FAIL${NC} ($result)\n"; FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "══════════════════════════════════════════"
echo "  DawaiSaathi — Meta Cloud API Test Suite"
echo "══════════════════════════════════════════"
echo ""

echo "── Greetings ──"
test_cmd "Hi" "Hi"
test_cmd "Hello" "Hello"
test_cmd "Namaste" "Namaste"

echo ""
echo "── Commands ──"
test_cmd "Help" "Help"
test_cmd "Add medicine" "Add medicine"
test_cmd "My medicines" "My medicines"
test_cmd "Today" "Today"
test_cmd "Streak" "Streak"
test_cmd "Add family" "Add family"

echo ""
echo "── Dose Logging ──"
test_cmd "Taken" "Taken"
test_cmd "✅ emoji" "✅"
test_cmd "Snooze" "Snooze"
test_cmd "⏰ emoji" "⏰"
test_cmd "Skip" "Skip"
test_cmd "❌ emoji" "❌"

echo ""
echo "── Account ──"
test_cmd "Stop" "Stop"
test_cmd "Resume" "Resume"
test_cmd "Delete data" "Delete my data"
test_cmd "Confirm delete" "CONFIRM DELETE"

echo ""
echo "── Edge Cases ──"
test_cmd "Gibberish" "xyzabc123"
test_cmd "Spaces" "   "

echo ""
echo "══════════════════════════════════════════"
TOTAL=$((PASS + FAIL))
echo "  Results: ${PASS} passed / ${FAIL} failed / ${TOTAL} total"
echo "══════════════════════════════════════════"
echo ""
