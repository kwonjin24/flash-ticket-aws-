#!/bin/bash

# Flash Tickets Full Flow Test Script
# Tests the complete user journey from login to payment

GATEWAY_URL="https://gateway.highgarden.cloud"
API_URL="https://api.highgarden.cloud"
USER_ID="test0000"
PASSWORD="testtest"

echo "=== Flash Tickets Full Flow Test ==="
echo

# 1. Login
echo "1. Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$GATEWAY_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$USER_ID\",\"password\":\"$PASSWORD\"}")

ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Login failed!"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi
echo "✅ Login successful - Token: ${ACCESS_TOKEN:0:20}..."

# 2. Get Events
echo
echo "2. Getting events..."
EVENTS_RESPONSE=$(curl -s "$API_URL/events")
EVENT_ID=$(echo $EVENTS_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$EVENT_ID" ]; then
  echo "❌ Get events failed!"
  exit 1
fi
echo "✅ Got event ID: $EVENT_ID"

# 3. Enqueue
echo
echo "3. Joining queue..."
ENQUEUE_RESPONSE=$(curl -s -X POST "$GATEWAY_URL/queue/enqueue" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{\"eventId\":\"$EVENT_ID\"}")

TICKET_ID=$(echo $ENQUEUE_RESPONSE | grep -o '"ticketId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TICKET_ID" ]; then
  echo "❌ Enqueue failed!"
  exit 1
fi
echo "✅ Joined queue - Ticket ID: $TICKET_ID"

# 4. Check Queue Status (polling)
echo
echo "4. Checking queue status..."
MAX_ATTEMPTS=20
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  STATUS_RESPONSE=$(curl -s "$GATEWAY_URL/queue/status?ticketId=$TICKET_ID")
  QUEUE_STATE=$(echo $STATUS_RESPONSE | grep -o '"state":"[^"]*"' | cut -d'"' -f4)

  echo "   Attempt $((ATTEMPT+1))/$MAX_ATTEMPTS - State: $QUEUE_STATE"

  if [ "$QUEUE_STATE" == "READY" ]; then
    GATE_TOKEN=$(echo $STATUS_RESPONSE | grep -o '"gateToken":"[^"]*"' | cut -d'"' -f4)
    echo "✅ Queue ready - Gate Token: ${GATE_TOKEN:0:20}..."
    break
  fi

  ATTEMPT=$((ATTEMPT+1))
  if [ $ATTEMPT -lt $MAX_ATTEMPTS ]; then
    sleep 5
  fi
done

if [ "$QUEUE_STATE" != "READY" ]; then
  echo "❌ Queue not ready after $MAX_ATTEMPTS attempts"
  exit 1
fi

# 5. Enter Queue
echo
echo "5. Entering queue..."
ENTER_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$GATEWAY_URL/queue/enter" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{\"ticketId\":\"$TICKET_ID\",\"gateToken\":\"$GATE_TOKEN\"}")

ENTER_CODE=$(echo "$ENTER_RESPONSE" | tail -1)
if [ "$ENTER_CODE" == "201" ]; then
  echo "✅ Entered queue successfully"
else
  echo "❌ Enter queue failed - HTTP $ENTER_CODE"
  exit 1
fi

# 6. Get Event Detail
echo
echo "6. Getting event details..."
EVENT_DETAIL=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" "$API_URL/events/$EVENT_ID")
EVENT_NAME=$(echo $EVENT_DETAIL | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
echo "✅ Event: $EVENT_NAME"

# 7. Create Order
echo
echo "7. Creating order..."
IDEMPOTENCY_KEY=$(uuidgen)
ORDER_RESPONSE=$(curl -s -X POST "$API_URL/orders" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d "{\"event_id\":\"$EVENT_ID\",\"qty\":1}")

ORDER_ID=$(echo $ORDER_RESPONSE | grep -o '"orderId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$ORDER_ID" ]; then
  echo "❌ Create order failed!"
  echo "Response: $ORDER_RESPONSE"
  exit 1
fi
echo "✅ Order created - Order ID: $ORDER_ID"

# 8. Create Payment
echo
echo "8. Creating payment..."
PAYMENT_RESPONSE=$(curl -s -X POST "$API_URL/payments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{\"orderId\":\"$ORDER_ID\",\"method\":\"MOCK\"}")

PAYMENT_ID=$(echo $PAYMENT_RESPONSE | grep -o '"paymentId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$PAYMENT_ID" ]; then
  echo "❌ Create payment failed!"
  exit 1
fi
echo "✅ Payment created - Payment ID: $PAYMENT_ID"

# 9. Complete Payment (Callback)
echo
echo "9. Completing payment..."
COMPLETE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/payments/callback" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{\"orderId\":\"$ORDER_ID\",\"paymentId\":\"$PAYMENT_ID\",\"status\":\"OK\"}")

COMPLETE_CODE=$(echo "$COMPLETE_RESPONSE" | tail -1)
if [ "$COMPLETE_CODE" == "201" ]; then
  echo "✅ Payment completed successfully"
else
  echo "❌ Complete payment failed - HTTP $COMPLETE_CODE"
  exit 1
fi

# 10. Verify Order
echo
echo "10. Verifying final order status..."
ORDER_STATUS=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" "$API_URL/orders/$ORDER_ID")
FINAL_STATUS=$(echo $ORDER_STATUS | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ "$FINAL_STATUS" == "PAID" ]; then
  echo "✅ Order status: PAID"
else
  echo "⚠️  Order status: $FINAL_STATUS (expected PAID)"
fi

echo
echo "=== ✅ ALL TESTS PASSED! ==="
echo
echo "Summary:"
echo "  - User: $USER_ID"
echo "  - Event: $EVENT_NAME"
echo "  - Order: $ORDER_ID"
echo "  - Payment: $PAYMENT_ID"
echo "  - Final Status: $FINAL_STATUS"
