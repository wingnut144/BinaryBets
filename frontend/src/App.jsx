import { useState, useEffect } from 'react';
import AuthModal from './components/AuthModal';
import MarketView from './components/MarketView';
import MarketDetailView from './components/MarketDetailView';
import CreateMarketView from './components/CreateMarketView';
import MyBetsView from './components/MyBetsView';
import ProfileView from './components/ProfileView';
import AdminView from './components/AdminView';
import LeaderboardView from './components/LeaderboardView';
import NotificationBell from './components/NotificationBell';
import AINewsWidget from './components/AINewsWidget';
import AnnouncementsWidget from './components/AnnouncementsWidget';

const API_URL = 'https://api.binary-bets.com';

function App() {
  const [view, setView] = useState('markets');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedMarketId, setSelectedMarketId] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    if (token) {
      fetchUser();
    }
    fetchCategories();
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
        localStorage.removeItem('token');
        setToken(null);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/api/categories/tree`);
      if (response.ok) {
        const data = await response.json();
        setCategories(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleLogin = (newToken) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setShowAuthModal(false);
    fetchUser();
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setView('markets');
  };

  const openAuth = (mode) => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  const navigateToView = (newView) => {
    setView(newView);
    setSelectedMarketId(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 
                className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent cursor-pointer"
                onClick={() => { setView('markets'); setSelectedMarketId(null); }}
              >
                Binary Bets
              </h1>
            </div>
            
            <div className="flex items-center gap-4">
              {user && (
                <>
                  <NotificationBell token={token} />
                  <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg">
                    <span className="text-lg">💰</span>
                    <span className="font-bold text-purple-700">{user.balance?.toFixed(2) || '0.00'}</span>
                  </div>
                </>
              )}
              
              {user ? (
                <div className="flex items-center gap-2">
                  <span className="text-gray-700">👤 {user.username}</span>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => openAuth('login')}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => openAuth('register')}
                    className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg"
                  >
                    Register
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {[
              { id: 'markets', label: '🏪 Markets', show: true },
              { id: 'create', label: '➕ Create', show: !!user },
              { id: 'mybets', label: '🎯 My Bets', show: !!user },
              { id: 'leaderboard', label: '🏆 Leaderboard', show: true },
              { id: 'profile', label: '👤 Profile', show: !!user },
              { id: 'admin', label: '⚙️ Admin', show: user?.is_admin }
            ].filter(item => item.show).map(item => (
              <button
                key={item.id}
                onClick={() => navigateToView(item.id)}
                className={`px-6 py-3 font-semibold whitespace-nowrap transition-all ${
                  view === item.id
                    ? 'text-purple-600 border-b-2 border-purple-600'
                    : 'text-gray-600 hover:text-purple-600'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Left Sidebar */}
          <div className="w-80 flex-shrink-0 space-y-6">
            <AINewsWidget />
            <AnnouncementsWidget />
          </div>

          {/* Center Content */}
          <div className="flex-1">
            {/* Horizontal Category Scroller - Only show on markets view */}
            {view === 'markets' && !selectedMarketId && (
              <div className="mb-6 bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xl">📁</span>
                  <h3 className="font-semibold text-gray-800">Categories</h3>
                </div>
                
                <div className="relative group">
                  <button
                    onClick={() => document.getElementById('category-scroll')?.scrollBy({ left: -200, behavior: 'smooth' })}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  <div 
                    id="category-scroll"
                    className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
                  >
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className={`flex-shrink-0 px-4 py-2 rounded-lg transition-all whitespace-nowrap ${
                        selectedCategory === null
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      All Markets
                    </button>
                    
                    {(categories || []).filter(cat => !cat.parent_id).map(category => (
                      <button
                        key={category.id}
                        onClick={() => setSelectedCategory(category.id)}
                        className={`flex-shrink-0 px-4 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
                          selectedCategory === category.id
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                      >
                        {category.icon && <span>{category.icon}</span>}
                        <span>{category.name}</span>
                      </button>
                    ))}
                  </div>
                  
                  <button
                    onClick={() => document.getElementById('category-scroll')?.scrollBy({ left: 200, behavior: 'smooth' })}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  
                  <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-white to-transparent pointer-events-none"></div>
                  <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white to-transparent pointer-events-none"></div>
                </div>
              </div>
            )}

            {/* View Content */}
            {view === 'markets' && (
              selectedMarketId ? (
                <MarketDetailView
                  marketId={selectedMarketId}
                  token={token}
                  user={user}
                  onBack={() => setSelectedMarketId(null)}
                />
              ) : (
                <MarketView
                  selectedCategory={selectedCategory}
                  token={token}
                  user={user}
                  onSelectMarket={setSelectedMarketId}
                />
              )
            )}
            
            {view === 'create' && <CreateMarketView token={token} user={user} />}
            {view === 'mybets' && <MyBetsView token={token} user={user} />}
            {view === 'leaderboard' && <LeaderboardView />}
            {view === 'profile' && <ProfileView token={token} user={user} onUpdateUser={fetchUser} />}
            {view === 'admin' && user?.is_admin && <AdminView token={token} />}
          </div>
        </div>
      </main>

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          mode={authMode}
          onClose={() => setShowAuthModal(false)}
          onLogin={handleLogin}
          onSwitchMode={(mode) => setAuthMode(mode)}
        />
      )}
    </div>
  );
}

export default App;
