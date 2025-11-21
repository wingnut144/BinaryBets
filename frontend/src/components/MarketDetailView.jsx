import { useState, useEffect } from 'react';

const API_URL = 'https://api.binary-bets.com';

function MarketDetailView({ marketId, token, user, onBack }) {
  const [market, setMarket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState(null);
  const [betAmount, setBetAmount] = useState('');

  useEffect(() => {
    fetchMarket();
  }, [marketId]);

  const fetchMarket = async () => {
    try {
      const response = await fetch(`${API_URL}/api/markets/${marketId}`);
      if (response.ok) {
        const data = await response.json();
        setMarket(data);
      }
    } catch (error) {
      console.error('Error fetching market:', error);
    } finally {
      setLoading(false);
    }
  };

  const placeBet = async () => {
    if (!selectedOption || !betAmount || parseFloat(betAmount) <= 0) {
      alert('Please select an option and enter a valid bet amount');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/bets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          market_id: marketId,
          option_id: selectedOption,
          amount: parseFloat(betAmount)
        })
      });

      if (response.ok) {
        alert('Bet placed successfully!');
        setBetAmount('');
        setSelectedOption(null);
        fetchMarket();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error placing bet:', error);
      alert('Failed to place bet');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading market...</div>;
  }

  if (!market) {
    return <div className="text-center py-8">Market not found</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="mb-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
      >
        ← Back to Markets
      </button>

      {/* Market Info */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="flex items-center gap-2 mb-2">
          {market.category_icon && <span className="text-2xl">{market.category_icon}</span>}
          <span className="text-purple-600 font-semibold">{market.category_name}</span>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-800 mb-4">{market.question}</h1>
        
        {market.description && (
          <p className="text-gray-600 mb-4">{market.description}</p>
        )}

        <div className="flex items-center gap-6 text-sm text-gray-500">
          <span>📅 Deadline: {new Date(market.deadline).toLocaleString()}</span>
          <span>👥 {market.total_bets} bets placed</span>
          <span className={`px-3 py-1 rounded-full ${
            market.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
          }`}>
            {market.status}
          </span>
        </div>
      </div>

      {/* Betting Interface */}
      {market.status === 'active' && user && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Place Your Bet</h2>
          
          <div className="space-y-4">
            {market.options.map(option => (
              <div
                key={option.id}
                onClick={() => setSelectedOption(option.id)}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedOption === option.id
                    ? 'border-purple-600 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 ${
                      selectedOption === option.id
                        ? 'border-purple-600 bg-purple-600'
                        : 'border-gray-300'
                    }`}>
                      {selectedOption === option.id && (
                        <div className="w-full h-full flex items-center justify-center text-white text-xs">✓</div>
                      )}
                    </div>
                    <span className="text-lg font-semibold">{option.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-purple-600">{option.odds.toFixed(2)}x</div>
                    <div className="text-sm text-gray-500">odds</div>
                  </div>
                </div>
              </div>
            ))}

            <div className="mt-6">
              <label className="block text-sm font-medium mb-2">Bet Amount (Points)</label>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full px-4 py-3 border rounded-lg text-lg"
                min="1"
                max={user.balance}
              />
              <p className="text-sm text-gray-500 mt-1">
                Your balance: {user.balance.toFixed(2)} points
              </p>
            </div>

            {selectedOption && betAmount && (
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span>Potential Win:</span>
                  <span className="font-bold text-purple-600">
                    {(parseFloat(betAmount) * market.options.find(o => o.id === selectedOption)?.odds || 0).toFixed(2)} points
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={placeBet}
              disabled={!selectedOption || !betAmount}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Place Bet
            </button>
          </div>
        </div>
      )}

      {!user && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-gray-700">Please log in to place bets</p>
        </div>
      )}

      {market.status !== 'active' && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-gray-700">This market is {market.status}</p>
        </div>
      )}
    </div>
  );
}

export default MarketDetailView;
