import { useState, useEffect } from 'react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function App() {
  const [user, setUser] = useState(null);
  const [markets, setMarkets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [statusFilter, setStatusFilter] = useState('active');
  const [leaderboard, setLeaderboard] = useState([]);
  const [showAuth, setShowAuth] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [showCreateMarket, setShowCreateMarket] = useState(false);
  const [view, setView] = useState('markets');

  // Auth form state
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '', confirmPassword: '' });

  // Market creation form state
  const [marketForm, setMarketForm] = useState({
    title: '',
    description: '',
    category_id: '',
    subcategory_id: '',
    close_date: '',
    market_type: 'binary',
    options: ['', '']
  });

  // AI-generated odds state
  const [aiOdds, setAiOdds] = useState(null);
  const [generatingOdds, setGeneratingOdds] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchUser();
    }
    fetchCategories();
    fetchMarkets();
    fetchLeaderboard();
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      fetchSubcategories();
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchMarkets();
  }, [selectedCategory, selectedSubcategory, statusFilter]);

  const fetchUser = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/user`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/api/categories`);
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchSubcategories = async () => {
    try {
      if (selectedCategory === 'all') {
        setSubcategories([]);
        return;
      }
      const response = await fetch(`${API_URL}/api/subcategories?category_id=${selectedCategory}`);
      const data = await response.json();
      setSubcategories(data);
    } catch (error) {
      console.error('Error fetching subcategories:', error);
    }
  };

  const fetchMarkets = async () => {
    try {
      let url = `${API_URL}/api/markets?status=${statusFilter}`;
      if (selectedCategory !== 'all') {
        url += `&category_id=${selectedCategory}`;
      }
      if (selectedSubcategory) {
        url += `&subcategory_id=${selectedSubcategory}`;
      }
      const response = await fetch(url);
      const data = await response.json();
      setMarkets(data);
    } catch (error) {
      console.error('Error fetching markets:', error);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`${API_URL}/api/leaderboard`);
      const data = await response.json();
      setLeaderboard(data);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    
    // Check if passwords match on registration
    if (!isLogin && authForm.password !== authForm.confirmPassword) {
      alert('Passwords do not match!');
      return;
    }
    
    try {
      const endpoint = isLogin ? '/api/login' : '/api/register';
      const body = isLogin
        ? { email: authForm.email, password: authForm.password }
        : { username: authForm.username, email: authForm.email, password: authForm.password };

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        setUser(data.user);
        setShowAuth(false);
        setAuthForm({ username: '', email: '', password: '', confirmPassword: '' });
      } else {
        alert(data.error || 'Authentication failed');
      }
    } catch (error) {
      console.error('Auth error:', error);
      alert('Authentication failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  // Generate AI odds
  const handleGenerateOdds = async () => {
    if (!marketForm.title) {
      alert('Please enter a market title first');
      return;
    }

    setGeneratingOdds(true);
    setAiOdds(null);

    try {
      const token = localStorage.getItem('token');
      const requestBody = {
        title: marketForm.title,
        options: marketForm.market_type === 'multiple' ? marketForm.options.filter(o => o.trim()) : null
      };

      const response = await fetch(`${API_URL}/api/generate-odds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (response.ok) {
        setAiOdds(data);
      } else {
        alert(data.error || 'Failed to generate odds');
      }
    } catch (error) {
      console.error('Error generating odds:', error);
      alert('Failed to generate odds');
    } finally {
      setGeneratingOdds(false);
    }
  };

  const handleCreateMarket = async (e) => {
    e.preventDefault();

    if (!marketForm.title || !marketForm.category_id || !marketForm.close_date) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      
      // Prepare the request body with AI odds if available
      const requestBody = {
        ...marketForm,
        options: marketForm.market_type === 'multiple' ? marketForm.options.filter(o => o.trim()) : null
      };
      
      // Include AI odds if they were generated
      if (aiOdds && aiOdds.yes !== undefined) {
        requestBody.ai_yes_odds = aiOdds.yes;
        requestBody.ai_no_odds = aiOdds.no;
      }
      
      const response = await fetch(`${API_URL}/api/markets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (response.ok) {
        alert('Bet created successfully!');
        setShowCreateMarket(false);
        setMarketForm({
          title: '',
          description: '',
          category_id: '',
          subcategory_id: '',
          close_date: '',
          market_type: 'binary',
          options: ['', '']
        });
        setAiOdds(null);
        fetchMarkets();
      } else {
        alert(data.error || 'Failed to create market');
      }
    } catch (error) {
      console.error('Error creating market:', error);
      alert('Failed to create market');
    }
  };

  const handlePlaceBet = async (marketId, position) => {
    if (!user) {
      alert('Please login to place bets');
      return;
    }

    const amount = prompt(`Enter bet amount (Your balance: $${parseFloat(user.balance).toFixed(2)}):`);
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/bets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          market_id: marketId,
          position: position,
          amount: parseFloat(amount)
        })
      });

      const data = await response.json();

      if (response.ok) {
        alert(`Bet placed successfully! Your odds: ${data.bet.odds}x\nPotential payout: $${parseFloat(data.bet.potential_payout).toFixed(2)}`);
        fetchUser();
        fetchMarkets();
      } else {
        alert(data.error || 'Failed to place bet');
      }
    } catch (error) {
      console.error('Error placing bet:', error);
      alert('Failed to place bet');
    }
  };

  const handleReportMarket = async (marketId) => {
    const reason = prompt('Please enter the reason for reporting this bet:');
    if (!reason || reason.trim() === '') {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/markets/${marketId}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reason: reason.trim() })
      });

      const data = await response.json();

      if (response.ok) {
        alert('Report submitted successfully. An admin will review it.');
      } else {
        alert(data.error || 'Failed to submit report');
      }
    } catch (error) {
      console.error('Error reporting market:', error);
      alert('Failed to submit report');
    }
  };

  const handleAdminDelete = async (marketId) => {
    if (!confirm('Are you sure you want to delete this bet? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/admin/markets/${marketId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        alert('Bet deleted successfully');
        fetchMarkets();
      } else {
        alert(data.error || 'Failed to delete bet');
      }
    } catch (error) {
      console.error('Error deleting market:', error);
      alert('Failed to delete bet');
    }
  };

  const calculateDisplayOdds = (yesVolume, noVolume) => {
    const total = parseFloat(yesVolume) + parseFloat(noVolume);
    if (total === 0) return { yes: '2.00', no: '2.00' };
    
    const yesOdds = total / parseFloat(yesVolume);
    const noOdds = total / parseFloat(noVolume);
    
    return {
      yes: yesOdds.toFixed(2),
      no: noOdds.toFixed(2)
    };
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <h1>🎯 BinaryBets</h1>
          {user ? (
            <div className="user-info">
              <span className="balance">💰 ${parseFloat(user.balance).toFixed(2)}</span>
              <span className="username">👤 {user.username}</span>
              <button onClick={handleLogout} className="btn-secondary">Logout</button>
            </div>
          ) : (
            <button onClick={() => setShowAuth(true)} className="btn-primary">Login / Sign Up</button>
          )}
        </div>
      </header>

      {/* Navigation */}
      <nav className="nav-tabs">
        <button 
          className={view === 'markets' ? 'active' : ''} 
          onClick={() => setView('markets')}
        >
          📊 Bets
        </button>
        <button 
          className={view === 'leaderboard' ? 'active' : ''} 
          onClick={() => setView('leaderboard')}
        >
          🏆 Leaderboard
        </button>
        {user && (
          <button 
            className={view === 'my-bets' ? 'active' : ''} 
            onClick={() => setView('my-bets')}
          >
            📈 My Bets
          </button>
        )}
        {user && user.is_admin && (
          <button 
            className={view === 'admin' ? 'active' : ''} 
            onClick={() => setView('admin')}
          >
            🛡️ Admin
          </button>
        )}
      </nav>

      {/* Category Navigation */}
      {view === 'markets' && (
        <>
          <div className="category-nav">
            <button
              className={`category-btn ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => {
                setSelectedCategory('all');
                setSelectedSubcategory(null);
              }}
            >
              All Bets
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                className={`category-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setSelectedSubcategory(null);
                }}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>

          {/* Subcategory Navigation */}
          {subcategories.length > 0 && (
            <div className="subcategory-nav">
              <button
                className={`subcategory-btn ${!selectedSubcategory ? 'active' : ''}`}
                onClick={() => setSelectedSubcategory(null)}
              >
                All
              </button>
              {subcategories.map(sub => (
                <button
                  key={sub.id}
                  className={`subcategory-btn ${selectedSubcategory === sub.id ? 'active' : ''}`}
                  onClick={() => setSelectedSubcategory(sub.id)}
                >
                  {sub.name}
                </button>
              ))}
            </div>
          )}

          {/* Status Filter */}
          <div className="filter-bar">
            <div className="status-filters">
              <button
                className={`filter-btn ${statusFilter === 'active' ? 'active' : ''}`}
                onClick={() => setStatusFilter('active')}
              >
                Active
              </button>
              <button
                className={`filter-btn ${statusFilter === 'resolved' ? 'active' : ''}`}
                onClick={() => setStatusFilter('resolved')}
              >
                Completed
              </button>
            </div>
            {user && (
              <button onClick={() => setShowCreateMarket(true)} className="btn-primary">
                ➕ Create Bet
              </button>
            )}
          </div>
        </>
      )}

      {/* Main Content */}
      <main className="main-content">
        {view === 'markets' && (
          <div className="markets-grid">
            {markets.map(market => {
              const odds = calculateDisplayOdds(market.yes_odds, market.no_odds);
              const totalVolume = parseFloat(market.yes_odds || 0) + parseFloat(market.no_odds || 0);
              
              return (
                <div key={market.id} className="market-card">
                  <div className="market-header">
                    <h3>{market.question}</h3>
                    <span className={`status-badge ${market.resolved ? 'resolved' : 'active'}`}>
                      {market.resolved ? '🔵 Resolved' : '🟢 Active'}
                    </span>
                  </div>
                  
                  {market.description && (
                    <p className="market-description">{market.description}</p>
                  )}

                  <div className="market-meta">
                    <span className="category-badge">
                      {market.category_name}
                      {market.subcategory_name && ` · ${market.subcategory_name}`}
                    </span>
                    <span className="date-badge">
                      Closes: {new Date(market.deadline).toLocaleDateString()}
                    </span>
                  </div>

                  {!market.resolved && (
                    <div className="betting-section">
                      <div className="odds-display">
                        <div className="odds-item">
                          <span className="odds-label">YES</span>
                          <span className="odds-value">{odds.yes}x</span>
                          <span className="odds-percentage">
                            {totalVolume > 0 ? ((parseFloat(market.yes_odds) / totalVolume) * 100).toFixed(0) : 50}%
                          </span>
                        </div>
                        <div className="odds-divider">vs</div>
                        <div className="odds-item">
                          <span className="odds-label">NO</span>
                          <span className="odds-value">{odds.no}x</span>
                          <span className="odds-percentage">
                            {totalVolume > 0 ? ((parseFloat(market.no_odds) / totalVolume) * 100).toFixed(0) : 50}%
                          </span>
                        </div>
                      </div>

                      <div className="bet-buttons">
                        <button
                          className="btn-yes"
                          onClick={() => handlePlaceBet(market.id, 'yes')}
                          disabled={!user}
                        >
                          Bet YES
                        </button>
                        <button
                          className="btn-no"
                          onClick={() => handlePlaceBet(market.id, 'no')}
                          disabled={!user}
                        >
                          Bet NO
                        </button>
                      </div>
                    </div>
                  )}

                  {market.resolved && (
                    <div className="resolved-outcome">
                      <strong>Winner:</strong> {market.outcome?.toUpperCase() || 'N/A'}
                    </div>
                  )}

                  <div className="market-footer">
                    <span>💰 Total Volume: ${totalVolume.toFixed(2)}</span>
                    <span>📊 {market.bet_count} bets</span>
                  </div>

                  {/* Report and Admin Actions */}
                  <div className="market-actions" style={{ display: 'flex', gap: '10px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #eee' }}>
                    {user && (
                      <button
                        onClick={() => handleReportMarket(market.id)}
                        className="btn-report"
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          background: '#FEF3C7',
                          color: '#92400E',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        🚩 Report
                      </button>
                    )}
                    {user && user.is_admin && (
                      <button
                        onClick={() => handleAdminDelete(market.id)}
                        className="btn-admin-delete"
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          background: '#FEE2E2',
                          color: '#991B1B',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        🗑️ Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {view === 'leaderboard' && (
          <div className="leaderboard-container">
            <h2>🏆 Top Traders</h2>
            <div className="leaderboard-table">
              {leaderboard.map((player, index) => (
                <div key={player.id} className="leaderboard-row">
                  <span className="rank">#{index + 1}</span>
                  <span className="username">{player.username}</span>
                  <span className="balance">${parseFloat(player.balance).toFixed(2)}</span>
                  <span className="stats">
                    {player.total_bets} bets
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'admin' && user && user.is_admin && (
          <div className="admin-container">
            <h2>🛡️ Admin Panel - Reported Bets</h2>
            <div className="reports-list">
              <p style={{ color: '#666', fontStyle: 'italic' }}>
                Reports feature is ready. Create the database table with:
                <br />
                <code style={{ background: '#f5f5f5', padding: '10px', display: 'block', marginTop: '10px', borderRadius: '5px' }}>
                  CREATE TABLE market_reports (
                  <br />
                  &nbsp;&nbsp;id SERIAL PRIMARY KEY,
                  <br />
                  &nbsp;&nbsp;market_id INTEGER REFERENCES markets(id) ON DELETE CASCADE,
                  <br />
                  &nbsp;&nbsp;reported_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                  <br />
                  &nbsp;&nbsp;reason TEXT NOT NULL,
                  <br />
                  &nbsp;&nbsp;status VARCHAR(20) DEFAULT 'pending',
                  <br />
                  &nbsp;&nbsp;created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  <br />
                  &nbsp;&nbsp;resolved_at TIMESTAMP,
                  <br />
                  &nbsp;&nbsp;resolved_by INTEGER REFERENCES users(id)
                  <br />
                  );
                </code>
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Auth Modal */}
      {showAuth && (
        <div className="modal-overlay" onClick={() => setShowAuth(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{isLogin ? 'Login' : 'Sign Up'}</h2>
            <form onSubmit={handleAuth}>
              {!isLogin && (
                <input
                  type="text"
                  placeholder="Username"
                  value={authForm.username}
                  onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                  required={!isLogin}
                />
              )}
              <input
                type="email"
                placeholder="Email"
                value={authForm.email}
                onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                required
              />
              {!isLogin && (
                <>
                  <input
                    type="password"
                    placeholder="Confirm Password"
                    value={authForm.confirmPassword}
                    onChange={(e) => setAuthForm({ ...authForm, confirmPassword: e.target.value })}
                    required
                    style={{
                      borderColor: authForm.confirmPassword && authForm.password !== authForm.confirmPassword ? '#EF4444' : ''
                    }}
                  />
                  {authForm.confirmPassword && authForm.password !== authForm.confirmPassword && (
                    <span style={{ color: '#EF4444', fontSize: '12px', marginTop: '-10px' }}>
                      Passwords do not match
                    </span>
                  )}
                </>
              )}
              <button type="submit" className="btn-primary">{isLogin ? 'Login' : 'Sign Up'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setAuthForm({ username: '', email: '', password: '', confirmPassword: '' });
                }}
                className="btn-link"
              >
                {isLogin ? 'Need an account? Sign up' : 'Have an account? Login'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Create Bet Modal */}
      {showCreateMarket && (
        <div className="modal-overlay" onClick={() => setShowCreateMarket(false)}>
          <div className="modal large" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Bet</h2>
            <form onSubmit={handleCreateMarket}>
              <input
                type="text"
                placeholder="Bet Question"
                value={marketForm.title}
                onChange={(e) => setMarketForm({ ...marketForm, title: e.target.value })}
                required
              />

              <textarea
                placeholder="Description (optional)"
                value={marketForm.description}
                onChange={(e) => setMarketForm({ ...marketForm, description: e.target.value })}
                rows={3}
              />

              <div className="form-row">
                <select
                  value={marketForm.category_id}
                  onChange={(e) => setMarketForm({ ...marketForm, category_id: e.target.value })}
                  required
                >
                  <option value="">Select Category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>

                <select
                  value={marketForm.subcategory_id}
                  onChange={(e) => setMarketForm({ ...marketForm, subcategory_id: e.target.value })}
                >
                  <option value="">Select Subcategory (optional)</option>
                  {subcategories
                    .filter(sub => sub.category_id.toString() === marketForm.category_id.toString())
                    .map(sub => (
                      <option key={sub.id} value={sub.id}>{sub.name}</option>
                    ))}
                </select>
              </div>

              <input
                type="datetime-local"
                value={marketForm.close_date}
                onChange={(e) => setMarketForm({ ...marketForm, close_date: e.target.value })}
                required
              />

              <div className="market-type-selector">
                <label>
                  <input
                    type="radio"
                    value="binary"
                    checked={marketForm.market_type === 'binary'}
                    onChange={(e) => setMarketForm({ ...marketForm, market_type: e.target.value })}
                  />
                  Yes/No Bet
                </label>
                <label>
                  <input
                    type="radio"
                    value="multiple"
                    checked={marketForm.market_type === 'multiple'}
                    onChange={(e) => setMarketForm({ ...marketForm, market_type: e.target.value })}
                  />
                  Multiple Choice Bet
                </label>
              </div>

              {marketForm.market_type === 'multiple' && (
                <div className="options-section">
                  <h4>Options</h4>
                  {marketForm.options.map((option, index) => (
                    <input
                      key={index}
                      type="text"
                      placeholder={`Option ${index + 1}`}
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...marketForm.options];
                        newOptions[index] = e.target.value;
                        setMarketForm({ ...marketForm, options: newOptions });
                      }}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => setMarketForm({ ...marketForm, options: [...marketForm.options, ''] })}
                    className="btn-secondary"
                  >
                    + Add Option
                  </button>
                </div>
              )}

              {/* AI Odds Generation Section */}
              <div className="ai-odds-section">
                <button
                  type="button"
                  onClick={handleGenerateOdds}
                  disabled={generatingOdds || !marketForm.title}
                  className="btn-ai"
                >
                  {generatingOdds ? '🤖 Generating...' : '🤖 Generate AI Odds'}
                </button>

                {aiOdds && (
                  <div className="ai-odds-result">
                    <h4>AI-Generated Odds:</h4>
                    {aiOdds.yes !== undefined ? (
                      <div className="odds-preview">
                        <div className="odds-preview-item">
                          <span>YES:</span>
                          <strong>{aiOdds.yes}%</strong>
                        </div>
                        <div className="odds-preview-item">
                          <span>NO:</span>
                          <strong>{aiOdds.no}%</strong>
                        </div>
                      </div>
                    ) : (
                      <div className="odds-preview">
                        {aiOdds.odds?.map((opt, i) => (
                          <div key={i} className="odds-preview-item">
                            <span>{opt.option}:</span>
                            <strong>{opt.percentage}%</strong>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="ai-reasoning">{aiOdds.reasoning}</p>
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button type="submit" className="btn-primary">Create Bet</button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateMarket(false);
                    setAiOdds(null);
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
