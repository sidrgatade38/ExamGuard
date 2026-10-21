# ExamGuard — Secret Management, Key Rotation & Operational Security

**Module 17: Production Hardening & Deployment Configuration**  
**Document Revision:** 1.0  
**Security Classification:** Highly Confidential Operational Procedure

---

## 1. Scope & Overview

ExamGuard implements a multi-tier cryptographic architecture:
1. **Application Master Key / JWT Secret:** Signs and verifies access tokens.
2. **RSA Key-Wrapping Pair (2048-bit RSA-OAEP with SHA-256):** Wraps and unwraps ephemeral AES-256 symmetric document keys.
3. **RSA Digital Signature Pair (2048-bit RSA-PSS with SHA-256):** Signs and verifies ciphertext digests to provide authenticity and tamper-detection.
4. **Database Credentials:** Supabase service-role credentials granting backend administrative data operations.

This guide defines strict operational security practices, key generation protocols, non-disruptive key rotation strategies, and emergency compromise containment workflows.

---

## 2. Filesystem Permissions & Key Storage Hardening

On POSIX-compliant production servers (Linux/Unix), private key files and `.env` credentials must be locked down to prevent unauthorized read access by non-root system users or compromised sibling services.

### 2.1 Permission Enforcement Commands

```bash
# Navigate to backend root
cd /home/examguard/app/Backend

# 1. Lock down environment file containing secrets
chmod 600 .env
chown examguard:examguard .env

# 2. Lock down cryptographic private keys (read/write only by owner)
chmod 700 keys/
chmod 600 keys/*-private.pem
chmod 644 keys/*-public.pem
chown -R examguard:examguard keys/
```

### 2.2 Permissions Verification Script
Verify directory and file permissions:

```bash
ls -ld keys/
# Expected: drwx------ (700)

ls -la keys/
# Expected for private keys: -rw------- (600)
# Expected for public keys:  -rw-r--r-- (644)
```

---

## 3. Cryptographic Key Generation & Backup Protocol

ExamGuard provides automated key generation utilities in `Backend/scripts/`:

| Utility Script | Keys Produced | Purpose |
| :--- | :--- | :--- |
| `scripts/generateEncryptionKeys.js` | `question-paper-encryption-{public,private}.pem` | RSA-OAEP key wrapping |
| `scripts/generateSigningKeys.js` | `question-paper-signing-{public,private}.pem` | RSA-PSS ciphertext signature |
| `scripts/generateKeyWrappingKeys.js` | `question-paper-key-wrapping-{public,private}.pem` | Dedicated key wrapping alias |

### 3.1 Initial Production Generation

```bash
cd Backend/
node scripts/generateEncryptionKeys.js
node scripts/generateSigningKeys.js
```

### 3.2 Secure Offline Backup

1. **Air-Gapped Backup:** Copy generated keys to an encrypted, air-gapped physical media (e.g. FIPS 140-2 Level 3 encrypted USB hardware token) stored in a secure physical safe.
2. **GPG Encryption for Cold Storage:**
   ```bash
   tar -czf - keys/ | gpg --symmetric --cipher-algo AES256 -o examguard_keys_cold_backup_$(date +%Y%m%d).tar.gz.gpg
   ```
3. **Zero Secrets in Git:** Verify that `keys/*.pem` and `.env` are strictly listed in `.gitignore`:
   ```bash
   git status --ignored | grep -E "(\.pem|\.env)"
   ```

---

## 4. Planned Key Rotation Strategies (Zero-Downtime)

Keys should be routinely rotated according to the following cadence:
- **JWT Secret:** Every 90 days.
- **RSA Digital Signing Pair:** Every 365 days.
- **RSA Key-Wrapping Pair:** Every 365 days.

### 4.1 JWT Secret Rotation (Graceful 24-Hour Transition)

To rotate the `JWT_SECRET` without forcibly logging out active academic users:
1. Support dual-key verification in `Backend/src/utils/jwt.js`:
   - Primary key: Used for signing new tokens.
   - Secondary / Legacy key: Accepted for verification only during the 24-hour expiration transition window.
2. Update `.env` with new `JWT_SECRET` and set `JWT_SECRET_LEGACY=[previous_secret]`.
3. Reload backend via PM2 (`pm2 reload ecosystem.config.js`).
4. After 24 hours (all previous tokens have expired), remove `JWT_SECRET_LEGACY`.

### 4.2 RSA Digital Signing Key Rotation

Because signatures are verified over historical stored question papers:
1. Generate new signing keypair: `keys/question-paper-signing-v2-{public,private}.pem`.
2. Configure `Backend/.env` to sign newly uploaded papers with `v2`.
3. Maintain `v1` public key for historical paper verification. The verification service checks the key version specified in paper metadata or falls back to legacy public key.

### 4.3 RSA Key-Wrapping Key Rotation

Existing question papers store AES symmetric keys wrapped with the active public key:
1. Generate new wrapping keypair: `keys/question-paper-key-wrapping-v2-{public,private}.pem`.
2. Run an offline batch re-wrapping migration utility:
   - For each paper record: unwrap AES key using `v1` private key.
   - Re-wrap AES key using `v2` public key.
   - Update `encrypted_aes_key` in `question_papers` table within a single transaction.
3. Once all records are re-wrapped, securely shred `v1` private key.

---

## 5. Emergency Compromise Response Procedure

If an active private key, JWT secret, or database credential is suspected of being compromised or exfiltrated, execute the following containment protocol immediately:

```
[1. ISOLATE]  --->  [2. REVOKE]  --->  [3. RE-KEY]  --->  [4. AUDIT]  --->  [5. RESTORE]
Stop Ingress        Invalidate         Generate New        Review Logs         Verify &
Traffic             Credentials        Keys & Re-encrypt   For Breaches        Resume
```

### Phase 1: Ingress Isolation
Temporarily redirect public Nginx ingress traffic to a static maintenance page to prevent further unauthorized access or automated scraping:
```bash
sudo ln -sf /etc/nginx/sites-available/maintenance.conf /etc/nginx/sites-enabled/examguard.conf
sudo systemctl reload nginx
```

### Phase 2: Immediate Credential Revocation
1. **Supabase Database & Storage:**
   - Log in to the Supabase Dashboard.
   - Navigate to **Project Settings > API**.
   - Click **Rotate Service Role Secret** and **Rotate Anon Key**.
   - This immediately severs all access via old keys.
2. **Invalidate All Active User Sessions:**
   - Change `JWT_SECRET` in `.env` to a completely new 64-character random string.
   - All currently distributed JWT tokens become immediately invalid.

### Phase 3: Cryptographic Re-Keying
1. Generate new RSA key-wrapping and RSA-PSS signing pairs.
2. Re-encrypt stored AES keys using the new wrapping public key.
3. Re-sign ciphertext archives using the new signing private key.

### Phase 4: Forensic Audit Trail Review
Query `audit_logs` for any anomalies during the suspected compromise window:
```sql
SELECT 
    created_at, 
    user_id, 
    action, 
    details, 
    ip_address 
FROM audit_logs 
WHERE created_at >= NOW() - INTERVAL '48 HOURS'
  AND (action LIKE '%DOWNLOAD%' OR action LIKE '%KEY%' OR action LIKE '%ADMIN%')
ORDER BY created_at DESC;
```

### Phase 5: Production Restoration
1. Update `Backend/.env` with new secrets and key paths.
2. Execute `pm2 restart ecosystem.config.js`.
3. Verify probes (`/api/health` and `/api/health/ready`).
4. Re-enable Nginx production site and reload.

---

## 6. Forward-Looking Enterprise Hardware & Cloud KMS Roadmap

For enterprise-scale, regulated academic environments requiring FIPS 140-2 Level 3 compliance:

1. **AWS KMS / Google Cloud KMS Integration:**
   - Transition file-based RSA key wrapping to an asymmetric KMS CMK (`KMS:Encrypt` / `KMS:Decrypt`).
   - The private key never leaves the secure Hardware Security Module (HSM).
   - Node.js invokes the KMS SDK to wrap/unwrap the AES-256 session key.

2. **HashiCorp Vault Secret Management:**
   - Store Supabase service-role credentials and JWT secrets inside a dynamic HashiCorp Vault KV v2 engine.
   - Inject secrets as ephemeral environment variables during container or systemd startup via Vault Agent.
