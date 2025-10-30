import { useState, useEffect } from 'react';
import './App.css';

const API_URL = 'https://api.binary-bets.com/api';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [activeTab, setActiveTab] = useState('markets');
  const [markets, setMarkets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [userBets, setUserBets] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [widgets, setWidgets] = useState([]);
  const [showBetModal, setShowBetModal] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [betAmount, setBetAmount] = useState('');
  const [betPosition, setBetPosition] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateMarket, setShowCreateMarket] = useState(false);
  const [newMarket, setNewMarket] = useState({
    question: '',
    category_id: '',
    subcategory_id: '',
    closes_at: '',
    description: ''
  });
  const [newsItems, setNewsItems] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);

  // Fetch user data
  useEffect(() => {
    if (token) {
      fetchUser();
    }
  }, [token]);

  // Fetch markets
  useEffect(() => {
    fetchMarkets();
    fetchCategories();
    fetchWidgets();
    fetchNews();
  }, []);

  // Fetch user bets
  useEffect(() => {
    if (user && activeTab === 'my-bets') {
      fetchUserBets();
    }
  }, [user, activeTab]);

  // Fetch leaderboard
  useEffect(() => {
    if (activeTab === 'leaderboard') {
      fetchLeaderboard();
    }
  }, [activeTab]);

  const fetchUser = async () => {
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
        setToken(null);
        setUser(null);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const fetchMarkets = async () => {
    try {
      const response = await fetch(`${API_URL}/markets`);
      const data = await response.json();
      console.log('📊 Markets received:', data.markets?.length || 0, 'markets');
      console.log('📋 Markets data:', data.markets);
      setMarkets(data.markets || []);
    } catch (error) {
      console.error('❌ Error fetching markets:', error);
      setMarkets([]);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/categories`);
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories([]);
    }
  };

  const fetchUserBets = async () => {
    try {
      const response = await fetch(`${API_URL}/bets`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setUserBets(data.bets || []);
    } catch (error) {
      console.error('Error fetching user bets:', error);
      setUserBets([]);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`${API_URL}/leaderboard`);
      const data = await response.json();
      setLeaderboard(data.leaderboard || []);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      setLeaderboard([]);
    }
  };

  const fetchWidgets = async () => {
    try {
      const response = await fetch(`${API_URL}/widgets`);
      const data = await response.json();
      setWidgets(data.widgets || []);
    } catch (error) {
      console.error('Error fetching widgets:', error);
      setWidgets([]);
    }
  };

  const fetchNews = async () => {
    setNewsLoading(true);
    try {
      // Simulate news fetching - replace with real news API if needed
      await new Promise(resolve => setTimeout(resolve, 1000));
      setNewsItems([
        {
          id: 1,
          category: 'Politics',
          title: 'Election predictions heating up',
          source: 'News Source'
        },
        {
          id: 2,
          category: 'Sports',
          title: 'Major upset in championship predictions',
          source: 'Sports News'
        },
        {
          id: 3,
          category: 'Technology',
          title: 'AI predictions market booming',
          source: 'Tech Daily'
        }
      ]);
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setNewsLoading(false);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
        setShowAuthModal(false);
        setAuthForm({ username: '', email: '', password: '' });
        setSuccess(authMode === 'login' ? 'Logged in successfully!' : 'Account created successfully!');
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setActiveTab('markets');
  };

  const handlePlaceBet = async () => {
    if (!betAmount || !betPosition) return;

    try {
      const response = await fetch(`${API_URL}/bets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          market_id: selectedMarket.id,
          option: betPosition,
          amount: parseFloat(betAmount)
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Bet placed successfully!');
        setShowBetModal(false);
        setBetAmount('');
        setBetPosition('');
        fetchUser();
        fetchMarkets();
      } else {
        setError(data.error || 'Failed to place bet');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    }
  };

  const handleCreateMarket = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch(`${API_URL}/markets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newMarket)
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Market created successfully!');
        setShowCreateMarket(false);
        setNewMarket({
          question: '',
          category_id: '',
          subcategory_id: '',
          closes_at: '',
          description: ''
        });
        fetchMarkets();
      } else {
        setError(data.error || 'Failed to create market');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    }
  };

  const openBetModal = (market) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    setSelectedMarket(market);
    setShowBetModal(true);
    setBetAmount('');
    setBetPosition('');
  };

  const toggleCategory = (categoryId) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const filterMarkets = () => {
    let filtered = markets;

    if (selectedCategory) {
      filtered = filtered.filter(m => m.category_id === selectedCategory);
    }

    if (selectedSubcategory) {
      filtered = filtered.filter(m => m.subcategory_id === selectedSubcategory);
    }

    return filtered;
  };

  const getMarketStatus = (market) => {
    if (market.resolved) return 'closed';
    const closeDate = market.closes_at || market.deadline;
    if (closeDate && new Date(closeDate) < new Date()) return 'closed';
    return 'live';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No date set';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    } catch (e) {
      return 'Invalid Date';
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <nav className="nav-container">
          <div className="logo" onClick={() => { setActiveTab('markets'); setSelectedCategory(null); setSelectedSubcategory(null); }}>
            Binary Bets
          </div>

          <div className="nav-tabs">
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
            {user && (
              <>
                <button
                  className={`nav-tab ${activeTab === 'my-bets' ? 'active' : ''}`}
                  onClick={() => setActiveTab('my-bets')}
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
            <button
              className={`nav-tab ${activeTab === 'leaderboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('leaderboard')}
            >
              Leaderboard
            </button>
            {user && user.is_admin && (
              <button
                className={`nav-tab ${activeTab === 'widgets' ? 'active' : ''}`}
                onClick={() => setActiveTab('widgets')}
              >
                🎨 Sidebar Widgets
              </button>
            )}
          </div>

          <div className="nav-actions">
            {user ? (
              <>
                <div className="balance">💰 ${user.balance?.toFixed(2) || '0.00'}</div>
                <div className="user-info">
                  <div className="user-avatar">{user.username?.[0]?.toUpperCase()}</div>
                  <span className="user-name">{user.username}</span>
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
        </nav>
      </header>

      {/* Main Content with Sidebar */}
      <div className="page-layout">
        {/* Left Sidebar */}
        <aside className="sidebar">
          {/* Disclaimer Widget */}
          <div className="disclaimer-widget">
            <h3>⚠️ Disclaimer</h3>
            <p>
              Prediction markets are for entertainment purposes only. This platform uses play money and is not real gambling. 
              Always bet responsibly and within your means.
            </p>
          </div>

          {/* News Widget */}
          <div className="widget news-widget">
            <h3>📰 Latest News</h3>
            {newsLoading ? (
              <div className="news-loading">Loading news...</div>
            ) : (
              <div>
                {newsItems.map(item => (
                  <div key={item.id} className="news-item">
                    <span className="news-category">{item.category}</span>
                    <div className="news-title">{item.title}</div>
                    <div className="news-source">{item.source}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Custom Widgets */}
          {widgets.map(widget => (
            <div key={widget.id} className="widget custom-widget">
              <h3>{widget.title}</h3>
              <div className="custom-widget-content" dangerouslySetInnerHTML={{ __html: widget.content }} />
            </div>
          ))}
        </aside>

        {/* Main Content Area */}
        <main className="main-content">
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          {/* Markets Tab */}
          {activeTab === 'markets' && (
            <div>
              <div className="markets-header">
                <h2>Prediction Markets</h2>
                {selectedCategory && (
                  <button 
                    className="btn btn-secondary"
                    onClick={() => { setSelectedCategory(null); setSelectedSubcategory(null); }}
                  >
                    Clear Filter
                  </button>
                )}
              </div>

              {filterMarkets().length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📊</div>
                  <h3>No markets found</h3>
                  <p>Check back later for new prediction markets!</p>
                </div>
              ) : (
                <div className="markets-grid">
                  {filterMarkets().map(market => (
                    <div key={market.id} className="market-card">
                      <div className={`market-status ${getMarketStatus(market)}`}>
                        {getMarketStatus(market)}
                      </div>

                      {market.category_name && (
                        <span className="market-category">
                          {market.category_icon} {market.category_name}
                        </span>
                      )}

                      <h3 className="market-question">{market.question}</h3>

                      <div className="market-info">
                        <div className="info-item">
                          <div className="info-label">Total Bets</div>
                          <div className="info-value">{market.bet_count || 0}</div>
                        </div>
                        <div className="info-item">
                          <div className="info-label">Pool</div>
                          <div className="info-value">
                            ${(parseFloat(market.yes_total || 0) + parseFloat(market.no_total || 0)).toFixed(0)}
                          </div>
                        </div>
                        <div className="info-item">
                          <div className="info-label">Closes</div>
                          <div className="info-value">
                            {formatDate(market.closes_at || market.deadline)}
                          </div>
                        </div>
                      </div>

                      {/* Betting Options with AI Odds */}
                      {market.options && market.options.length > 0 && (
                        <div className="betting-options">
                          <div className="options-label">Betting Options:</div>
                          <div className="options-grid">
                            {market.options.map(option => {
                              const totalPool = parseFloat(market.yes_total || 0) + parseFloat(market.no_total || 0);
                              let odds = 0.5;
                              
                              // Calculate current odds based on pool
                              if (totalPool > 0) {
                                const optionTotal = option.option_text.toLowerCase() === 'yes' 
                                  ? parseFloat(market.yes_total || 0)
                                  : parseFloat(market.no_total || 0);
                                odds = optionTotal / totalPool;
                              } else if (market.ai_odds && market.ai_odds.odds) {
                                // Use AI odds if no bets yet
                                odds = market.ai_odds.odds[option.option_text] || 0.5;
                              }

                              const percentage = (odds * 100).toFixed(0);
                              
                              return (
                                <div key={option.id} className="option-card">
                                  <div className="option-name">{option.option_text}</div>
                                  <div className="option-odds">
                                    <span className="odds-percentage">{percentage}%</span>
                                    <span className="odds-label">odds</span>
                                  </div>
                                  {totalPool === 0 && market.ai_odds && (
                                    <div className="ai-badge">AI Prediction</div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {getMarketStatus(market) === 'live' ? (
                        <div className="market-actions">
                          <button
                            className="bet-button yes"
                            onClick={() => openBetModal(market)}
                          >
                            Bet
                          </button>
                        </div>
                      ) : (
                        <div className="market-actions">
                          <button className="bet-button" disabled>
                            {market.resolved ? `Resolved: ${market.outcome}` : 'Closed'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Categories Tab */}
          {activeTab === 'categories' && (
            <div className="categories-section">
              <h2>Browse by Category</h2>
              <div className="categories-grid">
                {categories.map(category => (
                  <div
                    key={category.id}
                    className={`category-card ${expandedCategories.has(category.id) ? 'expanded' : ''}`}
                  >
                    <div className="category-header">
                      <div className="category-title">
                        <div className="category-icon">{category.icon}</div>
                        <div>
                          <div className="category-name">{category.name}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span className="category-count">
                          {markets.filter(m => m.category_id === category.id).length} markets
                        </span>
                        {category.subcategories?.length > 0 && (
                          <button
                            className="expand-icon"
                            onClick={() => toggleCategory(category.id)}
                          >
                            {expandedCategories.has(category.id) ? '▲' : '▼'}
                          </button>
                        )}
                      </div>
                    </div>

                    {expandedCategories.has(category.id) && category.subcategories?.length > 0 && (
                      <div className="subcategories">
                        {category.subcategories.map(sub => (
                          <span
                            key={sub.id}
                            className="subcategory-tag"
                            onClick={() => {
                              setSelectedCategory(category.id);
                              setSelectedSubcategory(sub.id);
                              setActiveTab('markets');
                            }}
                          >
                            {sub.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <button
                      className="btn btn-primary"
                      style={{ marginTop: '12px', width: '100%' }}
                      onClick={() => {
                        setSelectedCategory(category.id);
                        setSelectedSubcategory(null);
                        setActiveTab('markets');
                      }}
                    >
                      View All {category.name} Markets
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* My Bets Tab */}
          {activeTab === 'my-bets' && (
            <div>
              <h2>My Bets</h2>
              {userBets.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🎲</div>
                  <h3>No bets yet</h3>
                  <p>Start betting on prediction markets to see your bets here!</p>
                </div>
              ) : (
                <div className="markets-grid">
                  {userBets.map(bet => (
                    <div key={bet.id} className="market-card">
                      <span className="market-category">
                        {bet.category_icon} {bet.category_name}
                      </span>
                      <h3 className="market-question">{bet.question}</h3>
                      <div className="market-info">
                        <div className="info-item">
                          <div className="info-label">Your Bet</div>
                          <div className="info-value">{bet.option}</div>
                        </div>
                        <div className="info-item">
                          <div className="info-label">Amount</div>
                          <div className="info-value">${parseFloat(bet.amount).toFixed(2)}</div>
                        </div>
                        <div className="info-item">
                          <div className="info-label">Status</div>
                          <div className="info-value">
                            {bet.resolved ? (bet.won ? '✅ Won' : '❌ Lost') : '⏳ Pending'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Create Market Tab */}
          {activeTab === 'create' && user && (
            <div>
              <h2>Create New Market</h2>
              <form onSubmit={handleCreateMarket} style={{ maxWidth: '600px' }}>
                <div className="form-group">
                  <label>Question *</label>
                  <input
                    type="text"
                    value={newMarket.question}
                    onChange={(e) => setNewMarket({ ...newMarket, question: e.target.value })}
                    placeholder="Will Bitcoin reach $100k by end of 2025?"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Category *</label>
                  <select
                    value={newMarket.category_id}
                    onChange={(e) => setNewMarket({ ...newMarket, category_id: e.target.value, subcategory_id: '' })}
                    required
                  >
                    <option value="">Select a category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {newMarket.category_id && categories.find(c => c.id === parseInt(newMarket.category_id))?.subcategories?.length > 0 && (
                  <div className="form-group">
                    <label>Subcategory (Optional)</label>
                    <select
                      value={newMarket.subcategory_id}
                      onChange={(e) => setNewMarket({ ...newMarket, subcategory_id: e.target.value })}
                    >
                      <option value="">None</option>
                      {categories
                        .find(c => c.id === parseInt(newMarket.category_id))
                        ?.subcategories.map(sub => (
                          <option key={sub.id} value={sub.id}>
                            {sub.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label>Closes At *</label>
                  <input
                    type="datetime-local"
                    value={newMarket.closes_at}
                    onChange={(e) => setNewMarket({ ...newMarket, closes_at: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Description (Optional)</label>
                  <textarea
                    value={newMarket.description}
                    onChange={(e) => setNewMarket({ ...newMarket, description: e.target.value })}
                    placeholder="Additional details about this market..."
                  />
                </div>

                <button type="submit" className="btn btn-primary">
                  Create Market
                </button>
              </form>
            </div>
          )}

          {/* Leaderboard Tab */}
          {activeTab === 'leaderboard' && (
            <div>
              <h2>Leaderboard</h2>
              {leaderboard.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🏆</div>
                  <h3>No rankings yet</h3>
                  <p>Start betting to appear on the leaderboard!</p>
                </div>
              ) : (
                <div style={{ background: 'white', borderRadius: '24px', padding: '24px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Rank</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>Player</th>
                        <th style={{ padding: '12px', textAlign: 'right' }}>Balance</th>
                        <th style={{ padding: '12px', textAlign: 'right' }}>Total Bets</th>
                        <th style={{ padding: '12px', textAlign: 'right' }}>Wins</th>
                        <th style={{ padding: '12px', textAlign: 'right' }}>Winnings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((player, index) => (
                        <tr key={player.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px' }}>
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                          </td>
                          <td style={{ padding: '12px', fontWeight: '600' }}>{player.username}</td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>${parseFloat(player.balance).toFixed(2)}</td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>{player.total_bets}</td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>{player.wins}</td>
                          <td style={{ padding: '12px', textAlign: 'right', color: 'var(--success-color)', fontWeight: '600' }}>
                            ${parseFloat(player.winnings).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Widget Management Tab (Admin Only) */}
          {activeTab === 'widgets' && user?.is_admin && (
            <div>
              <h2>Sidebar Widget Management</h2>
              <p style={{ marginBottom: '24px', color: 'var(--text-secondary)' }}>
                Manage custom widgets that appear in the left sidebar. Users will see these below the disclaimer and news widgets.
              </p>
              
              <div className="empty-state">
                <div className="empty-state-icon">🎨</div>
                <h3>Widget Management Coming Soon</h3>
                <p>Full CRUD interface for managing sidebar widgets will be available here.</p>
                <p style={{ marginTop: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                  For now, widgets can be managed directly through the database or API.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{authMode === 'login' ? 'Login' : 'Sign Up'}</h2>
            <form onSubmit={handleAuth}>
              {authMode === 'register' && (
                <div className="form-group">
                  <label>Username</label>
                  <input
                    type="text"
                    value={authForm.username}
                    onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                    required
                  />
                </div>
              )}
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAuthModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {authMode === 'login' ? 'Login' : 'Sign Up'}
                </button>
              </div>
            </form>
            <p style={{ textAlign: 'center', marginTop: '16px' }}>
              {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
              <button
                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', textDecoration: 'underline' }}
              >
                {authMode === 'login' ? 'Sign Up' : 'Login'}
              </button>
            </p>
          </div>
        </div>
      )}

      {/* Bet Modal */}
      {showBetModal && selectedMarket && (
        <div className="modal-overlay" onClick={() => setShowBetModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Place Your Bet</h2>
            <h3 style={{ fontSize: '16px', marginBottom: '20px', color: 'var(--text-secondary)' }}>
              {selectedMarket.question}
            </h3>

            <div className="form-group">
              <label>Select Position</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                {selectedMarket.options?.map(option => (
                  <button
                    key={option.id}
                    className={`bet-button ${betPosition === option.option_text.toLowerCase() ? 'yes' : ''}`}
                    onClick={() => setBetPosition(option.option_text.toLowerCase())}
                    style={{ flex: 1 }}
                  >
                    {option.option_text}
                  </button>
                ))}
              </div>
            </div>

            {betPosition && (
              <>
                <div className="form-group">
                  <label>Bet Amount</label>
                  <input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    placeholder="Enter amount"
                    min="1"
                    max={user.balance}
                    step="0.01"
                  />
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Available balance: ${user.balance.toFixed(2)}
                  </p>
                </div>

                <div className="modal-actions">
                  <button className="btn btn-secondary" onClick={() => setShowBetModal(false)}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handlePlaceBet}
                    disabled={!betAmount || parseFloat(betAmount) <= 0 || parseFloat(betAmount) > user.balance}
                  >
                    Place Bet - ${parseFloat(betAmount || 0).toFixed(2)}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
