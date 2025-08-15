# Auth0 + Cloudflare Workers Implementation Guide

## Overview

This guide provides a complete implementation pattern for integrating Auth0 authentication with Cloudflare Workers. The architecture supports both API-only and full-stack applications with static asset serving.

## Architecture Components

### Core Stack
- **Authentication Provider**: Auth0 for identity management
- **Backend**: Cloudflare Worker with JWT verification using `jose` library
- **Frontend** (optional): React/Vue/Angular app with Auth0 SDK
- **Asset Serving**: Cloudflare KV Asset Handler for static files
- **Development**: Vite dev server with proxy configuration

### Key Features
- JWT token verification without Node.js dependencies
- CORS-enabled API endpoints
- Static asset serving from Worker
- Client-side routing support
- Development and production deployment paths

## Step-by-Step Implementation

### Step 1: Auth0 Configuration

1. **Create Auth0 Application**
   - Type: Single Page Application (for frontend) or Machine-to-Machine (for API-only)
   - Note these values:
     - Domain: `your-tenant.auth0.com`
     - Client ID: `your-client-id`
     - Client Secret: (for confidential clients only)

2. **Configure Auth0 Settings**
   ```
   Allowed Callback URLs: http://localhost:3000, https://your-app.workers.dev
   Allowed Logout URLs: http://localhost:3000, https://your-app.workers.dev
   Allowed Web Origins: http://localhost:3000, https://your-app.workers.dev
   ```

3. **Create API in Auth0** (Required for JWT audience validation)
   - Go to APIs section
   - Create new API with identifier: `https://your-api-identifier`
   - This becomes your `audience` parameter

### Step 2: Cloudflare Worker Setup

#### Project Structure
```
your-app/
├── worker/
│   ├── src/
│   │   ├── index.js       # Main worker entry
│   │   └── auth.js        # JWT verification logic
│   ├── wrangler.toml      # Worker configuration
│   ├── package.json
│   └── .dev.vars.example  # Environment template
└── frontend/              # Optional frontend
    ├── src/
    ├── package.json
    └── .env.example
```

#### Worker Dependencies (`worker/package.json`)
```json
{
  "name": "auth0-worker",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "deploy": "wrangler deploy",
    "dev": "wrangler dev",
    "start": "wrangler dev"
  },
  "devDependencies": {
    "wrangler": "^4.30.0"
  },
  "dependencies": {
    "jose": "^6.0.12",
    "@cloudflare/kv-asset-handler": "^0.4.0"
  }
}
```

#### JWT Verification Module (`worker/src/auth.js`)
```javascript
import { jwtVerify, createRemoteJWKSet } from 'jose';

// Cache JWKS to avoid rate limiting
let jwksCache = null;

export async function verifyAuth0Token(token, env) {
  try {
    // Remove 'Bearer ' prefix if present
    const jwt = token.startsWith('Bearer ') ? token.slice(7) : token;
    
    // Initialize JWKS cache if not exists
    if (!jwksCache) {
      const jwksUri = `https://${env.AUTH0_DOMAIN}/.well-known/jwks.json`;
      jwksCache = createRemoteJWKSet(new URL(jwksUri));
    }
    
    // Verify JWT with Auth0's public keys
    const { payload } = await jwtVerify(jwt, jwksCache, {
      issuer: `https://${env.AUTH0_DOMAIN}/`,
      audience: env.AUTH0_AUDIENCE,
      algorithms: ['RS256']
    });
    
    return { valid: true, payload };
  } catch (error) {
    console.error('JWT verification failed:', error.message);
    return { valid: false, error: error.message };
  }
}

// Middleware for protected routes
export async function requireAuth(request, env) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader) {
    return new Response('Unauthorized: No token provided', { status: 401 });
  }
  
  const verification = await verifyAuth0Token(authHeader, env);
  
  if (!verification.valid) {
    return new Response(`Unauthorized: ${verification.error}`, { status: 401 });
  }
  
  // Return decoded user information
  return verification.payload;
}
```

#### Main Worker (`worker/src/index.js`)
```javascript
import { verifyAuth0Token, requireAuth } from './auth';
import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import manifestJSON from '__STATIC_CONTENT_MANIFEST';
const assetManifest = JSON.parse(manifestJSON);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // CORS headers for API endpoints
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    };
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    try {
      // API Routes
      if (url.pathname.startsWith('/api/')) {
        
        // Protected endpoint example
        if (url.pathname === '/api/protected') {
          const authResult = await requireAuth(request, env);
          
          if (authResult instanceof Response) {
            return authResult;
          }
          
          return new Response(JSON.stringify({
            message: 'Protected data accessed successfully',
            timestamp: new Date().toISOString(),
            user: {
              sub: authResult.sub,
              email: authResult.email,
              name: authResult.name
            }
          }), {
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
        
        // Public endpoint example
        if (url.pathname === '/api/public') {
          return new Response(JSON.stringify({
            message: 'Public endpoint - no auth required',
            timestamp: new Date().toISOString()
          }), {
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
        
        // Health check
        if (url.pathname === '/api/health') {
          return new Response(JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString()
          }), {
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
        
        return new Response('API endpoint not found', { status: 404 });
      }
      
      // Serve static assets (if frontend is deployed)
      try {
        return await getAssetFromKV(
          {
            request,
            waitUntil: ctx.waitUntil.bind(ctx),
          },
          {
            ASSET_NAMESPACE: env.__STATIC_CONTENT,
            ASSET_MANIFEST: assetManifest,
            mapRequestToAsset: (request) => {
              // Support client-side routing
              const url = new URL(request.url);
              if (!url.pathname.includes('.')) {
                return new Request(`${url.origin}/index.html`, request);
              }
              return request;
            },
          }
        );
      } catch (e) {
        // Fallback to index.html for client-side routing
        try {
          const notFoundResponse = await getAssetFromKV(
            {
              request: new Request(`${url.origin}/index.html`, request),
              waitUntil: ctx.waitUntil.bind(ctx),
            },
            {
              ASSET_NAMESPACE: env.__STATIC_CONTENT,
              ASSET_MANIFEST: assetManifest,
            }
          );
          return notFoundResponse;
        } catch (finalError) {
          return new Response('Not Found', { status: 404 });
        }
      }
      
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(`Internal Server Error: ${error.message}`, { 
        status: 500,
        headers: corsHeaders
      });
    }
  }
};
```

#### Worker Configuration (`worker/wrangler.toml`)
```toml
name = "your-app-name"
main = "src/index.js"
compatibility_date = "2025-08-13"

[observability]
enabled = true

# For serving frontend assets
[site]
bucket = "../frontend/dist"

# Non-sensitive variables can go here
# [vars]
# API_VERSION = "v1"

# Sensitive variables use .dev.vars locally and wrangler secret for production
```

#### Environment Variables (`worker/.dev.vars.example`)
```env
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://your-api-identifier
```

### Step 3: Frontend Integration (Optional)

#### React Example with Auth0 SDK

**Install Dependencies**
```bash
npm install @auth0/auth0-react
```

**Auth0 Configuration (`frontend/src/auth0-config.js`)**
```javascript
export const auth0Config = {
  domain: import.meta.env.VITE_AUTH0_DOMAIN || "your-tenant.auth0.com",
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID || "your-client-id",
  redirectUri: window.location.origin,
  audience: import.meta.env.VITE_AUTH0_AUDIENCE || "https://your-api-identifier",
  scope: "openid profile email"
};
```

**App Entry (`frontend/src/main.jsx`)**
```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Auth0Provider } from '@auth0/auth0-react';
import App from './App';
import { auth0Config } from './auth0-config';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Auth0Provider
      domain={auth0Config.domain}
      clientId={auth0Config.clientId}
      authorizationParams={{
        redirect_uri: auth0Config.redirectUri,
        audience: auth0Config.audience,
        scope: auth0Config.scope
      }}
      onRedirectCallback={() => {
        window.history.replaceState({}, document.title, window.location.pathname);
      }}
    >
      <App />
    </Auth0Provider>
  </React.StrictMode>
);
```

**API Call with Token (`frontend/src/components/ApiCall.jsx`)**
```javascript
import { useAuth0 } from '@auth0/auth0-react';

const ApiCall = () => {
  const { getAccessTokenSilently } = useAuth0();

  const callProtectedApi = async () => {
    try {
      // Get token with correct audience
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: 'https://your-api-identifier',
          scope: 'openid profile email'
        }
      });
      
      // Make authenticated API call
      const response = await fetch('/api/protected', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Protected data:', data);
    } catch (error) {
      console.error('API call failed:', error);
    }
  };

  return <button onClick={callProtectedApi}>Call Protected API</button>;
};
```

#### Vite Configuration for Development (`frontend/vite.config.js`)
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true
      }
    }
  }
})
```

### Step 4: Development Setup

#### Root Package.json Scripts
```json
{
  "scripts": {
    "install:all": "cd frontend && npm install && cd ../worker && npm install",
    "dev:frontend": "cd frontend && npm run dev",
    "dev:worker": "cd worker && npm run dev",
    "kill:ports": "lsof -ti:3000,8787 | xargs kill -9 2>/dev/null || true",
    "dev": "npm run kill:ports && concurrently \"npm run dev:worker\" \"npm run dev:frontend\"",
    "build": "cd frontend && npm run build",
    "deploy": "npm run build && cd worker && npm run deploy"
  },
  "devDependencies": {
    "concurrently": "^8.2.0"
  }
}
```

#### Environment Files Setup
1. Copy `.dev.vars.example` to `.dev.vars` in worker directory
2. Copy `.env.example` to `.env` in frontend directory
3. Fill in your Auth0 credentials

### Step 5: Deployment

#### Deploy to Cloudflare Workers
```bash
# Set production secrets
cd worker
wrangler secret put AUTH0_DOMAIN
wrangler secret put AUTH0_AUDIENCE

# Build frontend (if applicable)
cd ../frontend
npm run build

# Deploy worker with assets
cd ../worker
wrangler deploy
```

## Common Implementation Patterns

### 1. API-Only Worker (No Frontend)
Remove the static asset serving logic and focus on API endpoints:
```javascript
// Simplified index.js for API-only
export default {
  async fetch(request, env, ctx) {
    // Only handle API routes
    if (!url.pathname.startsWith('/api/')) {
      return new Response('Not Found', { status: 404 });
    }
    // ... API logic
  }
}
```

### 2. Multi-Tenant Configuration
Use environment-specific Auth0 configurations:
```javascript
const getTenantConfig = (env, tenantId) => ({
  domain: env[`AUTH0_DOMAIN_${tenantId}`],
  audience: env[`AUTH0_AUDIENCE_${tenantId}`]
});
```

### 3. Role-Based Access Control (RBAC)
Check permissions in the JWT payload:
```javascript
export async function requirePermission(request, env, permission) {
  const authResult = await requireAuth(request, env);
  
  if (authResult instanceof Response) return authResult;
  
  const permissions = authResult.permissions || [];
  if (!permissions.includes(permission)) {
    return new Response('Forbidden: Insufficient permissions', { status: 403 });
  }
  
  return authResult;
}
```

### 4. Token Refresh Pattern
For long-lived sessions with refresh tokens:
```javascript
// Store refresh tokens securely (KV, D1, etc.)
const refreshAccessToken = async (refreshToken, env) => {
  const response = await fetch(`https://${env.AUTH0_DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: env.AUTH0_CLIENT_ID,
      refresh_token: refreshToken
    })
  });
  
  return response.json();
};
```

## Security Best Practices

### 1. Environment Variables
- **Never commit** `.dev.vars` or `.env` files
- Use `wrangler secret` for production secrets
- Rotate secrets regularly

### 2. CORS Configuration
```javascript
// Restrict origins in production
const corsHeaders = {
  'Access-Control-Allow-Origin': env.ALLOWED_ORIGINS || 'https://your-app.com',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};
```

### 3. Rate Limiting
```javascript
// Implement rate limiting using Cloudflare's rate limiting or custom logic
const rateLimit = async (request, env) => {
  const ip = request.headers.get('CF-Connecting-IP');
  // Implement using KV or Durable Objects
};
```

### 4. Token Validation
- Always validate issuer (iss)
- Always validate audience (aud)
- Check token expiration (exp)
- Validate token not-before (nbf) if present

## Troubleshooting

### Common Issues and Solutions

1. **JWKS Rate Limiting**
   - Solution: Cache JWKS using module-level variable (as shown in auth.js)

2. **CORS Errors**
   - Ensure OPTIONS requests return proper headers
   - Check allowed origins match your frontend URL

3. **Token Verification Fails**
   - Verify AUTH0_DOMAIN doesn't include https://
   - Ensure audience matches exactly what's configured in Auth0

4. **Environment Variables Not Loading**
   - Check `.dev.vars` file exists and is properly formatted
   - Restart wrangler after adding variables

5. **Static Assets Not Serving**
   - Run `npm run build` before deploying
   - Check `[site]` configuration in wrangler.toml

## Testing

### Local Testing
```bash
# Test public endpoint
curl http://localhost:8787/api/public

# Test protected endpoint (replace with actual token)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8787/api/protected

# Test health check
curl http://localhost:8787/api/health
```

### Get Test Token from Auth0
Use Auth0's API Explorer or implement a test login flow to obtain valid JWTs for testing.

## Migration Guide

### From Express/Node.js
- Replace `jsonwebtoken` with `jose`
- Replace `jwks-rsa` with `jose`'s `createRemoteJWKSet`
- Update middleware patterns to Worker fetch handler

### From Other Auth Providers
- Update JWKS endpoint URL
- Adjust JWT validation parameters (issuer, audience)
- Modify token claim mappings as needed

## Performance Optimization

1. **Cache JWKS**: Already implemented in the example
2. **Use Workers KV** for session storage if needed
3. **Implement edge caching** for public endpoints
4. **Use Durable Objects** for stateful operations

## Resources

- [Auth0 Documentation](https://auth0.com/docs)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [jose Library Documentation](https://github.com/panva/jose)
- [Cloudflare KV Asset Handler](https://github.com/cloudflare/kv-asset-handler)

## License

This implementation pattern is provided as-is for use in your applications.