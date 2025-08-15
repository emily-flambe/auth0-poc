import { useAuth0 } from '@auth0/auth0-react';

const LoginButton = () => {
  const { loginWithRedirect, isAuthenticated } = useAuth0();

  if (isAuthenticated) {
    return null;
  }

  return (
    <button 
      className="button primary"
      onClick={() => loginWithRedirect()}
    >
      Login with Auth0
    </button>
  );
};

export default LoginButton;