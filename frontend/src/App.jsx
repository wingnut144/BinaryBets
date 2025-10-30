import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE = process.env.REACT_APP_API_URL || 'https://api.binary-bets.com';

function App() {
  const [user, setUser] = useState(null);
  const [markets, setMarkets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [currentView, setCurrentView] = useState('markets');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [showBetModal, setShowBetModal] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

  // Auth form state
  const [authForm, setAuthForm] = useState({
    username: '',
    email: '',
    confirmEmail: '',
    password: '',
    confirmPassword: ''
  });

  // Bet form state
  const [betForm, setBetForm] = useState({
    selectedOption: null,
    amount: ''
  });

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Check if user is logged in
        const token = localStorage.getItem('token');
        if (token) {
          const userRes = await fetch(`${API_BASE}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (userRes.ok) {
            const userData = await userRes.json();
            setUser(userData.user);
          } else {
            localStorage.removeItem('token');
          }
        }

        // Fetch markets
        const marketsRes = await fetch(`${API_BASE}/api/markets`);
        if (marketsRes.ok) {
          const marketsData = await marketsRes.json();
          console.log('📊 Markets received:', marketsData.markets?.length || 0, 'markets');
          console.log('📋 Markets data:', marketsData.markets);
          setMarkets(marketsData.markets || []);
        }

        // Fetch categories
        const categoriesRes = await fetch(`${API_BASE}/api/categories`);
        if (categoriesRes.ok) {
          const categoriesData = await categoriesRes.json();
          console.log('📂 Categories received:', categoriesData.categories?.length || 0, 'categories');
          console.log('📋 Categories data:', categoriesData.categories);
          setCategories(categoriesData.categories || []);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
        showToast('Failed to load data', 'error');
      }
    };

    fetchData();
  }, []);

  // Check URL parameters for category filter (after categories load)
  useEffect(() => {
    if (categories.length === 0) return;

    const params = new URLSearchParams(window.location.search);
    const categoryId = params.get('category');
    
    if (categoryId) {
      const category = categories.find(c => c.id === parseInt(categoryId));
      if (category) {
        setSelectedCategory(category.id);
        console.log('✅ Category selected from URL:', category.name);
      } else {
        console.log('⚠️ Category ID not found:', categoryId);
      }
    }
  }, [categories]);

  // Filter markets by category
  const filteredMarkets = selectedCategory 
    ? markets.filter(m => m.category_id === selectedCategory)
    : markets;

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAuth = async (e) => {
    e.preventDefault();

    if (authMode === 'register') {
      // Validation
      if (authForm.username.length < 3 || authForm.username.length > 20) {
        showToast('Username must be 3-20 characters', 'error');
        return;
      }
      if (authForm.email !== authForm.confirmEmail) {
        showToast('Emails do not match', 'error');
        return;
      }
      if (authForm.password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
      }
      if (authForm.password !== authForm.confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
      }
    }

    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = authMode === 'login' 
        ? { username: authForm.username, password: authForm.password }
        : { 
            username: authForm.username, 
            email: authForm.email,
            password: authForm.password 
          };

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('token', data.token);
        setUser(data.user);
        setShowAuthModal(false);
        setAuthForm({ username: '', email: '', confirmEmail: '', password: '', confirmPassword: '' });
        showToast(authMode === 'login' ? 'Welcome back!' : 'Account created!');
      } else {
        showToast(data.error || 'Authentication failed', 'error');
      }
    } catch (error) {
      console.error('Auth error:', error);
      showToast('Network error', 'error');
    }
  };

  const handleBet = async (e) => {
    e.preventDefault();

    if (!betForm.selectedOption) {
      showToast('Please select an option', 'error');
      return;
    }

    if (!betForm.amount || betForm.amount <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    if (betForm.amount > user.balance) {
      showToast('Insufficient balance', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/bets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          market_id: selectedMarket.id,
          option_id: betForm.selectedOption,
          amount: parseFloat(betForm.amount)
        })
      });

      const data = await res.json();

      if (res.ok) {
        setUser(prev => ({ ...prev, balance: data.newBalance }));
        setShowBetModal(false);
        setBetForm({ selectedOption: null, amount: '' });
        showToast('Bet placed successfully!');
        
        // Refresh markets to update odds
        const marketsRes = await fetch(`${API_BASE}/api/markets`);
        if (marketsRes.ok) {
          const marketsData = await marketsRes.json();
          setMarkets(marketsData.markets || []);
        }
      } else {
        showToast(data.error || 'Failed to place bet', 'error');
      }
    } catch (error) {
      console.error('Bet error:', error);
      showToast('Network error', 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    showToast('Logged out');
  };

  const selectCategory = (categoryId) => {
    setSelectedCategory(categoryId);
    const url = new URL(window.location);
    if (categoryId) {
      url.searchParams.set('category', categoryId);
    } else {
      url.searchParams.delete('category');
    }
    window.history.pushState({}, '', url);
  };

  const copyShareLink = (categoryId, categoryName) => {
    const url = `${window.location.origin}?category=${categoryId}`;
    navigator.clipboard.writeText(url);
    showToast(`Link copied! Share ${categoryName} markets with this link.`);
  };

  const getCategoryIcon = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.icon || '📊';
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Unknown';
  };

  const getCategoryColor = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.color || '#667eea';
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <span className="dice-logo">🎲</span>
            Binary Bets
          </div>

          <nav className="nav">
            <button 
              className={`nav-tab ${currentView === 'markets' ? 'active' : ''}`}
              onClick={() => setCurrentView('markets')}
            >
              🏛️ Markets
            </button>
            <button 
              className={`nav-tab ${currentView === 'mybets' ? 'active' : ''}`}
              onClick={() => setCurrentView('mybets')}
              disabled={!user}
            >
              📊 My Bets
            </button>
            <button 
              className={`nav-tab ${currentView === 'categories' ? 'active' : ''}`}
              onClick={() => setCurrentView('categories')}
            >
              📂 Categories
            </button>
            <button 
              className={`nav-tab ${currentView === 'leaderboard' ? 'active' : ''}`}
              onClick={() => setCurrentView('leaderboard')}
            >
              🏆 Leaderboard
            </button>
            {user?.role === 'admin' && (
              <button 
                className={`nav-tab ${currentView === 'create' ? 'active' : ''}`}
                onClick={() => setCurrentView('create')}
              >
                ➕ Create Market
              </button>
            )}
          </nav>

          <div className="header-actions">
            {user ? (
              <>
                <div className="user-info">
                  <div className="username">👤 {user.username}</div>
                  <div className="balance">💰 ${parseFloat(user.balance).toFixed(2)}</div>
                </div>
                <button className="btn btn-secondary" onClick={handleLogout}>
                  Logout
                </button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={() => setShowAuthModal(true)}>
                Login / Sign Up
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Category Tabs - Horizontal below header */}
      {currentView === 'markets' && categories.length > 0 && (
        <div className="category-tabs">
          <button
            className={`category-tab ${!selectedCategory ? 'active' : ''}`}
            onClick={() => selectCategory(null)}
          >
            <span className="category-icon">🏛️</span>
            All Markets
          </button>
          {categories.map(category => (
            <button
              key={category.id}
              className={`category-tab ${selectedCategory === category.id ? 'active' : ''}`}
              onClick={() => selectCategory(category.id)}
            >
              <span className="category-icon">{category.icon}</span>
              {category.name}
            </button>
          ))}
        </div>
      )}

      {/* Main Content */}
      <div className="container">
        <aside className="sidebar">
          <div className="widget disclaimer-widget">
            <div className="widget-icon">⚠️</div>
            <h3>Play Money Only</h3>
            <p>This is a prediction market using play money. No real money is involved.</p>
          </div>

          <div className="widget news-widget">
            <div className="widget-icon">📰</div>
            <h3>Recent Activity</h3>
            <div className="news-item">
              <div className="news-date">Today</div>
              <div className="news-title">{markets.length} active markets</div>
            </div>
            <div className="news-item">
              <div className="news-date">This Week</div>
              <div className="news-title">Join the prediction community!</div>
            </div>
          </div>
        </aside>

        <main className="main-content">
          {loading ? (
            <div className="empty-state">
              <div className="empty-state-icon">⏳</div>
              <h3>Loading...</h3>
            </div>
          ) : (
            <>
              {currentView === 'markets' && (
                <>
                  <h1>
                    {selectedCategory 
                      ? `${getCategoryIcon(selectedCategory)} ${getCategoryName(selectedCategory)} Markets`
                      : '🏛️ All Markets'
                    }
                  </h1>
                  
                  {filteredMarkets.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state-icon">📭</div>
                      <h3>No markets found</h3>
                      <p>
                        {selectedCategory 
                          ? 'No markets in this category yet.'
                          : 'Check back soon for new markets!'}
                      </p>
                    </div>
                  ) : (
                    <div className="markets-grid">
                      {filteredMarkets.map(market => (
                        <MarketCard 
                          key={market.id}
                          market={market}
                          user={user}
                          onBet={(market) => {
                            if (!user) {
                              setShowAuthModal(true);
                              return;
                            }
                            setSelectedMarket(market);
                            setShowBetModal(true);
                          }}
                          getCategoryIcon={getCategoryIcon}
                          getCategoryName={getCategoryName}
                          getCategoryColor={getCategoryColor}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}

              {currentView === 'categories' && (
                <>
                  <h1>📂 Browse by Category</h1>
                  <div className="categories-grid">
                    {categories.map(category => (
                      <div key={category.id} className="category-card">
                        <div className="category-icon-large">{category.icon}</div>
                        <h3>{category.name}</h3>
                        <div className="subcategories">
                          {category.subcategories?.slice(0, 5).map(sub => (
                            <span key={sub.id} className="subcategory-tag">
                              {sub.name}
                            </span>
                          ))}
                        </div>
                        <div className="category-card-actions">
                          <button 
                            className="btn btn-primary"
                            onClick={() => {
                              selectCategory(category.id);
                              setCurrentView('markets');
                            }}
                          >
                            View Markets
                          </button>
                          <button 
                            className="btn btn-share"
                            onClick={() => copyShareLink(category.id, category.name)}
                          >
                            🔗 Share
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {currentView === 'mybets' && user && (
                <MyBets user={user} />
              )}

              {currentView === 'leaderboard' && (
                <Leaderboard />
              )}

              {currentView === 'create' && user?.role === 'admin' && (
                <CreateMarket 
                  categories={categories}
                  onSuccess={() => {
                    setCurrentView('markets');
                    showToast('Market created successfully!');
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAuthModal(false)}>×</button>
            <h2>👋 Welcome to Binary Bets</h2>
            
            <div className="auth-tabs">
              <button 
                className={authMode === 'login' ? 'active' : ''}
                onClick={() => setAuthMode('login')}
              >
                Login
              </button>
              <button 
                className={authMode === 'register' ? 'active' : ''}
                onClick={() => setAuthMode('register')}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleAuth}>
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={authForm.username}
                  onChange={e => setAuthForm({...authForm, username: e.target.value})}
                  required
                  minLength={3}
                  maxLength={20}
                />
                {authMode === 'register' && (
                  <span className="form-hint">3-20 characters</span>
                )}
              </div>

              {authMode === 'register' && (
                <>
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      value={authForm.email}
                      onChange={e => setAuthForm({...authForm, email: e.target.value})}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Confirm Email</label>
                    <input
                      type="email"
                      value={authForm.confirmEmail}
                      onChange={e => setAuthForm({...authForm, confirmEmail: e.target.value})}
                      required
                    />
                    {authForm.email && authForm.confirmEmail && authForm.email !== authForm.confirmEmail && (
                      <span className="error-hint">Emails do not match</span>
                    )}
                  </div>
                </>
              )}

              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={authForm.password}
                  onChange={e => setAuthForm({...authForm, password: e.target.value})}
                  required
                  minLength={6}
                />
                {authMode === 'register' && (
                  <span className="form-hint">Minimum 6 characters</span>
                )}
              </div>

              {authMode === 'register' && (
                <div className="form-group">
                  <label>Confirm Password</label>
                  <input
                    type="password"
                    value={authForm.confirmPassword}
                    onChange={e => setAuthForm({...authForm, confirmPassword: e.target.value})}
                    required
                  />
                  {authForm.password && authForm.confirmPassword && authForm.password !== authForm.confirmPassword && (
                    <span className="error-hint">Passwords do not match</span>
                  )}
                </div>
              )}

              <button type="submit" className="btn btn-primary" style={{width: '100%'}}>
                {authMode === 'login' ? 'Login' : 'Create Account'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Bet Modal */}
      {showBetModal && selectedMarket && (
        <div className="modal-overlay" onClick={() => setShowBetModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowBetModal(false)}>×</button>
            <h2>Place Your Bet</h2>
            <p style={{marginBottom: '24px', color: '#6b7280'}}>{selectedMarket.question}</p>

            <form onSubmit={handleBet}>
              <div className="form-group">
                <label>Select Option</label>
                <div className="bet-options">
                  {selectedMarket.options?.map(option => (
                    <button
                      key={option.id}
                      type="button"
                      className={`option-btn ${betForm.selectedOption === option.id ? 'selected' : ''}`}
                      onClick={() => setBetForm({...betForm, selectedOption: option.id})}
                    >
                      <div>{option.name}</div>
                      <div style={{fontSize: '20px', fontWeight: 'bold', marginTop: '8px'}}>
                        {option.odds?.toFixed(2) || '1.00'}x
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Bet Amount</label>
                <input
                  type="number"
                  min="1"
                  max={user?.balance || 0}
                  step="0.01"
                  value={betForm.amount}
                  onChange={e => setBetForm({...betForm, amount: e.target.value})}
                  required
                />
                <span className="form-hint">
                  Available balance: ${parseFloat(user?.balance || 0).toFixed(2)}
                </span>
              </div>

              {betForm.selectedOption && betForm.amount && (
                <div style={{
                  background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                  padding: '16px',
                  borderRadius: '12px',
                  marginBottom: '20px'
                }}>
                  <div style={{fontWeight: 'bold', marginBottom: '8px'}}>Potential Payout:</div>
                  <div style={{fontSize: '24px', fontWeight: 'bold', color: '#667eea'}}>
                    ${(parseFloat(betForm.amount) * (selectedMarket.options?.find(o => o.id === betForm.selectedOption)?.odds || 1)).toFixed(2)}
                  </div>
                </div>
              )}

              <button type="submit" className="btn btn-primary" style={{width: '100%'}}>
                Place Bet
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          <div className="toast-content">{toast.message}</div>
          <button className="toast-close" onClick={() => setToast(null)}>×</button>
        </div>
      )}
    </div>
  );
}

// Market Card Component
function MarketCard({ market, user, onBet, getCategoryIcon, getCategoryName, getCategoryColor }) {
  const isActive = market.status === 'active';
  const isResolved = market.status === 'resolved';
  
  return (
    <div className="market-card">
      <div className="market-header">
        <span 
          className="category-badge" 
          style={{ background: getCategoryColor(market.category_id) }}
        >
          {getCategoryIcon(market.category_id)} {getCategoryName(market.category_id)}
        </span>
        <span className={`status-badge ${isActive ? 'active' : 'resolved'}`}>
          {isActive ? 'LIVE' : 'CLOSED'}
        </span>
      </div>

      <h3 className="market-question">{market.question}</h3>

      <div className="market-stats">
        <div className="stat">
          <div className="stat-label">Pool</div>
          <div className="stat-value">${parseFloat(market.total_pool || 0).toFixed(0)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Bets</div>
          <div className="stat-value">{market.bet_count || 0}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Closes</div>
          <div className="stat-value">
            {new Date(market.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        </div>
      </div>

      {isResolved ? (
        <div className="outcome-badge">
          Outcome: {market.outcome || 'Unresolved'}
        </div>
      ) : (
        <>
          {market.options && market.options.length > 0 && (
            <div className="betting-options">
              <div className="options-label">Current Odds</div>
              <div className="options-grid">
                {market.options.map(option => (
                  <div key={option.id} className="option-card">
                    <div className="option-name">{option.name}</div>
                    <div className="option-odds">{option.odds?.toFixed(2) || '1.00'}x</div>
                    <div className="option-label">
                      {option.bet_count > 0 ? `${option.bet_count} bets` : 'NO BETS YET'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button 
            className="btn btn-primary" 
            style={{width: '100%'}}
            onClick={() => onBet(market)}
            disabled={!isActive}
          >
            {isActive ? '🎲 Place Bet' : '🔒 Market Closed'}
          </button>
        </>
      )}
    </div>
  );
}

// My Bets Component
function MyBets({ user }) {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBets = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/bets/my`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) {
          const data = await res.json();
          setBets(data.bets || []);
        }
      } catch (error) {
        console.error('Error fetching bets:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBets();
  }, []);

  if (loading) {
    return <div className="empty-state"><div className="empty-state-icon">⏳</div><h3>Loading...</h3></div>;
  }

  if (bets.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📭</div>
        <h3>No bets yet</h3>
        <p>Place your first bet to get started!</p>
      </div>
    );
  }

  return (
    <>
      <h1>📊 My Bets</h1>
      <div className="bets-list">
        {bets.map(bet => (
          <div key={bet.id} className="bet-card">
            <div className="bet-header">
              <h3>{bet.market_question}</h3>
              <span className={`status-badge ${bet.market_status === 'active' ? 'active' : 'resolved'}`}>
                {bet.market_status === 'active' ? 'ACTIVE' : 'CLOSED'}
              </span>
            </div>
            <div className="bet-details">
              <div className="bet-info">
                <div className="info-label">Your Pick</div>
                <div className="info-value">{bet.option_name}</div>
              </div>
              <div className="bet-info">
                <div className="info-label">Amount</div>
                <div className="info-value">${parseFloat(bet.amount).toFixed(2)}</div>
              </div>
              <div className="bet-info">
                <div className="info-label">Potential Win</div>
                <div className="info-value">${parseFloat(bet.potential_payout).toFixed(2)}</div>
              </div>
              <div className="bet-info">
                <div className="info-label">Status</div>
                <div className="info-value">{bet.status}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// Leaderboard Component
function Leaderboard() {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/leaderboard`);
        if (res.ok) {
          const data = await res.json();
          setLeaders(data.leaderboard || []);
        }
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  if (loading) {
    return <div className="empty-state"><div className="empty-state-icon">⏳</div><h3>Loading...</h3></div>;
  }

  return (
    <>
      <h1>🏆 Leaderboard</h1>
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Balance</th>
            <th>Total Bets</th>
            <th>Win Rate</th>
          </tr>
        </thead>
        <tbody>
          {leaders.map((leader, index) => (
            <tr key={leader.id}>
              <td>{index + 1}</td>
              <td>{leader.username}</td>
              <td>${parseFloat(leader.balance).toFixed(2)}</td>
              <td>{leader.total_bets}</td>
              <td>{leader.win_rate ? `${(leader.win_rate * 100).toFixed(1)}%` : 'N/A'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

// Create Market Component  
function CreateMarket({ categories, onSuccess }) {
  const [form, setForm] = useState({
    question: '',
    category_id: '',
    deadline: '',
    options: ['', '']
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch(`${API_BASE}/api/markets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(form)
      });

      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create market');
      }
    } catch (error) {
      console.error('Error creating market:', error);
      alert('Network error');
    }
  };

  return (
    <>
      <h1>➕ Create New Market</h1>
      <form className="create-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Question</label>
          <textarea
            value={form.question}
            onChange={e => setForm({...form, question: e.target.value})}
            required
            rows={3}
            placeholder="Will Bitcoin reach $100,000 by end of 2025?"
          />
        </div>

        <div className="form-group">
          <label>Category</label>
          <select
            value={form.category_id}
            onChange={e => setForm({...form, category_id: e.target.value})}
            required
          >
            <option value="">Select category...</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Deadline</label>
          <input
            type="datetime-local"
            value={form.deadline}
            onChange={e => setForm({...form, deadline: e.target.value})}
            required
          />
        </div>

        <div className="form-group">
          <label>Options</label>
          <div className="options-inputs">
            {form.options.map((option, index) => (
              <input
                key={index}
                type="text"
                value={option}
                onChange={e => {
                  const newOptions = [...form.options];
                  newOptions[index] = e.target.value;
                  setForm({...form, options: newOptions});
                }}
                placeholder={`Option ${index + 1}`}
                required
              />
            ))}
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            style={{marginTop: '12px'}}
            onClick={() => setForm({...form, options: [...form.options, '']})}
          >
            + Add Option
          </button>
        </div>

        <button type="submit" className="btn btn-primary" style={{width: '100%'}}>
          Create Market
        </button>
      </form>
    </>
  );
}

export default App;
