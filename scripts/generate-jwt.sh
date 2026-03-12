#!/bin/bash

# JWT Generator for Supabase Self-Hosted
# Usage: ./generate-jwt.sh

# Generate random secrets
JWT_SECRET=$(openssl rand -base64 32)
ANON_KEY_SECRET=$(openssl rand -hex 32)
SERVICE_KEY_SECRET=$(openssl rand -hex 32)

# Current timestamp
NOW=$(date +%s)
EXP=$(($NOW + 315360000))  # +10 years

# Generate ANON_KEY payload
ANON_PAYLOAD=$(cat <<EOF
{
  "role": "anon",
  "iss": "supabase",
  "iat": $NOW,
  "exp": $EXP
}
EOF
)

# Generate SERVICE_ROLE_KEY payload  
SERVICE_PAYLOAD=$(cat <<EOF
{
  "role": "service_role",
  "iss": "supabase",
  "iat": $NOW,
  "exp": $EXP
}
EOF
)

echo "=== JWT Secret (for .env JWT_SECRET) ==="
echo "$JWT_SECRET"
echo ""
echo "=== ANON_KEY (for .env ANON_KEY and VITE_SUPABASE_PUBLISHABLE_KEY) ==="
echo "Generate at https://jwt.io with:"
echo "Header: {\"alg\":\"HS256\",\"typ\":\"JWT\"}"
echo "Payload: $ANON_PAYLOAD"
echo "Secret: $JWT_SECRET"
echo ""
echo "=== SERVICE_ROLE_KEY (for .env SERVICE_ROLE_KEY) ==="
echo "Generate at https://jwt.io with:"
echo "Header: {\"alg\":\"HS256\",\"typ\":\"JWT\"}"
echo "Payload: $SERVICE_PAYLOAD"
echo "Secret: $JWT_SECRET"
echo ""

# Alternative: direct generation with Node.js if available
if command -v node &> /dev/null; then
    echo "=== Node.js detected, generating tokens directly... ==="
    
    cat > /tmp/gen-jwt.js << 'NODEEOF'
const crypto = require('crypto');

function base64UrlEncode(str) {
    return Buffer.from(str)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

function hmacSHA256(message, secret) {
    return crypto.createHmac('sha256', secret).update(message).digest();
}

function generateJWT(payload, secret) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const headerB64 = base64UrlEncode(JSON.stringify(header));
    const payloadB64 = base64UrlEncode(JSON.stringify(payload));
    const signingInput = `${headerB64}.${payloadB64}`;
    const signature = base64UrlEncode(hmacSHA256(signingInput, secret));
    return `${signingInput}.${signature}`;
}

const jwtSecret = process.argv[2];
const now = Math.floor(Date.now() / 1000);
const exp = now + 315360000; // 10 years

const anonPayload = { role: 'anon', iss: 'supabase', iat: now, exp: exp };
const servicePayload = { role: 'service_role', iss: 'supabase', iat: now, exp: exp };

console.log('\n=== ANON_KEY ===');
console.log(generateJWT(anonPayload, jwtSecret));

console.log('\n=== SERVICE_ROLE_KEY ===');
console.log(generateJWT(servicePayload, jwtSecret));
NODEEOF

    node /tmp/gen-jwt.js "$JWT_SECRET"
fi
