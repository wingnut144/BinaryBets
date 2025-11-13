import { useState, useEffect } from 'react';
import LeaderboardView from './components/LeaderboardView';
import MarketsView from './components/MarketsView';
import ClosedMarketsView from './components/ClosedMarketsView';
import CreateMarketView from './components/CreateMarketView';
import MessagesView from './components/MessagesView';
import AdminView from './components/AdminView';
import AuthModal from './components/AuthModal';
import BetModal from './components/BetModal';
import AnnouncementsWidget from './components/AnnouncementsWidget';
import AINewsWidget from './components/AINewsWidget';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.binary-bets.com';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [markets, setMarkets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('markets');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [showBetModal, setShowBetModal] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [betAmount, setBetAmount] = useState('');
  const [selectedOption, setSelectedOption] = useState(null);
  const [aiNews, setAiNews] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [showShareMenu, setShowShareMenu] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ username: '', email: '', password: '' });
  const [createMarketForm, setCreateMarketForm] = useState({
    question: '',
    category_id: '',
    deadline: '',
    options: ['', ''],
    useAiOdds: false
  });

  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  const getMaxDate = () => {
    const fourYears = new Date();
    fourYears.setFullYear(fourYears.getFullYear() + 4);
    return fourYears.toISOString().split('T')[0];
  };

  useEffect(() => {
    loadCategories();
    loadMarkets();
    loadAnnouncements();
    if (token) {
      loadUser();
      loadUnreadCount();
    }
    loadAINews();
  }, [token]);

  useEffect(() => {
    if (token) {
      const interval = setInterval(loadUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const loadUser = async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        localStorage.removeItem('token');
        setToken(null);
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const response = await fetch(`${API_URL}/api/messages/unread-count`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count);
      }
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/api/categories`);
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadMarkets = async () => {
    setLoading(true);
    try {
      const url = selectedCategory 
        ? `${API_URL}/api/markets?category=${selectedCategory}`
        : `${API_URL}/api/markets`;
      
      const response = await fetch(url);
      const data = await response.json();
      setMarkets(data);
    } catch (error) {
      console.error('Error loading markets:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAINews = async () => {
    try {
      const response = await fetch(`${API_URL}/api/ai-news`);
      if (response.ok) {
        const data = await response.json();
        setAiNews(data.news || []);
      }
    } catch (error) {
      console.error('Error loading AI news:', error);
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

  useEffect(() => {
    loadMarkets();
  }, [selectedCategory]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });

      if (response.ok) {
        const data = await response.json();
        setToken(data.token);
        localStorage.setItem('token', data.token);
        setUser(data.user);
        setShowAuthModal(false);
        setLoginForm({ email: '', password: '' });
        loadUnreadCount();
      } else {
        const error = await response.json();
        alert(error.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm)
      });

      if (response.ok) {
        const data = await response.json();
        setToken(data.token);
        localStorage.setItem('token', data.token);
        setUser(data.user);
        setShowAuthModal(false);
        setRegisterForm({ username: '', email: '', password: '' });
      } else {
        const error = await response.json();
        alert(error.error || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('Registration failed');
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    setView('markets');
    setUnreadCount(0);
  };

  const handleCreateMarket = async (e) => {
    e.preventDefault();
    
    if (!createMarketForm.category_id) {
      alert('Please select a category');
      return;
    }

    const deadlineDate = new Date(createMarketForm.deadline);
    deadlineDate.setHours(23, 59, 59, 999);

    try {
      const response = await fetch(`${API_URL}/api/markets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          question: createMarketForm.question,
          category_id: parseInt(createMarketForm.category_id),
          deadline: deadlineDate.toISOString(),
          options: createMarketForm.options.filter(opt => opt.trim() !== ''),
          useAiOdds: createMarketForm.useAiOdds
        })
      });

      if (response.ok) {
        alert('Market created successfully!');
        setCreateMarketForm({
          question: '',
          category_id: '',
          deadline: '',
          options: ['', ''],
          useAiOdds: false
        });
        setView('markets');
        loadMarkets();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create market');
      }
    } catch (error) {
      console.error('Error creating market:', error);
      alert('Failed to create market');
    }
  };

  const placeBet = async () => {
    if (!betAmount || !selectedOption) {
      alert('Please enter an amount and select an option');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/bets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          market_id: selectedMarket.id,
          option_id: selectedOption.id,
          amount: parseFloat(betAmount)
        })
      });

      if (response.ok) {
        const data = await response.json();
        setUser(prev => ({ ...prev, balance: data.newBalance }));
        await loadMarkets();
        alert('Bet placed successfully! Odds have been updated.');
        setShowBetModal(false);
        setBetAmount('');
        setSelectedOption(null);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to place bet');
      }
    } catch (error) {
      console.error('Error placing bet:', error);
      alert('Failed to place bet');
    }
  };

  const shareToSocial = (market, platform) => {
    const categoryName = categories.find(c => c.id === market.category_id)?.name || 'Prediction';
    const categoryIcon = categories.find(c => c.id === market.category_id)?.icon || '🎯';
    
    const shareText = `${categoryIcon} ${categoryName}: ${market.question}\n\nJoin the prediction market at Binary Bets!`;
    const url = `https://binary-bets.com/market/${market.id}`;
    
    let shareUrl;
    switch(platform) {
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(shareText)}`;
        break;
      case 'x':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`;
        break;
      case 'bluesky':
        shareUrl = `https://bsky.app/intent/compose?text=${encodeURIComponent(shareText + '\n' + url)}`;
        break;
    }
    
    window.open(shareUrl, '_blank', 'width=600,height=400');
    setShowShareMenu(null);
  };

  const getCategoryBadge = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return { icon: '🏛️', name: 'Unknown', color: '#667eea' };
    return category;
  };

  const getFilteredMarkets = () => {
    if (view === 'closed') {
      return markets.filter(m => m.status === 'resolved' || m.status === 'closed');
    }
    return markets.filter(m => m.status === 'active');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      <header className="bg-white shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-4xl">🎲</div>
            </div>

            <nav className="hidden md:flex items-center gap-6">
              <button onClick={() => setView('markets')} className={`px-4 py-2 rounded-lg font-medium transition-all ${view === 'markets' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' : 'text-gray-700 hover:bg-gray-100'}`}>
                Active Markets
              </button>
              <button onClick={() => setView('leaderboard')} className={`px-4 py-2 rounded-lg font-medium transition-all ${view === 'leaderboard' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' : 'text-gray-700 hover:bg-gray-100'}`}>
                🏆 Leaderboard
              </button>
              <button onClick={() => setView('closed')} className={`px-4 py-2 rounded-lg font-medium transition-all ${view === 'closed' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' : 'text-gray-700 hover:bg-gray-100'}`}>
                Closed Markets
              </button>
              {user && (
                <>
                  <button onClick={() => setView('create')} className={`px-4 py-2 rounded-lg font-medium transition-all ${view === 'create' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' : 'text-gray-700 hover:bg-gray-100'}`}>
                    Create Market
                  </button>
                  <button onClick={() => setView('messages')} className={`px-4 py-2 rounded-lg font-medium transition-all relative ${view === 'messages' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' : 'text-gray-700 hover:bg-gray-100'}`}>
                    Messages
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  {user.is_admin && (
                    <button onClick={() => setView('admin')} className={`px-4 py-2 rounded-lg font-medium transition-all ${view === 'admin' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' : 'text-gray-700 hover:bg-gray-100'}`}>
                      Admin
                    </button>
                  )}
                </>
              )}
            </nav>

            <div className="flex items-center gap-4">
              {user ? (
                <>
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium text-gray-700">{user.username}</p>
                    <p className="text-xs text-purple-600 font-semibold">
                      ${typeof user.balance === 'number' ? user.balance.toFixed(2) : parseFloat(user.balance || 0).toFixed(2)}
                    </p>
                  </div>
                  <button onClick={handleLogout} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium">
                    Logout
                  </button>
                </>
              ) : (
                <button onClick={() => setShowAuthModal(true)} className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                  Login / Register
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {(view === 'markets' || view === 'closed') && (
        <div className="bg-white border-b border-gray-200 shadow-sm sticky top-[72px] z-40">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center gap-2 overflow-x-auto">
              <button onClick={() => setSelectedCategory(null)} className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition-all flex items-center gap-2 ${selectedCategory === null ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                🏛️ All Markets
              </button>
              {categories.map(category => (
                <button key={category.id} onClick={() => setSelectedCategory(category.id)} className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition-all flex items-center gap-2 ${selectedCategory === category.id ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  {category.icon} {category.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-8">
        <div className="flex gap-6 items-start">
          <div className="flex-1">
            {view === 'markets' && <MarketsView loading={loading} markets={getFilteredMarkets()} getCategoryBadge={getCategoryBadge} user={user} setShowAuthModal={setShowAuthModal} setSelectedMarket={setSelectedMarket} setShowBetModal={setShowBetModal} shareToSocial={shareToSocial} showShareMenu={showShareMenu} setShowShareMenu={setShowShareMenu} token={token} loadMarkets={loadMarkets} />}
            {view === 'leaderboard' && <LeaderboardView user={user} />}
            {view === 'closed' && <ClosedMarketsView loading={loading} markets={getFilteredMarkets()} getCategoryBadge={getCategoryBadge} />}
            {view === 'create' && user && <CreateMarketView createMarketForm={createMarketForm} setCreateMarketForm={setCreateMarketForm} categories={categories} handleCreateMarket={handleCreateMarket} getMinDate={getMinDate} getMaxDate={getMaxDate} />}
            {view === 'messages' && user && <MessagesView token={token} user={user} loadUnreadCount={loadUnreadCount} />}
            {view === 'admin' && user && user.is_admin && <AdminView token={token} loadAnnouncements={loadAnnouncements} />}
          </div>

          {(view === 'markets' || view === 'closed' || view === 'leaderboard') && (
            <div className="hidden lg:block w-80 pt-[60px]">
              <AnnouncementsWidget announcements={announcements} />
              <AINewsWidget news={aiNews} />
            </div>
          )}
        </div>
      </main>

      {showAuthModal && <AuthModal authMode={authMode} setAuthMode={setAuthMode} setShowAuthModal={setShowAuthModal} loginForm={loginForm} setLoginForm={setLoginForm} registerForm={registerForm} setRegisterForm={setRegisterForm} handleLogin={handleLogin} handleRegister={handleRegister} />}
      {showBetModal && selectedMarket && <BetModal selectedMarket={selectedMarket} setShowBetModal={setShowBetModal} betAmount={betAmount} setBetAmount={setBetAmount} selectedOption={selectedOption} setSelectedOption={setSelectedOption} placeBet={placeBet} />}
    </div>
  );
}

export default App;
