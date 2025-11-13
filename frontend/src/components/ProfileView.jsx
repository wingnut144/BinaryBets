import MyBetsView from './MyBetsView';

function ProfileView({ token, user, refreshUser }) {
  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-6">👤 Profile</h2>
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <p><strong>Username:</strong> {user?.username}</p>
        <p><strong>Email:</strong> {user?.email}</p>
        <p><strong>Balance:</strong> ${user?.balance?.toFixed(2)}</p>
      </div>
      <MyBetsView token={token} user={user} refreshUser={refreshUser} />
    </div>
  );
}

export default ProfileView;
