import { useState, useEffect } from 'react';
import './App.css';

const API_URL = 'https://api.binary-bets.com/api';

function App() {
  const [user, setUser] = useState(null);
  const [markets, setMarkets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filteredMarkets, setFilteredMarkets] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [activeTab, setActiveTab] = useState('markets');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ 
    username: '', 
    email: '', 
    confirmEmail: '',
    password: '',
    confirmPassword: ''
  });
  const [authError, setAuthError] = useState('');
  const [showBetModal, setShowBetModal] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [betAmount, setBetAmount] = useState('');
  const [selectedOption, setSelectedOption] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [userBets, setUserBets] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [toast, setToast] = useState(null);
  const [newMarket, setNewMarket] = useState({
    question: '',
    deadline: '',
    categoryId: '',
    subcategoryId: '',
    options: ['Yes', 'No']
  });

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return 'No date set';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return 'Invalid date';
    }
  };

  // Show toast notification
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Copy category link to clipboard
  const copyShareLink = (category) => {
    const url = `${window.location.origin}${window.location.pathname}?category=${category.id}`;
    navigator.clipboard.writeText(url).then(() => {
      showToast(`Link copied! Share ${category.name} markets with this link.`);
    }).catch(() => {
      showToast('Failed to copy link', 'error');
    });
  };

  // Fetch data on mount
  useEffect(() => {
    fetchMarkets();
    fetchCategories();
    
    const token = localStorage.getItem('token');
    if (token) {
      fetchUserData(token);
    }
  }, []);

  // Check URL parameters after categories load
  useEffect(() => {
    if (categories.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const categoryId = urlParams.get('category');
      
      if (categoryId) {
        const category = categories.find(c => c.id === parseInt(categoryId));
        if (category) {
          setSelectedCategory(category);
          setActiveTab('markets');
          console.log('✅ Category selected from URL:', category.name);
        } else {
          console.warn('⚠️ Category not found:', categoryId);
        }
      }
    }
  }, [categories]); // Trigger when categories load

  // Filter markets when category changes
  useEffect(() => {
    if (selectedCategory) {
      const filtered = markets.filter(m => m.category_id === selectedCategory.id);
      setFilteredMarkets(filtered);
      
      // Update URL parameter
      const url = new URL(window.location);
      url.searchParams.set('category', selectedCategory.id);
      window.history.pushState({}, '', url);
    } else {
      setFilteredMarkets(markets);
      
      // Remove category parameter from URL
      const url = new URL(window.location);
      url.searchParams.delete('category');
      window.history.pushState({}, '', url);
    }
  }, [selectedCategory, markets]);

  const fetchUserData = async (token) => {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        localStorage.removeItem('token');
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchMarkets = async () => {
    try {
      const response = await fetch(`${API_URL}/markets`);
      const data = await response.json();
      console.log('📊 Markets received:', data.markets?.length || 0, 'markets');
      console.log('📋 Markets data:', data.markets);
      setMarkets(data.markets || []);
      setFilteredMarkets(data.markets || []);
    } catch (error) {
      console.error('❌ Error fetching markets:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/categories`);
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchUserBets = async () => {
    if (!user) return;
    
    try {
      const response = await fetch(`${API_URL}/bets`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setUserBets(data.bets || []);
    } catch (error) {
      console.error('Error fetching bets:', error);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`${API_URL}/leaderboard`);
      const data = await response.json();
      setLeaderboard(data.players || []);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');

    try {
      if (authMode === 'register') {
        // Validation
        if (!authForm.username || !authForm.email || !authForm.password) {
          setAuthError('All fields are required');
          return;
        }

        if (authForm.username.length < 3 || authForm.username.length > 20) {
          setAuthError('Username must be between 3 and 20 characters');
          return;
        }

        if (authForm.email !== authForm.confirmEmail) {
          setAuthError('Emails do not match');
          return;
        }

        if (authForm.password.length < 6) {
          setAuthError('Password must be at least 6 characters');
          return;
        }

        if (authForm.password !== authForm.confirmPassword) {
          setAuthError('Passwords do not match');
          return;
        }

        const response = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: authForm.username,
            email: authForm.email,
            password: authForm.password
          })
        });

        const data = await response.json();

        if (!response.ok) {
          setAuthError(data.error || 'Registration failed');
          return;
        }

        localStorage.setItem('token', data.token);
        setUser(data.user);
        setShowAuthModal(false);
        setAuthForm({ username: '', email: '', confirmEmail: '', password: '', confirmPassword: '' });
        showToast('Account created successfully! Welcome to Binary Bets!');
      } else {
        // Login
        const response = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: authForm.email,
            password: authForm.password
          })
        });

        const data = await response.json();

        if (!response.ok) {
          setAuthError(data.error || 'Login failed');
          return;
        }

        localStorage.setItem('token', data.token);
        setUser(data.user);
        setShowAuthModal(false);
        setAuthForm({ username: '', email: '', confirmEmail: '', password: '', confirmPassword: '' });
        showToast(`Welcome back, ${data.user.username}!`);
      }
    } catch (error) {
      setAuthError('Network error. Please try again.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setActiveTab('markets');
    showToast('Logged out successfully');
  };

  const handlePlaceBet = async () => {
    if (!betAmount || parseFloat(betAmount) <= 0) {
      showToast('Please enter a valid bet amount', 'error');
      return;
    }

    if (parseFloat(betAmount) > user.balance) {
      showToast('Insufficient balance', 'error');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/bets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          marketId: selectedMarket.id,
          optionId: selectedOption.id,
          amount: parseFloat(betAmount)
        })
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || 'Failed to place bet', 'error');
        return;
      }

      // Update user balance
      setUser(prev => ({
        ...prev,
        balance: prev.balance - parseFloat(betAmount)
      }));

      setShowBetModal(false);
      setBetAmount('');
      setSelectedOption(null);
      fetchMarkets();
      showToast(`Bet placed successfully! $${parseFloat(betAmount).toFixed(2)} on ${selectedOption.option_text}`);
    } catch (error) {
      showToast('Network error. Please try again.', 'error');
    }
  };

  const handleCreateMarket = async (e) => {
    e.preventDefault();

    if (!newMarket.question || !newMarket.deadline) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/markets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          question: newMarket.question,
          deadline: newMarket.deadline,
          categoryId: newMarket.categoryId || null,
          subcategoryId: newMarket.subcategoryId || null,
          options: newMarket.options
        })
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || 'Failed to create market', 'error');
        return;
      }

      setShowCreateModal(false);
      setNewMarket({
        question: '',
        deadline: '',
        categoryId: '',
        subcategoryId: '',
        options: ['Yes', 'No']
      });
      fetchMarkets();
      showToast('Market created successfully!');
    } catch (error) {
      showToast('Network error. Please try again.', 'error');
    }
  };

  useEffect(() => {
    if (activeTab === 'myBets') {
      fetchUserBets();
    } else if (activeTab === 'leaderboard') {
      fetchLeaderboard();
    }
  }, [activeTab]);

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo">
            {/* Dice Logo */}
            <svg width="40" height="40" viewBox="0 0 64 64" className="dice-logo">
              <rect x="4" y="4" width="56" height="56" rx="8" fill="white" stroke="#667eea" strokeWidth="3"/>
              <circle cx="20" cy="20" r="4" fill="#e74c3c"/>
              <circle cx="44" cy="20" r="4" fill="#e74c3c"/>
              <circle cx="32" cy="32" r="4" fill="#e74c3c"/>
              <circle cx="20" cy="44" r="4" fill="#e74c3c"/>
              <circle cx="44" cy="44" r="4" fill="#e74c3c"/>
            </svg>
            <span>Binary Bets</span>
          </div>

          <nav className="nav">
            <button 
              className={`nav-tab ${activeTab === 'markets' ? 'active' : ''}`}
              onClick={() => setActiveTab('markets')}
            >
              Markets
            </button>
            <button 
              className={`nav-tab ${activeTab === 'categories' ? 'active' : ''}`}
              onClick={() => setActiveTab('categories')}
            >
              Categories
            </button>
            <button 
              className={`nav-tab ${activeTab === 'leaderboard' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('leaderboard');
                fetchLeaderboard();
              }}
            >
              Leaderboard
            </button>
            {user && (
              <>
                <button 
                  className={`nav-tab ${activeTab === 'myBets' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('myBets');
                    fetchUserBets();
                  }}
                >
                  My Bets
                </button>
                <button 
                  className={`nav-tab ${activeTab === 'create' ? 'active' : ''}`}
                  onClick={() => setActiveTab('create')}
                >
                  Create Market
                </button>
              </>
            )}
          </nav>

          <div className="header-actions">
            {user ? (
              <>
                <div className="user-info">
                  <span className="username">{user.username}</span>
                  <div className="balance">💰 ${user.balance?.toFixed(2) || '0.00'}</div>
                </div>
                <button onClick={handleLogout} className="btn btn-secondary">
                  Logout
                </button>
              </>
            ) : (
              <button onClick={() => setShowAuthModal(true)} className="btn btn-primary">
                Login / Sign Up
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Category Tabs - Horizontal Display */}
      {activeTab === 'markets' && categories.length > 0 && (
        <div className="category-tabs">
          <button
            className={`category-tab ${!selectedCategory ? 'active' : ''}`}
            onClick={() => setSelectedCategory(null)}
          >
            All Markets
          </button>
          {categories.map(category => (
            <button
              key={category.id}
              className={`category-tab ${selectedCategory?.id === category.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category)}
            >
              <span className="category-icon">{category.icon}</span>
              {category.name}
            </button>
          ))}
        </div>
      )}

      <div className="container">
        {/* Sidebar */}
        <aside className="sidebar">
          {/* Disclaimer Widget */}
          <div className="widget disclaimer-widget">
            <div className="widget-icon">⚠️</div>
            <h3>Disclaimer</h3>
            <p>Prediction markets are for entertainment purposes only. This platform uses play money and is not real gambling. Always bet responsibly and within your means.</p>
          </div>

          {/* News Widget */}
          <div className="widget news-widget">
            <div className="widget-icon">📰</div>
            <h3>Latest News</h3>
            <div className="news-item">
              <div className="news-date">Oct 30, 2025</div>
              <div className="news-title">New markets added daily</div>
            </div>
            <div className="news-item">
              <div className="news-date">Oct 29, 2025</div>
              <div className="news-title">Leaderboard updated</div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          {activeTab === 'markets' && (
            <>
              <h1>Prediction Markets</h1>
              <div className="markets-grid">
                {filteredMarkets.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">📊</div>
                    <h3>No markets available</h3>
                    <p>Check back soon for new prediction markets!</p>
                  </div>
                ) : (
                  filteredMarkets.map((market) => (
                    <div key={market.id} className="market-card">
                      <div className="market-header">
                        {market.category_icon && (
                          <span className="category-badge" style={{ 
                            background: market.category_color || '#667eea' 
                          }}>
                            {market.category_icon} {market.category_name}
                          </span>
                        )}
                        <span className={`status-badge ${market.status}`}>
                          {market.status === 'active' ? 'LIVE' : 'CLOSED'}
                        </span>
                      </div>

                      <h3 className="market-question">{market.question}</h3>

                      <div className="market-stats">
                        <div className="stat">
                          <span className="stat-label">TOTAL BETS</span>
                          <span className="stat-value">{market.bet_count || 0}</span>
                        </div>
                        <div className="stat">
                          <span className="stat-label">POOL</span>
                          <span className="stat-value">
                            ${(parseFloat(market.yes_total || 0) + parseFloat(market.no_total || 0)).toFixed(0)}
                          </span>
                        </div>
                        <div className="stat">
                          <span className="stat-label">CLOSES</span>
                          <span className="stat-value">
                            {formatDate(market.deadline || market.closes_at)}
                          </span>
                        </div>
                      </div>

                      {/* Betting Options Display */}
                      {market.options && market.options.length > 0 && (
                        <div className="betting-options">
                          <div className="options-label">BETTING OPTIONS:</div>
                          <div className="options-grid">
                            {market.options.map((option) => {
                              const totalPool = market.options.reduce((sum, opt) => 
                                sum + parseFloat(opt.total_amount || 0), 0
                              );
                              const optionAmount = parseFloat(option.total_amount || 0);
                              
                              // Calculate odds
                              let odds = 0;
                              let oddsLabel = '';
                              
                              if (market.ai_odds && market.ai_odds.odds && market.ai_odds.odds[option.option_text]) {
                                // Use AI odds if available
                                odds = market.ai_odds.odds[option.option_text];
                                oddsLabel = 'AI PREDICTION';
                              } else if (totalPool > 0) {
                                // Use current pool odds
                                odds = optionAmount / totalPool;
                                oddsLabel = 'current odds';
                              } else {
                                odds = 0.5; // Default 50/50
                                oddsLabel = 'no bets yet';
                              }

                              const percentage = (odds * 100).toFixed(0);

                              return (
                                <div key={option.id} className="option-card">
                                  <div className="option-name">{option.option_text}</div>
                                  <div className="option-odds">{percentage}%</div>
                                  <div className="option-label">{oddsLabel}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {market.status === 'active' && user && (
                        <button
                          className="btn btn-primary"
                          onClick={() => {
                            setSelectedMarket(market);
                            setShowBetModal(true);
                          }}
                        >
                          Place Bet
                        </button>
                      )}

                      {market.status === 'resolved' && (
                        <div className="outcome-badge">
                          Outcome: {market.outcome}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {activeTab === 'categories' && (
            <>
              <h1>Browse Categories</h1>
              <div className="categories-grid">
                {categories.map(category => (
                  <div key={category.id} className="category-card">
                    <div className="category-icon-large">{category.icon}</div>
                    <h3>{category.name}</h3>
                    {category.subcategories && category.subcategories.length > 0 && (
                      <div className="subcategories">
                        {category.subcategories.map(sub => (
                          <span key={sub.id} className="subcategory-tag">
                            {sub.name}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="category-card-actions">
                      <button 
                        className="btn btn-secondary"
                        onClick={() => {
                          setSelectedCategory(category);
                          setActiveTab('markets');
                        }}
                      >
                        View Markets
                      </button>
                      <button 
                        className="btn btn-share"
                        onClick={() => copyShareLink(category)}
                        title="Copy link to share"
                      >
                        🔗 Share
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === 'myBets' && (
            <>
              <h1>My Bets</h1>
              {userBets.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🎲</div>
                  <h3>No bets yet</h3>
                  <p>Start betting on prediction markets!</p>
                </div>
              ) : (
                <div className="bets-list">
                  {userBets.map(bet => (
                    <div key={bet.id} className="bet-card">
                      <div className="bet-header">
                        <h3>{bet.question}</h3>
                        <span className={`status-badge ${bet.market_status}`}>
                          {bet.market_status}
                        </span>
                      </div>
                      <div className="bet-details">
                        <div className="bet-info">
                          <div className="info-label">Your Choice</div>
                          <div className="info-value">{bet.option_text}</div>
                        </div>
                        <div className="bet-info">
                          <div className="info-label">Amount</div>
                          <div className="info-value">${parseFloat(bet.amount || 0).toFixed(2)}</div>
                        </div>
                        <div className="bet-info">
                          <div className="info-label">Odds</div>
                          <div className="info-value">{(parseFloat(bet.odds || 0) * 100).toFixed(0)}%</div>
                        </div>
                        {bet.market_status === 'resolved' && (
                          <div className="bet-info">
                            <div className="info-label">Outcome</div>
                            <div className="info-value">{bet.outcome}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'create' && user && (
            <>
              <h1>Create New Market</h1>
              <form onSubmit={handleCreateMarket} className="create-form">
                <div className="form-group">
                  <label>Question *</label>
                  <input
                    type="text"
                    value={newMarket.question}
                    onChange={(e) => setNewMarket({ ...newMarket, question: e.target.value })}
                    placeholder="e.g., Will it rain tomorrow?"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Closing Date * (Must be at least tomorrow)</label>
                  <input
                    type="datetime-local"
                    value={newMarket.deadline}
                    onChange={(e) => setNewMarket({ ...newMarket, deadline: e.target.value })}
                    min={new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().slice(0, 16)}
                    required
                  />
                  <small className="form-hint">Markets cannot expire on the same day they are created</small>
                </div>

                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={newMarket.categoryId}
                    onChange={(e) => setNewMarket({ ...newMarket, categoryId: e.target.value })}
                  >
                    <option value="">Select category (optional)</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Options</label>
                  <div className="options-inputs">
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
                        placeholder={`Option ${index + 1}`}
                      />
                    ))}
                  </div>
                </div>

                <button type="submit" className="btn btn-primary">
                  Create Market
                </button>
              </form>
            </>
          )}

          {activeTab === 'leaderboard' && (
            <>
              <h1>Leaderboard</h1>
              {leaderboard.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🏆</div>
                  <h3>No players yet</h3>
                  <p>Be the first to start betting!</p>
                </div>
              ) : (
                <table className="leaderboard-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Player</th>
                      <th>Balance</th>
                      <th>Bets</th>
                      <th>Winnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((player, index) => (
                      <tr key={player.id}>
                        <td style={{ fontWeight: 'bold', color: '#667eea' }}>#{index + 1}</td>
                        <td style={{ fontWeight: '600' }}>{player.username}</td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>${parseFloat(player.balance || 0).toFixed(2)}</td>
                        <td style={{ textAlign: 'center' }}>{player.bet_count || 0}</td>
                        <td style={{ 
                          textAlign: 'right',
                          color: parseFloat(player.winnings || 0) > 0 ? '#10b981' : '#6b7280'
                        }}>
                          ${parseFloat(player.winnings || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </main>
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAuthModal(false)}>×</button>
            
            <h2>{authMode === 'login' ? 'Login' : 'Create Account'}</h2>
            
            <div className="auth-tabs">
              <button
                className={authMode === 'login' ? 'active' : ''}
                onClick={() => {
                  setAuthMode('login');
                  setAuthError('');
                  setAuthForm({ username: '', email: '', confirmEmail: '', password: '', confirmPassword: '' });
                }}
              >
                Login
              </button>
              <button
                className={authMode === 'register' ? 'active' : ''}
                onClick={() => {
                  setAuthMode('register');
                  setAuthError('');
                  setAuthForm({ username: '', email: '', confirmEmail: '', password: '', confirmPassword: '' });
                }}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleAuth}>
              {authMode === 'register' && (
                <>
                  <div className="form-group">
                    <label>Username *</label>
                    <input
                      type="text"
                      value={authForm.username}
                      onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                      placeholder="Choose a username (3-20 characters)"
                      required
                      minLength={3}
                      maxLength={20}
                    />
                    <small className="form-hint">This will be displayed publicly</small>
                  </div>

                  <div className="form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      value={authForm.email}
                      onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                      placeholder="your@email.com"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Confirm Email *</label>
                    <input
                      type="email"
                      value={authForm.confirmEmail}
                      onChange={(e) => setAuthForm({ ...authForm, confirmEmail: e.target.value })}
                      placeholder="Confirm your email"
                      required
                    />
                    {authForm.confirmEmail && authForm.email !== authForm.confirmEmail && (
                      <small className="error-hint">Emails do not match</small>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Password *</label>
                    <input
                      type="password"
                      value={authForm.password}
                      onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                      placeholder="At least 6 characters"
                      required
                      minLength={6}
                    />
                  </div>

                  <div className="form-group">
                    <label>Confirm Password *</label>
                    <input
                      type="password"
                      value={authForm.confirmPassword}
                      onChange={(e) => setAuthForm({ ...authForm, confirmPassword: e.target.value })}
                      placeholder="Confirm your password"
                      required
                    />
                    {authForm.confirmPassword && authForm.password !== authForm.confirmPassword && (
                      <small className="error-hint">Passwords do not match</small>
                    )}
                  </div>
                </>
              )}

              {authMode === 'login' && (
                <>
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      value={authForm.email}
                      onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                      placeholder="your@email.com"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Password</label>
                    <input
                      type="password"
                      value={authForm.password}
                      onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                      placeholder="Your password"
                      required
                    />
                  </div>
                </>
              )}

              {authError && <div className="error-message">{authError}</div>}

              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={
                  authMode === 'register' && (
                    !authForm.username ||
                    !authForm.email ||
                    !authForm.confirmEmail ||
                    !authForm.password ||
                    !authForm.confirmPassword ||
                    authForm.email !== authForm.confirmEmail ||
                    authForm.password !== authForm.confirmPassword
                  )
                }
              >
                {authMode === 'login' ? 'Login' : 'Create Account'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Bet Modal */}
      {showBetModal && selectedMarket && (
        <div className="modal-overlay" onClick={() => setShowBetModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowBetModal(false)}>×</button>
            
            <h2>Place Bet</h2>
            <h3 style={{ marginBottom: '24px', color: '#4b5563' }}>{selectedMarket.question}</h3>

            <div className="bet-options">
              {selectedMarket.options?.map(option => (
                <button
                  key={option.id}
                  className={`option-btn ${selectedOption?.id === option.id ? 'selected' : ''}`}
                  onClick={() => setSelectedOption(option)}
                >
                  {option.option_text}
                </button>
              ))}
            </div>

            {selectedOption && (
              <>
                <div className="form-group">
                  <label>Bet Amount</label>
                  <input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    placeholder="0.00"
                    min="0.01"
                    step="0.01"
                  />
                  <small>
                    Available balance: ${user.balance?.toFixed(2) || '0.00'}
                  </small>
                </div>

                <button
                  onClick={handlePlaceBet}
                  className="btn btn-primary"
                  disabled={!betAmount || parseFloat(betAmount) <= 0}
                >
                  Place Bet - ${parseFloat(betAmount || 0).toFixed(2)}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          <div className="toast-content">{toast.message}</div>
          <button className="toast-close" onClick={() => setToast(null)}>×</button>
        </div>
      )}
    </div>
  );
}

export default App;
