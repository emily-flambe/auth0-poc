import { useAuth0 } from '@auth0/auth0-react';

const Profile = () => {
  const { user, isAuthenticated } = useAuth0();

  if (!isAuthenticated) {
    return (
      <div className="profile">
        <p>You are not logged in.</p>
      </div>
    );
  }

  return (
    <div className="profile">
      <h2>User Profile</h2>
      <div className="user-info">
        <img src={user.picture} alt={user.name} className="user-avatar" />
        <div>
          <h3>{user.name}</h3>
          <p>{user.email}</p>
        </div>
      </div>
      <details>
        <summary>View Full Profile Data</summary>
        <pre>{JSON.stringify(user, null, 2)}</pre>
      </details>
    </div>
  );
};

export default Profile;