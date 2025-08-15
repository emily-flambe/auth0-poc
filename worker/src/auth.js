import { jwtVerify, createRemoteJWKSet } from 'jose';

let jwksCache = null;

export async function verifyAuth0Token(token, env) {
  try {
    const jwt = token.startsWith('Bearer ') ? token.slice(7) : token;
    
    if (!jwksCache) {
      const jwksUri = `https://${env.AUTH0_DOMAIN}/.well-known/jwks.json`;
      jwksCache = createRemoteJWKSet(new URL(jwksUri));
    }
    
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

export async function requireAuth(request, env) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader) {
    return new Response('Unauthorized: No token provided', { status: 401 });
  }
  
  const verification = await verifyAuth0Token(authHeader, env);
  
  if (!verification.valid) {
    return new Response(`Unauthorized: ${verification.error}`, { status: 401 });
  }
  
  return verification.payload;
}