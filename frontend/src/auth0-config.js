// Auth0 configuration
// These values should match what's in your Auth0 application settings
export const auth0Config = {
  domain: import.meta.env.VITE_AUTH0_DOMAIN || "your-tenant.auth0.com",
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID || "your-client-id",
  redirectUri: window.location.origin,
  audience: import.meta.env.VITE_AUTH0_AUDIENCE || undefined,
  scope: "openid profile email"
};