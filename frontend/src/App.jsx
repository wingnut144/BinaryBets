import { useState, useEffect } from 'react';
import './App.css';

const API_URL = 'https://api.binary-bets.com';

function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('bets');
  const [markets, setMarkets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [leaderboard, setLeaderboard] = useState([]);
  const [userBets, setUserBets] = useState([]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedBet, setSelectedBet] = useState(null);
  const [betAmount, setBetAmount] = useState('');
  const [betPosition, setBetPosition] = useState('');
  const [reportedBets, setReportedBets] = useState([]);
  
  const [authForm, setAuthForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const [formData, setFormData] = useState({
    question: '',
    category_id: 1,
    close_date: '',
    bet_type: 'binary',
    options: ['Yes', 'No'],
    ai_odds: null
  });

  const [generatingOdds, setGeneratingOdds] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }
    
    fetchCategories();
    fetchMarkets();
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
      // FIX: API returns {categories: [...]}
      setCategories(data.categories || []);
      console.log('Categories loaded:', data.categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories([]);
    }
  };

  const fetchMarkets = async () => {
    try {
      const response = await fetch(`${API_URL}/api/markets?status=active`);
      const data = await response.json();
      setMarkets(data.markets || []);
    } catch (error) {
      console.error('Error fetching bets:', error);
      setMarkets([]);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`${API_URL}/api/leaderboard`);
      const data = await response.json();
      setLeaderboard(data.leaderboard || []);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      setLeaderboard([]);
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
      setUserBets([]);
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
      setReportedBets([]);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    
    // Password confirmation check for registration
    if (authMode === 'register' && authForm.password !== authForm.confirmPassword) {
      alert('Passwords do not match!');
      return;
    }

    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: authForm.username,
          email: authForm.email,
          password: authForm.password,
          password_confirm: authForm.confirmPassword
        })
      });

      const data = await response.json();

      if (response.ok) {
        if (authMode === 'register') {
          alert(data.message || 'Account created! Please check your email to verify your account.');
          setAuthMode('login');
          setAuthForm({ username: '', email: '', password: '', confirmPassword: '' });
        } else {
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          setUser(data.user);
          setShowAuthModal(false);
          setAuthForm({ username: '', email: '', password: '', confirmPassword: '' });
        }
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
    localStorage.removeItem('user');
    setUser(null);
    setActiveTab('bets');
  };

  const handleGenerateOdds = async () => {
    if (!formData.question) {
      alert('Please enter a question first');
      return;
    }

    setGeneratingOdds(true);
    try {
      const response = await fetch(`${API_URL}/api/generate-odds`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          question: formData.question,
          options: formData.options
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setFormData({ ...formData, ai_odds: data });
      } else {
        alert('Failed to generate odds: ' + data.error);
      }
    } catch (error) {
      console.error('Error generating odds:', error);
      alert('Failed to generate odds');
    } finally {
      setGeneratingOdds(false);
    }
  };

  const handleCreateBet = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch(`${API_URL}/api/markets`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          question: formData.question,
          category_id: formData.category_id,
          close_date: formData.close_date,
          market_type: formData.bet_type,
          options: formData.bet_type === 'multiple' ? formData.options : undefined,
          ai_odds: formData.ai_odds
        })
      });

      if (response.ok) {
        setShowCreateModal(false);
        setFormData({
          question: '',
          category_id: 1,
          close_date: '',
          bet_type: 'binary',
          options: ['Yes', 'No'],
          ai_odds: null
        });
        fetchMarkets();
        alert('Bet created successfully!');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to create bet');
      }
    } catch (error) {
      console.error('Error creating bet:', error);
      alert('Failed to create bet');
    }
  };

  const handlePlaceBet = async () => {
    if (!betAmount || parseFloat(betAmount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      const amount = parseFloat(betAmount);
      const odds = selectedBet.current_odds?.[betPosition] || 2.0;
      const potential_payout = amount * odds;

      const response = await fetch(`${API_URL}/api/bets`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          market_id: selectedBet.id,
          prediction: betPosition,
          amount: amount,
          odds: odds,
          potential_payout: potential_payout
        })
      });

      const data = await response.json();

      if (response.ok) {
        alert('Bet placed successfully!');
        setSelectedBet(null);
        setBetAmount('');
        setBetPosition('');
        
        // Update user balance
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

  // NEW: Handle option changes for multiple choice bets
  const handleOptionChange = (index, value) => {
    const newOptions = [...formData.options];
    newOptions[index] = value;
    setFormData({ ...formData, options: newOptions });
  };

  // NEW: Add option row
  const handleAddOption = () => {
    if (formData.options.length < 10) {
      setFormData({ ...formData, options: [...formData.options, ''] });
    } else {
      alert('Maximum 10 options allowed');
    }
  };

  // NEW: Remove option row
  const handleRemoveOption = (index) => {
    if (formData.options.length > 2) {
      const newOptions = formData.options.filter((_, i) => i !== index);
      setFormData({ ...formData, options: newOptions });
    } else {
      alert('Minimum 2 options required');
    }
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
              <button onClick={handleLogout} className="btn-secondary">
                Logout ({user.username})
              </button>
            </div>
          ) : (
            <button onClick={() => setShowAuthModal(true)} className="btn-primary">
              Login / Sign Up
            </button>
          )}
        </div>
      </header>

      <nav className="nav">
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
          <button 
            className={activeTab === 'admin' ? 'active admin-btn' : 'admin-btn'} 
            onClick={() => setActiveTab('admin')}
          >
            🛡️ Admin
          </button>
        )}
      </nav>

      <main className="main">
        {activeTab === 'bets' && (
          <div className="bets-section">
            <div className="category-filters">
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
                  style={{ backgroundColor: selectedCategory === cat.id ? cat.color : 'transparent' }}
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
                filteredMarkets.map(market => (
                  <div key={market.id} className="market-card">
                    <div className="market-header">
                      <span className="category-badge" style={{ 
                        backgroundColor: categories.find(c => c.id === market.category_id)?.color || '#6B7280' 
                      }}>
                        {categories.find(c => c.id === market.category_id)?.icon || '📌'} {categories.find(c => c.id === market.category_id)?.name || 'Other'}
                      </span>
                      <span className="close-date">
                        Closes: {new Date(market.deadline).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: '2-digit', 
                          day: '2-digit' 
                        })}
                      </span>
                    </div>
                    
                    <h3>{market.question}</h3>
                    
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

                    <div className="odds-display">
                      {market.market_type === 'binary' ? (
                        <>
                          <div className="odds-option">
                            <span className="option-label">YES</span>
                            <span className="odds-value">{(market.yes_odds || 2.0).toFixed(2)}x</span>
                          </div>
                          <div className="odds-option">
                            <span className="option-label">NO</span>
                            <span className="odds-value">{(market.no_odds || 2.0).toFixed(2)}x</span>
                          </div>
                        </>
                      ) : (
                        market.options?.map(option => (
                          <div key={option.id} className="odds-option">
                            <span className="option-label">{option.option_text}</span>
                            <span className="odds-value">{(option.odds || 2.0).toFixed(2)}x</span>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="market-actions">
                      {user ? (
                        <>
                          <button 
                            className="btn-primary" 
                            onClick={() => {
                              setSelectedBet(market);
                              setBetPosition('');
                              setBetAmount('');
                            }}
                          >
                            Place Bet
                          </button>
                          <button 
                            className="btn-report" 
                            onClick={() => handleReportBet(market.id)}
                            title="Report this bet"
                          >
                            🚩 Report
                          </button>
                        </>
                      ) : (
                        <button className="btn-secondary" onClick={() => setShowAuthModal(true)}>
                          Login to Bet
                        </button>
                      )}
                    </div>
                  </div>
                ))
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
                    <h4>{bet.market_question}</h4>
                    <div className="bet-details">
                      <div className="bet-detail">
                        <span className="label">Position:</span>
                        <span className={`position ${bet.prediction?.toLowerCase()}`}>{bet.prediction}</span>
                      </div>
                      <div className="bet-detail">
                        <span className="label">Amount:</span>
                        <span className="value">${parseFloat(bet.amount).toFixed(2)}</span>
                      </div>
                      <div className="bet-detail">
                        <span className="label">Odds:</span>
                        <span className="value">{parseFloat(bet.odds || 2.0).toFixed(2)}x</span>
                      </div>
                      <div className="bet-detail">
                        <span className="label">Potential Win:</span>
                        <span className="value win">${parseFloat(bet.potential_payout || bet.amount * 2).toFixed(2)}</span>
                      </div>
                      <div className="bet-detail">
                        <span className="label">Status:</span>
                        <span className={`status ${bet.status}`}>{bet.status}</span>
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
          <div className="create-section">
            <h2>Create New Bet</h2>
            
            <form onSubmit={handleCreateBet} className="create-form">
              <div className="form-group">
                <label>Question</label>
                <input
                  type="text"
                  value={formData.question}
                  onChange={(e) => setFormData({...formData, question: e.target.value})}
                  placeholder="Will Bitcoin reach $100k by end of 2025?"
                  required
                />
              </div>

              <div className="form-group">
                <label>Category</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({...formData, category_id: parseInt(e.target.value)})}
                  required
                >
                  {categories.length === 0 ? (
                    <option value="">Loading categories...</option>
                  ) : (
                    categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="form-group">
                <label>Close Date</label>
                <input
                  type="date"
                  value={formData.close_date ? formData.close_date.split('T')[0] : ''}
                  onChange={(e) => setFormData({...formData, close_date: e.target.value})}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>

              <div className="form-group">
                <label>Bet Type</label>
                <select
                  value={formData.bet_type}
                  onChange={(e) => {
                    const newType = e.target.value;
                    setFormData({
                      ...formData, 
                      bet_type: newType,
                      options: newType === 'binary' ? ['Yes', 'No'] : ['', '', '']
                    });
                  }}
                >
                  <option value="binary">Yes/No</option>
                  <option value="multiple">Multiple Choice</option>
                </select>
              </div>

              {formData.bet_type === 'multiple' && (
                <div className="form-group">
                  <label>Options (2-10 options)</label>
                  <div className="options-list">
                    {formData.options.map((option, index) => (
                      <div key={index} className="option-row">
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => handleOptionChange(index, e.target.value)}
                          placeholder={`Option ${index + 1}`}
                          required
                        />
                        {formData.options.length > 2 && (
                          <button
                            type="button"
                            className="btn-remove"
                            onClick={() => handleRemoveOption(index)}
                            title="Remove option"
                          >
                            ❌
                          </button>
                        )}
                      </div>
                    ))}
                    {formData.options.length < 10 && (
                      <button
                        type="button"
                        className="btn-add-option"
                        onClick={handleAddOption}
                      >
                        ➕ Add Option
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="ai-odds-section">
                <button 
                  type="button" 
                  className="btn-ai" 
                  onClick={handleGenerateOdds}
                  disabled={generatingOdds || !formData.question}
                >
                  {generatingOdds ? '⏳ Generating...' : '🤖 Generate AI Odds'}
                </button>

                {formData.ai_odds && (
                  <div className="ai-odds-preview">
                    <h4>AI-Generated Odds:</h4>
                    <div className="odds-grid">
                      {Object.entries(formData.ai_odds.odds || {}).map(([key, value]) => (
                        <div key={key} className="odds-item">
                          <span className="odds-label">{key.toUpperCase()}</span>
                          <span className="odds-percentage">{value}%</span>
                        </div>
                      ))}
                    </div>
                    {formData.ai_odds.reasoning && (
                      <p className="odds-reasoning">{formData.ai_odds.reasoning}</p>
                    )}
                  </div>
                )}
              </div>

              <button type="submit" className="btn-primary btn-large">
                Create Bet
              </button>
            </form>
          </div>
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
                    color: player.balance >= 10000 ? '#10B981' : '#EF4444' 
                  }}>
                    {player.balance >= 10000 ? '+' : ''}{(player.balance - 10000).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
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
                              className="btn-danger" 
                              onClick={() => handleResolveReport(report.id, 'approve')}
                            >
                              ✅ Approve & Delete Bet
                            </button>
                            <button 
                              className="btn-secondary" 
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
                        className="btn-danger" 
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

      {/* Auth Modal */}
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
              
              <button type="submit" className="btn-primary">
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

      {/* Place Bet Modal */}
      {selectedBet && (
        <div className="modal-overlay" onClick={() => setSelectedBet(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Place Bet</h2>
            <h3>{selectedBet.question}</h3>
            
            <div className="bet-form">
              <label>Choose Position:</label>
              <div className="position-buttons">
                {selectedBet.market_type === 'binary' ? (
                  <>
                    <button
                      className={betPosition === 'yes' ? 'active yes' : 'yes'}
                      onClick={() => setBetPosition('yes')}
                    >
                      YES ({(selectedBet.yes_odds || 2.0).toFixed(2)}x)
                    </button>
                    <button
                      className={betPosition === 'no' ? 'active no' : 'no'}
                      onClick={() => setBetPosition('no')}
                    >
                      NO ({(selectedBet.no_odds || 2.0).toFixed(2)}x)
                    </button>
                  </>
                ) : (
                  selectedBet.options?.map(option => (
                    <button
                      key={option.id}
                      className={betPosition === option.option_text.toLowerCase() ? 'active' : ''}
                      onClick={() => setBetPosition(option.option_text.toLowerCase())}
                    >
                      {option.option_text} ({(option.odds || 2.0).toFixed(2)}x)
                    </button>
                  ))
                )}
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
                      <p>Potential win: <strong className="win">
                        ${(parseFloat(betAmount) * (selectedBet.market_type === 'binary' 
                          ? (betPosition === 'yes' ? selectedBet.yes_odds : selectedBet.no_odds)
                          : selectedBet.options?.find(o => o.option_text.toLowerCase() === betPosition)?.odds || 2.0
                        )).toFixed(2)}
                      </strong></p>
                    </div>
                  )}

                  <button 
                    className="btn-primary btn-large" 
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
