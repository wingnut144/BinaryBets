import { useState, useEffect } from 'react';
import LoginView from './components/LoginView';
import MarketView from './components/MarketView';
import MarketDetailView from './components/MarketDetailView';
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
  const [selectedMarketId, setSelectedMarketId] = useState(null);
  const [view, setView] = useState('markets');
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    if (token) {
      fetchUser();
    fetchCategories();
    fetchCategories();
      loadAnnouncements();
    }
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

  const handleLogin = (newToken) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setView('markets');
  };

  if (!token) {
    return <LoginView onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-lg border-b-4 border-gradient-to-r from-purple-600 to-pink-600">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                🎲 Binary Bets
              </h1>
              {user && (
                <div className="text-sm">
                  <span className="text-gray-600">Balance:</span>
                  <span className="ml-2 font-bold text-green-600">${user.balance?.toFixed(2)}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <NotificationBell token={token} />
              <nav className="flex gap-4">
                <button
                  onClick={() => setView('markets')}
                  className={`flex-shrink-0 px-4 py-2 rounded-lg font-semibold transition-all ${
                    view === 'markets'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Markets
                </button>
                <button
                  onClick={() => setView('create')}
                  className={`flex-shrink-0 px-4 py-2 rounded-lg font-semibold transition-all ${
                    view === 'create'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Create Market
                </button>
                <button
                  onClick={() => setView('profile')}
                  className={`flex-shrink-0 px-4 py-2 rounded-lg font-semibold transition-all ${
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
                    className={`flex-shrink-0 px-4 py-2 rounded-lg font-semibold transition-all ${
                      view === 'admin'
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    ⚙️ Admin
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-red-100 text-red-600 rounded-lg font-semibold hover:bg-red-200 transition-all"
                >
                  Logout
                </button>
              </nav>
            </div>
          </div>
        </div>
      </header>

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 py-4">
          {announcements.map((announcement) => (
            <div
              key={announcement.id}
              className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg p-4 mb-4 shadow-lg"
            >
              <h3 className="font-bold text-lg">📢 {announcement.title}</h3>
              <p className="mt-1">{announcement.content}</p>
              <p className="text-xs mt-2 opacity-75">
                {new Date(announcement.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* AI Resolution Info - Show on Markets and Create pages */}
      {(view === 'markets' || view === 'create') && (
        <div className="max-w-7xl mx-auto px-4 py-4">
          
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
          {/* Category Navigation - Modern Horizontal Scroller */}
          <div className="mb-6 bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xl">📁</span>
              <h3 className="font-semibold text-gray-800">Categories</h3>
            </div>
            <div className="relative group">
              <button onClick={() => document.getElementById('category-scroll').scrollBy({ left: -200, behavior: 'smooth' })} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div id="category-scroll" className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth pb-2">
                <button onClick={() => { setSelectedCategory(null); }} className={`flex-shrink-0 px-4 py-2 rounded-lg transition-all whitespace-nowrap whitespace-nowrap ${selectedCategory === null ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>All Markets</button>
                {categories.filter(cat => !cat.parent_id).map(topLevel => (
                  <button key={topLevel.id} onClick={() => setSelectedCategory(topLevel.id)} className={`flex-shrink-0 px-4 py-2 rounded-lg transition-all whitespace-nowrap flex items-center gap-2 whitespace-nowrap ${selectedCategory === topLevel.id ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                    {topLevel.icon && <span>{topLevel.icon}</span>}<span>{topLevel.name}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => document.getElementById('category-scroll').scrollBy({ left: 200, behavior: 'smooth' })} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
              <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-white to-transparent pointer-events-none"></div>
              <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white to-transparent pointer-events-none"></div>
            </div>
          </div>

