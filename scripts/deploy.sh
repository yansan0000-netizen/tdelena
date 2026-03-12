#!/bin/bash
# Complete deployment script for tdelena.ru
# Run on fresh Ubuntu 22.04/24.04 server

set -e

echo "🚀 Starting deployment for tdelena.ru..."

# Configuration
DOMAIN="tdelena.ru"
API_DOMAIN="api.tdelena.ru"
SERVER_IP=$(curl -s ifconfig.me)

echo "📋 Configuration:"
echo "  Frontend: https://$DOMAIN"
echo "  API: https://$API_DOMAIN"
echo "  Server IP: $SERVER_IP"

# 1. System update
echo "📦 Updating system..."
apt update && apt upgrade -y

# 2. Install dependencies
echo "📦 Installing dependencies..."
apt install -y curl wget git nginx certbot python3-certbot-nginx ufw fail2ban htop

# 3. Install Docker
echo "🐳 Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
usermod -aG docker root
apt install -y docker-compose-plugin

# 4. Install Node.js 20
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 5. Setup firewall
echo "🔥 Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable

# 6. Create directories
echo "📁 Creating directories..."
mkdir -p /opt/supabase
mkdir -p /opt/backup
mkdir -p /var/www/$DOMAIN
mkdir -p /var/log/nginx

# 7. Clone Supabase
echo "📥 Cloning Supabase..."
cd /opt/supabase
git clone --depth 1 https://github.com/supabase/supabase.git

# 8. Generate secrets
echo "🔐 Generating secrets..."
JWT_SECRET=$(openssl rand -base64 32)
POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr '+/' '-_')

# Generate JWT tokens using Node.js
cat > /tmp/gen-jwt.js << 'NODEEOF'
const crypto = require('crypto');

function base64UrlEncode(str) {
    return Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
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
const exp = now + 315360000;

const anonPayload = { role: 'anon', iss: 'supabase', iat: now, exp };
const servicePayload = { role: 'service_role', iss: 'supabase', iat: now, exp };

console.log('ANON_KEY=' + generateJWT(anonPayload, jwtSecret));
console.log('SERVICE_ROLE_KEY=' + generateJWT(servicePayload, jwtSecret));
NODEEOF

TOKENS=$(node /tmp/gen-jwt.js "$JWT_SECRET")
ANON_KEY=$(echo "$TOKENS" | grep ANON_KEY | cut -d= -f2)
SERVICE_ROLE_KEY=$(echo "$TOKENS" | grep SERVICE_ROLE_KEY | cut -d= -f2)

# 9. Create .env file
echo "📝 Creating .env file..."
cat > /opt/supabase/supabase/docker/.env << EOF
############
# Secrets
############
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
JWT_SECRET=$JWT_SECRET
ANON_KEY=$ANON_KEY
SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY

############
# URLs
############
API_EXTERNAL_URL=https://$API_DOMAIN
SUPABASE_PUBLIC_URL=https://$API_DOMAIN
SITE_URL=https://$DOMAIN
SUPABASE_STORAGE_URL=https://$API_DOMAIN/storage/v1

############
# Database
############
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT=5432
POSTGRES_POOL_SIZE=20

############
# Auth
############
DISABLE_SIGNUP=false
JWT_EXPIRY=3600
REFRESH_TOKEN_EXPIRY=604800
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false

############
# SMTP (configure manually after setup)
############
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_SENDER_NAME=TDElena
SMTP_ADMIN_EMAIL=

############
# Storage
############
STORAGE_FILE_SIZE_LIMIT=52428800
STORAGE_BACKEND=fs

############
# Realtime
############
ENABLE_REALTIME=true

############
# Ports
############
KONG_HTTP_PORT=8000
KONG_HTTPS_PORT=8443
EOF

# 10. Create backup script
echo "💾 Creating backup script..."
cat > /opt/backup/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backup"
DATE=$(date +%Y%m%d_%H%M%S)
LOG_FILE="/var/log/backup.log"

exec 1>>"$LOG_FILE"
exec 2>&1

echo "[$(date)] Starting backup..."

# Backup PostgreSQL
docker exec supabase-db pg_dump -U supabase -d postgres | gzip > "$BACKUP_DIR/db_backup_$DATE.sql.gz"

# Backup Storage
if [ -d "/opt/supabase/supabase/docker/volumes/storage" ]; then
    tar -czf "$BACKUP_DIR/storage_backup_$DATE.tar.gz" -C /opt/supabase/supabase/docker/volumes storage/
fi

# Cleanup old backups (keep 7 days)
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete 2>/dev/null
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete 2>/dev/null

echo "[$(date)] Backup completed: db_backup_$DATE.sql.gz"
EOF

chmod +x /opt/backup/backup.sh

# 11. Create monitor script
echo "📊 Creating monitor script..."
cat > /opt/monitor.sh << 'EOF'
#!/bin/bash
# Restart Supabase if down
if ! docker compose -f /opt/supabase/supabase/docker/docker-compose.yml ps | grep -q "Up (healthy)"; then
    echo "[$(date)] ALERT: Supabase containers unhealthy, restarting..."
    cd /opt/supabase/supabase/docker && docker compose up -d
fi
EOF

chmod +x /opt/monitor.sh

# 12. Setup cron
echo "⏰ Setting up cron jobs..."
(crontab -l 2>/dev/null || echo "") | grep -v "backup.sh\|monitor.sh" | crontab -
(
echo "0 3 * * * /opt/backup/backup.sh"
echo "*/5 * * * * /opt/monitor.sh"
) | crontab -

# 13. Pull and start Supabase
echo "🚀 Starting Supabase..."
cd /opt/supabase/supabase/docker
docker compose pull
docker compose up -d

# 14. Wait for Supabase to be ready
echo "⏳ Waiting for Supabase to be ready..."
sleep 30

# 15. Create Nginx config for API
echo "🔧 Configuring Nginx for API..."
cat > /etc/nginx/sites-available/$API_DOMAIN << EOF
server {
    listen 80;
    server_name $API_DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $API_DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$API_DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$API_DOMAIN/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Logs
    access_log /var/log/nginx/api-access.log;
    error_log /var/log/nginx/api-error.log;

    # Main proxy to Kong
    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
        
        # Timeouts for Excel processing
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        
        # File upload size
        client_max_body_size 50M;
    }

    # WebSocket for Realtime
    location /realtime/v1/websocket {
        proxy_pass http://localhost:8000/realtime/v1/websocket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }
}
EOF

# 16. Create Nginx config for frontend (placeholder)
echo "🔧 Configuring Nginx for frontend..."
cat > /etc/nginx/sites-available/$DOMAIN << 'EOF'
server {
    listen 80;
    server_name DOMAIN www.DOMAIN;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name DOMAIN www.DOMAIN;

    ssl_certificate /etc/letsencrypt/live/DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/DOMAIN/privkey.pem;

    root /var/www/DOMAIN;
    index index.html;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Static caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

sed -i "s/DOMAIN/$DOMAIN/g" /etc/nginx/sites-available/$DOMAIN

# 17. Enable sites
ln -sf /etc/nginx/sites-available/$API_DOMAIN /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 18. Test Nginx config
nginx -t

# 19. Save credentials
echo "💾 Saving credentials..."
cat > /opt/.credentials << EOF
============================================
TDElena Deployment Credentials
Generated: $(date)
============================================
Domain: $DOMAIN
API Domain: $API_DOMAIN
Server IP: $SERVER_IP

PostgreSQL Password: $POSTGRES_PASSWORD
JWT Secret: $JWT_SECRET

ANON_KEY: $ANON_KEY
SERVICE_ROLE_KEY: $SERVICE_ROLE_KEY

VITE_SUPABASE_URL=https://$API_DOMAIN
VITE_SUPABASE_PUBLISHABLE_KEY=$ANON_KEY

============================================
⚠️  SAVE THESE CREDENTIALS SECURELY!
============================================
EOF

chmod 600 /opt/.credentials

echo ""
echo "✅ Deployment preparation complete!"
echo ""
echo "📝 Next steps:"
echo "1. Point DNS A records to: $SERVER_IP"
echo "   - $DOMAIN → $SERVER_IP"
echo "   - www.$DOMAIN → $SERVER_IP"
echo "   - $API_DOMAIN → $SERVER_IP"
echo ""
echo "2. After DNS propagates, run:"
echo "   certbot --nginx -d $API_DOMAIN -d $DOMAIN -d www.$DOMAIN"
echo ""
echo "3. Build and deploy your frontend:"
echo "   npm run build"
echo "   scp -r dist/* root@$SERVER_IP:/var/www/$DOMAIN/"
echo ""
echo "4. Credentials saved to: /opt/.credentials"
echo ""
echo "5. Useful commands:"
echo "   - View logs: docker compose -f /opt/supabase/supabase/docker/docker-compose.yml logs -f"
echo "   - Restart: docker compose -f /opt/supabase/supabase/docker/docker-compose.yml restart"
echo "   - Backup now: /opt/backup/backup.sh"
