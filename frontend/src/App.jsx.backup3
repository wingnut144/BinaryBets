import { useState, useEffect } from 'react';

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
  const [showShareMenu, setShowShareMenu] = useState(null);

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ username: '', email: '', password: '' });
  const [createMarketForm, setCreateMarketForm] = useState({
    question: '',
    category_id: '',
    deadline: '',
    options: ['', ''],
    useAiOdds: false
  });

  // Get min and max dates for deadline picker
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
    if (token) {
      loadUser();
    }
    loadAINews();
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
  };

  const handleCreateMarket = async (e) => {
    e.preventDefault();
    
    if (!createMarketForm.category_id) {
      alert('Please select a category');
      return;
    }

    // Convert date to datetime with end of day
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
    console.log('Share button clicked!', platform, market.id);
    
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
    
    console.log('Opening share URL:', shareUrl);
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
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Binary Bets
                </h1>
                <p className="text-xs text-gray-600">Where Predictions Meet Fun</p>
              </div>
            </div>

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

      {(view === 'markets' || view === 'closed') && (
        <div className="bg-white border-b border-gray-200 shadow-sm sticky top-[72px] z-40">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center gap-2 overflow-x-auto">
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

      <main className="container mx-auto px-4 py-8">
        <div className="flex gap-6">
          <div className="flex-1">
            {view === 'markets' && (
              <div>
                <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  Active Prediction Markets
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
                        onShare={shareToSocial}
                        showShareMenu={showShareMenu}
                        setShowShareMenu={setShowShareMenu}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {view === 'closed' && (
              <div>
                <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                  🏁 Closed Markets
                </h2>
                {loading ? (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-600 border-t-transparent"></div>
                  </div>
                ) : getFilteredMarkets().length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-xl shadow-lg">
                    <div className="text-6xl mb-4">🏁</div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">No Closed Markets</h3>
                    <p className="text-gray-600">Markets will appear here after they close.</p>
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

            {view === 'create' && user && (
              <div className="max-w-2xl mx-auto">
                <h2 className="text-3xl font-bold text-gray-800 mb-6">Create New Market</h2>
                <form onSubmit={handleCreateMarket} className="bg-white rounded-xl shadow-lg p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Question</label>
                    <input
                      type="text"
                      required
                      value={createMarketForm.question}
                      onChange={(e) => setCreateMarketForm({...createMarketForm, question: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                      placeholder="Will X happen by Y date?"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                    <select
                      required
                      value={createMarketForm.category_id}
                      onChange={(e) => setCreateMarketForm({...createMarketForm, category_id: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                    >
                      <option value="">Select a category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Deadline Date
                      <span className="text-xs text-gray-500 ml-2">(Market closes at end of this day)</span>
                    </label>
                    <input
                      type="date"
                      required
                      min={getMinDate()}
                      max={getMaxDate()}
                      value={createMarketForm.deadline}
                      onChange={(e) => setCreateMarketForm({...createMarketForm, deadline: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Must be between tomorrow and {new Date(getMaxDate()).toLocaleDateString()}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
                    {createMarketForm.options.map((option, index) => (
                      <input
                        key={index}
                        type="text"
                        required
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...createMarketForm.options];
                          newOptions[index] = e.target.value;
                          setCreateMarketForm({...createMarketForm, options: newOptions});
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent mb-2"
                        placeholder={`Option ${index + 1}`}
                      />
                    ))}
                    {createMarketForm.options.length < 6 && (
                      <button
                        type="button"
                        onClick={() => setCreateMarketForm({...createMarketForm, options: [...createMarketForm.options, '']})}
                        className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                      >
                        + Add Option
                      </button>
                    )}
                  </div>

                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <label className="block text-sm font-semibold text-gray-800 mb-3">
                      Initial Odds Generation
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="oddsType"
                          checked={!createMarketForm.useAiOdds}
                          onChange={() => setCreateMarketForm({...createMarketForm, useAiOdds: false})}
                          className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-600"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-800">Equal Odds (50/50)</span>
                          <p className="text-xs text-gray-600">All options start with equal probability</p>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="oddsType"
                          checked={createMarketForm.useAiOdds}
                          onChange={() => setCreateMarketForm({...createMarketForm, useAiOdds: true})}
                          className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-600"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-800">🤖 AI-Generated Odds</span>
                          <p className="text-xs text-gray-600">AI analyzes the question to set initial probabilities</p>
                        </div>
                      </label>
                    </div>
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

          {(view === 'markets' || view === 'closed') && (
            <div className="hidden lg:block w-80">
              <AINewsWidget news={aiNews} />
            </div>
          )}
        </div>
      </main>

      {showAuthModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                {authMode === 'login' ? 'Login' : 'Register'}
              </h2>
              <button onClick={() => setShowAuthModal(false)} className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-2 rounded-lg font-medium transition-all ${
                  authMode === 'login'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                Login
              </button>
              <button
                onClick={() => setAuthMode('register')}
                className={`flex-1 py-2 rounded-lg font-medium transition-all ${
                  authMode === 'register'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                Register
              </button>
            </div>

            {authMode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    required
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({...loginForm, email: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                  <input
                    type="password"
                    required
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                >
                  Login
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                  <input
                    type="text"
                    required
                    value={registerForm.username}
                    onChange={(e) => setRegisterForm({...registerForm, username: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    required
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm({...registerForm, email: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                  <input
                    type="password"
                    required
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                >
                  Register
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {showBetModal && selectedMarket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Place Bet</h2>
              <button onClick={() => setShowBetModal(false)} className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-gray-700 mb-4">{selectedMarket.question}</p>

            <div className="space-y-3 mb-4">
              {selectedMarket.options && selectedMarket.options.map(option => (
                <button
                  key={option.id}
                  onClick={() => setSelectedOption(option)}
                  className={`w-full p-4 rounded-lg border-2 transition-all ${
                    selectedOption?.id === option.id
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-800">{option.name}</span>
                    <span className="text-purple-600 font-bold">{parseFloat(option.odds || 1.0).toFixed(2)}x</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Bet Amount</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                placeholder="Enter amount"
              />
              {selectedOption && betAmount && (
                <p className="text-sm text-gray-600 mt-2">
                  Potential payout: ${(parseFloat(betAmount) * parseFloat(selectedOption.odds || 1.0)).toFixed(2)}
                </p>
              )}
            </div>

            <button
              onClick={placeBet}
              disabled={!betAmount || !selectedOption}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Place Bet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MarketCard({ market, category, user, onBet, onShare, showShareMenu, setShowShareMenu }) {
  const deadline = new Date(market.deadline);
  const now = new Date();
  const isExpired = deadline < now;
  const timeUntil = isExpired ? 'Expired' : `Ends ${deadline.toLocaleDateString()}`;

  const handleShareClick = (e) => {
    e.stopPropagation();
    console.log('Share button clicked for market:', market.id);
    setShowShareMenu(showShareMenu === market.id ? null : market.id);
  };

  const handleSocialClick = (e, platform) => {
    e.stopPropagation();
    console.log('Social platform clicked:', platform);
    onShare(market, platform);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all overflow-hidden">
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

      <div className="p-4">
        <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
          <span>⏰ {timeUntil}</span>
          <span>👥 {market.total_bets || 0} bets</span>
        </div>

        {market.options && market.options.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <span>Betting Options & Odds</span>
              <span className="text-xs text-purple-600 font-normal">(Updates with each bet)</span>
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

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => onBet(market)}
            disabled={isExpired || !user}
            className="flex-1 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {!user ? 'Login to Bet' : isExpired ? 'Market Closed' : 'Place Bet'}
          </button>
          {!isExpired && (
            <div className="relative">
              <button
                onClick={handleShareClick}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all flex items-center gap-2"
                title="Share"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share
              </button>
              {showShareMenu === market.id && (
                <div className="absolute right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-10 min-w-[160px]">
                  <button
                    onClick={(e) => handleSocialClick(e, 'facebook')}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3 text-sm font-medium text-gray-700"
                  >
                    <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    Facebook
                  </button>
                  <button
                    onClick={(e) => handleSocialClick(e, 'x')}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3 text-sm font-medium text-gray-700"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    X (Twitter)
                  </button>
                  <button
                    onClick={(e) => handleSocialClick(e, 'bluesky')}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-3 text-sm font-medium text-gray-700"
                  >
                    <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 01-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8z"/>
                    </svg>
                    Bluesky
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ClosedMarketCard({ market, category }) {
  const hasWinner = market.outcome && market.outcome !== 'Unresolved';

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden opacity-75">
      <div className="p-4 bg-gradient-to-r from-gray-500 to-gray-600">
        <div className="flex items-center justify-between mb-2">
          <span className="px-3 py-1 bg-white bg-opacity-90 rounded-full text-xs font-semibold text-gray-700">
            {category.icon} {category.name}
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500 text-white">
            🏁 CLOSED
          </span>
        </div>
        <h3 className="text-lg font-bold text-white">{market.question}</h3>
      </div>

      <div className="p-4">
        {hasWinner && (
          <div className="bg-green-100 border-2 border-green-300 rounded-lg p-3 mb-4">
            <div className="text-center">
              <div className="text-sm text-green-800 font-semibold mb-1">Winner</div>
              <div className="text-xl font-bold text-green-600">{market.outcome}</div>
            </div>
          </div>
        )}
        <div className="text-center text-gray-600 text-sm">
          <p>Total Bets: {market.total_bets || 0}</p>
        </div>
      </div>
    </div>
  );
}

function AINewsWidget({ news }) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 sticky top-24">
      <div className="flex items-center gap-3 mb-4">
        <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <div>
          <h3 className="text-lg font-bold text-gray-800">AI Insights</h3>
          <p className="text-xs text-gray-600">Top trending prediction topics right now</p>
        </div>
      </div>
      
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
