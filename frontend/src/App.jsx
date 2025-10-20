import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Calendar, Users, Trophy, Settings, X, PlusCircle, User, LogOut, Search, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';

const API_URL = 'http://64.23.152.157:5000/api';

export default function App() {
  // State management
  const [markets, setMarkets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [user, setUser] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showBetModal, setShowBetModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [betAmount, setBetAmount] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [userBets, setUserBets] = useState([]);
  const [expiredMarkets, setExpiredMarkets] = useState([]);
  const [verificationData, setVerificationData] = useState(null);
  const [verifyingMarket, setVerifyingMarket] = useState(null);
  
  // Form states
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '' });
  const [newCategory, setNewCategory] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [marketForm, setMarketForm] = useState({
    question: '',
    categoryId: '',
    marketType: 'binary',
    yesOdds: '',
    noOdds: '',
    deadline: '',
    options: [
      { text: '', odds: '' },
      { text: '', odds: '' }
    ]
  });

  // Fetch data on mount
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
      fetchUserStats();
      fetchUserBets();
    }
  }, [user]);

  // API calls
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

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`${API_URL}/leaderboard`);
      const data = await response.json();
      setLeaderboard(data);
      setShowLeaderboard(true);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    }
  };

  const fetchUserStats = async () => {
    if (!user) return;
    try {
      const response = await fetch(`${API_URL}/users/${user.id}/stats`);
      const data = await response.json();
      setUserStats(data);
    } catch (error) {
      console.error('Error fetching user stats:', error);
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

  const fetchExpiredMarkets = async () => {
    if (!user?.is_admin) return;
    try {
      const response = await fetch(`${API_URL}/markets/expired`);
      const data = await response.json();
      setExpiredMarkets(data);
      setShowResolveModal(true);
    } catch (error) {
      console.error('Error fetching expired markets:', error);
    }
  };

  const fetchVerification = async (market) => {
    setVerifyingMarket(market.id);
    try {
      const response = await fetch(`${API_URL}/markets/${market.id}/verify`);
      const data = await response.json();
      setVerificationData(data);
      setShowVerificationModal(true);
    } catch (error) {
      console.error('Error fetching verification:', error);
      alert('Failed to fetch verification data');
    } finally {
      setVerifyingMarket(null);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      const data = await response.json();
      if (data.user) {
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
        setShowAuthModal(false);
        setLoginForm({ email: '', password: '' });
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm)
      });
      const data = await response.json();
      if (data.user) {
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
        setShowAuthModal(false);
        setRegisterForm({ name: '', email: '', password: '' });
      }
    } catch (error) {
      console.error('Register error:', error);
      alert('Registration failed');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const handleBet = (market, choice = null, option = null) => {
    setSelectedMarket(market);
    setSelectedChoice(choice);
    setSelectedOption(option);
    setShowBetModal(true);
  };

  const confirmBet = async () => {
    if (!user || !selectedMarket || !betAmount || parseFloat(betAmount) <= 0) {
      alert('Please enter a valid bet amount');
      return;
    }

    const amount = parseFloat(betAmount);
    if (amount > parseFloat(user.balance)) {
      alert('Insufficient balance');
      return;
    }

    try {
      let odds, potentialWin;
      
      if (selectedMarket.market_type === 'multi-choice') {
        odds = parseFloat(selectedOption.odds);
        potentialWin = amount * odds;
      } else {
        odds = selectedChoice === 'yes' ? parseFloat(selectedMarket.yes_odds) : parseFloat(selectedMarket.no_odds);
        potentialWin = amount * odds;
      }

      const betData = {
        userId: user.id,
        marketId: selectedMarket.id,
        choice: selectedMarket.market_type === 'binary' ? selectedChoice : null,
        marketOptionId: selectedMarket.market_type === 'multi-choice' ? selectedOption.id : null,
        amount,
        odds,
        potentialWin
      };

      const response = await fetch(`${API_URL}/bets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(betData)
      });

      const data = await response.json();
      
      if (response.ok) {
        setUser({ ...user, balance: (parseFloat(user.balance) - amount).toFixed(2) });
        localStorage.setItem('user', JSON.stringify({ ...user, balance: (parseFloat(user.balance) - amount).toFixed(2) }));
        setShowBetModal(false);
        setBetAmount('');
        fetchMarkets();
        fetchUserBets();
        alert('Bet placed successfully!');
      } else {
        alert(data.error || 'Failed to place bet');
      }
    } catch (error) {
      console.error('Bet error:', error);
      alert('Failed to place bet');
    }
  };

  const handleCancelBet = async (betId) => {
    if (!window.confirm('Are you sure you want to cancel this bet?')) return;

    try {
      const response = await fetch(`${API_URL}/bets/${betId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });

      const data = await response.json();
      
      if (response.ok) {
        setUser({ ...user, balance: parseFloat(data.newBalance).toFixed(2) });
        localStorage.setItem('user', JSON.stringify({ ...user, balance: parseFloat(data.newBalance).toFixed(2) }));
        fetchUserBets();
        alert('Bet cancelled successfully!');
      } else {
        alert(data.error || 'Failed to cancel bet');
      }
    } catch (error) {
      console.error('Cancel bet error:', error);
      alert('Failed to cancel bet');
    }
  };

  const handleUpdateProfile = async (field, value) => {
    try {
      const response = await fetch(`${API_URL}/users/${user.id}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      });

      const data = await response.json();
      
      if (response.ok) {
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
        if (field === 'avatar') setEditAvatar('');
        if (field === 'email') setEditEmail('');
        alert('Profile updated successfully!');
      } else {
        alert(data.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Update profile error:', error);
      alert('Failed to update profile');
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCategory.trim()) return;

    try {
      const response = await fetch(`${API_URL}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategory.trim() })
      });

      if (response.ok) {
        setNewCategory('');
        fetchCategories();
        alert('Category created!');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to create category');
      }
    } catch (error) {
      console.error('Create category error:', error);
      alert('Failed to create category');
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!window.confirm('Delete this category? Markets using it will have no category.')) return;

    try {
      const response = await fetch(`${API_URL}/categories/${categoryId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchCategories();
        alert('Category deleted!');
      }
    } catch (error) {
      console.error('Delete category error:', error);
      alert('Failed to delete category');
    }
  };

  const handleCreateMarket = async (e) => {
    e.preventDefault();
    
    if (!marketForm.question || !marketForm.categoryId || !marketForm.deadline) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      let marketData;
      
      if (marketForm.marketType === 'binary') {
        if (!marketForm.yesOdds || !marketForm.noOdds) {
          alert('Please provide odds for both YES and NO');
          return;
        }
        
        marketData = {
          question: marketForm.question,
          categoryId: parseInt(marketForm.categoryId),
          marketType: 'binary',
          yesOdds: parseFloat(marketForm.yesOdds),
          noOdds: parseFloat(marketForm.noOdds),
          deadline: marketForm.deadline
        };
      } else {
        const validOptions = marketForm.options.filter(opt => opt.text.trim() && opt.odds);
        
        if (validOptions.length < 2) {
          alert('Please provide at least 2 options with odds');
          return;
        }
        
        marketData = {
          question: marketForm.question,
          categoryId: parseInt(marketForm.categoryId),
          marketType: 'multi-choice',
          deadline: marketForm.deadline,
          options: validOptions.map((opt, index) => ({
            text: opt.text.trim(),
            odds: parseFloat(opt.odds),
            order: index + 1
          }))
        };
      }

      const response = await fetch(`${API_URL}/markets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(marketData)
      });

      if (response.ok) {
        setShowAdminPanel(false);
        setMarketForm({
          question: '',
          categoryId: '',
          marketType: 'binary',
          yesOdds: '',
          noOdds: '',
          deadline: '',
          options: [
            { text: '', odds: '' },
            { text: '', odds: '' }
          ]
        });
        fetchMarkets();
        alert('Market created successfully!');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to create market');
      }
    } catch (error) {
      console.error('Create market error:', error);
      alert('Failed to create market');
    }
  };

  const handleResolveMarket = async (marketId, winningOptionId) => {
    if (!window.confirm('Are you sure? This will payout winners and cannot be undone.')) return;

    try {
      const response = await fetch(`${API_URL}/markets/${marketId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winningOptionId })
      });

      const data = await response.json();
      
      if (response.ok) {
        alert(`Market resolved! ${data.winnersCount} winners paid out $${parseFloat(data.totalPayout).toFixed(2)}`);
        setShowVerificationModal(false);
        fetchExpiredMarkets();
        fetchMarkets();
      } else {
        alert(data.error || 'Failed to resolve market');
      }
    } catch (error) {
      console.error('Resolve market error:', error);
      alert('Failed to resolve market');
    }
  };

  const addOption = () => {
    if (marketForm.options.length < 4) {
      setMarketForm({
        ...marketForm,
        options: [...marketForm.options, { text: '', odds: '' }]
      });
    }
  };

  const removeOption = (index) => {
    if (marketForm.options.length > 2) {
      const newOptions = marketForm.options.filter((_, i) => i !== index);
      setMarketForm({ ...marketForm, options: newOptions });
    }
  };

  const updateOption = (index, field, value) => {
    const newOptions = [...marketForm.options];
    newOptions[index][field] = value;
    setMarketForm({ ...marketForm, options: newOptions });
  };

  // Filter markets by category
  const filteredMarkets = selectedCategory === 'all'
    ? markets
    : markets.filter(m => m.category_id === parseInt(selectedCategory));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="bg-slate-900/50 backdrop-blur-sm border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <TrendingUp className="w-8 h-8 text-purple-400" />
              <h1 className="text-2xl font-bold text-white">BinaryBets</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <button
                    onClick={fetchLeaderboard}
                    className="flex items-center space-x-2 px-4 py-2 bg-yellow-500/20 text-yellow-300 rounded-lg hover:bg-yellow-500/30 transition-colors"
                  >
                    <Trophy className="w-5 h-5" />
                    <span>Leaderboard</span>
                  </button>
                  
                  <button
                    onClick={() => setShowAccountModal(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-purple-500/20 text-purple-300 rounded-lg hover:bg-purple-500/30 transition-colors"
                  >
                    <User className="w-5 h-5" />
                    <span>My Account</span>
                  </button>
                  
                  <div className="flex items-center space-x-2 px-4 py-2 bg-green-500/20 text-green-300 rounded-lg">
                    <DollarSign className="w-5 h-5" />
                    <span className="font-semibold">${parseFloat(user.balance).toFixed(2)}</span>
                  </div>
                  
                  {user.is_admin && (
                    <>
                      <button
                        onClick={() => setShowCategoryManager(true)}
                        className="p-2 bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors"
                      >
                        <Settings className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setShowAdminPanel(true)}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        Create Market
                      </button>
                      <button
                        onClick={fetchExpiredMarkets}
                        className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                      >
                        Resolve Markets
                      </button>
                    </>
                  )}
                  
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-2 px-4 py-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Logout</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Category Filter */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex space-x-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              selectedCategory === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            All Markets
          </button>
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id.toString())}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                selectedCategory === category.id.toString()
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {/* Markets Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMarkets.map(market => (
            <MarketCard 
              key={market.id} 
              market={market} 
              user={user} 
              handleBet={handleBet}
            />
          ))}
        </div>
      </main>

      {/* Auth Modal */}
      {showAuthModal && (
        <Modal onClose={() => setShowAuthModal(false)} title={authMode === 'login' ? 'Sign In' : 'Create Account'}>
          {authMode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="email"
                placeholder="Email"
                value={loginForm.email}
                onChange={(e) => setLoginForm({...loginForm, email: e.target.value})}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                required
              />
              <button
                type="submit"
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                className="w-full text-purple-400 hover:text-purple-300"
              >
                Need an account? Register
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <input
                type="text"
                placeholder="Name"
                value={registerForm.name}
                onChange={(e) => setRegisterForm({...registerForm, name: e.target.value})}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={registerForm.email}
                onChange={(e) => setRegisterForm({...registerForm, email: e.target.value})}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={registerForm.password}
                onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                required
              />
              <button
                type="submit"
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Create Account
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className="w-full text-purple-400 hover:text-purple-300"
              >
                Already have an account? Sign in
              </button>
            </form>
          )}
        </Modal>
      )}

      {/* Bet Confirmation Modal */}
      {showBetModal && selectedMarket && (
        <Modal onClose={() => setShowBetModal(false)} title="Confirm Your Bet">
          <div className="space-y-4">
            <div className="bg-slate-800 p-4 rounded-lg">
              <p className="text-white font-semibold mb-2">{selectedMarket.question}</p>
              <p className="text-purple-400">
                {selectedMarket.market_type === 'binary' 
                  ? `Betting on: ${selectedChoice.toUpperCase()}`
                  : `Betting on: ${selectedOption.option_text}`
                }
              </p>
              <p className="text-green-400">
                Odds: {selectedMarket.market_type === 'binary'
                  ? (selectedChoice === 'yes' ? selectedMarket.yes_odds : selectedMarket.no_odds)
                  : selectedOption.odds}x
              </p>
            </div>
            
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Bet amount"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
            />
            
            {betAmount && parseFloat(betAmount) > 0 && (
              <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-3">
                <p className="text-green-300">
                  Potential Win: ${(
                    parseFloat(betAmount) * 
                    (selectedMarket.market_type === 'binary'
                      ? (selectedChoice === 'yes' ? parseFloat(selectedMarket.yes_odds) : parseFloat(selectedMarket.no_odds))
                      : parseFloat(selectedOption.odds))
                  ).toFixed(2)}
                </p>
              </div>
            )}
            
            <button
              onClick={confirmBet}
              className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold"
            >
              Confirm Bet
            </button>
          </div>
        </Modal>
      )}

      {/* Account Modal - [keeping existing code, no changes needed] */}
      {showAccountModal && user && (
        <Modal onClose={() => setShowAccountModal(false)} title="My Account" size="large">
          <div className="space-y-6">
            <div className="bg-slate-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Profile</h3>
              <div className="flex items-center space-x-4 mb-4">
                <img src={user.avatar} alt="Avatar" className="w-16 h-16 rounded-full" />
                <div>
                  <p className="text-white font-semibold">{user.name}</p>
                  <p className="text-slate-400">{user.email}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="text-slate-300 text-sm">Change Avatar URL</label>
                  <div className="flex space-x-2">
                    <input
                      type="url"
                      placeholder="https://..."
                      value={editAvatar}
                      onChange={(e) => setEditAvatar(e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                    />
                    <button
                      onClick={() => handleUpdateProfile('avatar', editAvatar)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                    >
                      Update
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="text-slate-300 text-sm">Change Email</label>
                  <div className="flex space-x-2">
                    <input
                      type="email"
                      placeholder="new@email.com"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                    />
                    <button
                      onClick={() => handleUpdateProfile('email', editEmail)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                    >
                      Update
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-500/20 rounded-lg p-4">
                <p className="text-green-300 text-sm">Balance</p>
                <p className="text-white text-2xl font-bold">${parseFloat(user.balance).toFixed(2)}</p>
              </div>
              <div className="bg-blue-500/20 rounded-lg p-4">
                <p className="text-blue-300 text-sm">Active Bets</p>
                <p className="text-white text-2xl font-bold">{userBets.filter(b => b.status === 'pending').length}</p>
              </div>
              <div className="bg-purple-500/20 rounded-lg p-4">
                <p className="text-purple-300 text-sm">Total Bets</p>
                <p className="text-white text-2xl font-bold">{userBets.length}</p>
              </div>
            </div>

            <div className="bg-slate-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-4">My Bets</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {userBets.length === 0 ? (
                  <p className="text-slate-400 text-center py-4">No bets placed yet</p>
                ) : (
                  userBets.map(bet => (
                    <div key={bet.id} className="bg-slate-700 rounded-lg p-4">
                      <p className="text-white font-semibold mb-1">{bet.market_question}</p>
                      <div className="flex items-center justify-between text-sm">
                        <div>
                          <p className="text-slate-300">
                            Bet: {bet.choice ? bet.choice.toUpperCase() : bet.option_name} at {parseFloat(bet.odds).toFixed(2)}x
                          </p>
                          <p className="text-green-400">
                            ${parseFloat(bet.amount).toFixed(2)} → Potential: ${parseFloat(bet.potential_win).toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            bet.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                            bet.status === 'won' ? 'bg-green-500/20 text-green-300' :
                            bet.status === 'lost' ? 'bg-red-500/20 text-red-300' :
                            'bg-slate-500/20 text-slate-300'
                          }`}>
                            {bet.status}
                          </span>
                          {bet.status === 'pending' && (
                            <button
                              onClick={() => handleCancelBet(bet.id)}
                              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <Modal onClose={() => setShowLeaderboard(false)} title="Leaderboard">
          <div className="space-y-2">
            {leaderboard.map((player, index) => (
              <div
                key={player.id}
                className={`flex items-center justify-between p-4 rounded-lg ${
                  index === 0 ? 'bg-yellow-500/20 border border-yellow-500/50' :
                  index === 1 ? 'bg-slate-500/20 border border-slate-500/50' :
                  index === 2 ? 'bg-orange-500/20 border border-orange-500/50' :
                  'bg-slate-800'
                }`}
              >
                <div className="flex items-center space-x-4">
                  <span className="text-2xl font-bold text-white">#{index + 1}</span>
                  <img src={player.avatar} alt={player.name} className="w-10 h-10 rounded-full" />
                  <div>
                    <p className="text-white font-semibold">{player.name}</p>
                    <p className="text-slate-400 text-sm">{player.bets_won} wins</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-green-400 font-bold">${parseFloat(player.total_winnings).toFixed(2)}</p>
                  <p className="text-slate-400 text-sm">Balance: ${parseFloat(player.balance).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Category Manager Modal - [keeping existing, no changes] */}
      {showCategoryManager && user?.is_admin && (
        <Modal onClose={() => setShowCategoryManager(false)} title="Manage Categories">
          <div className="space-y-4">
            <form onSubmit={handleCreateCategory} className="flex space-x-2">
              <input
                type="text"
                placeholder="New category name"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Add
              </button>
            </form>
            
            <div className="space-y-2">
              {categories.map(category => (
                <div key={category.id} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                  <span className="text-white">{category.name}</span>
                  <button
                    onClick={() => handleDeleteCategory(category.id)}
                    className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* Admin Panel Modal - [keeping existing, no changes] */}
      {showAdminPanel && user?.is_admin && (
        <Modal onClose={() => setShowAdminPanel(false)} title="Create Market" size="large">
          <form onSubmit={handleCreateMarket} className="space-y-4">
            <input
              type="text"
              placeholder="Market question"
              value={marketForm.question}
              onChange={(e) => setMarketForm({...marketForm, question: e.target.value})}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
              required
            />
            
            <select
              value={marketForm.categoryId}
              onChange={(e) => setMarketForm({...marketForm, categoryId: e.target.value})}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
              required
            >
              <option value="">Select category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            <div className="flex space-x-4">
              <label className="flex items-center space-x-2 text-white">
                <input
                  type="radio"
                  value="binary"
                  checked={marketForm.marketType === 'binary'}
                  onChange={(e) => setMarketForm({...marketForm, marketType: e.target.value})}
                />
                <span>Binary (Yes/No)</span>
              </label>
              <label className="flex items-center space-x-2 text-white">
                <input
                  type="radio"
                  value="multi-choice"
                  checked={marketForm.marketType === 'multi-choice'}
                  onChange={(e) => setMarketForm({...marketForm, marketType: e.target.value})}
                />
                <span>Multi-Choice (2-4 options)</span>
              </label>
            </div>

            {marketForm.marketType === 'binary' ? (
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="number"
                  step="0.1"
                  min="1.1"
                  placeholder="YES odds (e.g., 2.5)"
                  value={marketForm.yesOdds}
                  onChange={(e) => setMarketForm({...marketForm, yesOdds: e.target.value})}
                  className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  required
                />
                <input
                  type="number"
                  step="0.1"
                  min="1.1"
                  placeholder="NO odds (e.g., 1.5)"
                  value={marketForm.noOdds}
                  onChange={(e) => setMarketForm({...marketForm, noOdds: e.target.value})}
                  className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  required
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-white font-semibold">Options (2-4 required)</label>
                  {marketForm.options.length < 4 && (
                    <button
                      type="button"
                      onClick={addOption}
                      className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Add Option</span>
                    </button>
                  )}
                </div>
                {marketForm.options.map((option, index) => (
                  <div key={index} className="flex space-x-2">
                    <input
                      type="text"
                      placeholder={`Option ${index + 1} (e.g., California)`}
                      value={option.text}
                      onChange={(e) => updateOption(index, 'text', e.target.value)}
                      className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                      required
                    />
                    <input
                      type="number"
                      step="0.1"
                      min="1.1"
                      placeholder="Odds"
                      value={option.odds}
                      onChange={(e) => updateOption(index, 'odds', e.target.value)}
                      className="w-24 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                      required
                    />
                    {marketForm.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            <input
              type="datetime-local"
              value={marketForm.deadline}
              onChange={(e) => setMarketForm({...marketForm, deadline: e.target.value})}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
              required
            />
            
            <button
              type="submit"
              className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold"
            >
              Create Market
            </button>
          </form>
        </Modal>
      )}

      {/* Resolve Markets Modal - UPDATED WITH VERIFY BUTTON */}
      {showResolveModal && user?.is_admin && (
        <Modal onClose={() => setShowResolveModal(false)} title="Resolve Expired Markets" size="large">
          <div className="space-y-4">
            {expiredMarkets.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No expired markets to resolve</p>
            ) : (
              expiredMarkets.map(market => (
                <div key={market.id} className="bg-slate-800 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-white font-semibold mb-1">{market.question}</p>
                      <p className="text-slate-400 text-sm">
                        Expired: {new Date(market.deadline).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => fetchVerification(market)}
                      disabled={verifyingMarket === market.id}
                      className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      <Search className="w-4 h-4" />
                      <span>{verifyingMarket === market.id ? 'Verifying...' : 'Verify'}</span>
                    </button>
                  </div>
                  
                  {market.market_type === 'binary' ? (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleResolveMarket(market.id, 'yes')}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        YES Won
                      </button>
                      <button
                        onClick={() => handleResolveMarket(market.id, 'no')}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        NO Won
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-slate-300 text-sm">Select winning option:</p>
                      {market.options && market.options.map(option => (
                        <button
                          key={option.id}
                          onClick={() => handleResolveMarket(market.id, option.id)}
                          className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-left"
                        >
                          {option.option_text}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Modal>
      )}

      {/* Verification Modal - NEW! */}
      {showVerificationModal && verificationData && (
        <Modal 
          onClose={() => {
            setShowVerificationModal(false);
            setVerificationData(null);
          }} 
          title="Verification Data" 
          size="large"
        >
          <div className="space-y-6">
            {/* Market Info */}
            <div className="bg-slate-800 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-2">{verificationData.market.question}</h3>
              <p className="text-slate-400 text-sm">
                Deadline: {new Date(verificationData.market.deadline).toLocaleDateString()}
              </p>
            </div>

            {/* AI Suggestion */}
            {verificationData.suggested_winner && (
              <div className={`rounded-lg p-4 border-2 ${
                verificationData.confidence > 0.7 
                  ? 'bg-green-500/20 border-green-500' 
                  : 'bg-yellow-500/20 border-yellow-500'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    {verificationData.confidence > 0.7 ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-yellow-400" />
                    )}
                    <h4 className="text-white font-semibold">AI Suggestion</h4>
                  </div>
                  <span className={`text-sm font-semibold ${
                    verificationData.confidence > 0.7 ? 'text-green-400' : 'text-yellow-400'
                  }`}>
                    {(verificationData.confidence * 100).toFixed(0)}% Confidence
                  </span>
                </div>
                <p className="text-white text-lg">
                  Suggested Winner: <span className="font-bold">{verificationData.suggested_winner}</span>
                </p>
              </div>
            )}

            {/* Analysis Scores */}
            {verificationData.analysis && (
              <div className="bg-slate-800 rounded-lg p-4">
                <h4 className="text-white font-semibold mb-3">Analysis</h4>
                <div className="space-y-2">
                  {Object.entries(verificationData.analysis)
                    .sort(([,a], [,b]) => b - a)
                    .map(([option, score]) => (
                      <div key={option} className="flex items-center justify-between">
                        <span className="text-white">{option}</span>
                        <div className="flex items-center space-x-3">
                          <div className="w-32 bg-slate-700 rounded-full h-2">
                            <div 
                              className="bg-purple-500 h-2 rounded-full"
                              style={{ 
                                width: `${Math.min(score / Math.max(...Object.values(verificationData.analysis)) * 100, 100)}%` 
                              }}
                            />
                          </div>
                          <span className="text-purple-400 font-semibold w-12 text-right">{score}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Special Data (USGS Earthquakes, etc.) */}
            {verificationData.data && (
              <div className="bg-slate-800 rounded-lg p-4">
                <h4 className="text-white font-semibold mb-3">{verificationData.data.source}</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {verificationData.data.earthquakes?.map((eq, i) => (
                    <div key={i} className="bg-slate-700 rounded p-2 text-sm">
                      <p className="text-white">
                        <span className="font-semibold">M{eq.magnitude}</span> - {eq.location}
                      </p>
                      {eq.state && (
                        <p className="text-purple-400">State: {eq.state}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* News Articles */}
            {verificationData.news?.articles && verificationData.news.articles.length > 0 && (
              <div className="bg-slate-800 rounded-lg p-4">
                <h4 className="text-white font-semibold mb-3">
                  Related News ({verificationData.news.totalResults} results)
                </h4>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {verificationData.news.articles.map((article, i) => (
                    <div key={i} className="bg-slate-700 rounded-lg p-3">
                      <h5 className="text-white font-medium mb-1">{article.title}</h5>
                      {article.description && (
                        <p className="text-slate-300 text-sm mb-2">{article.description}</p>
                      )}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">{article.source}</span>
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1 text-purple-400 hover:text-purple-300"
                        >
                          <span>Read more</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resolution Buttons */}
            <div className="bg-slate-900 rounded-lg p-4">
              <h4 className="text-white font-semibold mb-3">Resolve Market</h4>
              {verificationData.market.type === 'binary' ? (
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleResolveMarket(verificationData.market.id, 'yes')}
                    className={`flex-1 px-4 py-3 text-white rounded-lg font-semibold transition-colors ${
                      verificationData.suggested_winner === 'YES' 
                        ? 'bg-green-600 hover:bg-green-700 ring-2 ring-green-400'
                        : 'bg-green-600/50 hover:bg-green-600'
                    }`}
                  >
                    YES Won {verificationData.suggested_winner === 'YES' && '⭐'}
                  </button>
                  <button
                    onClick={() => handleResolveMarket(verificationData.market.id, 'no')}
                    className={`flex-1 px-4 py-3 text-white rounded-lg font-semibold transition-colors ${
                      verificationData.suggested_winner === 'NO'
                        ? 'bg-red-600 hover:bg-red-700 ring-2 ring-red-400'
                        : 'bg-red-600/50 hover:bg-red-600'
                    }`}
                  >
                    NO Won {verificationData.suggested_winner === 'NO' && '⭐'}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {verificationData.options?.map(option => (
                    <button
                      key={option.id}
                      onClick={() => handleResolveMarket(verificationData.market.id, option.id)}
                      className={`w-full px-4 py-3 text-white rounded-lg font-semibold text-left transition-colors ${
                        verificationData.suggested_winner === option.text
                          ? 'bg-purple-600 hover:bg-purple-700 ring-2 ring-purple-400'
                          : 'bg-purple-600/50 hover:bg-purple-600'
                      }`}
                    >
                      {option.text} {verificationData.suggested_winner === option.text && '⭐ Suggested'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Market Card Component (unchanged)
function MarketCard({ market, user, handleBet }) {
  const deadline = new Date(market.deadline);
  const isExpired = deadline < new Date();

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20 hover:border-purple-500/40 transition-all">
      <div className="flex items-start justify-between mb-4">
        <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm">
          {market.category_name}
        </span>
        {market.market_type === 'multi-choice' && (
          <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm">
            Multi-Choice
          </span>
        )}
      </div>
      
      <h3 className="text-xl font-semibold text-white mb-4">{market.question}</h3>
      
      <div className="flex items-center space-x-2 text-slate-400 text-sm mb-4">
        <Calendar className="w-4 h-4" />
        <span>{deadline.toLocaleDateString()}</span>
      </div>

      {market.market_type === 'binary' ? (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => user && !isExpired && handleBet(market, 'yes')}
              disabled={!user || isExpired}
              className="px-4 py-3 bg-green-500/20 text-green-300 rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="text-lg font-bold">YES</div>
              <div className="text-sm">{parseFloat(market.yes_odds).toFixed(2)}x</div>
            </button>
            <button
              onClick={() => user && !isExpired && handleBet(market, 'no')}
              disabled={!user || isExpired}
              className="px-4 py-3 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="text-lg font-bold">NO</div>
              <div className="text-sm">{parseFloat(market.no_odds).toFixed(2)}x</div>
            </button>
          </div>

          <div className="flex items-center justify-between text-sm text-slate-400">
            <div className="flex items-center space-x-1">
              <Users className="w-4 h-4" />
              <span>{(market.total_bets || 0)} bets</span>
            </div>
            <div>
              <span className="text-green-400">{(market.yes_bets || 0)} YES</span>
              {' / '}
              <span className="text-red-400">{(market.no_bets || 0)} NO</span>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-2">
          {market.options && market.options.length > 0 ? (
            market.options
              .filter((option, index, self) => 
                index === self.findIndex(o => o.id === option.id)
              )
              .map((option) => {
                const totalBets = market.options.reduce((sum, opt) => sum + (opt.bet_count || 0), 0);
                const optionPercentage = totalBets > 0 
                  ? ((option.bet_count || 0) / totalBets * 100).toFixed(1)
                  : '0.0';
                
                return (
                  <div
                    key={`market-${market.id}-option-${option.id}`}
                    className="relative bg-slate-700/50 rounded-lg p-3 hover:bg-slate-700 transition-colors cursor-pointer"
                    onClick={() => user && !isExpired && handleBet(market, null, option)}
                  >
                    <div className="relative z-10 flex items-center justify-between">
                      <span className="text-white font-medium">{option.option_text}</span>
                      <span className="text-purple-400 font-bold">{parseFloat(option.odds).toFixed(1)}x</span>
                    </div>
                    <div className="relative z-10 flex items-center justify-between mt-1 text-xs">
                      <span className="text-slate-400">{option.bet_count || 0} bets</span>
                      <span className="text-slate-400">{optionPercentage}%</span>
                    </div>
                    <div 
                      className="absolute inset-0 bg-purple-500/20 rounded-lg"
                      style={{ width: `${optionPercentage}%` }}
                    />
                  </div>
                );
              })
          ) : (
            <p className="text-slate-400 text-center py-4">No options available</p>
          )}
        </div>
      )}

      {isExpired && (
        <div className="mt-4 px-3 py-2 bg-orange-500/20 border border-orange-500/50 rounded-lg text-orange-300 text-sm text-center">
          Market Expired - Awaiting Resolution
        </div>
      )}
    </div>
  );
}

// Modal Component (unchanged)
function Modal({ children, onClose, title, size = 'normal' }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`bg-slate-900 rounded-xl border border-purple-500/30 ${
        size === 'large' ? 'max-w-4xl w-full' : 'max-w-md w-full'
      } max-h-[90vh] overflow-hidden flex flex-col`}>
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}
