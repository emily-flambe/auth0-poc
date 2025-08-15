import { verifyAuth0Token, requireAuth } from './auth';
import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import manifestJSON from '__STATIC_CONTENT_MANIFEST';
const assetManifest = JSON.parse(manifestJSON);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    };
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    try {
      // Handle API routes first
      if (url.pathname.startsWith('/api/')) {
        // Protected API endpoint
        if (url.pathname === '/api/protected') {
        const authResult = await requireAuth(request, env);
        
        if (authResult instanceof Response) {
          return authResult;
        }
        
        return new Response(JSON.stringify({
          message: 'This is protected data from the Cloudflare Worker API',
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
      
      // Public API endpoint for testing
      if (url.pathname === '/api/public') {
        return new Response(JSON.stringify({
          message: 'This is public data from the Cloudflare Worker',
          timestamp: new Date().toISOString()
        }), {
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
      
      // Health check endpoint
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
      
      // Serve static assets for all other routes
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
              // Always return index.html for client-side routing
              const url = new URL(request.url);
              if (!url.pathname.includes('.')) {
                return new Request(`${url.origin}/index.html`, request);
              }
              return request;
            },
          }
        );
      } catch (e) {
        // If no asset found, return index.html for client-side routing
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