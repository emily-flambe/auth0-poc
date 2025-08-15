import React from 'react';
import ReactDOM from 'react-dom/client';
import { Auth0Provider } from '@auth0/auth0-react';
import App from './App';
import { auth0Config } from './auth0-config';
import './index.css';

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
      onRedirectCallback={(appState, user) => {
        console.log('Redirect callback:', { appState, user });
        window.history.replaceState({}, document.title, window.location.pathname);
      }}
    >
      <App />
    </Auth0Provider>
  </React.StrictMode>
);