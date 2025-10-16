import React, { useState, useEffect } from 'react';
import { LogIn, LogOut, TrendingUp, User, Wallet, Trophy, Medal, Award, Plus, Shield } from 'lucide-react';

const API_URL = `http://${window.location.hostname}:5000`;

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(10000);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });

  const [leaderboard, setLeaderboard] = useState([]);
  const [bettingMarkets, setBettingMarkets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [userStats, setUserStats] = useState(null);
  const [marketStats, setMarketStats] = useState({});

  const [newMarket, setNewMarket] = useState({
    question: '',
    yesOdds: '',
    noOdds: '',
    categoryId: '',
    deadline: ''
  });

  const [newCategory, setNewCategory] = useState('');
  const [showCategoryPanel, setShowCategoryPanel] = useState(false);

  const [activeBet, setActiveBet] = useState(null);
  const [betAmount, setBetAmount] = useState('');
  const [bets, setBets] = useState([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showUserStats, setShowUserStats] = useState(false);

  // Fetch markets on mount
  useEffect(() => {
    fetchMarkets();
    fetchLeaderboard();
    fetchCategories();
  }, []);

  // Fetch markets when category filter changes
  useEffect(() => {
    fetchMarkets();
  }, [selectedCategory]);

  // Fetch user bets when logged in
  useEffect(() => {
    if (isLoggedIn && user) {
      fetchUserBets();
      fetchUserBalance();
      fetchUserStats();
    }
  }, [isLoggedIn, user]);

  const fetchMarkets = async () => {
    try {
      const url = selectedCategory 
        ? `${API_URL}/api/markets?category_id=${selectedCategory}`
        : `${API_URL}/api/markets`;
      const response = await fetch(url);
      const data = await response.json();
      setBettingMarkets(data);
      
      // Fetch stats for each market
      data.forEach(market => fetchMarketStats(market.id));
    } catch (err) {
      console.error('Error fetching markets:', err);
    }
  };

  const fetchMarketStats = async (marketId) => {
    try {
      const response = await fetch(`${API_URL}/api/markets/${marketId}/stats`);
      const data = await response.json();
      setMarketStats(prev => ({ ...prev, [marketId]: data }));
    } catch (err) {
      console.error('Error fetching market stats:', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/api/categories`);
      const data = await response.json();
      setCategories(data);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchUserStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/users/${user.id}/stats`);
      const data = await response.json();
      setUserStats(data);
    } catch (err) {
      console.error('Error fetching user stats:', err);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`${API_URL}/api/leaderboard`);
      const data = await response.json();
      setLeaderboard(data);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    }
  };

  const fetchUserBets = async () => {
    try {
      const response = await fetch(`${API_URL}/api/users/${user.id}/bets`);
      const data = await response.json();
      setBets(data);
    } catch (err) {
      console.error('Error fetching bets:', err);
    }
  };

  const fetchUserBalance = async () => {
    try {
      const response = await fetch(`${API_URL}/api/users/${user.id}/balance`);
      const data = await response.json();
      setBalance(data.balance);
    } catch (err) {
      console.error('Error fetching balance:', err);
    }
  };

  const handleLogin = async () => {
    try {
      const endpoint = isSignUp ? '/api/auth/signup' : '/api/auth/login';
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Authentication failed');
        return;
      }

      const userData = await response.json();
      setUser(userData);
      setIsLoggedIn(true);
      setIsAdmin(userData.isAdmin);
      setBalance(userData.balance);
      setShowAuth(false);
      setFormData({ name: '', email: '', password: '' });
    } catch (err) {
      console.error('Login error:', err);
      alert('Login failed');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setIsAdmin(false);
    setUser(null);
    setBalance(10000);
    setBets([]);
    setShowAdminPanel(false);
  };

  const createNewMarket = async () => {
    if (!newMarket.question || !newMarket.yesOdds || !newMarket.noOdds || !newMarket.categoryId || !newMarket.deadline) {
      alert('Please fill all fields');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/markets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMarket)
      });

      if (!response.ok) {
        alert('Failed to create market');
        return;
      }

      await fetchMarkets();
      setNewMarket({ question: '', yesOdds: '', noOdds: '', categoryId: '', deadline: '' });
      setShowAdminPanel(false);
    } catch (err) {
      console.error('Create market error:', err);
      alert('Failed to create market');
    }
  };

  const createCategory = async () => {
    if (!newCategory.trim()) {
      alert('Please enter a category name');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategory })
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to create category');
        return;
      }

      await fetchCategories();
      setNewCategory('');
    } catch (err) {
      console.error('Create category error:', err);
      alert('Failed to create category');
    }
  };

  const deleteCategory = async (categoryId) => {
    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
      await fetch(`${API_URL}/api/categories/${categoryId}`, {
        method: 'DELETE'
      });
      await fetchCategories();
      await fetchMarkets();
    } catch (err) {
      console.error('Delete category error:', err);
      alert('Failed to delete category');
    }
  };

  const placeBet = (market, choice) => {
    if (!isLoggedIn) {
      setShowAuth(true);
      return;
    }
    setActiveBet({ market, choice });
  };

  const confirmBet = async () => {
  const amount = parseFloat(betAmount);
  if (amount <= 0 || amount > balance) {
    alert('Invalid bet amount');
    return;
  }

  const odds = activeBet.choice === 'yes' ? activeBet.market.yesOdds : activeBet.market.noOdds;
  const potentialWin = amount * odds;

  try {
    const response = await fetch(`${API_URL}/api/bets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        marketId: activeBet.market.id,
        choice: activeBet.choice,
        amount,
        odds,
        potentialWin
      })
    });

    if (!response.ok) {
      const error = await response.json();
      alert(error.error || 'Failed to place bet');
      return;
    }

    // Store market ID before clearing activeBet
    const marketId = activeBet.market.id;
    
    await fetchUserBets();
    await fetchUserBalance();
    await fetchUserStats(); // Update user stats too
    
    // Refresh stats for the market that was just bet on
    await fetchMarketStats(marketId);
    
    setActiveBet(null);
    setBetAmount('');
  } catch (err) {
    console.error('Bet error:', err);
    alert('Failed to place bet');
  }
};

  const getRankIcon = (rank) => {
    switch(rank) {
      case 0:
        return <Trophy className="text-yellow-400" size={32} />;
      case 1:
        return <Medal className="text-gray-300" size={28} />;
      case 2:
        return <Award className="text-orange-600" size={28} />;
      default:
        return <span className="text-purple-400 text-xl font-bold">#{rank + 1}</span>;
    }
  };

  const getAvatar = (index) => {
    const avatars = ['👩', '👨', '🧑', '👤', '🙋', '👨‍💼', '👩‍💼', '🧑‍💻'];
    return avatars[index % avatars.length];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="bg-black bg-opacity-50 border-b border-purple-500 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <TrendingUp className="text-purple-400" size={32} />
            <h1 className="text-2xl font-bold text-white">BinaryBets</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowLeaderboard(!showLeaderboard)}
              className="flex items-center space-x-2 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 px-4 py-2 rounded-lg transition"
            >
              <Trophy size={18} />
              <span>Leaderboard</span>
            </button>

            {isLoggedIn && !isAdmin && (
              <button
                onClick={() => setShowUserStats(true)}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition"
              >
                <span>My Stats</span>
              </button>
            )}

            {isLoggedIn ? (
              <>
                <div className="flex items-center space-x-2 text-green-400">
                  <Wallet size={20} />
                  <span className="font-semibold">${balance.toFixed(2)}</span>
                </div>
                <div className="flex items-center space-x-2 text-purple-300">
                  {isAdmin && <Shield className="text-red-400" size={18} />}
                  <User size={20} />
                  <span>{user?.name}</span>
                </div>
                {isAdmin && (
                  <>
                    <button
                      onClick={() => setShowCategoryPanel(true)}
                      className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded-lg transition"
                    >
                      <Plus size={18} />
                      <span>Manage Categories</span>
                    </button>
                    <button
                      onClick={() => setShowAdminPanel(true)}
                      className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition"
                    >
                      <Plus size={18} />
                      <span>Create Market</span>
                    </button>
                  </>
                )}
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition"
                >
                  <LogOut size={18} />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg transition"
              >
                <LogIn size={18} />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-white flex items-center space-x-3">
                <Trophy className="text-yellow-400" size={36} />
                <span>Top Winners</span>
              </h2>
              <button
                onClick={() => setShowLeaderboard(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              {leaderboard.map((player, index) => (
                <div
                  key={player.id}
                  className={`p-4 rounded-lg flex items-center justify-between ${
                    index < 3 
                      ? 'bg-gradient-to-r from-purple-900 to-purple-800 border-2 border-purple-500' 
                      : 'bg-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 flex justify-center">
                      {getRankIcon(index)}
                    </div>
                    <div className="text-3xl">{getAvatar(index)}</div>
                    <div>
                      <p className="text-white font-bold text-lg">{player.name}</p>
                      <p className="text-purple-300 text-sm">{player.betsWon} bets won</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 font-bold text-xl">
                      ${player.winnings.toLocaleString()}
                    </p>
                    <p className="text-gray-400 text-sm">Total Winnings</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* User Stats Modal */}
      {showUserStats && userStats && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-8 max-w-3xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-white">Your Betting Statistics</h2>
              <button
                onClick={() => setShowUserStats(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-700 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Total Bets</p>
                <p className="text-white text-2xl font-bold">{userStats.totalBets}</p>
              </div>
              <div className="bg-slate-700 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Win Rate</p>
                <p className="text-green-400 text-2xl font-bold">{userStats.winRate}%</p>
              </div>
              <div className="bg-slate-700 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Total Wagered</p>
                <p className="text-white text-2xl font-bold">${userStats.totalWagered.toFixed(2)}</p>
              </div>
              <div className="bg-slate-700 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Total Won</p>
                <p className="text-green-400 text-2xl font-bold">${userStats.totalWon.toFixed(2)}</p>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-bold text-white mb-4">Comparison with Others</h3>
              <div className="bg-slate-700 rounded-lg p-4">
                <p className="text-gray-300 mb-2">
                  Average bets per user: <span className="font-bold text-white">{userStats.avgBetsPerUser.toFixed(1)}</span>
                </p>
                <p className="text-gray-300">
                  You are {userStats.totalBets > userStats.avgBetsPerUser ? 'above' : 'below'} average
                  ({userStats.totalBets > userStats.avgBetsPerUser ? '+' : ''}
                  {(userStats.totalBets - userStats.avgBetsPerUser).toFixed(1)} bets)
                </p>
              </div>
            </div>

            {userStats.favoriteCategories.length > 0 && (
              <div>
                <h3 className="text-xl font-bold text-white mb-4">Favorite Categories</h3>
                <div className="space-y-2">
                  {userStats.favoriteCategories.map((cat, idx) => (
                    <div key={idx} className="bg-slate-700 rounded-lg p-3 flex justify-between items-center">
                      <span className="text-white">{cat.category || 'Other'}</span>
                      <span className="text-purple-400 font-bold">{cat.bet_count} bets</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Category Management Modal (Admin Only) */}
      {showCategoryPanel && isAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
                <Shield className="text-red-400" />
                <span>Manage Categories</span>
              </h2>
              <button
                onClick={() => setShowCategoryPanel(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-purple-300 mb-2">New Category</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Enter category name"
                  className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={createCategory}
                  className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg font-semibold transition"
                >
                  Add
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold text-white mb-4">Existing Categories</h3>
              <div className="space-y-2">
                {categories.map(category => (
                  <div key={category.id} className="bg-slate-700 rounded-lg p-3 flex justify-between items-center">
                    <span className="text-white">{category.name}</span>
                    <button
                      onClick={() => deleteCategory(category.id)}
                      className="text-red-400 hover:text-red-300 font-semibold"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Panel Modal */}
      {showAdminPanel && isAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-8 max-w-2xl w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
                <Shield className="text-red-400" />
                <span>Admin Panel - Create New Market</span>
              </h2>
              <button
                onClick={() => setShowAdminPanel(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-purple-300 mb-2">Question</label>
                <input
                  type="text"
                  value={newMarket.question}
                  onChange={(e) => setNewMarket({ ...newMarket, question: e.target.value })}
                  placeholder="Will X happen by Y date?"
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-purple-300 mb-2">YES Odds</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newMarket.yesOdds}
                    onChange={(e) => setNewMarket({ ...newMarket, yesOdds: e.target.value })}
                    placeholder="1.85"
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-purple-300 mb-2">NO Odds</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newMarket.noOdds}
                    onChange={(e) => setNewMarket({ ...newMarket, noOdds: e.target.value })}
                    placeholder="2.10"
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-purple-300 mb-2">Category</label>
                <select
                  value={newMarket.categoryId}
                  onChange={(e) => setNewMarket({ ...newMarket, categoryId: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select a category</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-purple-300 mb-2">Deadline</label>
                <input
                  type="text"
                  value={newMarket.deadline}
                  onChange={(e) => setNewMarket({ ...newMarket, deadline: e.target.value })}
                  placeholder="Dec 31, 2025"
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <button
                onClick={createNewMarket}
                className="w-full bg-green-600 hover:bg-green-700 py-3 rounded-lg font-semibold transition flex items-center justify-center space-x-2"
              >
                <Plus size={20} />
                <span>Create Market</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {showAuth && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-white mb-6">
              {isSignUp ? 'Create Account' : 'Sign In'}
            </h2>
            <div className="space-y-4">
              {isSignUp && (
                <div>
                  <label className="block text-purple-300 mb-2">Full Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-purple-300 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-purple-300 mb-2">Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <button
                onClick={handleLogin}
                className="w-full bg-purple-600 hover:bg-purple-700 py-3 rounded-lg font-semibold transition"
              >
                {isSignUp ? 'Create Account' : 'Sign In'}
              </button>
            </div>
            <p className="text-center text-purple-300 mt-4">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-purple-400 hover:text-purple-300 font-semibold"
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
            <div className="mt-4 p-3 bg-slate-700 rounded-lg">
              <p className="text-sm text-gray-400 text-center">
                Admin Login: admin@binarybets.com / admin123
              </p>
            </div>
            <button
              onClick={() => setShowAuth(false)}
              className="w-full mt-4 text-gray-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Bet Confirmation Modal */}
      {activeBet && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-8 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">Place Your Bet</h2>
            <p className="text-purple-300 mb-4">{activeBet.market.question}</p>
            <div className="bg-slate-700 rounded-lg p-4 mb-4">
              <p className="text-white">
                Betting: <span className="font-bold text-green-400">{activeBet.choice.toUpperCase()}</span>
              </p>
              <p className="text-white">
                Odds: <span className="font-bold">{activeBet.choice === 'yes' ? activeBet.market.yesOdds : activeBet.market.noOdds}x</span>
              </p>
            </div>

            {/* Show market statistics */}
            {marketStats[activeBet.market.id] && (
              <div className="bg-slate-700 rounded-lg p-3 mb-4">
                <p className="text-sm text-gray-300 mb-2">Others are betting:</p>
                <p className="text-green-400 text-sm">
                  {marketStats[activeBet.market.id].yesPercentage}% chose YES
                </p>
                <p className="text-red-400 text-sm">
                  {marketStats[activeBet.market.id].noPercentage}% chose NO
                </p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-purple-300 mb-2">Bet Amount ($)</label>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                placeholder="Enter amount"
                min="1"
                max={balance}
                className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            {betAmount && (
              <p className="text-green-400 mb-4">
                Potential Win: ${(parseFloat(betAmount) * (activeBet.choice === 'yes' ? activeBet.market.yesOdds : activeBet.market.noOdds)).toFixed(2)}
              </p>
            )}
            <div className="flex space-x-3">
              <button
                onClick={confirmBet}
                className="flex-1 bg-green-600 hover:bg-green-700 py-3 rounded-lg font-semibold transition"
                disabled={!betAmount || parseFloat(betAmount) > balance}
              >
                Confirm Bet
              </button>
              <button
                onClick={() => {
                  setActiveBet(null);
                  setBetAmount('');
                }}
                className="flex-1 bg-gray-600 hover:bg-gray-700 py-3 rounded-lg font-semibold transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Active Markets</h2>
          <p className="text-purple-300 mb-4">Place your bets on binary outcomes</p>
          
          <div className="flex items-center space-x-4">
            <label className="text-purple-300">Filter by category:</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {bettingMarkets.map((market) => {
            const stats = marketStats[market.id] || {};
            return (
              <div key={market.id} className="bg-slate-800 bg-opacity-50 rounded-xl p-6 border border-purple-500 hover:border-purple-400 transition backdrop-blur-sm">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="inline-block bg-purple-600 text-xs px-3 py-1 rounded-full mb-2">
                      {market.category}
                    </span>
                    <h3 className="text-lg font-semibold text-white mb-2">{market.question}</h3>
                    <p className="text-sm text-gray-400">Closes: {market.deadline}</p>
                  </div>
                </div>
                
                {/* Betting Statistics */}
                {stats.yesPercentage !== undefined && (
                  <div className="mb-4 bg-slate-700 rounded-lg p-3">
                    <p className="text-sm text-gray-300 mb-2">Community Betting:</p>
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="flex-1 bg-slate-600 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full transition-all"
                          style={{ width: `${stats.yesPercentage}%` }}
                        ></div>
                      </div>
                      <span className="text-green-400 text-sm font-bold">{stats.yesPercentage}% YES</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-slate-600 rounded-full h-2">
                        <div 
                          className="bg-red-500 h-2 rounded-full transition-all"
                          style={{ width: `${stats.noPercentage}%` }}
                        ></div>
                      </div>
                      <span className="text-red-400 text-sm font-bold">{stats.noPercentage}% NO</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      {(stats.yes?.count || 0) + (stats.no?.count || 0)} total bets placed
                    </p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <button
                    onClick={() => placeBet(market, 'yes')}
                    className="bg-green-600 hover:bg-green-700 py-4 rounded-lg transition transform hover:scale-105"
                  >
                    <div className="text-white font-bold text-lg">YES</div>
                    <div className="text-green-200 text-sm">{market.yesOdds}x</div>
                  </button>
                  <button
                    onClick={() => placeBet(market, 'no')}
                    className="bg-red-600 hover:bg-red-700 py-4 rounded-lg transition transform hover:scale-105"
                  >
                    <div className="text-white font-bold text-lg">NO</div>
                    <div className="text-red-200 text-sm">{market.noOdds}x</div>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Active Bets */}
        {isLoggedIn && bets.length > 0 && (
          <div className="bg-slate-800 bg-opacity-50 rounded-xl p-6 border border-purple-500 backdrop-blur-sm">
            <h3 className="text-2xl font-bold text-white mb-4">Your Active Bets</h3>
            <div className="space-y-3">
              {bets.map((bet) => (
                <div key={bet.id} className="bg-slate-700 rounded-lg p-4 flex justify-between items-center">
                  <div>
                    <p className="text-white font-semibold">{bet.market}</p>
                    <p className="text-purple-300 text-sm">
                      Bet: <span className="font-bold">{bet.choice.toUpperCase()}</span> at {bet.odds}x
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold">${bet.amount.toFixed(2)}</p>
                    <p className="text-green-400 text-sm">Win: ${bet.potentialWin.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
