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
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [view, setView] = useState('markets');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    if (token) {
      fetchUser();
    fetchCategories();
    }
    loadAnnouncements();
  }, [token]);

  
  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/api/categories/tree`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

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
          {/* Category Navigation */}
          <div className="mb-6 bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">📁</span>
              <h3 className="font-semibold text-gray-800">Categories</h3>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`w-full text-left px-4 py-2 rounded-lg transition-all ${
                  selectedCategory === null 
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white' 
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                All Markets
              </button>
              {categories
                .filter(cat => !cat.parent_id)
                .map(topLevel => (
                  <div key={topLevel.id}>
                    <button
                      onClick={() => setSelectedCategory(topLevel.id)}
                      className={`w-full text-left px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                        selectedCategory === topLevel.id
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      {topLevel.icon && <span>{topLevel.icon}</span>}
                      <span>{topLevel.name}</span>
                    </button>
                    {categories
                      .filter(cat => cat.parent_id === topLevel.id)
                      .map(subCat => (
                        <div key={subCat.id} className="ml-4">
                          <button
                            onClick={() => setSelectedCategory(subCat.id)}
                            className={`w-full text-left px-4 py-2 rounded-lg transition-all text-sm ${
                              selectedCategory === subCat.id
                                ? 'bg-purple-100 text-purple-800'
                                : 'hover:bg-gray-50 text-gray-600'
                            }`}
                          >
                            └─ {subCat.name}
                          </button>
                          {categories
                            .filter(cat => cat.parent_id === subCat.id)
                            .map(subSubCat => (
                              <button
                                key={subSubCat.id}
                                onClick={() => setSelectedCategory(subSubCat.id)}
                                className={`w-full text-left px-4 py-2 rounded-lg transition-all text-sm ml-4 ${
                                  selectedCategory === subSubCat.id
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'hover:bg-gray-50 text-gray-500'
                                }`}
                              >
                                └─ {subSubCat.name}
                              </button>
                            ))}
                        </div>
                      ))}
                  </div>
                ))}
            </div>
          </div>

          <MarketView selectedCategory={selectedCategory} token={token} user={user} />
        )}
        {view === 'create' && token && (
          <CreateMarketView token={token} user={user} refreshUser={fetchUser} onMarketCreated={() => setView('markets')} />
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
