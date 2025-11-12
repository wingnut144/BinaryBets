import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.binary-bets.com';

function BetCard({ bet, token, user, setUser, loadBets, loadMarkets, editingBet, setEditingBet }) {
  const [newAmount, setNewAmount] = useState(bet.amount);
  const [newOptionId, setNewOptionId] = useState(bet.option_id);
  const [marketOptions, setMarketOptions] = useState([]);
  
  const isActive = bet.market_status === 'active' && new Date(bet.market_deadline) > new Date();
  const canEdit = isActive && bet.edit_count < 2;
  const isExpired = new Date(bet.market_deadline) < new Date();

  useEffect(() => {
    if (editingBet === bet.id) {
      loadMarketOptions();
    }
  }, [editingBet]);

  const loadMarketOptions = async () => {
    try {
      const response = await fetch(`${API_URL}/api/markets`);
      const markets = await response.json();
      const market = markets.find(m => m.id === bet.market_id);
      if (market) {
        setMarketOptions(market.options);
      }
    } catch (error) {
      console.error('Error loading market options:', error);
    }
  };

  const handleEdit = async () => {
    try {
      const response = await fetch(`${API_URL}/api/bets/${bet.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          option_id: parseInt(newOptionId),
          amount: parseFloat(newAmount)
        })
      });

      if (response.ok) {
        const data = await response.json();
        setUser(prev => ({ ...prev, balance: data.newBalance }));
        alert('Bet updated successfully!');
        setEditingBet(null);
        loadBets();
        loadMarkets();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update bet');
      }
    } catch (error) {
      console.error('Error updating bet:', error);
      alert('Failed to update bet');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-800 mb-2">{bet.market_question}</h3>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              bet.market_status === 'active' && !isExpired
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {bet.market_status === 'active' && !isExpired ? '🟢 Active' : '🔴 Closed'}
            </span>
            <span>Edits: {bet.edit_count}/2</span>
            {isExpired && <span className="text-red-600">⚠️ Expired</span>}
          </div>
        </div>
      </div>

      {editingBet === bet.id ? (
        <div className="space-y-4 border-t pt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Option</label>
            <select
              value={newOptionId}
              onChange={(e) => setNewOptionId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
            >
              {marketOptions.map(option => (
                <option key={option.id} value={option.id}>
                  {option.name} - {parseFloat(option.odds).toFixed(2)}x odds
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Bet Amount</label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
            />
            <p className="text-xs text-gray-500 mt-1">
              Available balance: ${user.balance.toFixed(2)} + ${parseFloat(bet.amount).toFixed(2)} (current bet) = ${(parseFloat(user.balance) + parseFloat(bet.amount)).toFixed(2)}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleEdit}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
            >
              Save Changes
            </button>
            <button
              onClick={() => {
                setEditingBet(null);
                setNewAmount(bet.amount);
                setNewOptionId(bet.option_id);
              }}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="border-t pt-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-600">Your Choice</p>
              <p className="font-semibold text-gray-800">{bet.option_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Amount Bet</p>
              <p className="font-semibold text-purple-600">${parseFloat(bet.amount).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Current Odds</p>
              <p className="font-semibold text-blue-600">{parseFloat(bet.current_odds).toFixed(2)}x</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Potential Payout</p>
              <p className="font-semibold text-green-600">${parseFloat(bet.potential_payout).toFixed(2)}</p>
            </div>
          </div>

          {canEdit && (
            <button
              onClick={() => setEditingBet(bet.id)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all"
            >
              ✏️ Edit Bet ({2 - bet.edit_count} edit{2 - bet.edit_count !== 1 ? 's' : ''} remaining)
            </button>
          )}

          {!canEdit && isActive && (
            <p className="text-sm text-red-600 text-center">
              Maximum edits reached (2/2)
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default BetCard;
