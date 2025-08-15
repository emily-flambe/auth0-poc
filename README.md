# Auth0 POC

Minimal Auth0 proof-of-concept with React frontend and Cloudflare Worker backend.

## Project Structure

```
auth0-poc/
├── frontend/          # React app with Auth0 SDK
│   ├── src/          # React components
│   ├── .env          # Frontend config (gitignored)
│   └── .env.example  # Frontend config template
│
└── worker/           # Cloudflare Worker API
    ├── src/          # Worker code
    ├── .dev.vars     # Worker config (gitignored)
    └── .dev.vars.example  # Worker config template
```

## Quick Start

1. **Install dependencies:**
   ```bash
   npm run install:all
   ```

2. **Configure Auth0:**
   - Copy `frontend/.env.example` to `frontend/.env`
   - Copy `worker/.dev.vars.example` to `worker/.dev.vars`
   - Fill in your Auth0 credentials

3. **Run both services:**
   ```bash
   npm run dev
   ```
   - Frontend: http://localhost:3000
   - Worker API: http://localhost:8787

## Configuration

### Frontend (.env)
- `VITE_AUTH0_DOMAIN` - Your Auth0 domain
- `VITE_AUTH0_CLIENT_ID` - Your Auth0 app client ID
- `VITE_AUTH0_AUDIENCE` - Your Auth0 API identifier

### Worker (.dev.vars)
- `AUTH0_DOMAIN` - Your Auth0 domain (same as frontend)
- `AUTH0_AUDIENCE` - Your Auth0 API identifier (same as frontend)

## Deployment

Deploy the Worker to Cloudflare:
```bash
npm run deploy:worker
```

The Worker is already deployed at: https://auth0-poc.emily-cogsdill.workers.dev