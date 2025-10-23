import { useState, useEffect } from 'react';
import './App.css';

const API_URL = 'https://api.binary-bets.com/api';

// Helper function to safely format currency values
const formatCurrency = (value) => {
  return parseFloat(value || 0).toFixed(2);
};

export default function App() {
  const [markets, setMarkets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState('all');
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
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [newMarket, setNewMarket] = useState({
    question: '',
    categoryId: '',
    subcategoryId: '',
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

  // Admin category management
  const [newCategory, setNewCategory] = useState({ name: '', color: '#8B5CF6', icon: '' });
  const [newSubcategory, setNewSubcategory] = useState({ categoryId: '', name: '' });

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

  useEffect(() => {
    if (selectedCategory !== 'all') {
      fetchSubcategories(selectedCategory);
    } else {
      setSubcategories([]);
    }
    setSelectedSubcategory('all');
  }, [selectedCategory]);

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

  const fetchSubcategories = async (categoryId) => {
    try {
      const response = await fetch(`${API_URL}/categories/${categoryId}/subcategories`);
      const data = await response.json();
      setSubcategories(data);
    } catch (error) {
      console.error('Error fetching subcategories:', error);
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

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCategory)
      });

      if (response.ok) {
        showSuccess('Category created successfully!');
        setNewCategory({ name: '', color: '#8B5CF6', icon: '' });
        fetchCategories();
      } else {
        const data = await response.json();
        showError(data.error || 'Failed to create category');
      }
    } catch (error) {
      showError('Network error. Please try again.');
    }
  };

  const handleCreateSubcategory = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/subcategories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: parseInt(newSubcategory.categoryId),
          name: newSubcategory.name
        })
      });

      if (response.ok) {
        showSuccess('Subcategory created successfully!');
        setNewSubcategory({ categoryId: '', name: '' });
        if (selectedCategory !== 'all') {
          fetchSubcategories(selectedCategory);
        }
      } else {
        const data = await response.json();
        showError(data.error || 'Failed to create subcategory');
      }
    } catch (error) {
      showError('Network error. Please try again.');
    }
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
        subcategoryId: newMarket.subcategoryId ? parseInt(newMarket.subcategoryId) : null,
        marketType: newMarket.marketType,
        deadline: newMarket.deadline,
        createdBy: user.id
      };

      if (newMarket.marketType === 'binary') {
        marketData.yesOdds = parseFloat(newMarket.yesOdds);
        marketData.noOdds = parseFloat(newMarket.noOdds);
      } else {
        marketData.options = newMarket.options.filter(opt => opt.trim());
        if (newMarket.optionOdds) {
          marketData.optionOdds = newMarket.optionOdds;
        }
      }

      const response = await fetch(`${API_URL}/markets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(marketData)
      });

      if (response.ok) {
        showSuccess('Market created successfully!');
        setShowCreateModal(false);
        setNewMarket({
          question: '',
          categoryId: '',
          subcategoryId: '',
          marketType: 'binary',
          yesOdds: '',
          noOdds: '',
          options: ['', ''],
          deadline: ''
        });
        fetchMarkets();
      } else {
        const data = await response.json();
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
      const betData = {
        userId: user.id,
        marketId: selectedMarket.id,
        amount: parseFloat(betAmount),
        odds: selectedOption.odds
      };

      if (selectedMarket.market_type === 'binary') {
        betData.betType = selectedOption.option_text;
      } else {
        betData.marketOptionId = selectedOption.id;
      }

      const response = await fetch(`${API_URL}/bets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(betData)
      });

      const data = await response.json();

      if (response.ok) {
        showSuccess('Bet placed successfully!');
        setUser({ ...user, balance: data.newBalance });
        localStorage.setItem('user', JSON.stringify({ ...user, balance: data.newBalance }));
        setSelectedMarket(null);
        setSelectedOption(null);
        setBetAmount('');
        fetchMarkets();
        fetchUserBets();
      } else {
        showError(data.error || 'Failed to place bet');
      }
    } catch (error) {
      showError('Network error. Please try again.');
    }
  };

  const handleResolveMarket = async (marketId, outcome) => {
    try {
      const response = await fetch(`${API_URL}/markets/${marketId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          outcome,
          resolvedBy: user.id 
        })
      });

      if (response.ok) {
        showSuccess('Market resolved successfully!');
        setSelectedMarket(null);
        fetchMarkets();
        fetchUserBets();
      } else {
        const data = await response.json();
        showError(data.error || 'Failed to resolve market');
      }
    } catch (error) {
      showError('Network error. Please try again.');
    }
  };

  const filteredMarkets = markets.filter(m => {
    if (selectedCategory !== 'all' && m.category_id !== parseInt(selectedCategory)) return false;
    if (selectedSubcategory !== 'all' && m.subcategory_id !== parseInt(selectedSubcategory)) return false;
    return true;
  });

  const currentCategorySubcategories = selectedCategory !== 'all' && newMarket.categoryId
    ? subcategories.filter(s => s.category_id === parseInt(newMarket.categoryId))
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Error/Success Messages */}
      {error && (
        <div className="fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-in">
          {error}
        </div>
      )}
      {success && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-in">
          {success}
        </div>
      )}

      {/* Header */}
      <header className="bg-slate-900/50 backdrop-blur-md border-b border-purple-500/20 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="text-3xl">🎲</div>
              <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                BinaryBets
              </h1>
            </div>

            <div className="flex items-center gap-4">
              {user && (
                <>
                  <div className="text-right">
                    <p className="text-sm text-gray-400">Balance</p>
                    <p className="text-lg font-bold text-green-400">${formatCurrency(user.balance)}</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowLeaderboard(true);
                      fetchLeaderboard();
                    }}
                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-semibold transition"
                  >
                    🏆 Leaderboard
                  </button>
                  {user.is_admin && (
                    <>
                      <button
                        onClick={() => setShowAdminPanel(true)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition"
                      >
                        ⚙️ Admin
                      </button>
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition"
                      >
                        Create Market
                      </button>
                    </>
                  )}
                </>
              )}
              
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-white font-semibold">{user.username}</p>
                    <p className="text-xs text-gray-400">{user.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-semibold transition"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Category Filter */}
        <div className="mb-4">
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-lg font-semibold transition whitespace-nowrap ${
                selectedCategory === 'all'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
              }`}
            >
              All Markets
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id.toString())}
                className={`px-4 py-2 rounded-lg font-semibold transition whitespace-nowrap flex items-center gap-2 ${
                  selectedCategory === cat.id.toString()
                    ? 'text-white'
                    : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
                }`}
                style={selectedCategory === cat.id.toString() ? { backgroundColor: cat.color } : {}}
              >
                {cat.icon && <span>{cat.icon}</span>}
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Subcategory Filter */}
        {selectedCategory !== 'all' && subcategories.length > 0 && (
          <div className="mb-6">
            <div className="flex gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => setSelectedSubcategory('all')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition whitespace-nowrap ${
                  selectedSubcategory === 'all'
                    ? 'bg-purple-500 text-white'
                    : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                }`}
              >
                All
              </button>
              {subcategories.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubcategory(sub.id.toString())}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition whitespace-nowrap ${
                    selectedSubcategory === sub.id.toString()
                      ? 'bg-purple-500 text-white'
                      : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                  }`}
                >
                  {sub.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Markets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMarkets.map((market) => (
            <div
              key={market.id}
              className="bg-slate-800 rounded-xl p-6 border border-purple-500/20 hover:border-purple-500/50 transition cursor-pointer"
              onClick={() => setSelectedMarket(market)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className="px-3 py-1 rounded-full text-xs font-semibold"
                    style={{ backgroundColor: market.category_color + '40', color: market.category_color }}
                  >
                    {market.category_name}
                  </span>
                  {market.subcategory_name && (
                    <span className="px-2 py-1 bg-slate-700 text-gray-300 rounded-full text-xs">
                      {market.subcategory_name}
                    </span>
                  )}
                </div>
                {market.resolved && (
                  <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded-full text-xs font-semibold">
                    Resolved
                  </span>
                )}
              </div>

              <h3 className="text-white font-semibold text-lg mb-4">{market.question}</h3>

              {market.market_type === 'binary' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
                    <p className="text-green-400 text-sm font-semibold">Yes</p>
                    <p className="text-white text-xl font-bold">{market.yes_odds}x</p>
                  </div>
                  <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                    <p className="text-red-400 text-sm font-semibold">No</p>
                    <p className="text-white text-xl font-bold">{market.no_odds}x</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {market.options?.slice(0, 3).map((opt) => (
                    <div key={opt.id} className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-2 flex justify-between items-center">
                      <span className="text-white text-sm">{opt.option_text}</span>
                      <span className="text-purple-400 font-bold">{opt.odds}x</span>
                    </div>
                  ))}
                  {market.options?.length > 3 && (
                    <p className="text-gray-400 text-xs text-center">+{market.options.length - 3} more</p>
                  )}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-slate-700 flex justify-between text-sm text-gray-400">
                <span>Deadline: {new Date(market.deadline).toLocaleDateString()}</span>
                <span>{market.bet_count || 0} bets</span>
              </div>
            </div>
          ))}
        </div>

        {/* User Bets Section */}
        {user && userBets.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-white mb-6">Your Bets</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {userBets.map((bet) => (
                <div key={bet.id} className="bg-slate-800 rounded-lg p-4 border border-purple-500/20">
                  <p className="text-white font-semibold mb-2">{bet.market_question}</p>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Your bet:</span>
                    <span className="text-white">{bet.bet_type || bet.option_text}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Amount:</span>
                    <span className="text-white">${formatCurrency(bet.amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Odds:</span>
                    <span className="text-purple-400">{bet.odds}x</span>
                  </div>
                  <div className="flex justify-between text-sm mt-2 pt-2 border-t border-slate-700">
                    <span className="text-gray-400">Potential win:</span>
                    <span className="text-green-400 font-bold">${formatCurrency(parseFloat(bet.amount) * parseFloat(bet.odds))}</span>
                  </div>
                  {bet.resolved && (
                    <div className={`mt-2 px-3 py-1 rounded text-center text-sm font-semibold ${
                      bet.won ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
                    }`}>
                      {bet.won ? '✓ Won' : '✗ Lost'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Admin Panel Modal */}
      {showAdminPanel && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-slate-800 rounded-xl p-8 max-w-2xl w-full border border-purple-500/20 my-8">
            <h2 className="text-2xl font-bold text-white mb-6">Admin Panel</h2>
            
            {/* Create Category */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-4">Create New Category</h3>
              <form onSubmit={handleCreateCategory} className="space-y-4">
                <input
                  type="text"
                  placeholder="Category Name"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
                <input
                  type="text"
                  placeholder="Icon (emoji)"
                  value={newCategory.icon}
                  onChange={(e) => setNewCategory({ ...newCategory, icon: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                />
                <div className="flex gap-4">
                  <input
                    type="color"
                    value={newCategory.color}
                    onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                    className="w-20 h-10 rounded cursor-pointer"
                  />
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition"
                  >
                    Create Category
                  </button>
                </div>
              </form>
            </div>

            {/* Create Subcategory */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-4">Create New Subcategory</h3>
              <form onSubmit={handleCreateSubcategory} className="space-y-4">
                <select
                  value={newSubcategory.categoryId}
                  onChange={(e) => setNewSubcategory({ ...newSubcategory, categoryId: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="">Select Parent Category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Subcategory Name"
                  value={newSubcategory.name}
                  onChange={(e) => setNewSubcategory({ ...newSubcategory, name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition"
                >
                  Create Subcategory
                </button>
              </form>
            </div>

            <button
              onClick={() => setShowAdminPanel(false)}
              className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

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
                    placeholder="Username"
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
              
              {isRegister && (
                <input
                  type="password"
                  placeholder="Confirm Password"
                  value={authForm.confirmPassword}
                  onChange={(e) => setAuthForm({ ...authForm, confirmPassword: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              )}
              
              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-semibold transition"
              >
                {isRegister ? 'Create Account' : 'Sign In'}
              </button>
            </form>
            
            <div className="mt-4 text-center">
              <button
                onClick={() => setIsRegister(!isRegister)}
                className="text-purple-400 hover:text-purple-300 text-sm"
              >
                {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
              </button>
            </div>
            
            <button
              onClick={() => setShowAuthModal(false)}
              className="w-full mt-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Create Market Modal - continued in next part due to length */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-slate-800 rounded-xl p-8 max-w-2xl w-full border border-purple-500/20 my-8">
            <h2 className="text-2xl font-bold text-white mb-6">Create New Market</h2>
            
            <form onSubmit={handleCreateMarket} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Question
                </label>
                <input
                  type="text"
                  value={newMarket.question}
                  onChange={(e) => setNewMarket({ ...newMarket, question: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Will X happen by Y date?"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Category
                  </label>
                  <select
                    value={newMarket.categoryId}
                    onChange={(e) => {
                      setNewMarket({ ...newMarket, categoryId: e.target.value, subcategoryId: '' });
                      if (e.target.value) {
                        fetchSubcategories(e.target.value);
                      }
                    }}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                    required
                  >
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Subcategory (Optional)
                  </label>
                  <select
                    value={newMarket.subcategoryId}
                    onChange={(e) => setNewMarket({ ...newMarket, subcategoryId: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                    disabled={!newMarket.categoryId || currentCategorySubcategories.length === 0}
                  >
                    <option value="">None</option>
                    {currentCategorySubcategories.map((sub) => (
                      <option key={sub.id} value={sub.id}>{sub.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Market Type
                </label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setNewMarket({ ...newMarket, marketType: 'binary' })}
                    className={`flex-1 py-2 rounded-lg font-semibold transition ${
                      newMarket.marketType === 'binary'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                    }`}
                  >
                    Binary (Yes/No)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewMarket({ ...newMarket, marketType: 'multi-choice' })}
                    className={`flex-1 py-2 rounded-lg font-semibold transition ${
                      newMarket.marketType === 'multi-choice'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                    }`}
                  >
                    Multi-Choice
                  </button>
                </div>
              </div>

              {newMarket.marketType === 'binary' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Yes Odds
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={newMarket.yesOdds}
                      onChange={(e) => setNewMarket({ ...newMarket, yesOdds: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="1.5"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      No Odds
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={newMarket.noOdds}
                      onChange={(e) => setNewMarket({ ...newMarket, noOdds: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="2.5"
                      required
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Options
                  </label>
                  {newMarket.options.map((option, index) => (
                    <input
                      key={index}
                      type="text"
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...newMarket.options];
                        newOptions[index] = e.target.value;
                        setNewMarket({ ...newMarket, options: newOptions });
                      }}
                      className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500 mb-2"
                      placeholder={`Option ${index + 1}`}
                      required
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => setNewMarket({ ...newMarket, options: [...newMarket.options, ''] })}
                    className="text-purple-400 hover:text-purple-300 text-sm"
                  >
                    + Add option
                  </button>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Deadline
                </label>
                <input
                  type="datetime-local"
                  value={newMarket.deadline}
                  onChange={(e) => setNewMarket({ ...newMarket, deadline: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <button
                type="button"
                onClick={calculateAIOdds}
                disabled={!newMarket.question || calculatingOdds}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {calculatingOdds ? 'Calculating...' : '🤖 Calculate Odds with AI'}
              </button>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition"
                >
                  Create Market
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewMarket({
                      question: '',
                      categoryId: '',
                      subcategoryId: '',
                      marketType: 'binary',
                      yesOdds: '',
                      noOdds: '',
                      options: ['', ''],
                      deadline: ''
                    });
                  }}
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
                    <p className="text-green-400 font-bold text-lg">${formatCurrency(player.balance)}</p>
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
