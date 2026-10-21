# ExamGuard — Production Deployment & Operations Guide

**Module 17: Production Hardening & Deployment Configuration**  
**Document Revision:** 1.0  
**Target Environment:** Linux Server (Ubuntu 22.04 LTS / 24.04 LTS), Node.js LTS 20+, Nginx

---

## 1. System Architecture & Request Flow

ExamGuard follows a modern, decoupled production architecture separating client-side Single-Page Application (SPA) delivery, Node.js API processing, Supabase PostgreSQL data persistence, and local cryptographic key storage.

```
       +-------------------------------------------------------+
       |                  Client Web Browser                   |
       |     (React 18 SPA - HTML5 / JavaScript / CSS)         |
       +-------------------------------------------------------+
                                  |
                                  | HTTPS (TLS 1.3 on Port 443)
                                  v
       +-------------------------------------------------------+
       |             Nginx Reverse Proxy & Load Balancer       |
       |  - TLS Termination & HSTS                             |
       |  - Static Asset Delivery (/ -> Frontend dist/)        |
       |  - Rate-Limiting & Proxy Forwarding (/api -> Backend) |
       +-------------------------------------------------------+
                   |                               |
        Static /   |                               | Forward /api/*
        Assets     v                               v (Port 5000)
    +--------------------+            +----------------------------+
    | Frontend Static    |            | Node.js / Express Backend  |
    | Build (Vite dist/) |            | (PM2 / Systemd Cluster)    |
    +--------------------+            +----------------------------+
                                                    |
                         +--------------------------+--------------------------+
                         |                                                     |
                         v                                                     v
          +-------------------------------+                     +-------------------------------+
          |  Cryptographic Key Storage    |                     |   Supabase Cloud Platform     |
          |  - RSA-OAEP Key Wrapping Keys |                     |  - PostgreSQL Database        |
          |  - RSA-PSS Signature Keys     |                     |  - Private Object Storage     |
          |  (Filesystem: chmod 600)      |                     |    ('examguard-storage')      |
          +-------------------------------+                     +-------------------------------+
```

---

## 2. Server Prerequisites & Node.js Runtime

### 2.1 Operating System & Packages
- **Operating System:** Ubuntu 22.04 LTS or 24.04 LTS
- **Node.js Runtime:** Node.js LTS 20.x or higher (Node 20.18+ / 22.x)
- **Package Manager:** npm 10+
- **Process Manager:** PM2 (recommended) or systemd
- **Web Server:** Nginx 1.18+
- **TLS Certificate:** Let's Encrypt Certbot or enterprise wildcard certificate

### 2.2 Node.js Installation (via NodeSource)
```bash
# Update system repositories
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y curl git build-essential nginx certbot python3-certbot-nginx

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify versions
node -v   # Expected: v20.x.x
npm -v    # Expected: 10.x.x
```

---

## 3. Application Setup & Build Process

### 3.1 Repository Cloning & User Isolation
Run the application under a dedicated, non-privileged system user (`examguard`):

```bash
# Create dedicated system user
sudo useradd -m -s /bin/bash examguard
sudo su - examguard

# Clone repository
git clone https://github.com/your-org/examguard.git /home/examguard/app
cd /home/examguard/app
```

### 3.2 Backend Configuration & Dependencies
```bash
cd /home/examguard/app/Backend
npm ci --omit=dev

# Copy environment template
cp .env.example .env
chmod 600 .env

# Generate production cryptographic keys (if not previously generated)
node scripts/generateEncryptionKeys.js
node scripts/generateSigningKeys.js

# Secure key permissions (read-only by application owner)
chmod 600 keys/*-private.pem
chmod 644 keys/*-public.pem
```

Configure `Backend/.env` with production parameters:
```ini
NODE_ENV=production
PORT=5000
SUPABASE_URL=https://[YOUR-PROJECT].supabase.co
SUPABASE_ANON_KEY=[YOUR-ANON-KEY]
SUPABASE_SERVICE_ROLE_KEY=[YOUR-SERVICE-ROLE-KEY]
JWT_SECRET=[64-CHAR-CRYPTOGRAPHICALLY-SECURE-RANDOM-HEX-STRING]
JWT_EXPIRES_IN=1h
STORAGE_BUCKET=examguard-storage
MAX_QUESTION_PAPER_SIZE_MB=10
ALLOWED_ORIGINS=https://examguard.yourdomain.com
TRUST_PROXY=true
LOGIN_RATE_LIMIT_WINDOW_MINUTES=15
LOGIN_RATE_LIMIT_MAX_ATTEMPTS=10
```

### 3.3 Frontend Compilation & Asset Packaging
```bash
cd /home/examguard/app/Frontend
npm ci

# Configure production environment
echo "VITE_API_BASE_URL=/api" > .env.production

# Compile production bundle
npm run build

# Verify build output
ls -la dist/
```

---

## 4. Process Management: PM2 Configuration

Install PM2 globally to supervise the Express backend, handle process crashes, and restart on reboot:

```bash
sudo npm install -g pm2
```

Create `/home/examguard/app/Backend/ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'examguard-backend',
      script: 'src/server.js',
      cwd: '/home/examguard/app/Backend',
      instances: 'max', // Multi-core cluster mode
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      max_memory_restart: '500M',
      listen_timeout: 8000,
      kill_timeout: 5000,
      error_file: '/home/examguard/logs/backend-error.log',
      out_file: '/home/examguard/logs/backend-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
```

Start the application cluster and configure system startup:
```bash
pm2 start ecosystem.config.js
pm2 save
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u examguard --hp /home/examguard
```

---

## 5. Systemd Alternative Service Unit

If enterprise policy prohibits PM2, configure a native systemd unit at `/etc/systemd/system/examguard.service`:

```ini
[Unit]
Description=ExamGuard Secure Examination Backend Service
After=network.target

[Service]
Type=simple
User=examguard
WorkingDirectory=/home/examguard/app/Backend
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=examguard-backend
Environment=NODE_ENV=production
Environment=PORT=5000

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable examguard.service
sudo systemctl start examguard.service
sudo systemctl status examguard.service
```

---

## 6. Nginx Reverse Proxy Configuration

Nginx acts as the TLS termination endpoint, serves frontend static assets, applies rate limiting, and forwards `/api/*` calls to Node.js.

Create `/etc/nginx/sites-available/examguard.conf`:

```nginx
# Rate-limiting zones
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=login_limit:10m rate=5r/m;

server {
    listen 80;
    listen [::]:80;
    server_name examguard.yourdomain.com;
    
    # Redirect all plain HTTP traffic to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name examguard.yourdomain.com;

    # SSL Certificates (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/examguard.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/examguard.yourdomain.com/privkey.pem;

    # Hardened SSL Ciphers and Protocols
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Frontend Single Page Application (Static Root)
    root /home/examguard/app/Frontend/dist;
    index index.html;

    # Max upload limit matching backend 10 MB payload
    client_max_body_size 12M;

    # Frontend SPA Route Fallback
    location / {
        try_files $uri $uri/ /index.html;
        expires -1;
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }

    # Static Assets Cache (Immutable hashed Vite assets)
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Backend API Reverse Proxy
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;

        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }

    # Dedicated Rate Limiting for Authentication Login
    location /api/auth/login {
        limit_req zone=login_limit burst=5 nodelay;

        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site and test configuration:
```bash
sudo ln -s /etc/nginx/sites-available/examguard.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 7. Health & Readiness Verification

After completing deployment, verify server health and database readiness probes from the command line:

```bash
# Test Liveness Probe (HTTP 200)
curl -i https://examguard.yourdomain.com/api/health

# Test Readiness Probe (HTTP 200 with database check)
curl -i https://examguard.yourdomain.com/api/health/ready
```

Expected readiness output:
```json
{
  "success": true,
  "status": "ready",
  "checks": {
    "database": "connected",
    "storageBucket": "examguard-storage",
    "timestamp": "2026-10-15T19:30:00.000Z"
  }
}
```
