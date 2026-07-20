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
git checkout -- package-lock.json   # npm install dirties it; a dirty tree makes `git pull`
                                    # silently FAIL to advance HEAD while build/reload still
                                    # run — you'd redeploy the OLD code. Never skip this.
git status --short                  # ⚠️ ALSO clear stray UNTRACKED files (e.g. a script you
                                    # scp'd for a one-off): `git pull` aborts rather than
                                    # overwrite them, and the build then typechecks the stale
                                    # copy. This bit us on 2026-07-20.
git pull
npm install                          # also re-runs `prisma generate` (postinstall) — required
                                     # whenever the schema changed, or the client goes stale
npx prisma migrate deploy

# ⚠️ NEVER pipe the build (`npm run build | tail -4`): $? comes from `tail`, so a FAILED build
# reads as success and you restart onto a broken tree. Gate the restart on the exit code:
if npm run build > /tmp/build.log 2>&1; then
  pm2 restart veeey veeey-worker --update-env
else
  echo "BUILD FAILED — not restarting"; tail -25 /tmp/build.log; exit 1
fi
git rev-parse --short HEAD           # confirm it matches the commit you pushed
```

Verify before calling it done — the app listens on **:3100** behind nginx (not :3000, which answers
nothing and looks like an outage):

```bash
for p in /api/health /en /ar /en/cart; do
  printf "%-14s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3100$p)"
done
curl -s -o /dev/null -w 'public %{http_code}\n' https://veeey.com/en
```

More gotchas (firewall bans, ad-hoc DB queries, health checks): see the
"Deploy gotchas" section in `PROJECT_STATUS.md`.

### What you own on a VPS

OS + Node + Postgres updates, PM2/process health, SSL renewal (CWP automates),
backups (`pg_dump` on a cron), and running the redeploy steps. No usage fees, full
control, app + DB + worker co-located.

---

# Second deployment — veeey.net (independent store, co-hosted)

> **veeey.net is a SEPARATE, independent Veeey store** running this same codebase: its own
> Postgres, customers and orders — **NOT synced with veeey.com** (owner's explicit choice over a
> shared backend). Deployed **2026-07-15**. Both are test sites for now, so it is **co-hosted** on
> the box that also runs the `egyptvitamins.net` WordPress copy, to save cost. Shared blast
> radius is accepted while both are test.
>
> **Everything below differs from the veeey.com runbook above — read it before touching that box.**

## Box & access

- Host **178.105.234.110** — AlmaLinux 9.8, 4 cores / 8 GB RAM, hostname `YeldnIN`.
  Runs **CyberPanel + OpenLiteSpeed (OLS) + MariaDB**, serving `egyptvitamins.net` (WordPress)
  and `veeey.net` side by side.
- SSH uses a **separate config file**, not the default one:
  ```bash
  ssh -F ~/.ssh_ev/config evnew          # this box (root, key ~/.ssh_ev/id_rsa)
  ssh -F ~/.ssh_ev/config evnet          # 46.62.135.225 — the OTHER Egypt Vitamins box
  ```
  The aliases live in `C:\Users\<you>\.ssh_ev\config`. ⚠️ **This is per-Windows-user** — a new
  account must recreate `~/.ssh_ev/` (config + key) or its own key in the box's
  `/root/.ssh/authorized_keys`. Plain `ssh evnew` will NOT resolve.

## How it is wired (differs from veeey.com!)

| | veeey.com | **veeey.net** |
|---|---|---|
| App path | `/home/veeey/app` | **`/opt/veeey`** |
| pm2 processes | `veeey`, `veeey-worker` | **`veeey-net`, `veeey-net-worker`** |
| Web server | nginx | **OpenLiteSpeed reverse proxy** |
| Start command | `next start` | **`node server.js`** ← see the Origin bug below |
| Code delivery | `git pull` | **git-archive tarball** (no git remote on the box) |
| DB | Postgres @ localhost | own **Postgres 13** @ localhost:5432 (DB `veeey`, role `veeey`, `pg_trgm` pre-created) |

- `.env` at **`/opt/veeey/.env`** (chmod 600) — own `AUTH_SECRET`, `DATABASE_URL`,
  `NEXT_PUBLIC_SITE_URL=https://veeey.net`, `JOBS_DISABLED=0`, plus `AUTH_URL`/`AUTH_TRUST_HOST`.
  It is gitignored, so a tarball redeploy leaves it intact.
- Node binds **127.0.0.1:3100** (not firewall-open). OLS proxies to it via
  `/usr/local/lsws/conf/vhosts/veeey.net/vhost.conf`:
  ```
  extprocessor veeeyapp { type proxy; address 127.0.0.1:3100 }
  context / { type proxy; handler veeeyapp }
  ```
  (backup kept at `vhost.conf.bak.pre-proxy`; the `/.well-known/acme-challenge` context is
  preserved for SSL). Restart OLS: `/usr/local/lsws/bin/lswsctrl restart`.
  ⚠️ **A CyberPanel panel action can regenerate `vhost.conf` and drop the proxy** — if veeey.net
  starts serving the placeholder PHP page, re-append those two blocks.
- SSL issued by CyberPanel (Let's Encrypt at `/etc/letsencrypt/live/veeey.net/`).

## ⚠️ The Origin bug — why this box runs `server.js`, not `next start`

**Do not "simplify" this back to `next start`. It will break login and registration.**

**Symptom:** login/register page GET is fine, but submitting the form 500s with
`TypeError: Invalid URL`.

**Root cause:** OLS injects a **duplicate `Origin` request header**. Every proxied request reaches
Node with *two* `Origin: https://veeey.net` headers (the client's + one OLS adds — confirmed with a
header-echo capture; not HTTP/2-specific). Node joins duplicates into
`"https://veeey.net, https://veeey.net"`, which crashes **Next's Server-Action CSRF origin check**
(`new URL(origin)`).

**What did NOT fix it** (don't retry these):
- `AUTH_URL` — fixes the NextAuth *route handler*, not the server-action check. (Still set; harmless.)
- An Origin-collapse in `proxy.ts` middleware — Next validates the action Origin *before* middleware runs.
- OLS `RequestHeader set Origin` in the vhost — OLS ignores it for proxy backends.

**The actual fix:** a custom Node server at **`/opt/veeey/server.js`** that wraps Next and dedupes
`req.headers.origin` at the raw socket before Next reads it. The app runs
`pm2 start server.js --name veeey-net`. **Any rebuild/redeploy must keep using `server.js`.**

Harmless leftovers that may be cleaned up: the `proxy.ts` origin guard, and the ineffective
`extraHeaders RequestHeader set Origin` in the vhost — both no-ops now.

## Redeploy (no git remote — tarball)

From the local repo (`C:\Claude\eCommerce\veeey`):

```bash
# 1. Pack the committed tree
git archive --format=tar.gz -o /c/Users/<you>/AppData/Local/Temp/veeey-deploy.tar.gz HEAD

# 2. Ship it.  Use the /c/Users/... MSYS path form — scp misreads "C:" as a hostname.
scp -F ~/.ssh_ev/config /c/Users/<you>/AppData/Local/Temp/veeey-deploy.tar.gz evnew:/tmp/

# 3. On the box
ssh -F ~/.ssh_ev/config evnew
cd /opt/veeey
tar xzf /tmp/veeey-deploy.tar.gz -C /opt/veeey     # .env AND server.js are untracked → survive
npm install                                        # postinstall runs prisma generate
npx prisma migrate deploy

# Same guard as veeey.com — never restart onto a failed build.
if npm run build > /tmp/build.log 2>&1; then
  pm2 restart veeey-net veeey-net-worker --update-env    # restart, NOT reload (see below)
else
  echo "BUILD FAILED — not restarting"; tail -25 /tmp/build.log; exit 1
fi
```

Then verify — including the two things unique to this box:

```bash
pm2 describe veeey-net | grep -i 'script path'          # MUST be /opt/veeey/server.js
for p in /api/health /en /ar /en/cart; do
  printf "%-14s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3100$p)"
done
curl -s  -o /dev/null -w 'veeey.net    %{http_code}\n' https://veeey.net/en
curl -sL -o /dev/null -w 'wordpress    %{http_code}\n' https://egyptvitamins.net/   # co-tenant
```

First deploy was commit `dad59dc`; last redeploy **2026-07-20 at `56bd6c7`** — applied the 64th
migration `20260720010000_backup_module` (63 → 64) and added `BACKUP_ARCHIVE_PREFIX=veeey-net-backup-`
to `/opt/veeey/.env`. Verified after restart: pm2 runs `server.js`, health + `/en` + `/ar` + `/en/cart`
200, `veeey.net/en` 200, WordPress co-tenant 200.
⚠️ `pm2 reload veeey-net-worker` does NOT actually restart the worker (uptime keeps counting) — use
`pm2 restart` for it. Consider adding a git remote/clone on the box later to make this a normal
`git pull` deploy.

## Off-site backups (both stores)

Admin UI `/admin/backup`; full spec + every hard-won gotcha in **`C:\Claude\YeldnIN\BACKUP.md`**.
Destination is a shared Hetzner Storage Box — **one sub-account per app**, so isolation comes from the
sub-account, not the path.

| | veeey.com | veeey.net |
|---|---|---|
| Sub-account | `u635384-sub4` (`/veeey.com/`) | **`u635384-sub2`** (`/veeey.net/`) |
| Host | `u635384-sub4.your-storagebox.de` | `u635384-sub2.your-storagebox.de` |
| Port | **23** (not 22) | **23** |
| Base path | `/home` | `/home` |
| Archive prefix | `veeey-backup-` (default) | `veeey-net-backup-` (`BACKUP_ARCHIVE_PREFIX` in `.env`) |
| Status | ✅ live, drill passed 2026-07-20 | ⏳ deployed, **password not yet entered** |

**The three that will catch you out**

1. **A sub-account sees its base dir as `/home`, not as `/veeey.com/`.** Both stores are therefore
   configured with the *identical* folders `/home/{hourly,daily,weekly,manual}` and still land in
   different real directories. Writing `/veeey.com/hourly` creates a **nested** wrong folder and the
   run still reports SUCCESS.
2. **Port 22 also answers but is chrooted** — the same path resolves elsewhere and silently nests.
   Stay on 23.
3. **Changing `BACKUP_ARCHIVE_PREFIX` on a store that already has archives orphans them** — the parser
   stops recognising the old names, so they are never pruned and retention restarts from zero. Only
   set it on a store whose destination is still empty.

**Verify (never trust the status field alone)**

```bash
cd /home/veeey/app            # or /opt/veeey on the .net box
npx tsx scripts/backup-verify.ts --list   # lists every level's remote folder + archive counts
npx tsx scripts/backup-verify.ts          # full drill: db archive → restore → row counts vs live
npx tsx scripts/backup-verify.ts --full   # same, but the FULL archive (also proves uploads/)
```

The drill downloads an archive, checks it byte-exact, verifies the manifest doesn't overclaim,
restores into a **throwaway** database and compares row counts against live, then drops it. It needs
`sudo -u postgres` because the app role deliberately lacks CREATEDB. Default is the db-only archive on
purpose — same `pg_dump` as the full one, without pulling ~1 GB across a live server's uplink.

Last drill (veeey.com, 2026-07-20): 110 tables restored, Product/Customer/Order/OrderItem/Lot/Brand
counts **exactly equal to live**. Small deltas are normal for a point-in-time snapshot; investigate
only large gaps or an unexpectedly empty table.

## Current state & open items

- **Catalog IS populated (2026-07-19).** The real egyptvitamins.net catalog was imported via the
  **net-sync ETL** — **2,703 products, 3,584 lots, 724 brands, 60 categories + 13,475 images** — and a
  cron keeps it fresh. See "Catalog sync (net-sync)" below and **`../VEEEY_NET_MIGRATION.md`**.

### Catalog sync (net-sync) — veeey.net only
DB-direct ETL from the co-hosted egyptvitamins.net WordPress (ATUM lots + WPML EN/AR). Code lives in
the repo (`src/lib/net-sync/*`, `scripts/net-sync/*`); runs ON THE BOX via `tsx`. **Env-gated by
`NET_SYNC_MYSQL_URL` so it is completely inert on veeey.com** (no source env there).
- **Manual run** (from `/opt/veeey`): `bash scripts/net-sync/sync-cron.sh` — the wrapper builds the WP
  DSN from wp-config via `wp eval` (password never stored), then runs the idempotent importer with
  delete-detection. Products/stock only; add `--images` for the image copy.
  - Or directly: `NET_SYNC_MYSQL_URL=<mysql://…/egyptvit_website> NET_SYNC_WP_PREFIX=SFPgx_ npx tsx
    scripts/net-sync/run.ts [--commit|--limit N]` (dry-run is the default — writes nothing).
- **Schedule** (installed in root's crontab; header of `sync-cron.sh` has the install recipe).
  All modes are the same wrapper with a flag; every import is idempotent (re-run = no-op):
  - `*/10 * * * *` products + lots + stock + delete-detection (full hash-diff scan; ~40 s).
  - `*/2 * * * *` `--writeback` — NetStockOutbox drain → WP stock deltas (gated `NET_SYNC_WRITEBACK`).
  - `15 * * * *` `--customers` — registered customers + addresses + spend/tier refresh (`run-customers.ts`).
  - `30 3 * * *` `--images` daily image refresh (`run-images.ts`).
  - `50 3 * * *` `--enrich` daily tags + attributes (`run-enrich.ts`).
  - `10 4 * * *` `--reviews` daily approved-review import (`run-reviews.ts`).
  - `20 4 * * *` `--orders` daily read-only order-history top-up (`run-orders.ts`; skip-existing on
    `Order.legacyWpId`, bypasses transitionOrder → no loyalty/stock/notification side-effects).
  - `flock` guards against overlap; **WP is the stock master.** A source read that returns < 50% of the
    live product set REFUSES to archive (safety floor) — a transient DB error can't wipe the catalog.
- **Customers** — ongoing one-way pull of registered egyptvitamins.net customers (name / email /
  phone / addresses + a read-only **lifetime-spend snapshot** from `wc_orders.total_amount` over the
  store's delivered statuses → drives the tier). **No passwords** (OTP login). `15 * * * *` cron
  (`sync-cron.sh --customers`); idempotent on `Customer.legacyWpId`, matched by email, write-only-on-
  change. PII stays on the box; the CLI prints counts only. Marketing consent OFF (no WP opt-in flag).
  ⚠️ Set real **tier thresholds** on veeey.net (all seeded at 0 → everyone lands top-tier until then;
  the hourly sync auto-corrects once thresholds exist).
- **Writeback (Phase 3)** — the only WRITE to the live WP: veeey.net order stock **deltas** flow back
  so the pull doesn't re-inflate sold stock. `transitionOrder` enqueues into the `NetStockOutbox`
  ledger (exactly-once by unique key; confirm-triggered, restore-on-cancel); a `*/2 * * * *` cron
  (`sync-cron.sh --writeback`) drains it via wp-cli `wc_update_product_stock` — deltas only, never
  absolute, so staff stock edits in WP are never clobbered. **Gate: `NET_SYNC_WRITEBACK` in
  `/opt/veeey/.env`** — **`on` since 2026-07-19** (real writes; live-fire verified with a net-zero
  SALE+RESTORE round trip) / `dry` (ledger records, drain logs only) / absent (veeey.com — fully
  inert). Failed rows retry ×5 then park as FAILED (visible in the log + `NetStockOutbox` table).
- **Monitor:** `tail -f /opt/veeey/net-sync.log`. **The `net/` uploads (`public/uploads/net/`, 1.8 GB)
  and the crontab are box-local** — a tarball redeploy keeps the uploads (gitignored) but re-check the
  crontab survived (it's independent of the app). ⚠️ **This runs only where `NET_SYNC_MYSQL_URL` resolves;
  do NOT add that env or this cron on veeey.com.**
- **Admin user exists:** `aleimam@live.com`, role `super_admin`. Password login works end-to-end.
  **OTP login needs an SMS provider** configured in `/admin/providers` (none on veeey.net yet) —
  password is the way in for now. To grant another admin, set `User.roleId` to a Role id
  (`super_admin`/`admin` = full).
- ⚠️ **RBAC gotcha — the "Sales" department trap (bites every fresh Veeey store).** The
  `departments` migration seeds an empty **Sales** department, and TEAM RBAC gates on department
  membership: **a membership OVERRIDES the legacy role** (`auth.ts` jwt:
  `depts.length ? unionPerms : role.perms`). If an owner account gets added to Sales (0 perms),
  its `super_admin` role is masked and admin pages vanish. Fix:
  `DELETE FROM "DepartmentMember"` for that user (→ 0 memberships → role fallback), **then the
  user must sign out and back in** (permissions are JWT-cached at login).
  **Keep owner accounts OUT of departments**, or give the department full permissions.
- **Security owed:** that box's root had **4 plaintext passwords** committed in the
  egyptvitamins.net session's `.claude/settings.local.json` — **rotate them and move to key-only
  SSH**. (Same class as the veeey.com `/root/.ssh/id_rsa` exposure still owed — see
  PROJECT_STATUS.md → "Open security action".)
- Verified live 2026-07-15: `https://veeey.net` → 307 → `/en` 200, `/ar` 200, `/en/products` 200
  (6 sample products), `/en/admin` 307 → login. The `egyptvitamins.net` co-tenant still serves 200.
