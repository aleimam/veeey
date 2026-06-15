# Veeey — Deployment & Staging Runbook

Get the verified codebase (P0–P15) running where you and your team can use it.
Two stages: **(1) push to GitHub**, **(2) stand up a staging environment**
(Vercel + managed Postgres). Everything external is env-gated and off by default,
so a minimal staging deploy needs only **three** environment variables.

Prerequisites: Node ≥ 20, a GitHub account, a Vercel account, and a managed
Postgres (Neon or Supabase free tier are fine).

---

## 1. Push to GitHub (one-time)

The repo is committed locally (4 commits on `master`) but has **no remote**.
`gh` isn't installed here, so create the repo in your account, then push.

1. On GitHub: **New repository** → name `veeey` → **Private** → **do not** add a
   README/.gitignore/license (the repo already has them; an extra commit causes a
   conflict).
2. From `C:\Claude\eCommerce\veeey`:

   ```bash
   git remote add origin https://github.com/<you>/veeey.git
   git push -u origin master
   ```

   (If your default-branch policy prefers `main`: `git branch -M main && git push -u origin main`.)

> Nothing sensitive ships: `.env`/`.env.local` are git-ignored, only `.env.example`
> is tracked, and there is no real customer data in the repo (synthetic seeds only).
> CI (`.github/workflows/ci.yml`) runs tsc + lint + tests + build on every push.

---

## 2. Stand up staging

### 2a. Provision Postgres

Create a Postgres database (Neon/Supabase) and copy its connection string
(include `?sslmode=require`). This becomes `DATABASE_URL`.

### 2b. Apply the schema + (optional) seed

From your machine, pointing at the new DB:

```bash
# apply all committed migrations (no data)
DATABASE_URL="postgres://…?sslmode=require" npx prisma migrate deploy

# OPTIONAL — load the synthetic catalog/tiers/shipping/admin user for a usable demo
DATABASE_URL="postgres://…?sslmode=require" npm run db:seed
```

The seed creates an admin login (`admin@veeey.test` / `Admin12345!`) and a small
synthetic catalog. **Never seed a database that will hold real data.**

### 2c. Deploy on Vercel

1. **Vercel → Add New → Project → Import** your `veeey` repo. It auto-detects
   Next.js; no build-command overrides needed (`postinstall` runs `prisma generate`).
2. Add the environment variables below (Project → Settings → Environment Variables).
3. **Deploy.** Open the URL → you should see the bilingual storefront.

### 2d. Walk the flows

- Storefront: `/` → `/products` → a product page → add to cart → `/checkout`.
- Admin: `/en/admin` (sign in with the seeded admin) → Orders, Inventory, Analytics.
- Switch locale to `/ar` to confirm RTL.

---

## Environment variables

### Required (minimal staging)

| Var | Notes |
|---|---|
| `DATABASE_URL` | Postgres connection string (`?sslmode=require`). |
| `AUTH_SECRET` | Generate with `npx auth secret`. Auth.js session signing. |
| `NEXT_PUBLIC_SITE_URL` | Public base URL, e.g. `https://veeey-staging.vercel.app` (feeds, sitemap, emails). |

That's enough for a working storefront + admin. Everything below is optional and
**off until set** — turn them on one at a time and verify each.

### Optional — turn on per feature

| Feature | Vars |
|---|---|
| AI (quizzes, review summaries) | `ANTHROPIC_API_KEY` |
| Transactional email | `RESEND_API_KEY`, `EMAIL_FROM` |
| Web push | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |
| Analytics | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_CLARITY_ID` |
| Bot protection | `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY`, `RECAPTCHA_MIN_SCORE` |
| Social login | `AUTH_GOOGLE_ID/SECRET`, `AUTH_FACEBOOK_*`, `AUTH_APPLE_*`, `AUTH_TWITTER_*` |
| AI-MCP read API | `MCP_API_SECRET` (unset = `/api/mcp/*` returns 503) |
| Payments (later) | `KASHIER_API_KEY`, `OPAY_*` |

### Keep OFF in staging (gated phases)

| Var | Keep |
|---|---|
| `INTEGRATION_ENABLED` | `0` — YeldnIN integration stays disabled until the contract is re-baselined. |
| `TRANSITION_MIRROR` | unset — WooCommerce parallel-run (P16) is cutover-only. |

---

## Background worker (optional)

`pg-boss` powers async notifications + the wishlist-alert sweep, but the app
**works without it** (jobs run inline as a fallback). Vercel's serverless model
doesn't host long-running workers, so when you want true async + the recurring
sweep, run the worker on a small always-on host (Railway/Render/a VM):

```bash
DATABASE_URL=… npm run worker
```

---

## Post-deploy smoke checklist

- [ ] Home, a product page, search, and `/ar` (RTL) all render.
- [ ] Admin sign-in works; Orders/Inventory/Analytics load.
- [ ] `GET /sitemap.xml`, `/robots.txt`, `/feeds/google.xml` return XML.
- [ ] `GET /api/mcp/catalog` → 503 (until `MCP_API_SECRET` is set) — confirms gating.
- [ ] Place a test order end-to-end; check it in admin Orders.
- [ ] (If email/push/AI keys set) trigger each once and confirm delivery.

---

## Notes

- **Migrations on deploy:** run `prisma migrate deploy` against the prod DB before/at
  release (it's not auto-run by the Vercel build). Add it to your release step once
  you have a pipeline.
- **Prisma:** uses the driver adapter + `DATABASE_URL` (read via `prisma.config.ts`);
  the build itself doesn't need a live DB, runtime does.
- **Custom domain:** when ready, point it in Vercel and update `NEXT_PUBLIC_SITE_URL`.
- **Product images:** add CDN hostnames to `images.remotePatterns` in `next.config.ts`
  before serving migrated product images.

---

## Self-hosting on a VPS (CWP) — alternative to Vercel

Veeey runs well self-hosted, and for this app it's arguably a better fit: the
**pg-boss worker** wants a persistent process and **Postgres can live on the same
box**. The model: Next.js runs as a long-lived Node process on `:3100` (kept alive
by **PM2**), **Nginx** reverse-proxies your domain to it, and CWP issues SSL.
Next.js is **not** served like a PHP site — CWP's job here is just the proxy + TLS.

### A. Install Node 20+ (alongside CWP's PHP stack)

```bash
# NodeSource (CentOS/AlmaLinux) — or use nvm
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
node -v   # >= 20
sudo npm i -g pm2
```

### B. PostgreSQL on the VPS

```bash
sudo dnf install -y postgresql-server postgresql-contrib
sudo postgresql-setup --initdb
sudo systemctl enable --now postgresql
sudo -u postgres psql -c "CREATE USER veeey WITH PASSWORD 'STRONG_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE veeey OWNER veeey;"
```
In `pg_hba.conf` ensure local TCP uses `scram-sha-256`/`md5` (so a password URL
works), then `sudo systemctl restart postgresql`.
→ `DATABASE_URL="postgresql://veeey:STRONG_PASSWORD@localhost:5432/veeey"`

### C. App setup

```bash
cd /home/veeey   # or any deploy dir
git clone https://github.com/aleimam/veeey.git app && cd app
cp .env.example .env
# edit .env — at minimum:
#   DATABASE_URL=postgresql://veeey:STRONG_PASSWORD@localhost:5432/veeey
#   AUTH_SECRET=$(npx auth secret)        # paste the generated value
#   NEXT_PUBLIC_SITE_URL=https://veeey.com
npm ci
npx prisma migrate deploy
npm run db:seed          # optional synthetic demo data (skip for real data)
npm run build
```

### D. Run under PM2 (app + worker, boot-persistent)

```bash
pm2 start npm --name veeey        -- start        # next start -p 3100
pm2 start npm --name veeey-worker -- run worker    # pg-boss async + alert sweep
pm2 save
pm2 startup    # run the command it prints (registers a systemd unit)
```
The app listens on `127.0.0.1:3100` only — do **not** open 3100 in the firewall;
traffic reaches it through Nginx. Open 80/443 only.

### E. Nginx reverse proxy (recommended)

> ⚠️ **CWP regenerates vhost configs**, so don't hand-edit the managed vhost — it
> gets overwritten. Use CWP's **Nginx Reverse Proxy** / custom-config section, or
> drop the block in a conf.d include CWP doesn't manage. Point the domain's docroot
> proxy at the Node port:

```nginx
server {
    listen 80;
    server_name veeey.com www.veeey.com;

    client_max_body_size 25m;            # product image / review media uploads
    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;

    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Then enable **AutoSSL/Let's Encrypt** for the domain in CWP (it rewrites this to
443 + redirects 80→443).

**Apache fallback** (if you proxy via Apache `mod_proxy` instead — enable
`mod_proxy` + `mod_proxy_http`, add to the domain vhost via CWP custom config):

```apache
ProxyPreserveHost On
ProxyPass        / http://127.0.0.1:3100/
ProxyPassReverse / http://127.0.0.1:3100/
RequestHeader set X-Forwarded-Proto "https"
```

### F. Redeploy (each release)

```bash
cd /home/veeey/app
git pull
npm ci
npx prisma migrate deploy
npm run build
pm2 reload veeey && pm2 reload veeey-worker
```

### What you own on a VPS

OS + Node + Postgres updates, PM2/process health, SSL renewal (CWP automates),
backups (`pg_dump` on a cron), and running the redeploy steps. No usage fees, full
control, app + DB + worker co-located.
