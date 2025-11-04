import { useState, useEffect } from 'react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.binary-bets.com';

function App() {
  // State Management
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [markets, setMarkets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('markets'); // 'markets', 'create', 'profile', 'closed'
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [showBetModal, setShowBetModal] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [betAmount, setBetAmount] = useState('');
  const [selectedOption, setSelectedOption] = useState(null);
  const [aiNews, setAiNews] = useState([]);

  // Form States
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ username: '', email: '', password: '' });
  const [createMarketForm, setCreateMarketForm] = useState({
    question: '',
    category_id: '',
    deadline: '',
    options: ['', ''],
    useAiOdds: false
  });

  // Load data on mount
  useEffect(() => {
    loadCategories();
    loadMarkets();
    if (token) {
      loadUser();
    }
    loadAINews();
  }, [token]);

  // Load user data
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

  // Load categories
  const loadCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/api/categories`);
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  // Load markets
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

  // Load AI News
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

  // Reload markets when category changes
  useEffect(() => {
    loadMarkets();
  }, [selectedCategory]);

  // Handle Login
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
      } else {
        const error = await response.json();
        alert(error.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed');
    }
  };

  // Handle Register
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

  // Handle Logout
  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    setView('markets');
  };

  // Handle Create Market
  const handleCreateMarket = async (e) => {
    e.preventDefault();
    
    if (!createMarketForm.category_id) {
      alert('Please select a category');
      return;
    }

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
          deadline: createMarketForm.deadline,
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

  // Place Bet
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
        
        // Refresh markets to get updated odds
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

  // Share to Facebook
  const shareToFacebook = (market) => {
    const categoryName = categories.find(c => c.id === market.category_id)?.name || 'Prediction';
    const categoryIcon = categories.find(c => c.id === market.category_id)?.icon || '🎯';
    
    const shareText = `🎲 Binary Bets - Where Predictions Meet Fun!\n\n${categoryIcon} ${categoryName}: ${market.question}\n\n💰 Join the fun! Create your own prediction markets and bet with friends. It's all for entertainment - no real money!\n\n✨ Features:\n• Create custom prediction markets\n• Bet on outcomes with friends\n• Dynamic odds that update in real-time\n• Categories: Sports, Politics, Tech, Weather & more!\n\nJoin now and start predicting! 🚀`;
    
    const url = `https://binary-bets.com/market/${market.id}`;
    const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(shareText)}`;
    
    window.open(facebookShareUrl, '_blank', 'width=600,height=400');
  };

  // Get category badge color
  const getCategoryBadge = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return { icon: '🏛️', name: 'Unknown', color: '#667eea' };
    return category;
  };

  // Filter markets based on view
  const getFilteredMarkets = () => {
    if (view === 'closed') {
      return markets.filter(m => m.status === 'resolved' || m.status === 'closed');
    }
    return markets.filter(m => m.status === 'active');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="text-4xl">🎲</div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Binary Bets
                </h1>
                <p className="text-xs text-gray-600">Where Predictions Meet Fun</p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              <button
                onClick={() => setView('markets')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  view === 'markets'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Active Markets
              </button>
              <button
                onClick={() => setView('closed')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  view === 'closed'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Closed Markets
              </button>
              {user && (
                <button
                  onClick={() => setView('create')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    view === 'create'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Create Market
                </button>
              )}
            </nav>

            {/* User Menu */}
            <div className="flex items-center gap-4">
              {user ? (
                <>
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium text-gray-700">{user.username}</p>
                    <p className="text-xs text-purple-600 font-semibold">
                      ${typeof user.balance === 'number' ? user.balance.toFixed(2) : parseFloat(user.balance || 0).toFixed(2)}
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all font-medium"
                >
                  Login / Register
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Category Tabs */}
      {(view === 'markets' || view === 'closed') && (
        <div className="bg-white border-b border-gray-200 shadow-sm sticky top-[72px] z-40">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition-all flex items-center gap-2 ${
                  selectedCategory === null
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                🏛️ All Markets
              </button>
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition-all flex items-center gap-2 ${
                    selectedCategory === category.id
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category.icon} {category.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex gap-6">
          {/* Markets List */}
          <div className="flex-1">
            {view === 'markets' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-6">
                  {selectedCategory 
                    ? `${categories.find(c => c.id === selectedCategory)?.icon} ${categories.find(c => c.id === selectedCategory)?.name} Markets`
                    : '🔥 Active Prediction Markets'
                  }
                </h2>
                
                {loading ? (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent"></div>
                    <p className="mt-4 text-gray-600">Loading markets...</p>
                  </div>
                ) : getFilteredMarkets().length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-xl shadow-lg">
                    <div className="text-6xl mb-4">📭</div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">No Markets Yet</h3>
                    <p className="text-gray-600">Be the first to create a prediction market!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {getFilteredMarkets().map(market => (
                      <MarketCard
                        key={market.id}
                        market={market}
                        category={getCategoryBadge(market.category_id)}
                        user={user}
                        onBet={(market) => {
                          if (!user) {
                            setShowAuthModal(true);
                            return;
                          }
                          setSelectedMarket(market);
                          setShowBetModal(true);
                        }}
                        onShare={shareToFacebook}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {view === 'closed' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-6">
                  🏁 Closed Markets
                </h2>
                
                {loading ? (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent"></div>
                    <p className="mt-4 text-gray-600">Loading markets...</p>
                  </div>
                ) : getFilteredMarkets().length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-xl shadow-lg">
                    <div className="text-6xl mb-4">📭</div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">No Closed Markets</h3>
                    <p className="text-gray-600">Check back later for resolved markets!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {getFilteredMarkets().map(market => (
                      <ClosedMarketCard
                        key={market.id}
                        market={market}
                        category={getCategoryBadge(market.category_id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {view === 'create' && (
              <div className="max-w-2xl mx-auto">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Create Prediction Market</h2>
                <form onSubmit={handleCreateMarket} className="bg-white rounded-xl shadow-lg p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Question *
                    </label>
                    <input
                      type="text"
                      value={createMarketForm.question}
                      onChange={(e) => setCreateMarketForm({ ...createMarketForm, question: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                      placeholder="e.g., Will it rain in Seattle tomorrow?"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category *
                    </label>
                    <select
                      value={createMarketForm.category_id}
                      onChange={(e) => setCreateMarketForm({ ...createMarketForm, category_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                      required
                    >
                      <option value="">Select a category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.icon} {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Deadline *
                    </label>
                    <input
                      type="datetime-local"
                      value={createMarketForm.deadline}
                      onChange={(e) => setCreateMarketForm({ ...createMarketForm, deadline: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Options (minimum 2) *
                    </label>
                    {createMarketForm.options.map((option, index) => (
                      <input
                        key={index}
                        type="text"
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...createMarketForm.options];
                          newOptions[index] = e.target.value;
                          setCreateMarketForm({ ...createMarketForm, options: newOptions });
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent mb-2"
                        placeholder={`Option ${index + 1}`}
                        required
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => setCreateMarketForm({ ...createMarketForm, options: [...createMarketForm.options, ''] })}
                      className="text-purple-600 text-sm font-medium hover:underline"
                    >
                      + Add Option
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="useAiOdds"
                      checked={createMarketForm.useAiOdds}
                      onChange={(e) => setCreateMarketForm({ ...createMarketForm, useAiOdds: e.target.checked })}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-600"
                    />
                    <label htmlFor="useAiOdds" className="text-sm text-gray-700">
                      🤖 Use AI to generate initial odds (then switch to dynamic odds)
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                  >
                    Create Market
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* AI News Sidebar */}
          {(view === 'markets' || view === 'closed') && (
            <div className="hidden lg:block w-80">
              <AINewsWidget news={aiNews} />
            </div>
          )}
        </div>
      </main>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                {authMode === 'login' ? 'Login' : 'Register'}
              </h2>
              <button
                onClick={() => setShowAuthModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {authMode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                >
                  Login
                </button>
                <p className="text-center text-sm text-gray-600">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setAuthMode('register')}
                    className="text-purple-600 font-medium hover:underline"
                  >
                    Register
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                  <input
                    type="text"
                    value={registerForm.username}
                    onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                  <input
                    type="password"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                >
                  Register
                </button>
                <p className="text-center text-sm text-gray-600">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setAuthMode('login')}
                    className="text-purple-600 font-medium hover:underline"
                  >
                    Login
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Bet Modal */}
      {showBetModal && selectedMarket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">Place Your Bet</h2>
              <button
                onClick={() => {
                  setShowBetModal(false);
                  setBetAmount('');
                  setSelectedOption(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Market:</p>
              <p className="font-medium text-gray-800">{selectedMarket.question}</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Option
              </label>
              <div className="space-y-2">
                {selectedMarket.options && selectedMarket.options.map(option => (
                  <button
                    key={option.id}
                    onClick={() => setSelectedOption(option)}
                    className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                      selectedOption?.id === option.id
                        ? 'border-purple-600 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{option.name}</span>
                      <span className="text-purple-600 font-bold">
                        {parseFloat(option.odds || 1.0).toFixed(2)}x
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bet Amount
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={user?.balance}
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                placeholder="Enter amount"
              />
              <p className="text-xs text-gray-500 mt-1">
                Available: ${typeof user?.balance === 'number' ? user.balance.toFixed(2) : parseFloat(user?.balance || 0).toFixed(2)}
              </p>
            </div>

            {betAmount && selectedOption && (
              <div className="mb-4 p-3 bg-purple-50 rounded-lg">
                <p className="text-sm text-gray-600">Potential Payout:</p>
                <p className="text-2xl font-bold text-purple-600">
                  ${(parseFloat(betAmount) * parseFloat(selectedOption.odds || 1.0)).toFixed(2)}
                </p>
              </div>
            )}

            <button
              onClick={placeBet}
              disabled={!betAmount || !selectedOption}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Place Bet
            </button>

            <p className="text-xs text-gray-500 text-center mt-4">
              💡 Odds update dynamically after each bet
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Market Card Component
function MarketCard({ market, category, user, onBet, onShare }) {
  const deadline = new Date(market.deadline);
  const now = new Date();
  const isExpired = deadline < now;
  const timeUntil = isExpired ? 'Expired' : `Ends ${deadline.toLocaleDateString()}`;

  return (
    <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-purple-500 to-pink-500">
        <div className="flex items-center justify-between mb-2">
          <span className="px-3 py-1 bg-white bg-opacity-90 rounded-full text-xs font-semibold text-gray-700 flex items-center gap-1">
            {category.icon} {category.name}
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            isExpired ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
          }`}>
            {isExpired ? '🔴 CLOSED' : '🟢 LIVE'}
          </span>
        </div>
        <h3 className="text-lg font-bold text-white">{market.question}</h3>
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
          <span>⏰ {timeUntil}</span>
          <span>👥 {market.total_bets || 0} bets</span>
        </div>

        {/* Betting Options & Odds */}
        {market.options && market.options.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <span>Betting Options & Odds</span>
              <span className="text-xs text-purple-600 font-normal">
                (Updates with each bet)
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {market.options.map(option => (
                <div 
                  key={option.id}
                  className="bg-gradient-to-br from-purple-50 to-pink-50 p-3 rounded-lg border border-purple-200"
                >
                  <div className="text-center">
                    <div className="font-semibold text-gray-800">{option.name}</div>
                    <div className="text-2xl font-bold text-purple-600 mt-1">
                      {parseFloat(option.odds || 1.0).toFixed(2)}x
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {option.bet_count || 0} {option.bet_count === 1 ? 'bet' : 'bets'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => onBet(market)}
            disabled={isExpired || !user}
            className="flex-1 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {!user ? 'Login to Bet' : isExpired ? 'Market Closed' : 'Place Bet'}
          </button>
          {!isExpired && (
            <button
              onClick={() => onShare(market)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
              title="Share to Facebook"
            >
              📘 Share
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Closed Market Card Component
function ClosedMarketCard({ market, category }) {
  const hasWinner = market.outcome && market.outcome !== 'Unresolved';
  const totalBets = market.total_bets || 0;

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden opacity-75">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-gray-500 to-gray-600">
        <div className="flex items-center justify-between mb-2">
          <span className="px-3 py-1 bg-white bg-opacity-90 rounded-full text-xs font-semibold text-gray-700 flex items-center gap-1">
            {category.icon} {category.name}
          </span>
          <span className="px-3 py-1 bg-red-500 text-white rounded-full text-xs font-semibold">
            🏁 CLOSED
          </span>
        </div>
        <h3 className="text-lg font-bold text-white">{market.question}</h3>
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="text-center py-4 bg-gray-50 rounded-lg mb-4">
          {hasWinner ? (
            <>
              <div className="text-sm text-gray-600 mb-1">Winner</div>
              <div className="text-xl font-bold text-green-600">
                🏆 {market.outcome}
              </div>
            </>
          ) : (
            <>
              <div className="text-sm text-gray-600 mb-1">Result</div>
              <div className="text-lg font-semibold text-gray-700">
                {totalBets === 0 ? 'No bets were placed' : 'Market closed without resolution'}
              </div>
            </>
          )}
        </div>

        {/* Final Options Display */}
        {market.options && market.options.length > 0 && (
          <div className="mt-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Final Odds</div>
            <div className="grid grid-cols-2 gap-3">
              {market.options.map(option => (
                <div 
                  key={option.id}
                  className={`p-3 rounded-lg border ${
                    hasWinner && option.name === market.outcome
                      ? 'bg-green-50 border-green-300'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="text-center">
                    <div className="font-semibold text-gray-800">
                      {hasWinner && option.name === market.outcome && '🏆 '}
                      {option.name}
                    </div>
                    <div className="text-lg font-bold text-gray-600 mt-1">
                      {parseFloat(option.odds || 1.0).toFixed(2)}x
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {option.bet_count || 0} bets
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 text-center text-sm text-gray-500">
          Total Bets: {totalBets}
        </div>
      </div>
    </div>
  );
}

// AI News Widget Component
function AINewsWidget({ news }) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 sticky top-24">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🤖</span>
        <h3 className="text-lg font-bold text-gray-800">AI Generated Headlines</h3>
      </div>
      <p className="text-xs text-gray-600 mb-4">
        Top trending prediction topics right now
      </p>
      
      {news.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">📰</div>
          <p className="text-sm">Loading trending topics...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {news.slice(0, 3).map((item, index) => (
            <div 
              key={index}
              className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-200 hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-2 mb-2">
                <span className="text-xl">{item.icon || '📌'}</span>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-800 text-sm mb-1">
                    {item.category || 'Trending'}
                  </h4>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {item.headline}
                  </p>
                </div>
              </div>
              {item.source_url && (
                <a
                  href={item.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-purple-600 hover:underline flex items-center gap-1 mt-2"
                >
                  📰 Read full article →
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
