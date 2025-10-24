import { useState, useEffect } from 'react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://64.23.152.157:5000';

function App() {
  const [user, setUser] = useState(null);
  const [markets, setMarkets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [userBets, setUserBets] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [statusFilter, setStatusFilter] = useState('active');
  const [showAuth, setShowAuth] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Initialize
  useEffect(() => {
    checkAuth();
    fetchCategories();
    fetchMarkets();
    fetchLeaderboard();
  }, []);

  // Fetch subcategories when category changes
  useEffect(() => {
    if (selectedCategory) {
      fetchSubcategories(selectedCategory);
    } else {
      setSubcategories([]);
      setSelectedSubcategory(null);
    }
  }, [selectedCategory]);

  // Refetch markets when filters change
  useEffect(() => {
    fetchMarkets();
  }, [selectedCategory, selectedSubcategory, statusFilter]);

  // Check authentication
  const checkAuth = () => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchUser(token);
    } else {
      setLoading(false);
    }
  };

  // Fetch current user
  const fetchUser = async (token) => {
    try {
      const response = await fetch(`${API_URL}/api/user`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        fetchUserBets(token);
      } else {
        localStorage.removeItem('token');
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch categories
  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/api/categories`);
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  // Fetch subcategories
  const fetchSubcategories = async (categoryId) => {
    try {
      const response = await fetch(`${API_URL}/api/subcategories?category_id=${categoryId}`);
      const data = await response.json();
      setSubcategories(data);
    } catch (error) {
      console.error('Error fetching subcategories:', error);
    }
  };

  // Fetch markets
  const fetchMarkets = async () => {
    try {
      let url = `${API_URL}/api/markets?status=${statusFilter}`;
      if (selectedCategory) url += `&category_id=${selectedCategory}`;
      if (selectedSubcategory) url += `&subcategory_id=${selectedSubcategory}`;
      
      const response = await fetch(url);
      const data = await response.json();
      setMarkets(data);
    } catch (error) {
      console.error('Error fetching markets:', error);
    }
  };

  // Fetch leaderboard
  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`${API_URL}/api/leaderboard`);
      const data = await response.json();
      setLeaderboard(data);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    }
  };

  // Fetch user bets
  const fetchUserBets = async (token) => {
    try {
      const response = await fetch(`${API_URL}/api/bets/user`, {
        headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setUserBets(data);
    } catch (error) {
      console.error('Error fetching user bets:', error);
    }
  };

  // Handle authentication
  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const endpoint = isLogin ? '/api/login' : '/api/register';
      const body = isLogin 
        ? { username: authForm.username, password: authForm.password }
        : authForm;

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Authentication failed');
        return;
      }

      localStorage.setItem('token', data.token);
      setUser(data.user);
      setShowAuth(false);
      setAuthForm({ username: '', email: '', password: '' });
      fetchUserBets(data.token);
    } catch (error) {
      setError('Server error. Please try again.');
    }
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setUserBets([]);
  };

  // Place bet
  const placeBet = async (marketId, position, shares) => {
    if (!user) {
      alert('Please login to place bets');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/bets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ market_id: marketId, position, shares })
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || 'Failed to place bet');
        return;
      }

      // Refresh data
      fetchUser(localStorage.getItem('token'));
      fetchMarkets();
      alert('Bet placed successfully!');
    } catch (error) {
      alert('Error placing bet');
    }
  };

  // Calculate probability
  const calculateProbability = (market, position) => {
    const total = market.yes_shares + market.no_shares;
    if (total === 0) return 50;
    const shares = position === 'yes' ? market.yes_shares : market.no_shares;
    return Math.round((shares / total) * 100);
  };

  // Handle category click
  const handleCategoryClick = (categoryId) => {
    if (selectedCategory === categoryId) {
      setSelectedCategory(null);
      setSelectedSubcategory(null);
    } else {
      setSelectedCategory(categoryId);
      setSelectedSubcategory(null);
    }
  };

  // Handle subcategory click
  const handleSubcategoryClick = (subcategoryId) => {
    if (selectedSubcategory === subcategoryId) {
      setSelectedSubcategory(null);
    } else {
      setSelectedSubcategory(subcategoryId);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="App">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <h1 className="logo">🎲 BinaryBets</h1>
          <div className="header-right">
            {user ? (
              <>
                <div className="user-info">
                  <span className="username">{user.username}</span>
                  <span className="balance">${user.balance.toFixed(2)}</span>
                </div>
                <button onClick={handleLogout} className="btn btn-secondary">Logout</button>
              </>
            ) : (
              <button onClick={() => setShowAuth(true)} className="btn btn-primary">Login / Sign Up</button>
            )}
          </div>
        </div>
      </header>

      {/* Category Navigation */}
      <div className="category-nav">
        <button
          className={`category-btn ${!selectedCategory ? 'active' : ''}`}
          onClick={() => handleCategoryClick(null)}
        >
          All Markets
        </button>
        {categories.map(category => (
          <button
            key={category.id}
            className={`category-btn ${selectedCategory === category.id ? 'active' : ''}`}
            style={selectedCategory === category.id ? { backgroundColor: category.color } : {}}
            onClick={() => handleCategoryClick(category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Subcategory Navigation */}
      {selectedCategory && subcategories.length > 0 && (
        <div className="subcategory-nav">
          <button
            className={`subcategory-btn ${!selectedSubcategory ? 'active' : ''}`}
            onClick={() => setSelectedSubcategory(null)}
          >
            All {categories.find(c => c.id === selectedCategory)?.name}
          </button>
          {subcategories.map(sub => (
            <button
              key={sub.id}
              className={`subcategory-btn ${selectedSubcategory === sub.id ? 'active' : ''}`}
              onClick={() => handleSubcategoryClick(sub.id)}
            >
              {sub.name}
            </button>
          ))}
        </div>
      )}

      {/* Status Filter */}
      <div className="status-filter">
        <button
          className={`filter-btn ${statusFilter === 'active' ? 'active' : ''}`}
          onClick={() => setStatusFilter('active')}
        >
          Active Markets
        </button>
        <button
          className={`filter-btn ${statusFilter === 'resolved' ? 'active' : ''}`}
          onClick={() => setStatusFilter('resolved')}
        >
          Completed Markets
        </button>
      </div>

      {/* Main Content */}
      <div className="container">
        <div className="main-content">
          {/* Markets Section */}
          <section className="section">
            <h2>
              {selectedSubcategory 
                ? subcategories.find(s => s.id === selectedSubcategory)?.name + ' Markets'
                : selectedCategory
                ? categories.find(c => c.id === selectedCategory)?.name + ' Markets'
                : 'All Markets'}
            </h2>
            <div className="markets-grid">
              {markets.length === 0 ? (
                <p className="no-data">No markets found</p>
              ) : (
                markets.map(market => (
                  <div key={market.id} className="market-card">
                    <div className="market-header">
                      <span className="market-category" style={{ color: market.category_color }}>
                        {market.category_name}
                        {market.subcategory_name && ` • ${market.subcategory_name}`}
                      </span>
                      <span className={`market-status status-${market.status}`}>
                        {market.status}
                      </span>
                    </div>
                    
                    <h3 className="market-question">{market.question}</h3>
                    
                    {market.description && (
                      <p className="market-description">{market.description}</p>
                    )}

                    {market.status === 'resolved' ? (
                      <div className="market-result">
                        <strong>Result:</strong> {market.winning_outcome.toUpperCase()}
                      </div>
                    ) : (
                      <>
                        <div className="market-probabilities">
                          <div className="probability">
                            <span className="prob-label">YES</span>
                            <span className="prob-value">
                              {calculateProbability(market, 'yes')}%
                            </span>
                          </div>
                          <div className="probability">
                            <span className="prob-label">NO</span>
                            <span className="prob-value">
                              {calculateProbability(market, 'no')}%
                            </span>
                          </div>
                        </div>

                        <div className="market-actions">
                          <button
                            className="btn btn-yes"
                            onClick={() => {
                              const shares = prompt('How many shares to bet on YES?');
                              if (shares) placeBet(market.id, 'yes', parseFloat(shares));
                            }}
                          >
                            Bet YES
                          </button>
                          <button
                            className="btn btn-no"
                            onClick={() => {
                              const shares = prompt('How many shares to bet on NO?');
                              if (shares) placeBet(market.id, 'no', parseFloat(shares));
                            }}
                          >
                            Bet NO
                          </button>
                        </div>
                      </>
                    )}

                    <div className="market-footer">
                      <span>Volume: ${(market.yes_shares + market.no_shares).toFixed(2)}</span>
                      <span>Closes: {new Date(market.close_date).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* User Bets Section */}
          {user && userBets.length > 0 && (
            <section className="section">
              <h2>My Bets</h2>
              <div className="bets-table">
                <table>
                  <thead>
                    <tr>
                      <th>Market</th>
                      <th>Position</th>
                      <th>Shares</th>
                      <th>Status</th>
                      <th>Payout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userBets.map(bet => (
                      <tr key={bet.id}>
                        <td>{bet.question}</td>
                        <td>
                          <span className={`position-badge position-${bet.position}`}>
                            {bet.position.toUpperCase()}
                          </span>
                        </td>
                        <td>${bet.shares.toFixed(2)}</td>
                        <td>
                          <span className={`status-badge status-${bet.status}`}>
                            {bet.status}
                          </span>
                        </td>
                        <td>${bet.payout ? bet.payout.toFixed(2) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <aside className="sidebar">
          {/* Leaderboard */}
          <div className="widget">
            <h3>🏆 Leaderboard</h3>
            <div className="leaderboard">
              {leaderboard.slice(0, 10).map((player, index) => (
                <div key={player.id} className="leaderboard-item">
                  <span className="rank">{index + 1}</span>
                  <span className="player-name">{player.username}</span>
                  <span className="player-balance">${player.balance.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="widget">
            <h3>📊 Stats</h3>
            <div className="stats">
              <div className="stat">
                <span className="stat-label">Total Markets</span>
                <span className="stat-value">{markets.length}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Active</span>
                <span className="stat-value">
                  {markets.filter(m => m.status === 'active').length}
                </span>
              </div>
              <div className="stat">
                <span className="stat-label">Total Users</span>
                <span className="stat-value">{leaderboard.length}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Auth Modal */}
      {showAuth && (
        <div className="modal-overlay" onClick={() => setShowAuth(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{isLogin ? 'Login' : 'Sign Up'}</h2>
              <button className="modal-close" onClick={() => setShowAuth(false)}>×</button>
            </div>
            
            <form onSubmit={handleAuth}>
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={authForm.username}
                  onChange={e => setAuthForm({ ...authForm, username: e.target.value })}
                  required
                />
              </div>

              {!isLogin && (
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={authForm.email}
                    onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={authForm.password}
                  onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                  required
                />
              </div>

              {error && <div className="error-message">{error}</div>}

              <button type="submit" className="btn btn-primary btn-full">
                {isLogin ? 'Login' : 'Sign Up'}
              </button>
            </form>

            <div className="auth-switch">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }} className="link-button">
                {isLogin ? 'Sign up' : 'Login'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
