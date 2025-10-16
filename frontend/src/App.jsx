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
  
  // NEW STATE VARIABLES
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [userStats, setUserStats] = useState(null);
  const [marketStats, setMarketStats] = useState({});
  const [showUserStats, setShowUserStats] = useState(false);
  const [showCategoryPanel, setShowCategoryPanel] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  const [newMarket, setNewMarket] = useState({
    question: '',
    yesOdds: '',
    noOdds: '',
    categoryId: '', // CHANGED from 'category'
    deadline: ''
  });

  const [activeBet, setActiveBet] = useState(null);
  const [betAmount, setBetAmount] = useState('');
  const [bets, setBets] = useState([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Fetch markets on mount
  useEffect(() => {
    fetchMarkets();
    fetchLeaderboard();
    fetchCategories(); // NEW
  }, []);

  // Fetch markets when category filter changes (NEW)
  useEffect(() => {
    fetchMarkets();
  }, [selectedCategory]);

  // Fetch user bets when logged in
  useEffect(() => {
    if (isLoggedIn && user) {
      fetchUserBets();
      fetchUserBalance();
      fetchUserStats(); // NEW
    }
  }, [isLoggedIn, user]);

  // MODIFIED - Now supports category filtering
  const fetchMarkets = async () => {
    try {
      const url = selectedCategory 
        ? `${API_URL}/api/markets?category_id=${selectedCategory}`
        : `${API_URL}/api/markets`;
      const response = await fetch(url);
      const data = await response.json();
      setBettingMarkets(data);
      
      // Fetch stats for each market (NEW)
      data.forEach(market => fetchMarketStats(market.id));
    } catch (err) {
      console.error('Error fetching markets:', err);
    }
  };

  // NEW - Fetch market betting statistics
  const fetchMarketStats = async (marketId) => {
    try {
      const response = await fetch(`${API_URL}/api/markets/${marketId}/stats`);
      const data = await response.json();
      setMarketStats(prev => ({ ...prev, [marketId]: data }));
    } catch (err) {
      console.error('Error fetching market stats:', err);
    }
  };

  // NEW - Fetch categories
  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/api/categories`);
      const data = await response.json();
      setCategories(data);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  // NEW - Fetch user statistics
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
    setShowCategoryPanel(false);
    setShowUserStats(false);
  };

  // MODIFIED - Now uses categoryId
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

  // NEW - Create category
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

  // NEW - Delete category
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

      await fetchUserBets();
      await fetchUserBalance();
      await fetchMarketStats(activeBet.market.id); // Refresh market stats
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

  // Component continues in Part 2...
  // This continues from Part 1...
  
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

            {/* NEW - My Stats Button */}
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
                    {/* NEW - Manage Categories Button */}
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

      {/* Continue to Part 3 for modals... */}
    </div>
  );
};

export default App;
