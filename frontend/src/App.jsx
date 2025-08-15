import { useAuth0 } from '@auth0/auth0-react';
import LoginButton from './components/LoginButton';
import LogoutButton from './components/LogoutButton';
import Profile from './components/Profile';
import ApiTest from './components/ApiTest';

function App() {
  const { isLoading, error } = useAuth0();

  if (error) {
    return (
      <div className="app">
        <div className="container">
          <h1>Auth0 React POC</h1>
          <div className="error">
            <h2>Authentication Error</h2>
            <p>{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="app">
        <div className="container">
          <h1>Auth0 React POC</h1>
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="container">
        <h1>Auth0 React POC - Minimal Test</h1>
        
        <div className="auth-section">
          <LoginButton />
          <LogoutButton />
        </div>

        <Profile />
        
        <ApiTest />
      </div>
    </div>
  );
}

export default App;