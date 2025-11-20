import { useState, useEffect } from 'react';
import AuthModal from './components/AuthModal';
import MarketView from './components/MarketView';
import CreateMarketView from './components/CreateMarketView';
import AdminView from './components/AdminView';
import ProfileView from './components/ProfileView';
import NotificationBell from './components/NotificationBell';
import AIResolutionInfo from './components/AIResolutionInfo';

const API_URL = 'https://api.binary-bets.com';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [view, setView] = useState('markets');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    if (token) {
      fetchUser();
    }
    loadAnnouncements();
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await fetch(`${API_URL}/api/user`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data);
      } else {
        handleLogout();
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const loadAnnouncements = async () => {
    try {
      const response = await fetch(`${API_URL}/api/announcements`);
      if (response.ok) {
        const data = await response.json();
        setAnnouncements(data);
      }
    } catch (error) {
      console.error('Error loading announcements:', error);
    }
  };

  const handleLogin = (newToken, userData) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    if (userData) {
      setUser(userData);
    }
    setShowAuthModal(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setView('markets');
  };

  const requireAuth = (callback) => {
    if (!token) {
      setShowAuthModal(true);
      return false;
    }
    callback();
    return true;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-lg border-b-4 border-gradient-to-r from-purple-600 to-pink-600">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent cursor-pointer"
                  onClick={() => setView('markets')}>
                🎲 Binary Bets
              </h1>
              {user && (
                <div className="text-sm">
                  <span className="text-gray-600">Balance:</span>
                  <span className="ml-2 font-bold text-green-600">${parseFloat(user.balance).toFixed(2)}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              {token && <NotificationBell token={token} />}
              <nav className="flex gap-4">
                <button
                  onClick={() => setView('markets')}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    view === 'markets'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Markets
                </button>
                {token && (
                  <>
                    <button
                      onClick={() => setView('create')}
                      className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                        view === 'create'
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Create Market
                    </button>
                    <button
                      onClick={() => setView('profile')}
                      className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                        view === 'profile'
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Profile
                    </button>
                    {user?.is_admin && (
                      <button
                        onClick={() => setView('admin')}
                        className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                          view === 'admin'
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        Admin
                      </button>
                    )}
                    <button
                      onClick={handleLogout}
                      className="px-4 py-2 rounded-lg font-semibold text-red-600 hover:bg-red-50 transition-all"
                    >
                      Logout
                    </button>
                  </>
                )}
                {!token && (
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="px-4 py-2 rounded-lg font-semibold bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg hover:shadow-xl transition-all"
                  >
                    Login / Register
                  </button>
                )}
              </nav>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <AIResolutionInfo />
        
        {view === 'markets' && (
          <MarketView token={token} user={user} refreshUser={fetchUser} requireAuth={requireAuth} />
        )}
        {view === 'create' && token && (
          <CreateMarketView token={token} user={user} refreshUser={fetchUser} onBack={() => setView('markets')} />
        )}
        {view === 'profile' && token && (
          <ProfileView token={token} user={user} refreshUser={fetchUser} />
        )}
        {view === 'admin' && token && user?.is_admin && (
          <AdminView token={token} user={user} />
        )}
      </main>

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} onLogin={handleLogin} />
      )}
    </div>
  );
}

export default App;
