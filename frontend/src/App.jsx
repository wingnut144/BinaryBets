import { useState, useEffect } from 'react';
import './App.css';

const API_URL = 'https://api.binary-bets.com/api';

export default function App() {
  const [markets, setMarkets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [authForm, setAuthForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    fullName: ''
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newMarket, setNewMarket] = useState({
    question: '',
    categoryId: '',
    marketType: 'binary',
    yesOdds: '',
    noOdds: '',
    options: ['', ''],
    deadline: ''
  });
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [betAmount, setBetAmount] = useState('');
  const [selectedOption, setSelectedOption] = useState(null);
  const [userBets, setUserBets] = useState([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [calculatingOdds, setCalculatingOdds] = useState(false);

  useEffect(() => {
    fetchMarkets();
    fetchCategories();
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchUserBets();
    }
  }, [user]);

  const fetchMarkets = async () => {
    try {
      const response = await fetch(`${API_URL}/markets`);
      const data = await response.json();
      setMarkets(data);
    } catch (error) {
      console.error('Error fetching markets:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/categories`);
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchUserBets = async () => {
    if (!user) return;
    try {
      const response = await fetch(`${API_URL}/users/${user.id}/bets`);
      const data = await response.json();
      setUserBets(data);
    } catch (error) {
      console.error('Error fetching user bets:', error);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`${API_URL}/leaderboard`);
      const data = await response.json();
      setLeaderboardData(data);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    }
  };

  const showError = (message) => {
    setError(message);
    setTimeout(() => setError(''), 5000);
  };

  const showSuccess = (message) => {
    setSuccess(message);
    setTimeout(() => setSuccess(''), 5000);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    
    if (isRegister && authForm.password !== authForm.confirmPassword) {
      showError('Passwords do not match');
      return;
    }
    
    if (isRegister && authForm.password.length < 8) {
      showError('Password must be at least 8 characters long');
      return;
    }
    
    const endpoint = isRegister ? '/auth/register' : '/auth/login';
    
    try {
      const body = isRegister 
        ? { 
            email: authForm.email, 
            password: authForm.password, 
            username: authForm.username, 
            fullName: authForm.fullName 
          }
        : { email: authForm.email, password: authForm.password };
        
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
        setShowAuthModal(false);
        setAuthForm({ email: '', password: '', confirmPassword: '', username: '', fullName: '' });
        showSuccess(isRegister ? 'Account created successfully!' : 'Logged in successfully!');
      } else {
        showError(data.error || 'Authentication failed');
      }
    } catch (error) {
      showError('Network error. Please try again.');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    showSuccess('Logged out successfully');
  };

  const calculateAIOdds = async () => {
    setCalculatingOdds(true);
    try {
      const response = await fetch(`${API_URL}/markets/calculate-odds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: newMarket.question,
          marketType: newMarket.marketType,
          options: newMarket.marketType === 'multi-choice' ? newMarket.options : null
        })
      });
      
      const data = await response.json();
      
      if (newMarket.marketType === 'binary') {
        setNewMarket({
          ...newMarket,
          yesOdds: data.odds.yes.toString(),
          noOdds: data.odds.no.toString()
        });
      } else {
        const updatedOptions = data.odds.options.map(opt => opt.text);
        const optionOdds = data.odds.options.map(opt => opt.odds);
        setNewMarket({
          ...newMarket,
          options: updatedOptions,
          optionOdds: optionOdds
        });
      }
      
      showSuccess('AI odds calculated successfully!');
    } catch (error) {
      showError('Failed to calculate odds. Using manual entry.');
    } finally {
      setCalculatingOdds(false);
    }
  };

  const handleCreateMarket = async (e) => {
    e.preventDefault();
    
    try {
      const marketData = {
        question: newMarket.question,
        categoryId: parseInt(newMarket.categoryId),
        marketType: newMarket.marketType,
        deadline: newMarket.deadline,
        ...(newMarket.marketType === 'binary' 
          ? { 
              yesOdds: parseFloat(newMarket.yesOdds), 
              noOdds: parseFloat(newMarket.noOdds) 
            }
          : { options: newMarket.options.filter(opt => opt.trim() !== '') }
        )
      };
      
      const response = await fetch(`${API_URL}/markets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(marketData)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        showSuccess('Market created successfully!');
        setShowCreateModal(false);
        setNewMarket({
          question: '',
          categoryId: '',
          marketType: 'binary',
          yesOdds: '',
          noOdds: '',
          options: ['', ''],
          deadline: ''
        });
        fetchMarkets();
      } else {
        showError(data.error || 'Failed to create market');
      }
    } catch (error) {
      showError('Network error. Please try again.');
    }
  };

  const handlePlaceBet = async (e) => {
    e.preventDefault();
    
    if (!user) {
      showError('Please sign in to place bets');
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/bets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          marketId: selectedMarket.id,
          marketOptionId: selectedOption?.id || null,
          amount: parseFloat(betAmount),
          betType: selectedMarket.market_type === 'binary' ? selectedOption?.option_text : null,
          odds: selectedOption?.odds || 0
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        showSuccess('Bet placed successfully!');
        setUser({ ...user, balance: data.newBalance });
        localStorage.setItem('user', JSON.stringify({ ...user, balance: data.newBalance }));
        setSelectedMarket(null);
        setBetAmount('');
        setSelectedOption(null);
        fetchUserBets();
      } else {
        showError(data.error || 'Failed to place bet');
      }
    } catch (error) {
      showError('Network error. Please try again.');
    }
  };

  const handleCancelBet = async (betId) => {
    try {
      const response = await fetch(`${API_URL}/bets/${betId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        showSuccess('Bet cancelled successfully!');
        setUser({ ...user, balance: data.newBalance });
        localStorage.setItem('user', JSON.stringify({ ...user, balance: data.newBalance }));
        fetchUserBets();
      } else {
        showError(data.error || 'Failed to cancel bet');
      }
    } catch (error) {
      showError('Network error. Please try again.');
    }
  };

  const handleResolveMarket = async (marketId, winningOptionId) => {
    try {
      const response = await fetch(`${API_URL}/markets/${marketId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winning_option_id: winningOptionId })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        showSuccess(`Market resolved! ${data.winners_count} winners paid out.`);
        fetchMarkets();
      } else {
        showError(data.error || 'Failed to resolve market');
      }
    } catch (error) {
      showError('Network error. Please try again.');
    }
  };

  const filteredMarkets = selectedCategory === 'all' 
    ? markets 
    : markets.filter(m => m.category_id === parseInt(selectedCategory));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-sm border-b border-purple-500/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📈</span>
            <h1 className="text-2xl font-bold text-white">BinaryBets</h1>
            <a 
              href="#" 
              className="text-sm text-purple-300 hover:text-purple-200 ml-2"
            >
              Help
            </a>
          </div>
          
          <div className="flex items-center gap-4">
            {user && (
              <>
                <div className="text-right">
                  <p className="text-sm text-gray-400">Balance</p>
                  <p className="text-lg font-bold text-green-400">${user.balance?.toFixed(2)}</p>
                </div>
                <button
                  onClick={() => {
                    setShowLeaderboard(true);
                    fetchLeaderboard();
                  }}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition"
                >
                  🏆 Leaderboard
                </button>
                {user.is_admin && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
                  >
                    ➕ Create Bet
                  </button>
                )}
              </>
            )}
            
            {user ? (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm text-gray-400">{user.username}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setShowAuthModal(true);
                  setIsRegister(false);
                }}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Error/Success Messages */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
            {error}
          </div>
        </div>
      )}
      
      {success && (
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="bg-green-500/20 border border-green-500 text-green-200 px-4 py-3 rounded-lg">
            {success}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Category Filter */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition ${
              selectedCategory === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
            }`}
          >
            All Bets
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id.toString())}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition ${
                selectedCategory === cat.id.toString()
                  ? `bg-${cat.color}-600 text-white`
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Markets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMarkets.map((market) => (
            <div
              key={market.id}
              className="bg-slate-800/50 backdrop-blur-sm border border-purple-500/20 rounded-xl p-6 hover:border-purple-500/40 transition cursor-pointer"
              onClick={() => setSelectedMarket(market)}
            >
              <div className="flex items-start justify-between mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold bg-${market.category_color}-600/20 text-${market.category_color}-300`}>
                  {market.category_name}
                </span>
                {market.resolved && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-600/20 text-green-300">
                    Resolved
                  </span>
                )}
              </div>
              
              <h3 className="text-xl font-bold text-white mb-4">{market.question}</h3>
              
              {market.market_type === 'binary' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
                    <p className="text-sm text-gray-400">Yes</p>
                    <p className="text-2xl font-bold text-green-400">{market.yes_odds}x</p>
                  </div>
                  <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                    <p className="text-sm text-gray-400">No</p>
                    <p className="text-2xl font-bold text-red-400">{market.no_odds}x</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {market.options?.map((opt) => (
                    <div key={opt.id} className="bg-slate-700/50 rounded-lg p-3 flex justify-between items-center">
                      <span className="text-white">{opt.option_text}</span>
                      <span className="text-purple-400 font-bold">{opt.odds}x</span>
                    </div>
                  ))}
                </div>
              )}
              
              <p className="text-sm text-gray-400 mt-4">
                Deadline: {new Date(market.deadline).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>

        {/* User Bets Section */}
        {user && userBets.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-white mb-6">Your Bets</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {userBets.map((bet) => (
                <div key={bet.id} className="bg-slate-800/50 border border-purple-500/20 rounded-lg p-4">
                  <p className="text-white font-semibold mb-2">{bet.market_question}</p>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Bet:</span>
                    <span className="text-white">${bet.amount}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Odds:</span>
                    <span className="text-purple-400">{bet.odds}x</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Potential Win:</span>
                    <span className="text-green-400">${(bet.amount * bet.odds).toFixed(2)}</span>
                  </div>
                  {!bet.market_resolved && (
                    <button
                      onClick={() => handleCancelBet(bet.id)}
                      className="w-full mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition text-sm"
                    >
                      Cancel Bet
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-8 max-w-md w-full border border-purple-500/20">
            <h2 className="text-2xl font-bold text-white mb-6">
              {isRegister ? 'Create Account' : 'Sign In'}
            </h2>
            
            <form onSubmit={handleAuth} className="space-y-4">
              {isRegister && (
                <>
                  <input
                    type="text"
                    placeholder="Username (e.g., @cryptoking)"
                    value={authForm.username}
                    onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={authForm.fullName}
                    onChange={(e) => setAuthForm({ ...authForm, fullName: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </>
              )}
              
              <input
                type="email"
                placeholder="Email"
                value={authForm.email}
                onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                required
              />
              
              <input
                type="password"
                placeholder="Password (min 8 characters)"
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                required
                minLength={8}
              />
              
              {isRegister && (
                <input
                  type="password"
                  placeholder="Confirm Password"
                  value={authForm.confirmPassword}
                  onChange={(e) => setAuthForm({ ...authForm, confirmPassword: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                  minLength={8}
                />
              )}
              
              <button
                type="submit"
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition"
              >
                {isRegister ? 'Create Account' : 'Sign In'}
              </button>
            </form>
            
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="w-full mt-4 text-purple-300 hover:text-purple-200 text-sm"
            >
              {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Register"}
            </button>
            
            <button
              onClick={() => setShowAuthModal(false)}
              className="w-full mt-2 text-gray-400 hover:text-gray-300 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Create Market Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-slate-800 rounded-xl p-8 max-w-2xl w-full border border-purple-500/20 my-8">
            <h2 className="text-2xl font-bold text-white mb-6">Create Bet</h2>
            
            <form onSubmit={handleCreateMarket} className="space-y-6">
              <input
                type="text"
                placeholder="Question (e.g., Will it snow in Houston tomorrow?)"
                value={newMarket.question}
                onChange={(e) => setNewMarket({ ...newMarket, question: e.target.value })}
                className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                required
              />
              
              <select
                value={newMarket.categoryId}
                onChange={(e) => setNewMarket({ ...newMarket, categoryId: e.target.value })}
                className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                required
              >
                <option value="">Select Category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-white cursor-pointer">
                  <input
                    type="radio"
                    value="binary"
                    checked={newMarket.marketType === 'binary'}
                    onChange={(e) => setNewMarket({ ...newMarket, marketType: e.target.value })}
                    className="w-5 h-5"
                  />
                  Binary (Yes/No)
                </label>
                <label className="flex items-center gap-2 text-white cursor-pointer">
                  <input
                    type="radio"
                    value="multi-choice"
                    checked={newMarket.marketType === 'multi-choice'}
                    onChange={(e) => setNewMarket({ ...newMarket, marketType: e.target.value })}
                    className="w-5 h-5"
                  />
                  Multi-Choice (2-4 options)
                </label>
              </div>
              
              <button
                type="button"
                onClick={calculateAIOdds}
                disabled={!newMarket.question || calculatingOdds}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span>✨</span>
                <span>🤖</span>
                {calculatingOdds ? 'Calculating...' : 'Calculate AI Odds'}
              </button>
              
              {/* ENHANCED ODDS SECTION */}
              {newMarket.marketType === 'binary' && (
                <>
                  <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4">
                    <p className="text-sm text-blue-200">
                      <span className="font-semibold">💡 How odds work:</span> If someone bets $10 on "Yes" with odds of 4.0, they win $40 total ($30 profit). Lower odds = more likely outcome.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Yes Odds
                        <span className="text-xs text-gray-400 block mt-1">
                          Payout multiplier for "Yes" bets
                        </span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={newMarket.yesOdds}
                        onChange={(e) => setNewMarket({ ...newMarket, yesOdds: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500 text-lg"
                        placeholder="e.g., 4.0"
                        required
                      />
                      {newMarket.yesOdds && (
                        <p className="text-xs text-gray-400 mt-2">
                          💰 Bet $10 → Win ${(10 * parseFloat(newMarket.yesOdds || 0)).toFixed(2)}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        No Odds
                        <span className="text-xs text-gray-400 block mt-1">
                          Payout multiplier for "No" bets
                        </span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={newMarket.noOdds}
                        onChange={(e) => setNewMarket({ ...newMarket, noOdds: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500 text-lg"
                        placeholder="e.g., 1.2"
                        required
                      />
                      {newMarket.noOdds && (
                        <p className="text-xs text-gray-400 mt-2">
                          💰 Bet $10 → Win ${(10 * parseFloat(newMarket.noOdds || 0)).toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}
              
              {newMarket.marketType === 'multi-choice' && (
                <div className="space-y-3">
                  {[0, 1, 2, 3].map((i) => (
                    <input
                      key={i}
                      type="text"
                      placeholder={`Option ${i + 1}${i < 2 ? ' (required)' : ' (optional)'}`}
                      value={newMarket.options[i] || ''}
                      onChange={(e) => {
                        const newOptions = [...newMarket.options];
                        newOptions[i] = e.target.value;
                        setNewMarket({ ...newMarket, options: newOptions });
                      }}
                      className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                      required={i < 2}
                    />
                  ))}
                </div>
              )}
              
              <input
                type="datetime-local"
                value={newMarket.deadline}
                onChange={(e) => setNewMarket({ ...newMarket, deadline: e.target.value })}
                className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                required
              />
              
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition"
                >
                  Create Bet
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bet Modal */}
      {selectedMarket && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-8 max-w-md w-full border border-purple-500/20">
            <h2 className="text-2xl font-bold text-white mb-4">{selectedMarket.question}</h2>
            
            {!user && (
              <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4 mb-4">
                <p className="text-yellow-200 text-sm">Please sign in to place bets</p>
              </div>
            )}
            
            <form onSubmit={handlePlaceBet} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Select Option
                </label>
                {selectedMarket.market_type === 'binary' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedOption({ option_text: 'Yes', odds: parseFloat(selectedMarket.yes_odds) })}
                      className={`p-4 rounded-lg border-2 transition ${
                        selectedOption?.option_text === 'Yes'
                          ? 'border-green-500 bg-green-900/30'
                          : 'border-slate-600 hover:border-slate-500'
                      }`}
                    >
                      <p className="text-white font-semibold">Yes</p>
                      <p className="text-green-400 text-lg font-bold">{selectedMarket.yes_odds}x</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedOption({ option_text: 'No', odds: parseFloat(selectedMarket.no_odds) })}
                      className={`p-4 rounded-lg border-2 transition ${
                        selectedOption?.option_text === 'No'
                          ? 'border-red-500 bg-red-900/30'
                          : 'border-slate-600 hover:border-slate-500'
                      }`}
                    >
                      <p className="text-white font-semibold">No</p>
                      <p className="text-red-400 text-lg font-bold">{selectedMarket.no_odds}x</p>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedMarket.options?.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSelectedOption(opt)}
                        className={`w-full p-3 rounded-lg border-2 transition flex justify-between items-center ${
                          selectedOption?.id === opt.id
                            ? 'border-purple-500 bg-purple-900/30'
                            : 'border-slate-600 hover:border-slate-500'
                        }`}
                      >
                        <span className="text-white">{opt.option_text}</span>
                        <span className="text-purple-400 font-bold">{opt.odds}x</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Bet Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter amount"
                  required
                  disabled={!user}
                />
              </div>
              
              {selectedOption && betAmount && (
                <div className="bg-purple-900/30 border border-purple-500/50 rounded-lg p-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Your Bet:</span>
                    <span className="text-white">${parseFloat(betAmount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Odds:</span>
                    <span className="text-purple-400">{selectedOption.odds}x</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold mt-2 pt-2 border-t border-purple-500/30">
                    <span className="text-gray-300">Potential Win:</span>
                    <span className="text-green-400">${(parseFloat(betAmount) * selectedOption.odds).toFixed(2)}</span>
                  </div>
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={!user || !selectedOption || !betAmount}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Place Bet
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMarket(null);
                    setSelectedOption(null);
                    setBetAmount('');
                  }}
                  className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition"
                >
                  Cancel
                </button>
              </div>
            </form>
            
            {user?.is_admin && !selectedMarket.resolved && (
              <div className="mt-6 pt-6 border-t border-slate-700">
                <h3 className="text-white font-semibold mb-3">Admin: Resolve Market</h3>
                {selectedMarket.market_type === 'binary' ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleResolveMarket(selectedMarket.id, 'yes')}
                      className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"
                    >
                      Resolve: Yes
                    </button>
                    <button
                      onClick={() => handleResolveMarket(selectedMarket.id, 'no')}
                      className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
                    >
                      Resolve: No
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedMarket.options?.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => handleResolveMarket(selectedMarket.id, opt.id)}
                        className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm"
                      >
                        Resolve: {opt.option_text}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-8 max-w-2xl w-full border border-purple-500/20 max-h-[80vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <span>🏆</span>
              Leaderboard
            </h2>
            
            <div className="space-y-3">
              {leaderboardData.map((player, index) => (
                <div
                  key={player.id}
                  className={`flex items-center gap-4 p-4 rounded-lg ${
                    index === 0 ? 'bg-yellow-900/30 border border-yellow-500/50' :
                    index === 1 ? 'bg-gray-600/30 border border-gray-400/50' :
                    index === 2 ? 'bg-orange-900/30 border border-orange-500/50' :
                    'bg-slate-700/50 border border-slate-600/50'
                  }`}
                >
                  <div className="text-2xl font-bold w-8 text-center">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-semibold">{player.username}</p>
                    <p className="text-sm text-gray-400">{player.full_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 font-bold text-lg">${player.balance?.toFixed(2)}</p>
                    <p className="text-xs text-gray-400">{player.total_bets} bets</p>
                  </div>
                </div>
              ))}
            </div>
            
            <button
              onClick={() => setShowLeaderboard(false)}
              className="w-full mt-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
