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
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [userBets, setUserBets] = useState([]);
  const [reportedBets, setReportedBets] = useState([]);
  const [activeTab, setActiveTab] = useState('bets');
  const [newsArticles, setNewsArticles] = useState([]);
  const [loadingNews, setLoadingNews] = useState(false);
  
  // Sidebar widgets (admin configurable)
  const [sidebarWidgets, setSidebarWidgets] = useState([]);
  const [editingWidget, setEditingWidget] = useState(null);
  const [showWidgetForm, setShowWidgetForm] = useState(false);
  const [widgetForm, setWidgetForm] = useState({
    title: '',
    content: '',
    icon: '📌'
  });

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
    loadSidebarWidgets();
  }, []);

  useEffect(() => {
    if (user) {
      fetchUserBets();
      if (user.is_admin) {
        fetchReportedBets();
      }
    }
  }, [user]);

  // Fetch news when markets or categories change
  useEffect(() => {
    if (activeTab === 'bets' && markets.length > 0) {
      fetchRelevantNews();
    }
  }, [markets, activeTab]);

  const fetchMarkets = async () => {
    try {
      console.log('🔍 Fetching markets...');
      const response = await fetch(`${API_URL}/api/markets`);
      const data = await response.json();
      console.log('📊 Markets received:', data.markets?.length || 0, 'markets');
      console.log('📋 Markets data:', data.markets);
      setMarkets(data.markets || []);
    } catch (error) {
      console.error('❌ Error fetching markets:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/api/categories`);
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
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
          'Authorization': `Bearer ${user.token}`
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
      const response = await fetch(`${API_URL}/api/admin/reported-bets`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      const data = await response.json();
      setReportedBets(data.bets || []);
    } catch (error) {
      console.error('Error fetching reported bets:', error);
    }
  };

  const fetchRelevantNews = async () => {
    setLoadingNews(true);
    try {
      const categoryCounts = {};
      markets.forEach(market => {
        const catId = market.category_id;
        categoryCounts[catId] = (categoryCounts[catId] || 0) + 1;
      });

      const sortedCategories = Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([catId]) => {
          const cat = categories.find(c => c.id === parseInt(catId));
          return cat ? cat.name.toLowerCase() : null;
        })
        .filter(Boolean);

      const allArticles = [];
      for (const categoryName of sortedCategories) {
        try {
          const response = await fetch(
            `https://newsapi.org/v2/everything?q=${categoryName}&sortBy=publishedAt&pageSize=2&apiKey=219d788b390f4918a2d0f963a21460d9`
          );
          const data = await response.json();
          if (data.articles) {
            allArticles.push(...data.articles.slice(0, 2).map(article => ({
              ...article,
              category: categoryName
            })));
          }
        } catch (error) {
          console.error(`Error fetching news for ${categoryName}:`, error);
        }
      }

      setNewsArticles(allArticles.slice(0, 5));
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setLoadingNews(false);
    }
  };

  // Sidebar widget management
  const loadSidebarWidgets = () => {
    const saved = localStorage.getItem('sidebarWidgets');
    if (saved) {
      setSidebarWidgets(JSON.parse(saved));
    }
  };

  const saveSidebarWidgets = (widgets) => {
    localStorage.setItem('sidebarWidgets', JSON.stringify(widgets));
    setSidebarWidgets(widgets);
  };

  const handleAddWidget = () => {
    if (sidebarWidgets.length >= 4) {
      alert('Maximum 4 custom widgets allowed');
      return;
    }
    setWidgetForm({ title: '', content: '', icon: '📌' });
    setEditingWidget(null);
    setShowWidgetForm(true);
  };

  const handleEditWidget = (widget) => {
    setWidgetForm(widget);
    setEditingWidget(widget.id);
    setShowWidgetForm(true);
  };

  const handleSaveWidget = () => {
    if (!widgetForm.title.trim() || !widgetForm.content.trim()) {
      alert('Please fill in all fields');
      return;
    }

    let updatedWidgets;
    if (editingWidget) {
      updatedWidgets = sidebarWidgets.map(w => 
        w.id === editingWidget ? { ...widgetForm, id: editingWidget } : w
      );
    } else {
      const newWidget = {
        ...widgetForm,
        id: Date.now(),
        order: sidebarWidgets.length
      };
      updatedWidgets = [...sidebarWidgets, newWidget];
    }

    saveSidebarWidgets(updatedWidgets);
    setShowWidgetForm(false);
    setWidgetForm({ title: '', content: '', icon: '📌' });
    setEditingWidget(null);
  };

  const handleDeleteWidget = (widgetId) => {
    if (confirm('Are you sure you want to delete this widget?')) {
      const updatedWidgets = sidebarWidgets.filter(w => w.id !== widgetId);
      saveSidebarWidgets(updatedWidgets);
    }
  };

  const handleMoveWidget = (widgetId, direction) => {
    const index = sidebarWidgets.findIndex(w => w.id === widgetId);
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === sidebarWidgets.length - 1)
    ) {
      return;
    }

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const updatedWidgets = [...sidebarWidgets];
    [updatedWidgets[index], updatedWidgets[newIndex]] = [updatedWidgets[newIndex], updatedWidgets[index]];
    
    saveSidebarWidgets(updatedWidgets);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: authForm.username,
          password: authForm.password
        })
      });

      const data = await response.json();
      if (response.ok) {
        const userData = { ...data.user, token: data.token };
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        setShowAuthModal(false);
        setAuthForm({ username: '', email: '', password: '', confirmPassword: '' });
      } else {
        alert(data.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed');
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (authForm.password !== authForm.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/signup`, {
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
        const userData = { ...data.user, token: data.token };
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        setShowAuthModal(false);
        setAuthForm({ username: '', email: '', password: '', confirmPassword: '' });
      } else {
        alert(data.error || 'Signup failed');
      }
    } catch (error) {
      console.error('Signup error:', error);
      alert('Signup failed');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    setActiveTab('bets');
  };

  const handleBetSubmit = async () => {
    if (!selectedBet || !betPosition || !betAmount) {
      alert('Please fill in all fields');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/bets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          market_id: selectedBet.id,
          position: betPosition,
          amount: parseFloat(betAmount)
        })
      });

      const data = await response.json();
      if (response.ok) {
        alert('Bet placed successfully!');
        setSelectedBet(null);
        setBetPosition('');
        setBetAmount('');
        fetchMarkets();
        fetchUserBets();
        
        const updatedUser = { ...user, balance: data.newBalance };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      } else {
        alert(data.error || 'Failed to place bet');
      }
    } catch (error) {
      console.error('Error placing bet:', error);
      alert('Failed to place bet');
    }
  };

  const handleMarketCreated = () => {
    fetchMarkets();
    setActiveTab('bets');
  };

  const handleCategoryClick = (categoryId) => {
    if (selectedCategory === categoryId) {
      setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
    } else {
      setSelectedCategory(categoryId);
      setSelectedSubcategory(null);
      setExpandedCategory(categoryId);
    }
  };

  const handleSubcategoryClick = (subcategoryId) => {
    setSelectedSubcategory(subcategoryId === selectedSubcategory ? null : subcategoryId);
  };

  const filteredMarkets = markets.filter(market => {
    if (selectedCategory === 'all') return true;
    if (selectedSubcategory) {
      return market.subcategory_id === selectedSubcategory;
    }
    return market.category_id === selectedCategory;
  });

  const currentCategory = categories.find(cat => cat.id === expandedCategory);
  const subcategories = currentCategory?.subcategories || [];

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isMarketLive = (deadline) => {
    return new Date(deadline) > new Date();
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1>🎯 Binary Bets</h1>
          <div className="user-section">
            {user ? (
              <>
                <span className="balance">💰 ${parseFloat(user.balance).toFixed(2)}</span>
                <span className="username">👤 {user.username}</span>
                <button onClick={handleLogout} className="button-secondary">
                  Logout
                </button>
              </>
            ) : (
              <button onClick={() => setShowAuthModal(true)} className="button-primary">
                Login / Sign Up
              </button>
            )}
          </div>
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
              📊 My Portfolio
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
              👤 Admin
            </button>
            <button
              className={activeTab === 'categories' ? 'active admin-btn' : 'admin-btn'} 
              onClick={() => setActiveTab('categories')}
            >
              📁 Categories
            </button>
            <button
              className={activeTab === 'widgets' ? 'active admin-btn' : 'admin-btn'} 
              onClick={() => setActiveTab('widgets')}
            >
              🎨 Sidebar Widgets
            </button>
          </>
        )}
      </nav>

      {activeTab === 'bets' && (
        <>
          <div className="categories-bar">
            <div className="categories-container">
              <div className="categories-row">
                <button
                  className={selectedCategory === 'all' ? 'category-badge active' : 'category-badge'}
                  onClick={() => {
                    setSelectedCategory('all');
                    setSelectedSubcategory(null);
                    setExpandedCategory(null);
                  }}
                >
                  All
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    className={selectedCategory === cat.id ? 'category-badge active' : 'category-badge'}
                    onClick={() => handleCategoryClick(cat.id)}
                  >
                    {cat.icon} {cat.name}
                  </button>
                ))}
              </div>
              
              <div className={`subcategories-container ${expandedCategory ? 'expanded' : ''}`}>
                {subcategories.length > 0 && (
                  <div className="subcategories-grid">
                    {subcategories.map(sub => (
                      <button
                        key={sub.id}
                        className={selectedSubcategory === sub.id ? 'subcategory-badge active' : 'subcategory-badge'}
                        onClick={() => handleSubcategoryClick(sub.id)}
                      >
                        {sub.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="page-layout">
            {/* SIDEBAR ON LEFT */}
            <aside className="sidebar">
              {/* Disclaimer Widget (Always First) */}
              <div className="disclaimer-widget">
                <h3>⚠️ Important Notice</h3>
                <p>
                  This site is for <strong>entertainment purposes only</strong>. 
                  No real money is involved. All bets use virtual currency and 
                  are meant for fun and prediction practice.
                </p>
              </div>

              {/* News Widget */}
              <div className="news-widget widget">
                <h3>📰 Trending News</h3>
                {loadingNews ? (
                  <div className="news-loading">Loading news...</div>
                ) : newsArticles.length > 0 ? (
                  newsArticles.map((article, idx) => (
                    <div key={idx} className="news-item">
                      <span className="news-category">{article.category}</span>
                      <h4 className="news-title">{article.title}</h4>
                      <div className="news-source">
                        <span>{article.source?.name || 'Unknown'}</span>
                        <span className="news-date">
                          {new Date(article.publishedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="news-empty">
                    <p>No news available at the moment.</p>
                  </div>
                )}
              </div>

              {/* Custom Widgets (Admin Created) */}
              {sidebarWidgets.map((widget) => (
                <div key={widget.id} className="custom-widget widget">
                  <h3>{widget.icon} {widget.title}</h3>
                  <div 
                    className="custom-widget-content"
                    dangerouslySetInnerHTML={{ __html: widget.content.replace(/\n/g, '<br />') }}
                  />
                </div>
              ))}
            </aside>

            {/* MAIN CONTENT ON RIGHT */}
            <main className="main-content">
              <div className="bets-section">
                <div className="markets-grid">
                  {filteredMarkets.length === 0 ? (
                    <div className="empty-state">
                      <p>No active bets at the moment. Be the first to create one!</p>
                    </div>
                  ) : (
                    filteredMarkets.map(market => {
                      const category = categories.find(c => c.id === market.category_id);
                      const subcategory = category?.subcategories?.find(s => s.id === market.subcategory_id);
                      const isLive = isMarketLive(market.deadline);
                      
                      return (
                        <div key={market.id} className="market-card">
                          <div className={`market-status-badge ${isLive ? 'live' : 'closed'}`}>
                            {isLive ? '🟢 LIVE' : '🔴 CLOSED'}
                          </div>
                          
                          <div className="market-header">
                            <h3 className="market-question">{market.question}</h3>
                            {category && (
                              <div className="market-categories">
                                <span className="category-tag">
                                  {category.icon} {category.name}
                                </span>
                                {subcategory && (
                                  <>
                                    <span className="category-separator">|</span>
                                    <span className="subcategory-tag">
                                      {subcategory.name}
                                    </span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="market-options">
                            {market.options && market.options.map((option, idx) => (
                              <div key={idx} className="option-item">
                                <span className="option-name">{option}</span>
                                {market.ai_odds && market.ai_odds[option] && (
                                  <span className="option-odds">
                                    {Math.round(market.ai_odds[option] * 100)}%
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>

                          <div className="market-stats">
                            <div className="stat-group">
                              <div className="stat">
                                <span className="stat-label">Total Pool</span>
                                <span className="stat-value">${parseFloat(market.total_bet_amount || 0).toFixed(2)}</span>
                              </div>
                              <div className="stat">
                                <span className="stat-label">Participants</span>
                                <span className="stat-value">{market.bet_count || 0}</span>
                              </div>
                            </div>
                          </div>

                          <div className="market-footer">
                            <span className="close-date">
                              ⏰ Closes: {formatDate(market.deadline)}
                            </span>
                            {user && isLive && (
                              <button
                                className="button-primary btn-small"
                                onClick={() => setSelectedBet(market)}
                              >
                                Place Bet
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </main>
          </div>
        </>
      )}

      {activeTab === 'portfolio' && user && (
        <main className="main">
          <div className="portfolio-section">
            <h2>My Portfolio</h2>
            {userBets.length === 0 ? (
              <p>You haven't placed any bets yet.</p>
            ) : (
              <div className="bets-list">
                {userBets.map(bet => (
                  <div key={bet.id} className="bet-item">
                    <h3>{bet.question}</h3>
                    <p>Position: {bet.position}</p>
                    <p>Amount: ${parseFloat(bet.amount).toFixed(2)}</p>
                    <p>Status: {bet.market_status}</p>
                    <p>Placed: {new Date(bet.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      )}

      {activeTab === 'create' && user && (
        <CreateMarket 
          onMarketCreated={handleMarketCreated}
          categories={categories}
        />
      )}

      {activeTab === 'leaderboard' && (
        <main className="main">
          <div className="leaderboard-section">
            <h2>🏆 Leaderboard</h2>
            {leaderboard.length === 0 ? (
              <p>No leaderboard data yet.</p>
            ) : (
              <div className="leaderboard-list">
                {leaderboard.map((entry, idx) => (
                  <div key={entry.user_id} className="leaderboard-item">
                    <span className="rank">#{idx + 1}</span>
                    <span className="username">{entry.username}</span>
                    <span className="balance">${parseFloat(entry.balance).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      )}

      {activeTab === 'widgets' && user?.is_admin && (
        <main className="main">
          <div className="widget-management">
            <h2>🎨 Sidebar Widget Management</h2>
            
            <div className="widget-list">
              <h3>Custom Widgets ({sidebarWidgets.length}/4)</h3>
              {sidebarWidgets.map((widget, index) => (
                <div key={widget.id} className="widget-item">
                  <div className="widget-order-controls">
                    <button
                      className="btn-order"
                      onClick={() => handleMoveWidget(widget.id, 'up')}
                      disabled={index === 0}
                    >
                      ↑
                    </button>
                    <button
                      className="btn-order"
                      onClick={() => handleMoveWidget(widget.id, 'down')}
                      disabled={index === sidebarWidgets.length - 1}
                    >
                      ↓
                    </button>
                  </div>
                  <div className="widget-item-content">
                    <div className="widget-item-header">
                      <div className="widget-item-title">
                        {widget.icon} {widget.title}
                      </div>
                      <div className="widget-item-actions">
                        <button className="button-secondary" onClick={() => handleEditWidget(widget)}>
                          ✏️ Edit
                        </button>
                        <button className="button-secondary" onClick={() => handleDeleteWidget(widget.id)}>
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                    <div className="widget-item-preview">
                      {widget.content.substring(0, 100)}
                      {widget.content.length > 100 && '...'}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {sidebarWidgets.length < 4 ? (
              <div className="add-widget-section">
                <h3>➕ Add New Widget</h3>
                <p>You can add up to {4 - sidebarWidgets.length} more widget{4 - sidebarWidgets.length !== 1 ? 's' : ''}</p>
                <button className="button-primary" onClick={handleAddWidget}>
                  Add Widget
                </button>
              </div>
            ) : (
              <div className="widget-limit-warning">
                ⚠️ Maximum of 4 custom widgets reached. Delete a widget to add a new one.
              </div>
            )}
          </div>
        </main>
      )}

      {activeTab === 'admin' && user?.is_admin && (
        <main className="main">
          <div className="admin-section">
            <h2>Admin Panel</h2>
            <h3>Reported Bets</h3>
            {reportedBets.length === 0 ? (
              <p>No reported bets.</p>
            ) : (
              <div className="reported-bets-list">
                {reportedBets.map(bet => (
                  <div key={bet.id} className="reported-bet-item">
                    <h4>{bet.question}</h4>
                    <p>Reported by: {bet.reporter_username}</p>
                    <p>Reason: {bet.report_reason}</p>
                    <p>Reported at: {new Date(bet.reported_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      )}

      {activeTab === 'categories' && user?.is_admin && (
        <CategoryManagement />
      )}

      {/* Widget Form Modal */}
      {showWidgetForm && (
        <div className="modal-overlay" onClick={() => setShowWidgetForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>{editingWidget ? 'Edit Widget' : 'Add New Widget'}</h2>
            <form className="widget-form" onSubmit={(e) => { e.preventDefault(); handleSaveWidget(); }}>
              <label>
                Icon (emoji)
                <input
                  type="text"
                  placeholder="📌"
                  maxLength="2"
                  value={widgetForm.icon}
                  onChange={e => setWidgetForm({...widgetForm, icon: e.target.value})}
                />
              </label>
              <label>
                Title
                <input
                  type="text"
                  placeholder="Widget Title"
                  value={widgetForm.title}
                  onChange={e => setWidgetForm({...widgetForm, title: e.target.value})}
                  required
                />
              </label>
              <label>
                Content
                <textarea
                  placeholder="Widget content (HTML allowed)"
                  value={widgetForm.content}
                  onChange={e => setWidgetForm({...widgetForm, content: e.target.value})}
                  required
                />
              </label>
              <div className="widget-form-actions">
                <button type="button" className="button-secondary" onClick={() => setShowWidgetForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="button-primary">
                  {editingWidget ? 'Save Changes' : 'Add Widget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAuthModal && (
        <div className="modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>{authMode === 'login' ? 'Login' : 'Sign Up'}</h2>
            <form onSubmit={authMode === 'login' ? handleLogin : handleSignup}>
              <input
                type="text"
                placeholder="Username"
                value={authForm.username}
                onChange={e => setAuthForm({...authForm, username: e.target.value})}
                required
              />
              {authMode === 'signup' && (
                <input
                  type="email"
                  placeholder="Email"
                  value={authForm.email}
                  onChange={e => setAuthForm({...authForm, email: e.target.value})}
                  required
                />
              )}
              <input
                type="password"
                placeholder="Password"
                value={authForm.password}
                onChange={e => setAuthForm({...authForm, password: e.target.value})}
                required
              />
              {authMode === 'signup' && (
                <input
                  type="password"
                  placeholder="Confirm Password"
                  value={authForm.confirmPassword}
                  onChange={e => setAuthForm({...authForm, confirmPassword: e.target.value})}
                  required
                />
              )}
              <button type="submit" className="button-primary">
                {authMode === 'login' ? 'Login' : 'Sign Up'}
              </button>
            </form>
            <button
              className="button-link"
              onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
            >
              {authMode === 'login' ? 'Need an account? Sign up' : 'Have an account? Login'}
            </button>
          </div>
        </div>
      )}

      {selectedBet && (
        <div className="modal-overlay" onClick={() => setSelectedBet(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Place a Bet</h2>
            <h3>{selectedBet.question}</h3>
            <select
              value={betPosition}
              onChange={e => setBetPosition(e.target.value)}
              required
            >
              <option value="">Select your position</option>
              {selectedBet.options && selectedBet.options.map((option, idx) => (
                <option key={idx} value={option}>{option}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Amount"
              value={betAmount}
              onChange={e => setBetAmount(e.target.value)}
              min="0"
              step="0.01"
              required
            />
            <button className="button-primary" onClick={handleBetSubmit}>
              Confirm Bet
            </button>
            <button className="button-secondary" onClick={() => setSelectedBet(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
