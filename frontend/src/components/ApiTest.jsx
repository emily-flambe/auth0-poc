import { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const ApiTest = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [apiResult, setApiResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const callPublicApi = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/public');
      const data = await response.json();
      setApiResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const callProtectedApi = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: 'https://auth0-poc-api',
          scope: 'openid profile email'
        }
      });
      const response = await fetch('/api/protected', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${await response.text()}`);
      }
      
      const data = await response.json();
      setApiResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="api-test">
      <h2>Test API Endpoints</h2>
      
      <div className="button-group">
        <button 
          className="button"
          onClick={callPublicApi}
          disabled={loading}
        >
          Call Public API
        </button>
        
        <button 
          className="button"
          onClick={callProtectedApi}
          disabled={loading || !isAuthenticated}
        >
          Call Protected API
          {!isAuthenticated && ' (Login Required)'}
        </button>
      </div>

      {loading && <p className="loading">Loading...</p>}
      
      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {apiResult && !error && (
        <div className="success">
          <strong>API Response:</strong>
          <pre>{JSON.stringify(apiResult, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default ApiTest;