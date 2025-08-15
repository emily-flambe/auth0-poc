# Auth0 POC

React + Cloudflare Worker with Auth0 authentication.

## Setup

```bash
npm run install:all
cp frontend/.env.example frontend/.env
cp worker/.dev.vars.example worker/.dev.vars
# Add your Auth0 credentials to both files
```

## Development

```bash
npm run dev
```
- Frontend: http://localhost:3000
- API: http://localhost:8787

## Deploy

```bash
npm run deploy
```

Deployed at: https://auth0-poc.emily-cogsdill.workers.dev