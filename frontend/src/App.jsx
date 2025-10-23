import { useState, useEffect } from 'react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Helper function to format currency
const formatCurrency = (value) => {
  return parseFloat(value || 0).toFixed(2);
};

function App() {
  const [user, setUser] = useState(null);
  const [markets, setMarkets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [userBets, setUserBets] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showCreateMarket, setShowCreateMarket] = useState(false);
  const [showResolved, setShowResolved] = useState('active'); // 'active' or 'completed'
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [marketResults, setMarketResults] = useState(null);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [registerData, setRegisterData] = useState({ username: '', email: '', password: '' });
  const [newMarket, setNewMarket] = useState({
    question: '',
    type: 'binary',
    category_id: 1,
    deadline: '',
    options: ['', '']
  });
  const [betAmount, setBetAmount] = useState('');
  const [betType, setBetType] = useState('yes');
  const [selectedOption, setSelectedOption] = useState(null);

  useEffect(() => {
    fetchMarkets();
    fetchCategories();
    fetchLeaderboard();
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      fetchUserBets(parsedUser.id);
    }
  }, []);

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

  const fetchUserBets = async (userId) => {
    try {
      const response = await fetch(`${API_URL}/users/${userId}/bets`);
      const data = await response.json();
      setUserBets(data);
    } catch (error) {
      console.error('Error fetching user bets:', error);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`${API_URL}/leaderboard`);
      const data = await response.json();
      setLeaderboard(data);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    }
  };

  const fetchMarketResults = async (marketId) => {
    try {
      const response = await fetch(`${API_URL}/markets/${marketId}/results`);
      const data = await response.json();
      
      // Split into winners and losers
      const winners = data.filter(bet => parseFloat(bet.payout) > 0);
      const losers = data.filter(bet => parseFloat(bet.payout) === 0);
      
      setMarketResults({ winners, losers });
    } catch (error) {
      console.error('Error fetching market results:', error);
      setMarketResults({ winners: [], losers: [] });
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData),
      });
      const data = await response.json();
      if (response.ok) {
        setUser(data);
        localStorage.setItem('user', JSON.stringify(data));
        fetchUserBets(data.id);
        setShowLogin(false);
        setLoginData({ email: '', password: '' });
      } else {
        alert(data.error || 'Login failed');
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
        body: JSON.stringify(registerData),
      });
      const data = await response.json();
      if (response.ok) {
        setUser(data);
        localStorage.setItem('user', JSON.stringify(data));
        fetchUserBets(data.id);
        setShowRegister(false);
        setRegisterData({ username: '', email: '', password: '' });
      } else {
        alert(data.error || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('Registration failed');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setUserBets([]);
    localStorage.removeItem('user');
  };

  const handleCreateMarket = async (e) => {
    e.preventDefault();
    try {
      const marketData = {
        ...newMarket,
        created_by: user.id,
        options: newMarket.type === 'multiple' ? newMarket.options.filter(o => o.trim()) : undefined
      };
      
      const response = await fetch(`${API_URL}/markets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(marketData),
      });
      
      if (response.ok) {
        fetchMarkets();
        setShowCreateMarket(false);
        setNewMarket({
          question: '',
          type: 'binary',
          category_id: 1,
          deadline: '',
          options: ['', '']
        });
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to create market');
      }
    } catch (error) {
      console.error('Error creating market:', error);
      alert('Failed to create market');
    }
  };

  const handlePlaceBet = async (marketId, marketType) => {
    if (!user) {
      alert('Please login to place a bet');
      return;
    }

    if (!betAmount || parseFloat(betAmount) <= 0) {
      alert('Please enter a valid bet amount');
      return;
    }

    if (marketType === 'multiple' && !selectedOption) {
      alert('Please select an option');
      return;
    }

    try {
      const betData = {
        user_id: user.id,
        market_id: marketId,
        amount: parseFloat(betAmount),
        bet_type: marketType === 'binary' ? betType : null,
        option_id: marketType === 'multiple' ? selectedOption : null
      };

      const response = await fetch(`${API_URL}/bets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(betData),
      });

      if (response.ok) {
        alert('Bet placed successfully!');
        fetchMarkets();
        fetchUserBets(user.id);
        
        // Update user balance
        const userResponse = await fetch(`${API_URL}/users/${user.id}`);
        const userData = await userResponse.json();
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        
        setBetAmount('');
        setSelectedOption(null);
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to place bet');
      }
    } catch (error) {
      console.error('Error placing bet:', error);
      alert('Failed to place bet');
    }
  };

  const viewResults = (market) => {
    setSelectedMarket(market);
    fetchMarketResults(market.id);
  };

  const closeResults = () => {
    setSelectedMarket(null);
    setMarketResults(null);
  };

  const filteredMarkets = markets.filter(m => {
    if (showResolved === 'active') return !m.resolved;
    if (showResolved === 'completed') return m.resolved;
    return true;
  });

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1>🎲 BinaryBets</h1>
          {user ? (
            <div className="user-info">
              <span>👤 {user.username}</span>
              <span className="balance">${formatCurrency(user.balance)}</span>
              <button onClick={handleLogout} className="btn-secondary">Logout</button>
            </div>
          ) : (
            <div className="auth-buttons">
              <button onClick={() => setShowLogin(true)} className="btn-primary">Login</button>
              <button onClick={() => setShowRegister(true)} className="btn-secondary">Register</button>
            </div>
          )}
        </div>
      </header>

      <main className="main-content">
        <div className="markets-section">
          <div className="section-header">
            <h2>Markets</h2>
            <div className="market-filters">
              <button 
                onClick={() => setShowResolved('active')}
                className={showResolved === 'active' ? 'filter-active' : 'filter-inactive'}
              >
                Active
              </button>
              <button 
                onClick={() => setShowResolved('completed')}
                className={showResolved === 'completed' ? 'filter-active' : 'filter-inactive'}
              >
                🏁 Completed
              </button>
            </div>
            {user && user.is_admin && (
              <button onClick={() => setShowCreateMarket(true)} className="btn-primary">
                Create Market
              </button>
            )}
          </div>

          <div className="markets-grid">
            {filteredMarkets.map(market => (
              <div key={market.id} className="market-card">
                <div className="market-header">
                  <span className="category-badge" style={{ backgroundColor: market.category_color }}>
                    {market.category_name}
                  </span>
                  {market.resolved && <span className="resolved-badge">✅ Resolved</span>}
                </div>
                <h3>{market.question}</h3>
                <div className="market-info">
                  <p>Deadline: {new Date(market.deadline).toLocaleDateString()}</p>
                  {market.type === 'binary' && (
                    <div className="binary-odds">
                      <div className="odds-item">
                        <span>Yes: ${formatCurrency(market.yes_bets)}</span>
                      </div>
                      <div className="odds-item">
                        <span>No: ${formatCurrency(market.no_bets)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {!market.resolved && user && (
                  <div className="bet-form">
                    <input
                      type="number"
                      placeholder="Bet amount"
                      value={betAmount}
                      onChange={(e) => setBetAmount(e.target.value)}
                      className="bet-input"
                    />
                    {market.type === 'binary' ? (
                      <div className="bet-options">
                        <button
                          onClick={() => {
                            setBetType('yes');
                            handlePlaceBet(market.id, 'binary');
                          }}
                          className="btn-yes"
                        >
                          Bet Yes
                        </button>
                        <button
                          onClick={() => {
                            setBetType('no');
                            handlePlaceBet(market.id, 'binary');
                          }}
                          className="btn-no"
                        >
                          Bet No
                        </button>
                      </div>
                    ) : (
                      <div className="multi-options">
                        {market.options.map(option => (
                          <button
                            key={option.id}
                            onClick={() => {
                              setSelectedOption(option.id);
                              handlePlaceBet(market.id, 'multiple');
                            }}
                            className="btn-option"
                          >
                            {option.name} (${formatCurrency(option.total_bets)})
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {market.resolved && (
                  <button 
                    onClick={() => viewResults(market)} 
                    className="btn-results"
                  >
                    📊 View Results
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <aside className="sidebar">
          <div className="leaderboard">
            <h3>🏆 Leaderboard</h3>
            <div className="leaderboard-list">
              {leaderboard.map((player, index) => (
                <div key={player.id} className="leaderboard-item">
                  <span className="rank">#{index + 1}</span>
                  <span className="username">{player.username}</span>
                  <span className="balance">${formatCurrency(player.balance)}</span>
                </div>
              ))}
            </div>
          </div>

          {user && userBets.length > 0 && (
            <div className="user-bets">
              <h3>Your Bets</h3>
              <div className="bets-list">
                {userBets.slice(0, 5).map(bet => (
                  <div key={bet.id} className="bet-item">
                    <p className="bet-question">{bet.question}</p>
                    <div className="bet-details">
                      <span>${formatCurrency(bet.amount)}</span>
                      <span>{bet.bet_type || bet.option_name}</span>
                      {bet.resolved && (
                        <span className={parseFloat(bet.payout) > 0 ? 'won' : 'lost'}>
                          {parseFloat(bet.payout) > 0 ? `+$${formatCurrency(bet.payout)}` : 'Lost'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </main>

      {/* Login Modal */}
      {showLogin && (
        <div className="modal-overlay" onClick={() => setShowLogin(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Login</h2>
            <form onSubmit={handleLogin}>
              <input
                type="email"
                placeholder="Email"
                value={loginData.email}
                onChange={(e) => setLoginData({...loginData, email: e.target.value})}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={loginData.password}
                onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                required
              />
              <button type="submit" className="btn-primary">Login</button>
            </form>
          </div>
        </div>
      )}

      {/* Register Modal */}
      {showRegister && (
        <div className="modal-overlay" onClick={() => setShowRegister(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Register</h2>
            <form onSubmit={handleRegister}>
              <input
                type="text"
                placeholder="Username"
                value={registerData.username}
                onChange={(e) => setRegisterData({...registerData, username: e.target.value})}
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={registerData.email}
                onChange={(e) => setRegisterData({...registerData, email: e.target.value})}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={registerData.password}
                onChange={(e) => setRegisterData({...registerData, password: e.target.value})}
                required
              />
              <button type="submit" className="btn-primary">Register</button>
            </form>
          </div>
        </div>
      )}

      {/* Create Market Modal */}
      {showCreateMarket && (
        <div className="modal-overlay" onClick={() => setShowCreateMarket(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create Market</h2>
            <form onSubmit={handleCreateMarket}>
              <input
                type="text"
                placeholder="Question"
                value={newMarket.question}
                onChange={(e) => setNewMarket({...newMarket, question: e.target.value})}
                required
              />
              <select
                value={newMarket.type}
                onChange={(e) => setNewMarket({...newMarket, type: e.target.value})}
              >
                <option value="binary">Binary (Yes/No)</option>
                <option value="multiple">Multiple Choice</option>
              </select>
              <select
                value={newMarket.category_id}
                onChange={(e) => setNewMarket({...newMarket, category_id: parseInt(e.target.value)})}
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              <input
                type="datetime-local"
                value={newMarket.deadline}
                onChange={(e) => setNewMarket({...newMarket, deadline: e.target.value})}
                required
              />
              {newMarket.type === 'multiple' && (
                <div className="options-input">
                  {newMarket.options.map((option, index) => (
                    <input
                      key={index}
                      type="text"
                      placeholder={`Option ${index + 1}`}
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...newMarket.options];
                        newOptions[index] = e.target.value;
                        setNewMarket({...newMarket, options: newOptions});
                      }}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => setNewMarket({...newMarket, options: [...newMarket.options, '']})}
                    className="btn-secondary"
                  >
                    Add Option
                  </button>
                </div>
              )}
              <button type="submit" className="btn-primary">Create Market</button>
            </form>
          </div>
        </div>
      )}

      {/* Results Modal */}
      {selectedMarket && marketResults && (
        <div className="modal-overlay" onClick={closeResults}>
          <div className="modal results-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Results: {selectedMarket.question}</h2>
            <div className="results-content">
              <div className="results-column">
                <h3 className="winners-title">🎉 Winners ({marketResults.winners?.length || 0})</h3>
                <div className="results-list">
                  {marketResults.winners && marketResults.winners.length > 0 ? (
                    marketResults.winners.map((bet, index) => (
                      <div key={index} className="result-item winner">
                        <span className="username">
                          {user ? bet.username : bet.username.replace(/./g, '*')}
                        </span>
                        <span className="bet-info">
                          Bet: ${formatCurrency(bet.amount)} 
                          {bet.bet_type && ` on ${bet.bet_type}`}
                          {bet.option_name && ` on ${bet.option_name}`}
                        </span>
                        <span className="payout">+${formatCurrency(bet.payout)}</span>
                      </div>
                    ))
                  ) : (
                    <p>No winners</p>
                  )}
                </div>
              </div>
              <div className="results-column">
                <h3 className="losers-title">😔 Losers ({marketResults.losers?.length || 0})</h3>
                <div className="results-list">
                  {marketResults.losers && marketResults.losers.length > 0 ? (
                    marketResults.losers.map((bet, index) => (
                      <div key={index} className="result-item loser">
                        <span className="username">
                          {user ? bet.username : bet.username.replace(/./g, '*')}
                        </span>
                        <span className="bet-info">
                          Bet: ${formatCurrency(bet.amount)}
                          {bet.bet_type && ` on ${bet.bet_type}`}
                          {bet.option_name && ` on ${bet.option_name}`}
                        </span>
                        <span className="loss">-${formatCurrency(bet.amount)}</span>
                      </div>
                    ))
                  ) : (
                    <p>No losers</p>
                  )}
                </div>
              </div>
            </div>
            <button onClick={closeResults} className="btn-secondary">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
export default App;
