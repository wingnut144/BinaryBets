import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Award, Shield, Plus, X, BarChart3, User, CheckCircle } from 'lucide-react';

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
  const [showResolvePanel, setShowResolvePanel] = useState(false);
  const [activeBet, setActiveBet] = useState(null);
  const [betAmount, setBetAmount] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [leaderboard, setLeaderboard] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [marketStats, setMarketStats] = useState({});
  const [newCategory, setNewCategory] = useState('');
  const [expiredMarkets, setExpiredMarkets] = useState([]);
  const [marketType, setMarketType] = useState('binary');
  const [newMarket, setNewMarket] = useState({
    question: '',
    yesOdds: '',
    noOdds: '',
    categoryId: '',
    deadline: '',
    options: [
      { text: '', odds: '' },
      { text: '', odds: '' }
    ]
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
      
      const parsedData = data.map(market => ({
        ...market,
        yesOdds: market.yes_odds ? parseFloat(market.yes_odds) : null,
        noOdds: market.no_odds ? parseFloat(market.no_odds) : null,
        options: market.options ? market.options.map(opt => ({
          ...opt,
          odds: parseFloat(opt.odds),
          totalBets: parseInt(opt.total_bets || 0),
          totalAmount: parseFloat(opt.total_amount || 0)
        })) : null
      }));
      
      setMarkets(parsedData);
    } catch (err) {
      console.error('Failed to fetch markets:', err);
    }
  };

  const fetchExpiredMarkets = async () => {
    try {
      const response = await fetch(`${API_URL}/api/markets/expired?userId=${user.id}`);
      const data = await response.json();
      setExpiredMarkets(data);
    } catch (err) {
      console.error('Failed to fetch expired markets:', err);
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
      const payload = {
        question: newMarket.question,
        marketType: marketType,
        categoryId: parseInt(newMarket.categoryId),
        deadline: newMarket.deadline,
        userId: user.id
      };

      if (marketType === 'binary') {
        payload.yesOdds = parseFloat(newMarket.yesOdds);
        payload.noOdds = parseFloat(newMarket.noOdds);
      } else {
        // Filter out empty options
        const validOptions = newMarket.options.filter(opt => opt.text.trim() && opt.odds);
        if (validOptions.length < 2) {
          alert('Please add at least 2 options');
          return;
        }
        payload.options = validOptions.map(opt => ({
          text: opt.text,
          odds: parseFloat(opt.odds)
        }));
      }

      const response = await fetch(`${API_URL}/api/markets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to create market');
        return;
      }

      await fetchMarkets();
      setShowAdminPanel(false);
      setNewMarket({ 
        question: '', 
        yesOdds: '', 
        noOdds: '', 
        categoryId: '', 
        deadline: '',
        options: [{ text: '', odds: '' }, { text: '', odds: '' }]
      });
      setMarketType('binary');
      alert('Market created successfully!');
    } catch (err) {
      console.error('Market creation error:', err);
      alert('Failed to create market');
    }
  };

  const resolveMarket = async (marketId, outcome, winningOptionId = null) => {
    try {
      const response = await fetch(`${API_URL}/api/markets/${marketId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          outcome,
          winningOptionId
        })
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to resolve market');
        return;
      }

      alert('Market resolved successfully! Payouts processed.');
      await fetchExpiredMarkets();
      await fetchMarkets();
    } catch (err) {
      console.error('Market resolution error:', err);
      alert('Failed to resolve market');
    }
  };

  const hasActiveBetOnMarket = (marketId) => {
    return bets.some(bet => bet.marketId === marketId && bet.status === 'pending');
  };

  const placeBet = (market, choice, optionId = null, odds = null) => {
    if (!isLoggedIn) {
      setShowAuth(true);
      return;
    }
    
    if (hasActiveBetOnMarket(market.id)) {
      alert('You already have an active bet on this market. Cancel your existing bet first if you want to place a new one.');
      return;
    }
    
    setActiveBet({ 
      market, 
      choice, 
      optionId,
      odds: odds || (choice === 'yes' ? market.yesOdds : market.noOdds)
    });
  };

  const confirmBet = async () => {
    const amount = parseFloat(betAmount);
    if (amount <= 0 || amount > balance) {
      alert('Invalid bet amount');
      return;
    }

    const potentialWin = amount * activeBet.odds;

    try {
      const response = await fetch(`${API_URL}/api/bets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          marketId: activeBet.market.id,
          choice: activeBet.choice,
          marketOptionId: activeBet.optionId,
          amount,
          odds: activeBet.odds,
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
      
      await fetchUserBets();
      await fetchUserBalance();
      await fetchUserStats();
      await fetchMarkets();
      
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
      await fetchMarkets();
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

  const getOptionPercentage = (option, allOptions) => {
    const totalBets = allOptions.reduce((sum, opt) => sum + opt.totalBets, 0);
    if (totalBets === 0) return 0;
    return Math.round((option.totalBets / totalBets) * 100);
  };

  const addMarketOption = () => {
    if (newMarket.options.length >= 4) {
      alert('Maximum 4 options allowed');
      return;
    }
    setNewMarket({
      ...newMarket,
      options: [...newMarket.options, { text: '', odds: '' }]
    });
  };

  const removeMarketOption = (index) => {
    if (newMarket.options.length <= 2) {
      alert('Minimum 2 options required');
      return;
    }
    setNewMarket({
      ...newMarket,
      options: newMarket.options.filter((_, i) => i !== index)
    });
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
                <button
                  onClick={() => {
                    fetchExpiredMarkets();
                    setShowResolvePanel(true);
                  }}
                  className="bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded-lg flex items-center space-x-2 transition"
                >
                  <CheckCircle size={20} />
                  <span>Resolve Markets</span>
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
          {filteredMarkets.map((market) => (
            <div
              key={market.id}
              className="bg-slate-800 bg-opacity-50 rounded-xl p-6 border border-purple-500 backdrop-blur-sm hover:border-purple-400 transition"
            >
              <div className="mb-4 flex justify-between items-center">
                <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded">
                  {market.categoryName || 'Uncategorized'}
                </span>
                <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                  {market.market_type === 'multi-choice' ? 'Multi-Choice' : 'Binary'}
                </span>
              </div>
              
              <h3 className="text-xl font-bold text-white mb-4">{market.question}</h3>
              
              {market.market_type === 'binary' ? (
                <>
                  {/* Binary Market Display */}
                  {market.stats && parseInt(market.stats.total_bets) > 0 && (
                    <div className="mb-4 p-3 bg-slate-700 bg-opacity-50 rounded-lg">
                      <p className="text-xs text-purple-300 mb-2">{market.stats.total_bets} bets placed</p>
                      <div className="flex items-center space-x-2 mb-1">
                        <div className="flex-1 bg-slate-600 rounded-full h-2 overflow-hidden">
                          <div 
                            className="bg-green-500 h-full transition-all duration-500"
                            style={{ width: `${getMarketStatsPercentages(market.id).yesPercent || 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-green-400 font-semibold w-12 text-right">
                          {getMarketStatsPercentages(market.id).yesPercent || 0}%
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 bg-slate-600 rounded-full h-2 overflow-hidden">
                          <div 
                            className="bg-red-500 h-full transition-all duration-500"
                            style={{ width: `${getMarketStatsPercentages(market.id).noPercent || 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-red-400 font-semibold w-12 text-right">
                          {getMarketStatsPercentages(market.id).noPercent || 0}%
                        </span>
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
                </>
              ) : (
                <>
                  {/* Multi-Choice Market Display */}
                  <div className="space-y-2 mb-4">
                    {market.options && market.options.map((option) => {
                      const percentage = getOptionPercentage(option, market.options);
                      return (
                        <div key={option.id} className="bg-slate-700 bg-opacity-50 rounded-lg p-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-white font-semibold text-sm">{option.option_text || option.optionText}</span>
                            <span className="text-purple-300 text-xs">{option.odds}x</span>
                          </div>
                          {option.totalBets > 0 && (
                            <div className="flex items-center space-x-2">
                              <div className="flex-1 bg-slate-600 rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className="bg-purple-500 h-full transition-all duration-500"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <span className="text-xs text-purple-400 w-8 text-right">{percentage}%</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="space-y-2">
                    {market.options && market.options.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => placeBet(market, option.option_text || option.optionText, option.id, option.odds)}
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-2 rounded-lg transition transform hover:scale-105"
                      >
                        Bet on {option.option_text || option.optionText}
                      </button>
                    ))}
                  </div>
                </>
              )}
              
              <p className="text-purple-300 text-sm mt-4">
                Closes: {new Date(market.deadline).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      </main>

      {/* Resolve Markets Modal (Admin Only) */}
      {showResolvePanel && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-slate-800 rounded-xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-white">Resolve Expired Markets</h2>
              <button onClick={() => setShowResolvePanel(false)} className="text-white hover:text-red-400">
                <X size={24} />
              </button>
            </div>

            {expiredMarkets.length === 0 ? (
              <p className="text-purple-300 text-center py-8">No markets pending resolution</p>
            ) : (
              <div className="space-y-6">
                {expiredMarkets.map((market) => (
                  <div key={market.id} className="bg-slate-700 rounded-lg p-6">
                    <h3 className="text-xl font-bold text-white mb-2">{market.question}</h3>
                    <p className="text-purple-300 text-sm mb-4">
                      Deadline: {new Date(market.deadline).toLocaleString()} | 
                      Total Bets: {market.total_bets || 0}
                    </p>
                    
                    {market.market_type === 'binary' ? (
                      <div className="flex space-x-4">
                        <button
                          onClick={() => resolveMarket(market.id, 'yes')}
                          className="flex-1 bg-green-600 hover:bg-green-700 px-4 py-3 rounded-lg transition font-bold"
                        >
                          Resolve as YES
                        </button>
                        <button
                          onClick={() => resolveMarket(market.id, 'no')}
                          className="flex-1 bg-red-600 hover:bg-red-700 px-4 py-3 rounded-lg transition font-bold"
                        >
                          Resolve as NO
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-white font-semibold mb-2">Select Winning Option:</p>
                        {market.options && market.options.map((option) => (
                          <button
                            key={option.id}
                            onClick={() => resolveMarket(market.id, null, option.id)}
                            className="w-full bg-purple-600 hover:bg-purple-700 px-4 py-3 rounded-lg transition text-left"
                          >
                            <span className="font-bold">{option.option_text || option.optionText}</span>
                            <span className="text-sm opacity-75 ml-2">({option.odds}x odds)</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rest of the modals remain the same as before... */}
      {/* I'll include the rest in a follow-up due to length */}
    </div>
  );
}

export default App;
