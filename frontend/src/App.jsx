import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Award, Shield, Plus, X, BarChart3, User } from 'lucide-react';

const API_URL = `http://${window.location.hostname}:5000`;

function App() {
  const [user, setUser] = useState(null);
  const [markets, setMarkets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [bets, setBets] = useState([]);
  const [balance, setBalance] = useState(10000);
  const [showAuth, setShowAuth] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showUserStats, setShowUserStats] = useState(false);
  const [showUserAccount, setShowUserAccount] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [activeBet, setActiveBet] = useState(null);
  const [betAmount, setBetAmount] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [leaderboard, setLeaderboard] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [marketStats, setMarketStats] = useState({});
  const [newCategory, setNewCategory] = useState('');
  const [newMarket, setNewMarket] = useState({
    question: '',
    yesOdds: '',
    noOdds: '',
    categoryId: '',
    deadline: ''
  });
  const [editProfile, setEditProfile] = useState({
    email: '',
    avatar: ''
  });

  const isLoggedIn = !!user;
  const isAdmin = user?.isAdmin || false;

  useEffect(() => {
    fetchMarkets();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      fetchUserBets();
      fetchUserBalance();
      fetchUserStats();
    }
  }, [user]);

  const fetchMarkets = async () => {
    try {
      const response = await fetch(`${API_URL}/api/markets`);
      const data = await response.json();
      
      // Ensure numeric fields are parsed as numbers
      const parsedData = data.map(market => ({
        ...market,
        yesOdds: parseFloat(market.yesOdds || market.yes_odds),
        noOdds: parseFloat(market.noOdds || market.no_odds)
      }));
      
      setMarkets(parsedData);
      
      // Fetch stats for each market
      parsedData.forEach(market => {
        fetchMarketStats(market.id);
      });
    } catch (err) {
      console.error('Failed to fetch markets:', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/api/categories`);
      const data = await response.json();
      setCategories(data);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const fetchMarketStats = async (marketId) => {
    try {
      const response = await fetch(`${API_URL}/api/markets/${marketId}/stats`);
      const data = await response.json();
      setMarketStats(prev => ({
        ...prev,
        [marketId]: data
      }));
    } catch (err) {
      console.error('Failed to fetch market stats:', err);
    }
  };

  const fetchUserBets = async () => {
    try {
      const response = await fetch(`${API_URL}/api/users/${user.id}/bets`);
      const data = await response.json();
      
      // Ensure numeric fields are parsed as numbers
      const parsedBets = data.map(bet => ({
        ...bet,
        amount: parseFloat(bet.amount),
        odds: parseFloat(bet.odds),
        potentialWin: parseFloat(bet.potentialWin || bet.potential_win)
      }));
      
      setBets(parsedBets);
    } catch (err) {
      console.error('Failed to fetch user bets:', err);
    }
  };

  const fetchUserBalance = async () => {
    try {
      const response = await fetch(`${API_URL}/api/users/${user.id}/balance`);
      const data = await response.json();
      setBalance(parseFloat(data.balance));
    } catch (err) {
      console.error('Failed to fetch balance:', err);
    }
  };

  const fetchUserStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/users/${user.id}/stats`);
      const data = await response.json();
      
      // Ensure all numeric fields are parsed
      const parsedStats = {
        totalBets: parseInt(data.totalBets || 0),
        totalWagered: parseFloat(data.totalWagered || 0),
        winRate: parseFloat(data.winRate || 0),
        totalWinnings: parseFloat(data.totalWinnings || 0),
        favoriteCategory: data.favoriteCategory || 'None',
        avgBetAmount: parseFloat(data.avgBetAmount || 0),
        avgBetsPerUser: parseFloat(data.avgBetsPerUser || 0)
      };
      
      setUserStats(parsedStats);
    } catch (err) {
      console.error('Failed to fetch user stats:', err);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`${API_URL}/api/leaderboard`);
      const data = await response.json();
      
      // Ensure numeric fields are parsed as numbers
      const parsedLeaderboard = data.map(player => ({
        ...player,
        totalWinnings: parseFloat(player.totalWinnings || player.total_winnings),
        balance: parseFloat(player.balance)
      }));
      
      setLeaderboard(parsedLeaderboard);
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    const endpoint = authMode === 'login' ? 'login' : 'register';
    
    try {
      const response = await fetch(`${API_URL}/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Authentication failed');
        return;
      }

      const data = await response.json();
      setUser(data);
      setBalance(parseFloat(data.balance));
      setShowAuth(false);
      setAuthForm({ name: '', email: '', password: '' });
    } catch (err) {
      console.error('Auth error:', err);
      alert('Authentication failed');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setBets([]);
    setBalance(10000);
    setUserStats(null);
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
        body: JSON.stringify({ name: newCategory, userId: user.id })
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to create category');
        return;
      }

      await fetchCategories();
      setNewCategory('');
      alert('Category created successfully!');
    } catch (err) {
      console.error('Category creation error:', err);
      alert('Failed to create category');
    }
  };

  const deleteCategory = async (categoryId) => {
    if (!confirm('Are you sure you want to delete this category?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/categories/${categoryId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to delete category');
        return;
      }

      await fetchCategories();
      alert('Category deleted successfully!');
    } catch (err) {
      console.error('Category deletion error:', err);
      alert('Failed to delete category');
    }
  };

  const createMarket = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch(`${API_URL}/api/markets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newMarket,
          yesOdds: parseFloat(newMarket.yesOdds),
          noOdds: parseFloat(newMarket.noOdds),
          categoryId: parseInt(newMarket.categoryId),
          userId: user.id
        })
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to create market');
        return;
      }

      await fetchMarkets();
      setShowAdminPanel(false);
      setNewMarket({ question: '', yesOdds: '', noOdds: '', categoryId: '', deadline: '' });
      alert('Market created successfully!');
    } catch (err) {
      console.error('Market creation error:', err);
      alert('Failed to create market');
    }
  };

  const hasActiveBetOnMarket = (marketId) => {
    return bets.some(bet => bet.marketId === marketId && bet.status === 'pending');
  };

  const placeBet = (market, choice) => {
    if (!isLoggedIn) {
      setShowAuth(true);
      return;
    }
    
    if (hasActiveBetOnMarket(market.id)) {
      alert('You already have an active bet on this market. Cancel your existing bet first if you want to place a new one.');
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

      const result = await response.json();
      alert(result.message);

      const marketId = activeBet.market.id;
      
      await fetchUserBets();
      await fetchUserBalance();
      await fetchUserStats();
      await fetchMarketStats(marketId);
      
      setActiveBet(null);
      setBetAmount('');
    } catch (err) {
      console.error('Bet error:', err);
      alert('Failed to place bet');
    }
  };

  const cancelBet = async (betId) => {
    if (!confirm('Are you sure you want to cancel this bet? You will be charged a penalty fee if you rebet on this market within 5 minutes.')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/bets/${betId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to cancel bet');
        return;
      }

      const data = await response.json();
      alert(data.message);
      
      await fetchUserBets();
      await fetchUserBalance();
      await fetchUserStats();
      
      const cancelledBet = bets.find(b => b.id === betId);
      if (cancelledBet) {
        await fetchMarketStats(cancelledBet.marketId);
      }
    } catch (err) {
      console.error('Cancel bet error:', err);
      alert('Failed to cancel bet');
    }
  };

  const updateProfile = async () => {
    try {
      const response = await fetch(`${API_URL}/api/users/${user.id}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: editProfile.email || user.email,
          avatar: editProfile.avatar || user.avatar
        })
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to update profile');
        return;
      }

      const updatedUser = await response.json();
      setUser(updatedUser);
      setEditProfile({ email: '', avatar: '' });
      alert('Profile updated successfully!');
    } catch (err) {
      console.error('Profile update error:', err);
      alert('Failed to update profile');
    }
  };

  const getMarketStatsPercentages = (marketId) => {
    const stats = marketStats[marketId];
    if (!stats) return { yesPercent: 0, noPercent: 0 };

    const totalBets = parseInt(stats.yes_bets || 0) + parseInt(stats.no_bets || 0);
    if (totalBets === 0) return { yesPercent: 0, noPercent: 0 };

    return {
      yesPercent: Math.round((parseInt(stats.yes_bets || 0) / totalBets) * 100),
      noPercent: Math.round((parseInt(stats.no_bets || 0) / totalBets) * 100)
    };
  };

  const filteredMarkets = selectedCategory === 'all' 
    ? markets 
    : markets.filter(m => m.categoryId === parseInt(selectedCategory));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800 bg-opacity-50 backdrop-blur-md border-b border-purple-500 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <TrendingUp className="text-purple-400" size={32} />
            <h1 className="text-2xl font-bold text-white">BinaryBets</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {isLoggedIn && (
              <>
                <div className="flex items-center space-x-2 bg-slate-700 px-4 py-2 rounded-lg">
                  <DollarSign className="text-green-400" size={20} />
                  <span className="text-white font-semibold">${parseFloat(balance).toFixed(2)}</span>
                </div>
                
                <button
                  onClick={() => setShowUserAccount(true)}
                  className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg flex items-center space-x-2 transition"
                >
                  <User size={20} />
                  <span>My Account</span>
                </button>

                {!isAdmin && (
                  <button
                    onClick={() => {
                      fetchUserStats();
                      setShowUserStats(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg flex items-center space-x-2 transition"
                  >
                    <BarChart3 size={20} />
                    <span>My Stats</span>
                  </button>
                )}
                
                <button
                  onClick={() => {
                    fetchLeaderboard();
                    setShowLeaderboard(true);
                  }}
                  className="bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded-lg flex items-center space-x-2 transition"
                >
                  <Award size={20} />
                  <span>Leaderboard</span>
                </button>
              </>
            )}

            {isAdmin && (
              <>
                <button
                  onClick={() => setShowCategoryManager(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition"
                >
                  Manage Categories
                </button>
                <button
                  onClick={() => setShowAdminPanel(true)}
                  className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg flex items-center space-x-2 transition"
                >
                  <Plus size={20} />
                  <span>Create Market</span>
                </button>
              </>
            )}
            
            {isLoggedIn ? (
              <div className="flex items-center space-x-3">
                {isAdmin && <Shield className="text-red-400" size={20} />}
                <img 
                  src={user.avatar} 
                  alt={user.name}
                  className="w-10 h-10 rounded-full border-2 border-purple-400"
                />
                <span className="text-white">{user.name}</span>
                <button
                  onClick={handleLogout}
                  className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg font-semibold transition"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-4xl font-bold text-white mb-2">Live Betting Markets</h2>
          <p className="text-purple-300">Place your bets on future events and outcomes</p>
        </div>

        {/* Category Filter */}
        <div className="mb-6 flex items-center space-x-4">
          <label className="text-white font-semibold">Filter by Category:</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-700 text-white px-4 py-2 rounded-lg border border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        {/* Markets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMarkets.map((market) => {
            const stats = getMarketStatsPercentages(market.id);
            const totalBets = parseInt(marketStats[market.id]?.total_bets || 0);
            
            return (
              <div
                key={market.id}
                className="bg-slate-800 bg-opacity-50 rounded-xl p-6 border border-purple-500 backdrop-blur-sm hover:border-purple-400 transition transform hover:scale-105"
              >
                <div className="mb-4">
                  <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded">
                    {market.categoryName || 'Uncategorized'}
                  </span>
                </div>
                
                <h3 className="text-xl font-bold text-white mb-4">{market.question}</h3>
                
                {/* Community Betting Statistics */}
                {totalBets > 0 && (
                  <div className="mb-4 p-3 bg-slate-700 bg-opacity-50 rounded-lg">
                    <p className="text-xs text-purple-300 mb-2">{totalBets} bets placed</p>
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="flex-1 bg-slate-600 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-green-500 h-full transition-all duration-500"
                          style={{ width: `${stats.yesPercent}%` }}
                        />
                      </div>
                      <span className="text-xs text-green-400 font-semibold w-12 text-right">{stats.yesPercent}%</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-slate-600 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-red-500 h-full transition-all duration-500"
                          style={{ width: `${stats.noPercent}%` }}
                        />
                      </div>
                      <span className="text-xs text-red-400 font-semibold w-12 text-right">{stats.noPercent}%</span>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => placeBet(market, 'yes')}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition transform hover:scale-105"
                  >
                    <div className="text-sm">YES</div>
                    <div className="text-xs opacity-75">{market.yesOdds}x</div>
                  </button>
                  <button
                    onClick={() => placeBet(market, 'no')}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition transform hover:scale-105"
                  >
                    <div className="text-sm">NO</div>
                    <div className="text-xs opacity-75">{market.noOdds}x</div>
                  </button>
                </div>
                
                <p className="text-purple-300 text-sm mt-4">
                  Closes: {new Date(market.deadline).toLocaleDateString()}
                </p>
              </div>
            );
          })}
        </div>
      </main>

      {/* User Account Modal */}
      {showUserAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-white">My Account</h2>
              <button onClick={() => setShowUserAccount(false)} className="text-white hover:text-red-400">
                <X size={24} />
              </button>
            </div>

            {/* Profile Section */}
            <div className="bg-slate-700 rounded-lg p-6 mb-6">
              <h3 className="text-xl font-bold text-white mb-4">Profile</h3>
              
              <div className="flex items-center space-x-4 mb-6">
                <img 
                  src={user.avatar} 
                  alt={user.name}
                  className="w-20 h-20 rounded-full border-4 border-purple-400"
                />
                <div>
                  <p className="text-2xl font-bold text-white">{user.name}</p>
                  <p className="text-purple-300">{user.email}</p>
                  {isAdmin && <span className="text-red-400 text-sm flex items-center mt-1"><Shield size={16} className="mr-1" /> Administrator</span>}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-white text-sm mb-2 block">Avatar URL</label>
                  <input
                    type="text"
                    placeholder={user.avatar}
                    value={editProfile.avatar}
                    onChange={(e) => setEditProfile({ ...editProfile, avatar: e.target.value })}
                    className="w-full bg-slate-600 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                  <p className="text-xs text-purple-300 mt-1">Paste an image URL or leave blank to keep current</p>
                </div>

                <div>
                  <label className="text-white text-sm mb-2 block">Email Address</label>
                  <input
                    type="email"
                    placeholder={user.email}
                    value={editProfile.email}
                    onChange={(e) => setEditProfile({ ...editProfile, email: e.target.value })}
                    className="w-full bg-slate-600 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>

                <button
                  onClick={updateProfile}
                  className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg transition"
                >
                  Update Profile
                </button>
              </div>
            </div>

            {/* Account Stats */}
            <div className="bg-slate-700 rounded-lg p-6 mb-6">
              <h3 className="text-xl font-bold text-white mb-4">Account Stats</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-600 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-400">${parseFloat(balance).toFixed(2)}</p>
                  <p className="text-sm text-purple-300">Current Balance</p>
                </div>
                <div className="bg-slate-600 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-400">{bets.filter(b => b.status === 'pending').length}</p>
                  <p className="text-sm text-purple-300">Active Bets</p>
                </div>
                <div className="bg-slate-600 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-yellow-400">{bets.length}</p>
                  <p className="text-sm text-purple-300">Total Bets</p>
                </div>
              </div>
            </div>

            {/* Bets Section */}
            <div className="bg-slate-700 rounded-lg p-6">
              <h3 className="text-xl font-bold text-white mb-4">My Bets</h3>
              
              {bets.length === 0 ? (
                <p className="text-purple-300 text-center py-4">No bets placed yet</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {bets.map((bet) => (
                    <div 
                      key={bet.id} 
                      className={`rounded-lg p-4 flex justify-between items-center ${
                        bet.status === 'pending' ? 'bg-slate-600' : 'bg-slate-800 opacity-70'
                      }`}
                    >
                      <div className="flex-1">
                        <p className="text-white font-semibold">{bet.market}</p>
                        <p className="text-purple-300 text-sm">
                          Bet: <span className="font-bold">{bet.choice.toUpperCase()}</span> at {bet.odds}x
                          {bet.status === 'cancelled' && <span className="text-red-400 ml-2">(Cancelled)</span>}
                          {bet.status === 'won' && <span className="text-green-400 ml-2">(Won!)</span>}
                          {bet.status === 'lost' && <span className="text-gray-400 ml-2">(Lost)</span>}
                        </p>
                        <p className="text-xs text-purple-400">
                          {new Date(bet.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right flex items-center space-x-3">
                        <div>
                          <p className="text-white font-bold">${parseFloat(bet.amount).toFixed(2)}</p>
                          {bet.status === 'pending' && (
                            <p className="text-green-400 text-sm">Potential: ${parseFloat(bet.potentialWin).toFixed(2)}</p>
                          )}
                        </div>
                        {bet.status === 'pending' && (
                          <button
                            onClick={() => cancelBet(bet.id)}
                            className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm transition"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bet Confirmation Modal */}
      {activeBet && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-white mb-4">Confirm Bet</h2>
            <p className="text-purple-300 mb-4">{activeBet.market.question}</p>
            
            {/* Show community stats in modal */}
            {marketStats[activeBet.market.id] && parseInt(marketStats[activeBet.market.id].total_bets || 0) > 0 && (
              <div className="mb-4 p-3 bg-slate-700 rounded-lg">
                <p className="text-xs text-purple-300 mb-2">Community Betting:</p>
                <div className="flex justify-between text-sm">
                  <span className="text-green-400">
                    YES: {getMarketStatsPercentages(activeBet.market.id).yesPercent}%
                  </span>
                  <span className="text-red-400">
                    NO: {getMarketStatsPercentages(activeBet.market.id).noPercent}%
                  </span>
                </div>
              </div>
            )}
            
            <div className="bg-slate-700 p-4 rounded-lg mb-4">
              <p className="text-white mb-2">
                Betting: <span className={`font-bold ${activeBet.choice === 'yes' ? 'text-green-400' : 'text-red-400'}`}>
                  {activeBet.choice.toUpperCase()}
                </span>
              </p>
              <p className="text-purple-300 mb-2">
                Odds: {activeBet.choice === 'yes' ? activeBet.market.yesOdds : activeBet.market.noOdds}x
              </p>
            </div>

            <input
              type="number"
              placeholder="Enter bet amount"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
            
            {betAmount && (
              <p className="text-green-400 mb-4">
                Potential Win: ${(parseFloat(betAmount) * (activeBet.choice === 'yes' ? activeBet.market.yesOdds : activeBet.market.noOdds)).toFixed(2)}
              </p>
            )}

            <div className="flex space-x-4">
              <button
                onClick={confirmBet}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition"
              >
                Confirm Bet
              </button>
              <button
                onClick={() => {
                  setActiveBet(null);
                  setBetAmount('');
                }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {showAuth && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-white mb-6">
              {authMode === 'login' ? 'Sign In' : 'Create Account'}
            </h2>
            
            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === 'register' && (
                <input
                  type="text"
                  placeholder="Name"
                  value={authForm.name}
                  onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                  className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                  required
                />
              )}
              <input
                type="email"
                placeholder="Email"
                value={authForm.email}
                onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                required
              />
              
              {authMode === 'login' && (
                <div className="bg-slate-700 p-3 rounded text-sm text-purple-300">
                  <p className="font-semibold mb-1">Admin Login:</p>
                  <p>Email: admin@binarybets.com</p>
                  <p>Password: admin123</p>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition"
              >
                {authMode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <p className="text-purple-300 text-center mt-4">
              {authMode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                className="text-purple-400 hover:underline"
              >
                {authMode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>

            <button
              onClick={() => setShowAuth(false)}
              className="w-full mt-4 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-8 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-white">🏆 Leaderboard</h2>
              <button onClick={() => setShowLeaderboard(false)} className="text-white hover:text-red-400">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-3">
              {leaderboard.map((player, index) => (
                <div
                  key={player.id}
                  className={`rounded-lg p-4 flex items-center justify-between ${
                    index < 3 ? 'bg-gradient-to-r from-yellow-600 to-yellow-800' : 'bg-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <div className="text-3xl">
                      {index === 0 && '🥇'}
                      {index === 1 && '🥈'}
                      {index === 2 && '🥉'}
                      {index > 2 && <span className="text-white font-bold">#{index + 1}</span>}
                    </div>
                    <img 
                      src={player.avatar} 
                      alt={player.name}
                      className="w-12 h-12 rounded-full border-2 border-purple-400"
                    />
                    <div>
                      <p className="text-white font-bold">{player.name}</p>
                      <p className="text-purple-300 text-sm">{player.betsWon} bets won</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 font-bold text-xl">${parseFloat(player.totalWinnings).toFixed(2)}</p>
                    <p className="text-purple-300 text-sm">Total Winnings</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* User Stats Modal */}
      {showUserStats && userStats && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-8 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-white">📊 My Statistics</h2>
              <button onClick={() => setShowUserStats(false)} className="text-white hover:text-red-400">
                <X size={24} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-700 p-4 rounded-lg">
                <p className="text-purple-300 text-sm mb-1">Total Bets Placed</p>
                <p className="text-white text-2xl font-bold">{userStats.totalBets}</p>
              </div>
              <div className="bg-slate-700 p-4 rounded-lg">
                <p className="text-purple-300 text-sm mb-1">Win Rate</p>
                <p className="text-green-400 text-2xl font-bold">{userStats.winRate}%</p>
              </div>
              <div className="bg-slate-700 p-4 rounded-lg">
                <p className="text-purple-300 text-sm mb-1">Total Wagered</p>
                <p className="text-white text-2xl font-bold">${parseFloat(userStats.totalWagered).toFixed(2)}</p>
              </div>
              <div className="bg-slate-700 p-4 rounded-lg">
                <p className="text-purple-300 text-sm mb-1">Total Winnings</p>
                <p className="text-green-400 text-2xl font-bold">${parseFloat(userStats.totalWinnings).toFixed(2)}</p>
              </div>
            </div>

            <div className="bg-slate-700 p-4 rounded-lg mb-4">
              <p className="text-purple-300 text-sm mb-1">Favorite Category</p>
              <p className="text-white text-xl font-bold">{userStats.favoriteCategory}</p>
            </div>

            <div className="bg-slate-700 p-4 rounded-lg">
              <p className="text-white font-bold mb-2">Compared to Others:</p>
              <p className="text-purple-300 text-sm">
                Your avg bet: <span className="text-white font-semibold">${(parseFloat(userStats.totalWagered) / Math.max(userStats.totalBets, 1)).toFixed(2)}</span>
              </p>
              <p className="text-purple-300 text-sm">
                Community avg: <span className="text-white font-semibold">${parseFloat(userStats.avgBetAmount).toFixed(2)}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Category Manager Modal */}
      {showCategoryManager && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-8 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-white">Manage Categories</h2>
              <button onClick={() => setShowCategoryManager(false)} className="text-white hover:text-red-400">
                <X size={24} />
              </button>
            </div>

            <div className="mb-6">
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="New category name"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="flex-1 bg-slate-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <button
                  onClick={createCategory}
                  className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg transition"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {categories.map(cat => (
                <div key={cat.id} className="bg-slate-700 p-4 rounded-lg flex justify-between items-center">
                  <span className="text-white font-semibold">{cat.name}</span>
                  <button
                    onClick={() => deleteCategory(cat.id)}
                    className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded transition text-sm"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Admin Panel Modal */}
      {showAdminPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-8 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-white">Create New Market</h2>
              <button onClick={() => setShowAdminPanel(false)} className="text-white hover:text-red-400">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={createMarket} className="space-y-4">
              <div>
                <label className="text-white text-sm mb-2 block">Question</label>
                <input
                  type="text"
                  placeholder="e.g., Will Bitcoin reach $100k by 2025?"
                  value={newMarket.question}
                  onChange={(e) => setNewMarket({ ...newMarket, question: e.target.value })}
                  className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-white text-sm mb-2 block">YES Odds</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="2.5"
                    value={newMarket.yesOdds}
                    onChange={(e) => setNewMarket({ ...newMarket, yesOdds: e.target.value })}
                    className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                    required
                  />
                </div>
                <div>
                  <label className="text-white text-sm mb-2 block">NO Odds</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="1.5"
                    value={newMarket.noOdds}
                    onChange={(e) => setNewMarket({ ...newMarket, noOdds: e.target.value })}
                    className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-white text-sm mb-2 block">Category</label>
                <select
                  value={newMarket.categoryId}
                  onChange={(e) => setNewMarket({ ...newMarket, categoryId: e.target.value })}
                  className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                  required
                >
                  <option value="">Select a category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-white text-sm mb-2 block">Deadline</label>
                <input
                  type="datetime-local"
                  value={newMarket.deadline}
                  onChange={(e) => setNewMarket({ ...newMarket, deadline: e.target.value })}
                  className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition"
              >
                Create Market
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
