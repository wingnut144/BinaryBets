import React, { useState, useEffect } from 'react';
import './App.css';
import CategoryManagement from './components/CategoryManagement';
import CreateMarket from './CreateMarket';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.binary-bets.com';

function App() {
  const [user, setUser] = useState(null);
  const [markets, setMarkets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [leaderboard, setLeaderboard] = useState([]);
  const [userBets, setUserBets] = useState([]);
  const [reportedBets, setReportedBets] = useState([]);
  const [activeTab, setActiveTab] = useState('bets');
  
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  
  const [selectedBet, setSelectedBet] = useState(null);
  const [betPosition, setBetPosition] = useState('');
  const [betAmount, setBetAmount] = useState('');

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    
    fetchMarkets();
    fetchCategories();
    fetchLeaderboard();
  }, []);

  useEffect(() => {
    if (user) {
      fetchUserBets();
      if (user.is_admin) {
        fetchReportedBets();
      }
    }
  }, [user]);

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/api/categories`);
      const data = await response.json();
      console.log('Categories loaded:', data.categories);
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchMarkets = async () => {
    try {
      const response = await fetch(`${API_URL}/api/markets?status=active`);
      const data = await response.json();
      setMarkets(data.markets || []);
    } catch (error) {
      console.error('Error fetching markets:', error);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`${API_URL}/api/leaderboard`);
      const data = await response.json();
      setLeaderboard(data.leaderboard || []);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    }
  };

  const fetchUserBets = async () => {
    try {
      const response = await fetch(`${API_URL}/api/bets`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setUserBets(data.bets || []);
    } catch (error) {
      console.error('Error fetching user bets:', error);
    }
  };

  const fetchReportedBets = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/reports`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setReportedBets(data.reports || []);
    } catch (error) {
      console.error('Error fetching reported bets:', error);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();

    if (authMode === 'register' && authForm.password !== authForm.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: authForm.username,
          email: authForm.email,
          password: authForm.password
        })
      });

      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('token', data.token);
        setShowAuthModal(false);
        setAuthForm({ username: '', email: '', password: '', confirmPassword: '' });
      } else {
        alert(data.error || 'Authentication failed');
      }
    } catch (error) {
      console.error('Auth error:', error);
      alert('Authentication failed: ' + error.message);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setActiveTab('bets');
  };

  const handlePlaceBet = async () => {
    if (!betAmount || parseFloat(betAmount) <= 0) {
      alert('Please enter a valid bet amount');
      return;
    }

    if (parseFloat(betAmount) > user.balance) {
      alert('Insufficient balance');
      return;
    }

    try {
      const selectedOption = selectedBet.options?.find(o => o.option_text.toLowerCase() === betPosition);
      
      if (!selectedOption) {
        alert('Please select an option');
        return;
      }

      const response = await fetch(`${API_URL}/api/bets`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          market_id: selectedBet.id,
          option_id: selectedOption.id,
          amount: parseFloat(betAmount)
        })
      });

      const data = await response.json();

      if (response.ok) {
        alert('Bet placed successfully!');
        setSelectedBet(null);
        setBetAmount('');
        setBetPosition('');
        
        if (data.newBalance !== undefined) {
          const updatedUser = { ...user, balance: data.newBalance };
          setUser(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }
        
        fetchMarkets();
        fetchUserBets();
      } else {
        alert(data.error || 'Failed to place bet');
      }
    } catch (error) {
      console.error('Error placing bet:', error);
      alert('Failed to place bet: ' + error.message);
    }
  };

  const handleReportBet = async (marketId) => {
    const reason = prompt('Please enter the reason for reporting this bet:');
    
    if (!reason) return;

    try {
      const response = await fetch(`${API_URL}/api/markets/${marketId}/report`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ reason })
      });

      if (response.ok) {
        alert('Bet reported successfully. Admins will review it.');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to report bet');
      }
    } catch (error) {
      console.error('Error reporting bet:', error);
      alert('Failed to report bet');
    }
  };

  const handleAdminDeleteBet = async (marketId) => {
    if (!window.confirm('Are you sure you want to delete this bet? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/markets/${marketId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        alert('Bet deleted successfully');
        fetchMarkets();
        if (user.is_admin) {
          fetchReportedBets();
        }
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete bet');
      }
    } catch (error) {
      console.error('Error deleting bet:', error);
      alert('Failed to delete bet');
    }
  };

  const handleResolveReport = async (reportId, action) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ action })
      });

      if (response.ok) {
        alert(`Report ${action === 'approve' ? 'approved and bet deleted' : 'dismissed'}`);
        fetchReportedBets();
        fetchMarkets();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to resolve report');
      }
    } catch (error) {
      console.error('Error resolving report:', error);
      alert('Failed to resolve report');
    }
  };

  const handleMarketCreated = (market) => {
    setActiveTab('bets');
    fetchMarkets();
  };

  const filteredMarkets = selectedCategory === 'all' 
    ? markets 
    : markets.filter(m => m.category_id === selectedCategory);

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1>🎯 Binary Bets</h1>
          
          {user ? (
            <div className="user-section">
              <span className="balance">💰 ${parseFloat(user.balance).toFixed(2)}</span>
              <button onClick={handleLogout} className="button-secondary">
                Logout ({user.username})
              </button>
            </div>
          ) : (
            <button onClick={() => setShowAuthModal(true)} className="button-primary">
              Login / Sign Up
            </button>
          )}
        </div>
      </header>

      <nav className="tabs">
        <button 
          className={activeTab === 'bets' ? 'active' : ''} 
          onClick={() => setActiveTab('bets')}
        >
          🎯 Bets
        </button>
        
        {user && (
          <>
            <button 
              className={activeTab === 'portfolio' ? 'active' : ''} 
              onClick={() => setActiveTab('portfolio')}
            >
              💼 My Portfolio
            </button>
            <button 
              className={activeTab === 'create' ? 'active' : ''} 
              onClick={() => setActiveTab('create')}
            >
              ➕ Create Bet
            </button>
          </>
        )}
        
        <button 
          className={activeTab === 'leaderboard' ? 'active' : ''} 
          onClick={() => setActiveTab('leaderboard')}
        >
          🏆 Leaderboard
        </button>

        {user?.is_admin && (
          <>
            <button 
              className={activeTab === 'admin' ? 'active admin-btn' : 'admin-btn'} 
              onClick={() => setActiveTab('admin')}
            >
              🛡️ Admin
            </button>
            <button 
              className={activeTab === 'categories' ? 'active admin-btn' : 'admin-btn'} 
              onClick={() => setActiveTab('categories')}
            >
              📁 Categories
            </button>
          </>
        )}
      </nav>

      <main className="main">
        {activeTab === 'bets' && (
          <div className="bets-section">
            <div className="categories-bar">
              <button
                className={selectedCategory === 'all' ? 'active' : ''}
                onClick={() => setSelectedCategory('all')}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  className={selectedCategory === cat.id ? 'active' : ''}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.icon} {cat.name}
                </button>
              ))}
            </div>

            <div className="markets-grid">
              {filteredMarkets.length === 0 ? (
                <div className="empty-state">
                  <p>No active bets at the moment. Be the first to create one!</p>
                </div>
              ) : (
                filteredMarkets.map(market => {
                  const isLive = new Date(market.deadline) > new Date();
                  
                  return (
                    <div key={market.id} className="market-card">
                      {/* Status Badge - Top Right */}
                      <div className={`market-status-badge ${isLive ? 'live' : 'closed'}`}>
                        {isLive ? '🟢 LIVE' : '🔴 CLOSED'}
                      </div>

                      {/* Header - Categories with Spacing */}
                      <div className="market-header">
                        <div className="market-categories">
                          {/* Category Badge */}
                          <span className="category-badge">
                            {categories.find(c => c.id === market.category_id)?.icon || '📌'}{' '}
                            {categories.find(c => c.id === market.category_id)?.name || 'Other'}
                          </span>
                          
                          {/* Subcategory Badge - Separate */}
                          {market.subcategory_name && (
                            <span className="subcategory-badge">
                              {market.subcategory_name}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Question */}
                      <h3>{market.question}</h3>
                      
                      {/* Stats - Better Spacing */}
                      <div className="market-stats">
                        <div className="stat">
                          <span className="stat-label">Total Pool</span>
                          <span className="stat-value">${parseFloat(market.total_bet_amount || 0).toFixed(2)}</span>
                        </div>
                        <div className="stat">
                          <span className="stat-label">Participants</span>
                          <span className="stat-value">{market.total_bets || 0}</span>
                        </div>
                      </div>

                      {/* Options */}
                      <div className="odds-display">
                        {market.options?.map(option => (
                          <div key={option.id} className="odds-option">
                            <span className="option-label">{option.option_text}</span>
                            <span className="odds-value">${parseFloat(option.total_amount || 0).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Close Date - Moved to Bottom */}
                      <div className="close-date">
                        Closes: {new Date(market.deadline).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </div>

                      {/* Actions */}
                      <div className="market-actions">
                        {user ? (
                          <>
                            <button 
                              className="button-primary" 
                              onClick={() => {
                                setSelectedBet(market);
                                setBetPosition('');
                                setBetAmount('');
                              }}
                              disabled={!isLive}
                            >
                              {isLive ? 'Place Bet' : 'Closed'}
                            </button>
                            <button 
                              className="btn-report" 
                              onClick={() => handleReportBet(market.id)}
                              title="Report this bet"
                            >
                              🚩
                            </button>
                          </>
                        ) : (
                          <button className="button-secondary" onClick={() => setShowAuthModal(true)}>
                            Login to Bet
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'portfolio' && user && (
          <div className="portfolio-section">
            <h2>My Bets</h2>
            
            {userBets.length === 0 ? (
              <div className="empty-state">
                <p>You haven't placed any bets yet. Check out the active bets!</p>
              </div>
            ) : (
              <div className="bets-list">
                {userBets.map(bet => (
                  <div key={bet.id} className="bet-card">
                    <h4>{bet.question}</h4>
                    <div className="bet-details">
                      <div className="bet-detail">
                        <span className="label">Position:</span>
                        <span className={`position ${bet.option_text?.toLowerCase()}`}>{bet.option_text}</span>
                      </div>
                      <div className="bet-detail">
                        <span className="label">Amount:</span>
                        <span className="value">${parseFloat(bet.amount).toFixed(2)}</span>
                      </div>
                      <div className="bet-detail">
                        <span className="label">Status:</span>
                        <span className={`status ${bet.market_status}`}>{bet.market_status}</span>
                      </div>
                      <div className="bet-detail">
                        <span className="label">Placed:</span>
                        <span className="value">{new Date(bet.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'create' && user && (
          <CreateMarket onMarketCreated={handleMarketCreated} />
        )}

        {activeTab === 'leaderboard' && (
          <div className="leaderboard-section">
            <h2>🏆 Top Players</h2>
            
            <div className="leaderboard">
              {leaderboard.map((player, index) => (
                <div key={player.id} className="leaderboard-item">
                  <span className="rank">#{index + 1}</span>
                  <span className="username">{player.username}</span>
                  <span className="balance">${parseFloat(player.balance).toFixed(2)}</span>
                  <span className="profit" style={{ 
                    color: player.balance >= 1000 ? '#10B981' : '#EF4444' 
                  }}>
                    {player.balance >= 1000 ? '+' : ''}{(player.balance - 1000).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'categories' && user?.is_admin && (
          <CategoryManagement />
        )}

        {activeTab === 'admin' && user?.is_admin && (
          <div className="admin-section">
            <h2>🛡️ Admin Panel</h2>
            
            <div className="admin-panel">
              <div className="admin-card">
                <h3>📋 Reported Bets</h3>
                
                {reportedBets.length === 0 ? (
                  <p className="empty-message">No reported bets at this time.</p>
                ) : (
                  <div className="reports-list">
                    {reportedBets.map(report => (
                      <div key={report.id} className="report-item">
                        <div className="report-header">
                          <h4>{report.question}</h4>
                          <span className="report-status">{report.status}</span>
                        </div>
                        <p className="report-reason"><strong>Reason:</strong> {report.reason}</p>
                        <p className="report-meta">
                          Reported by: {report.reporter_username} on {new Date(report.created_at).toLocaleDateString()}
                        </p>
                        
                        {report.status === 'pending' && (
                          <div className="report-actions">
                            <button 
                              className="button-primary" 
                              onClick={() => handleResolveReport(report.id, 'approve')}
                            >
                              ✅ Approve & Delete Bet
                            </button>
                            <button 
                              className="button-secondary" 
                              onClick={() => handleResolveReport(report.id, 'dismiss')}
                            >
                              ❌ Dismiss Report
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="admin-card">
                <h3>🗑️ Manage All Bets</h3>
                
                <div className="admin-bets-list">
                  {markets.map(market => (
                    <div key={market.id} className="admin-bet-item">
                      <div className="bet-info">
                        <h4>{market.question}</h4>
                        <p className="bet-meta">
                          Category: {categories.find(c => c.id === market.category_id)?.name || 'Unknown'} • 
                          Total bets: ${parseFloat(market.total_bet_amount || 0).toFixed(2)} • 
                          Closes: {new Date(market.deadline).toLocaleDateString()}
                        </p>
                      </div>
                      <button 
                        className="button-primary" 
                        onClick={() => handleAdminDeleteBet(market.id)}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {showAuthModal && (
        <div className="modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{authMode === 'login' ? 'Login' : 'Sign Up'}</h2>
            
            <form onSubmit={handleAuth}>
              <input
                type="text"
                placeholder="Username"
                value={authForm.username}
                onChange={(e) => setAuthForm({...authForm, username: e.target.value})}
                required
              />
              
              {authMode === 'register' && (
                <input
                  type="email"
                  placeholder="Email"
                  value={authForm.email}
                  onChange={(e) => setAuthForm({...authForm, email: e.target.value})}
                  required
                />
              )}
              
              <input
                type="password"
                placeholder="Password"
                value={authForm.password}
                onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
                required
              />

              {authMode === 'register' && (
                <div className="password-confirm-group">
                  <input
                    type="password"
                    placeholder="Confirm Password"
                    value={authForm.confirmPassword}
                    onChange={(e) => setAuthForm({...authForm, confirmPassword: e.target.value})}
                    className={authForm.confirmPassword && authForm.password !== authForm.confirmPassword ? 'error' : ''}
                    required
                  />
                  {authForm.confirmPassword && authForm.password !== authForm.confirmPassword && (
                    <span className="error-message">❌ Passwords do not match</span>
                  )}
                </div>
              )}
              
              <button type="submit" className="button-primary">
                {authMode === 'login' ? 'Login' : 'Sign Up'}
              </button>
            </form>
            
            <p className="auth-switch">
              {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
              <button 
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'register' : 'login');
                  setAuthForm({ username: '', email: '', password: '', confirmPassword: '' });
                }}
              >
                {authMode === 'login' ? 'Sign Up' : 'Login'}
              </button>
            </p>
          </div>
        </div>
      )}

      {selectedBet && (
        <div className="modal-overlay" onClick={() => setSelectedBet(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Place Bet</h2>
            <h3>{selectedBet.question}</h3>
            
            <div className="bet-form">
              <label>Choose Position:</label>
              <div className="position-buttons">
                {selectedBet.options?.map(option => (
                  <button
                    key={option.id}
                    className={betPosition === option.option_text.toLowerCase() ? 'active' : ''}
                    onClick={() => setBetPosition(option.option_text.toLowerCase())}
                  >
                    {option.option_text}
                  </button>
                ))}
              </div>

              {betPosition && (
                <>
                  <label>Bet Amount:</label>
                  <input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    placeholder="Enter amount"
                    min="1"
                    max={user.balance}
                    step="0.01"
                  />

                  {betAmount && parseFloat(betAmount) > 0 && (
                    <div className="bet-summary">
                      <p>You're betting: <strong>${parseFloat(betAmount).toFixed(2)}</strong></p>
                    </div>
                  )}

                  <button 
                    className="button-primary btn-large" 
                    onClick={handlePlaceBet}
                    disabled={!betAmount || parseFloat(betAmount) <= 0 || parseFloat(betAmount) > user.balance}
                  >
                    Confirm Bet
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
