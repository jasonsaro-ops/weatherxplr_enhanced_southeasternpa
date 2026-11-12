# WEATHERXPLR · SE-PA Dispatch

Maverick-style board + **Storm 3D** (Three.js) with optional **Cloudflare Worker**.

## Automatic Worker deploy (GitHub Actions)

On every push to `main` that changes `worker/**`, GitHub Actions deploys the Worker with Wrangler.

### One-time setup

**1. Cloudflare API token**
1. [Cloudflare → API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. **Create Token** → use template **Edit Cloudflare Workers** (or custom: Account → Workers Scripts → Edit)
3. Copy the token (shown once)

**2. GitHub secret**
1. GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**
   - Name: `CLOUDFLARE_API_TOKEN`
   - Value: paste the token
3. (Only if deploy fails with account errors) add `CLOUDFLARE_ACCOUNT_ID` = your account ID from CF dashboard URL / overview

**3. Push this repo** (including `.github/workflows/deploy-storm3d-worker.yml` and `worker/`)

**4. Run the workflow**
- Push a change under `worker/`, or
- **Actions** tab → **Deploy Storm 3D Worker** → **Run workflow**

**5. Get the Worker URL**
- Cloudflare → **Workers & Pages** → **weatherxplr-storm3d** → enable **workers.dev** if needed  
- URL looks like: `https://weatherxplr-storm3d.<subdomain>.workers.dev`

**6. Point the board (once)**  
In `index.html` set:

```html
window.STORM3D_WORKER_URL = "https://weatherxplr-storm3d.<subdomain>.workers.dev";
```

Commit & push. After that, Storm 3D loads the Worker **automatically** — no “Set Worker URL” needed.

Test: `https://weatherxplr-storm3d.<subdomain>.workers.dev/?lat=40.08&lon=-75.30` → JSON.

### Without a Worker
Storm 3D still runs in the browser (same heuristics). Worker only adds edge fetch + cache.

## Files
| Path | Role |
|------|------|
| `index.html` / `app.js` | Board + Storm 3D UI |
| `worker/storm3d.js` | Worker source |
| `worker/wrangler.toml` | Worker name / entry |
| `.github/workflows/deploy-storm3d-worker.yml` | Auto-deploy |

## Board
GitHub Pages is fine for the UI. Worker is separate on `*.workers.dev`.
