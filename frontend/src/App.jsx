import { useState, useEffect } from 'react';
import { TrendingUp, LogOut, Plus, CheckCircle, XCircle, DollarSign, Calendar, Award, Sparkles, X } from 'lucide-react';

const API_URL = 'http://64.23.152.157:5000/api';

export default function App() {
  const [user, setUser] = useState(null);
  const [markets, setMarkets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [showCreateMarket, setShowCreateMarket] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [userBets, setUserBets] = useState([]);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [calculatingOdds, setCalculatingOdds] = useState(false);
  const [suggestedOdds, setSuggestedOdds] = useState(null);
  
  // Error notification state
  const [errorNotification, setErrorNotification] = useState(null);
  
  // Show error function
  const showError = (message) => {
    setErrorNotification(message);
    setTimeout(() => setErrorNotification(null), 5000);
  };

  const [authForm, setAuthForm] = useState({
    email: '',
    password: '',
    username: '',
    fullName: ''
  });

  const [marketForm, setMarketForm] = useState({
    question: '',
    description: '',
    deadline: '',
    category_id: '',
    marketType: 'binary',
    yes_odds: '',
    no_odds: '',
    options: [
      { text: '', odds: '' },
      { text: '', odds: '' }
    ]
  });

  useEffect(() => {
    fetchMarkets();
    fetchCategories();
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // Read category from URL after categories are loaded
  useEffect(() => {
    if (categories.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const categoryParam = urlParams.get('category');
      
      if (categoryParam) {
        // Check if it's a category name (string) or ID (number)
        const categoryByName = categories.find(cat => 
          cat.name.toLowerCase() === categoryParam.toLowerCase()
        );
        
        if (categoryByName) {
          setSelectedCategory(categoryByName.id.toString());
        } else if (!isNaN(categoryParam)) {
          // It's a number, use as ID
          setSelectedCategory(categoryParam);
        }
      }
    }
  }, [categories]);

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

  const handleAuth = async (e) => {
    e.preventDefault();
    const endpoint = isRegister ? '/auth/register' : '/auth/login';
    
    try {
      const body = isRegister 
        ? authForm 
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
        setAuthForm({ email: '', password: '', username: '', fullName: '' });
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
  };

  const calculateAIOdds = async () => {
    if (!marketForm.question) {
      showError('Please enter a question first');
      return;
    }
    
    setCalculatingOdds(true);
    try {
      const response = await fetch(`${API_URL}/markets/calculate-odds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: marketForm.question,
          options: marketForm.marketType === 'multi-choice' 
            ? marketForm.options.map(o => o.text).filter(t => t.trim())
            : null,
          marketType: marketForm.marketType
        })
      });
      
      const data = await response.json();
      setSuggestedOdds(data.odds);
      
      if (marketForm.marketType === 'binary') {
        setMarketForm(prev => ({
          ...prev,
          yes_odds: data.odds.yes,
          no_odds: data.odds.no
        }));
      } else {
        const updatedOptions = marketForm.options.map((opt, idx) => ({
          ...opt,
          odds: data.odds.options[idx]?.odds || opt.odds
        }));
        setMarketForm(prev => ({ ...prev, options: updatedOptions }));
      }
    } catch (error) {
      showError('Failed to calculate odds. You can enter odds manually.');
    } finally {
      setCalculatingOdds(false);
    }
  };

  const handleCreateMarket = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch(`${API_URL}/markets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(marketForm)
      });
      
      if (response.ok) {
        setShowCreateMarket(false);
        setMarketForm({
          question: '',
          description: '',
          deadline: '',
          category_id: '',
          marketType: 'binary',
          yes_odds: '',
          no_odds: '',
          options: [{ text: '', odds: '' }, { text: '', odds: '' }]
        });
        fetchMarkets();
      } else {
        showError('Failed to create bet');
      }
    } catch (error) {
      showError('Network error. Please try again.');
    }
  };

  const handleBet = async (market, outcome, option = null) => {
    if (!user) {
      showError('Please sign in to place a bet');
      setShowAuthModal(true);
      return;
    }

    const amount = prompt('Enter bet amount ($):');
    if (!amount || isNaN(amount) || amount <= 0) return;

    const marketOptionId = option?.id || null;
    const odds = option?.odds || (outcome === 'YES' ? market.yes_odds : market.no_odds);

    try {
      const response = await fetch(`${API_URL}/bets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          market_id: market.id,
          market_option_id: marketOptionId,
          amount: parseFloat(amount),
          odds: parseFloat(odds)
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        const updatedUser = { ...user, balance: user.balance - parseFloat(amount) };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        fetchUserBets();
        showError('Bet placed successfully!'); // Using as success notification
      } else {
        showError(data.error || 'Failed to place bet');
      }
    } catch (error) {
      showError('Network error. Please try again.');
    }
  };

  const handleCancelBet = async (betId) => {
    if (!confirm('Cancel this bet? You will receive a 95% refund.')) return;

    try {
      const response = await fetch(`${API_URL}/bets/${betId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id })
      });

      if (response.ok) {
        const data = await response.json();
        const updatedUser = { ...user, balance: user.balance + data.refund };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        fetchUserBets();
        showError(`Bet cancelled. Refunded $${data.refund.toFixed(2)}`);
      } else {
        showError('Failed to cancel bet');
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

      if (response.ok) {
        setShowResolveModal(false);
        fetchMarkets();
        showError('Bet resolved successfully!');
      } else {
        showError('Failed to resolve bet');
      }
    } catch (error) {
      showError('Network error. Please try again.');
    }
  };

  const filteredMarkets = selectedCategory === 'all'
    ? markets
    : markets.filter(m => m.category_id === parseInt(selectedCategory));

  // Function to handle category change and update URL
  const handleCategoryChange = (categoryValue) => {
    setSelectedCategory(categoryValue);
    
    // Update URL without page reload
    const url = new URL(window.location);
    if (categoryValue === 'all') {
      url.searchParams.delete('category');
    } else {
      url.searchParams.set('category', categoryValue);
    }
    window.history.pushState({}, '', url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      
      {/* Error Notification Box */}
      {errorNotification && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className="bg-red-500 text-white px-6 py-4 rounded-lg shadow-2xl max-w-md flex items-start space-x-3 border-2 border-red-400">
            <div className="flex-shrink-0 mt-0.5">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-lg">Error</p>
              <p className="text-sm mt-1 break-words">{errorNotification}</p>
            </div>
            <button
              onClick={() => setErrorNotification(null)}
              className="flex-shrink-0 text-white hover:text-red-200 transition-colors focus:outline-none"
              aria-label="Close notification"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Add animation styles */}
      <style>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>

      {/* Header */}
      <nav className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-8 h-8 text-purple-400" />
              <h1 className="text-2xl font-bold text-white">BinaryBets</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <button
                    onClick={() => {
                      setShowLeaderboard(true);
                      fetchLeaderboard();
                    }}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors flex items-center space-x-2"
                  >
                    <Award className="w-4 h-4" />
                    <span>Leaderboard</span>
                  </button>
                  
                  {user.is_admin && (
                    <>
                      <button
                        onClick={() => setShowCreateMarket(true)}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Create Bet</span>
                      </button>
                      <button
                        onClick={() => setShowResolveModal(true)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Resolve Bets
                      </button>
                    </>
                  )}
                  
                  <button
                    onClick={() => setShowProfileModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    @{user.username} - ${user.balance.toFixed(2)}
                  </button>
                  <button
                    onClick={handleLogout}
                    className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Category Filter */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleCategoryChange('all')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              selectedCategory === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
            }`}
          >
            All Bets
          </button>
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => handleCategoryChange(category.id.toString())}
              className={`px-4 py-2 rounded-lg transition-colors ${
                selectedCategory === category.id.toString()
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {/* Markets Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMarkets.map(market => (
            <div key={market.id} className="bg-slate-800 rounded-lg shadow-lg overflow-hidden border border-slate-700">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white flex-1">{market.question}</h3>
                  {market.resolved && (
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 ml-2" />
                  )}
                </div>

                {market.category_name && (
                  <span className="inline-block px-3 py-1 bg-purple-600/20 text-purple-300 text-sm rounded-full mb-4">
                    {market.category_name}
                  </span>
                )}

                <div className="flex items-center text-gray-400 text-sm mb-4">
                  <Calendar className="w-4 h-4 mr-2" />
                  <span>{new Date(market.deadline).toLocaleDateString()}</span>
                </div>

                {market.market_type === 'binary' && (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleBet(market, 'YES')}
                      disabled={market.resolved || !user}
                      className="py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="font-bold">YES</div>
                      <div className="text-sm">{market.yes_odds}x</div>
                    </button>
                    <button
                      onClick={() => handleBet(market, 'NO')}
                      disabled={market.resolved || !user}
                      className="py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="font-bold">NO</div>
                      <div className="text-sm">{market.no_odds}x</div>
                    </button>
                  </div>
                )}

                {market.market_type === 'multi-choice' && market.options && (
                  <div className="space-y-2">
                    {market.options
                      .filter((option, index, self) => 
                        index === self.findIndex(o => o.id === option.id)
                      )
                      .map((option) => {
                        const totalBets = market.options.reduce((sum, opt) => 
                          sum + (opt.bet_count || 0), 0
                        );
                        const optionPercentage = totalBets > 0 
                          ? ((option.bet_count || 0) / totalBets * 100).toFixed(1)
                          : '0.0';
                        
                        return (
                          <div
                            key={option.id}
                            className="relative bg-slate-700/50 rounded-lg p-3 hover:bg-slate-700 transition-colors cursor-pointer"
                            onClick={() => !market.resolved && user && handleBet(market, null, option)}
                          >
                            <div className="flex justify-between items-center relative z-10">
                              <span className="font-medium text-white">{option.option_text}</span>
                              <div className="flex items-center space-x-3">
                                <span className="text-sm text-gray-400">{optionPercentage}%</span>
                                <span className="text-purple-400 font-bold">{option.odds}x</span>
                              </div>
                            </div>
                            <div
                              className="absolute inset-0 bg-purple-600/20 rounded-lg transition-all"
                              style={{ width: `${optionPercentage}%` }}
                            />
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg p-8 max-w-md w-full">
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
                placeholder="Password"
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                required
              />
              <button
                type="submit"
                className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                {isRegister ? 'Register' : 'Sign In'}
              </button>
            </form>
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="w-full mt-4 text-purple-400 hover:text-purple-300 transition-colors"
            >
              {isRegister ? 'Already have an account? Sign in' : 'Need an account? Register'}
            </button>
            <button
              onClick={() => setShowAuthModal(false)}
              className="w-full mt-2 text-gray-400 hover:text-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Create Market Modal */}
      {showCreateMarket && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-slate-800 rounded-lg p-8 max-w-2xl w-full my-8">
            <h2 className="text-2xl font-bold text-white mb-6">Create Bet</h2>
            <form onSubmit={handleCreateMarket} className="space-y-4">
              <input
                type="text"
                placeholder="Question"
                value={marketForm.question}
                onChange={(e) => setMarketForm({ ...marketForm, question: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg"
                required
              />
              
              <select
                value={marketForm.category_id}
                onChange={(e) => setMarketForm({ ...marketForm, category_id: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg"
                required
              >
                <option value="">Select Category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>

              <div className="flex space-x-4">
                <label className="flex items-center text-white">
                  <input
                    type="radio"
                    value="binary"
                    checked={marketForm.marketType === 'binary'}
                    onChange={(e) => setMarketForm({ ...marketForm, marketType: e.target.value })}
                    className="mr-2"
                  />
                  Binary (Yes/No)
                </label>
                <label className="flex items-center text-white">
                  <input
                    type="radio"
                    value="multi-choice"
                    checked={marketForm.marketType === 'multi-choice'}
                    onChange={(e) => setMarketForm({ ...marketForm, marketType: e.target.value })}
                    className="mr-2"
                  />
                  Multi-Choice (2-4 options)
                </label>
              </div>

              <button
                type="button"
                onClick={calculateAIOdds}
                disabled={calculatingOdds || !marketForm.question || (marketForm.marketType === 'multi-choice' && marketForm.options.filter(o => o.text.trim()).length < 2)}
                className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {calculatingOdds ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    <span>Calculating AI Odds...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>🤖 Calculate AI Odds</span>
                  </>
                )}
              </button>

              {marketForm.marketType === 'binary' && (
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="number"
                    step="0.1"
                    placeholder="YES odds (e.g., 2.5)"
                    value={marketForm.yes_odds}
                    onChange={(e) => setMarketForm({ ...marketForm, yes_odds: e.target.value })}
                    className="px-4 py-2 bg-slate-700 text-white rounded-lg"
                    required
                  />
                  <input
                    type="number"
                    step="0.1"
                    placeholder="NO odds (e.g., 1.5)"
                    value={marketForm.no_odds}
                    onChange={(e) => setMarketForm({ ...marketForm, no_odds: e.target.value })}
                    className="px-4 py-2 bg-slate-700 text-white rounded-lg"
                    required
                  />
                </div>
              )}

              {marketForm.marketType === 'multi-choice' && (
                <div className="space-y-2">
                  {marketForm.options.map((option, index) => (
                    <div key={index} className="grid grid-cols-2 gap-4">
                      <input
                        type="text"
                        placeholder={`Option ${index + 1}`}
                        value={option.text}
                        onChange={(e) => {
                          const newOptions = [...marketForm.options];
                          newOptions[index].text = e.target.value;
                          setMarketForm({ ...marketForm, options: newOptions });
                        }}
                        className="px-4 py-2 bg-slate-700 text-white rounded-lg"
                        required
                      />
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Odds"
                        value={option.odds}
                        onChange={(e) => {
                          const newOptions = [...marketForm.options];
                          newOptions[index].odds = e.target.value;
                          setMarketForm({ ...marketForm, options: newOptions });
                        }}
                        className="px-4 py-2 bg-slate-700 text-white rounded-lg"
                        required
                      />
                    </div>
                  ))}
                  {marketForm.options.length < 4 && (
                    <button
                      type="button"
                      onClick={() => setMarketForm({
                        ...marketForm,
                        options: [...marketForm.options, { text: '', odds: '' }]
                      })}
                      className="w-full py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
                    >
                      + Add Option
                    </button>
                  )}
                </div>
              )}

              <input
                type="datetime-local"
                value={marketForm.deadline}
                onChange={(e) => setMarketForm({ ...marketForm, deadline: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg"
                required
              />

              <div className="flex space-x-4">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Create Bet
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateMarket(false)}
                  className="flex-1 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-6">Your Bets</h2>
            <div className="space-y-4">
              {userBets.map(bet => (
                <div key={bet.id} className="bg-slate-700 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-white">{bet.question}</h3>
                    <span className={`px-2 py-1 rounded text-sm ${
                      bet.status === 'won' ? 'bg-green-600' :
                      bet.status === 'lost' ? 'bg-red-600' :
                      'bg-yellow-600'
                    } text-white`}>
                      {bet.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-gray-300 text-sm space-y-1">
                    <div>Option: {bet.option_text}</div>
                    <div>Amount: ${bet.amount} @ {bet.odds}x</div>
                    <div>Potential: ${(bet.amount * bet.odds).toFixed(2)}</div>
                  </div>
                  {bet.status === 'active' && (
                    <button
                      onClick={() => handleCancelBet(bet.id)}
                      className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                    >
                      Cancel (95% refund)
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowProfileModal(false)}
              className="w-full mt-6 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg p-8 max-w-2xl w-full">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <Award className="w-8 h-8 text-yellow-400 mr-2" />
              Leaderboard
            </h2>
            <div className="space-y-3">
              {leaderboardData.map((entry, index) => (
                <div key={entry.id} className="bg-slate-700 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <span className="text-2xl font-bold text-purple-400">#{index + 1}</span>
                    <div>
                      <div className="font-semibold text-white">@{entry.username}</div>
                      <div className="text-sm text-gray-400">
                        {entry.total_bets} bets • {entry.wins} wins
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-green-400">${entry.balance}</div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowLeaderboard(false)}
              className="w-full mt-6 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Resolve Modal - For Admins */}
      {showResolveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-6">Resolve Bets</h2>
            <div className="space-y-4">
              {markets.filter(m => new Date(m.deadline) < new Date() && !m.resolved).map(market => (
                <div key={market.id} className="bg-slate-700 rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-3">{market.question}</h3>
                  <div className="space-y-2">
                    {market.options && market.options.length > 0 ? (
                      market.options
                        .filter((option, index, self) => 
                          index === self.findIndex(o => o.id === option.id)
                        )
                        .map(option => (
                          <button
                            key={option.id}
                            onClick={() => handleResolveMarket(market.id, option.id)}
                            className="w-full py-2 bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            {option.option_text}
                          </button>
                        ))
                    ) : (
                      <>
                        <button
                          onClick={() => handleResolveMarket(market.id, null)}
                          className="w-full py-2 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          YES
                        </button>
                        <button
                          onClick={() => handleResolveMarket(market.id, null)}
                          className="w-full py-2 bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          NO
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowResolveModal(false)}
              className="w-full mt-6 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
