# ExamGuard — Render Backend Deployment Guide

**Target Service:** Render Web Service (Node.js Environment)  
**Applicability:** Production Deployment of `Backend/`  
**Security Status:** Mandatory Production Configuration

---

## 1. Overview & Root Cause Analysis

When deploying the ExamGuard backend to Render, the server's fail-closed startup validation (`enforceStartupValidation`) aborted with the following errors in the Render deployment logs:

| Error Reported on Render | Root Cause | Permanent Resolution |
| :--- | :--- | :--- |
| **Insecure JWT_SECRET** | A development placeholder (e.g. `'examguard_secure_jwt_secret_dev_key_2026_examguard'`) was present or copied from `.env.example`. | Provision a cryptographically random string (minimum 32 characters, 64-character hex recommended) in the Render Dashboard. |
| **Missing ALLOWED_ORIGINS** | The `ALLOWED_ORIGINS` environment variable was not set in the Render Dashboard. | Set `ALLOWED_ORIGINS=https://exam-gaurd.vercel.app` (the deployed Vercel frontend URL). |
| **Missing RSA key-wrapping files** | Private and public keys in `Backend/keys/*.pem` are excluded from Git via `.gitignore` to prevent credential leakage. | Provision existing keys via Base64 environment variables (decoded at startup by `keyProvisioner.js`) or via Render Secret Files. |
| **Missing RSA signing files** | Digital signing keys in `Backend/keys/*.pem` are excluded from Git via `.gitignore`. | Provision existing keys via Base64 environment variables (decoded at startup by `keyProvisioner.js`) or via Render Secret Files. |
| **Yarn & package-lock.json warning** | Render logged a non-fatal warning when Root Directory was left as `.` instead of `Backend`. | Set **Root Directory** to `Backend` in Render Dashboard Web Service settings. |

> [!IMPORTANT]
> **Preserving Existing Cryptographic Material:**
> Do NOT generate new random RSA keys on Render if question papers have already been submitted and encrypted in your database. Decrypting existing papers requires the exact matching private wrapping key, and verifying signatures requires the matching public signing key.

---

## 2. Render Web Service Configuration Settings

In the **Render Dashboard**, open your ExamGuard backend Web Service and verify the following under **Settings**:

- **Name:** `examguard-backend` (or your chosen service name)
- **Environment:** `Node`
- **Region:** Choose the region closest to your Supabase database
- **Branch:** `main`
- **Root Directory:** `Backend` *(CRITICAL: Must be set to `Backend`)*
- **Build Command:** `npm ci --omit=dev` (or `npm install`)
- **Start Command:** `node src/server.js` (or `npm start`)
- **Auto-Deploy:** `Yes`

---

## 3. Environment Variables Configuration

In the **Render Dashboard**, navigate to **Environment > Environment Variables** and add the following keys:

| Environment Variable | Recommended Value / Format | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production security, error sanitization, and strict CORS. |
| `PORT` | `10000` *(Render sets this automatically)* | Port the Express server listens on. |
| `SUPABASE_URL` | `https://[YOUR-PROJECT-ID].supabase.co` | Your Supabase project endpoint (must use HTTPS). |
| `SUPABASE_ANON_KEY` | `[YOUR-SUPABASE-ANON-KEY]` | Supabase client anon public key. |
| `SUPABASE_SERVICE_ROLE_KEY` | `[YOUR-SUPABASE-SERVICE-ROLE-KEY]` | Privileged server-side database key. |
| `JWT_SECRET` | 64-character random hex string | Random token signing secret (see generator below). |
| `JWT_EXPIRES_IN` | `1h` | Token validity duration. |
| `STORAGE_BUCKET` | `examguard-storage` | Private object storage bucket name. |
| `MAX_QUESTION_PAPER_SIZE_MB` | `10` | Maximum upload file limit in megabytes. |
| `ALLOWED_ORIGINS` | `https://exam-gaurd.vercel.app` | Comma-separated list of authorized frontend origins. |
| `TRUST_PROXY` | `true` | Required for correct client IP detection behind Render's reverse proxy. |
| `LOGIN_RATE_LIMIT_WINDOW_MINUTES` | `15` | Brute-force throttling window. |
| `LOGIN_RATE_LIMIT_MAX_ATTEMPTS` | `10` | Max allowed attempts per window per IP. |

### Generating a Strong `JWT_SECRET`
Generate a cryptographically secure 64-character hex secret locally:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 4. Cryptographic Key Provisioning (Preserving Existing Keys)

ExamGuard includes an automated utility `Backend/scripts/exportKeysForRender.js` that extracts your existing local keys and formats them into Base64 strings for Render.

### Step 4.1: Run the Local Export Utility
In your local terminal (inside `ExamGaurd/Backend`):
```bash
node scripts/exportKeysForRender.js
```

This generates a local, git-ignored file:
`Backend/.render-secrets.env`

### Step 4.2: Add Keys to Render Dashboard
Open `Backend/.render-secrets.env` on your local computer and copy the four Base64 variables into your **Render Dashboard > Environment Variables**:

1. `QUESTION_PAPER_KEY_WRAPPING_PUBLIC_KEY_BASE64`
2. `QUESTION_PAPER_KEY_WRAPPING_PRIVATE_KEY_BASE64`
3. `QUESTION_PAPER_SIGNING_PUBLIC_KEY_BASE64`
4. `QUESTION_PAPER_SIGNING_PRIVATE_KEY_BASE64`

### How It Works at Runtime:
When `server.js` boots on Render:
1. `keyProvisioner.js` detects the Base64 environment variables.
2. It decodes the PEM strings and writes them to `Backend/keys/` with POSIX permissions `0600` (private) and `0644` (public).
3. `envValidator.js` validates that all keys exist, are readable, and contain valid PEM headers.
4. The server starts with 100% cryptographic continuity.

---

## 5. Alternative: Render Secret Files

If you prefer using Render's native Secret Files feature instead of environment variables:

1. In Render Dashboard, go to **Environment > Secret Files**.
2. Click **Add Secret File** for each of the 4 keys:
   - **Filename:** `keys/question-paper-key-wrapping-public.pem`
   - **Filename:** `keys/question-paper-key-wrapping-private.pem`
   - **Filename:** `keys/question-paper-signing-public.pem`
   - **Filename:** `keys/question-paper-signing-private.pem`
3. Paste the raw PEM contents from your local `Backend/keys/*.pem` files.
4. Render mounts these files directly into the filesystem.

---

## 6. Post-Deployment Verification

Once Render finishes deploying the service:

### 1. Test Liveness Probe:
```bash
curl -i https://[YOUR-RENDER-APP].onrender.com/api/health
# Expected: HTTP 200 OK with {"success": true, "status": "healthy"}
```

### 2. Test Readiness Probe (Database Connectivity):
```bash
curl -i https://[YOUR-RENDER-APP].onrender.com/api/health/ready
# Expected: HTTP 200 OK with {"success": true, "status": "ready", "checks": {"database": "connected"}}
```

### 3. Update Vercel Frontend:
In your **Vercel Dashboard > Project Settings > Environment Variables**:
- Set `VITE_API_BASE_URL=https://[YOUR-RENDER-APP].onrender.com/api`
- Trigger a Redeploy in Vercel to connect the frontend to your live Render backend.
