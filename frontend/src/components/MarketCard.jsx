import { useState } from 'react';
import ReportModal from './ReportModal';

function MarketCard({ market, category, user, onBet, onShare, showShareMenu, setShowShareMenu, token, loadMarkets }) {
  const deadline = new Date(market.deadline);
  const now = new Date();
  const isExpired = deadline < now;
  const timeUntil = isExpired ? 'Expired' : `Ends ${deadline.toLocaleDateString()}`;
  const [showReportModal, setShowReportModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    question: market.question,
    deadline: market.deadline.split('T')[0]
  });

  const isCreator = user && market.created_by === user.id;
  const isAdmin = user && user.is_admin;
  const hasBets = market.total_bets > 0;

  const handleShareClick = (e) => {
    e.stopPropagation();
    setShowShareMenu(showShareMenu === market.id ? null : market.id);
  };

  const handleSocialClick = (e, platform) => {
    e.stopPropagation();
    onShare(market, platform);
  };

  const handleEditMarket = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`https://api.binary-bets.com/api/markets/${market.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(editForm)
      });

      if (response.ok) {
        alert('Market updated successfully!');
        setShowEditModal(false);
        loadMarkets();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update market');
      }
    } catch (error) {
      console.error('Error updating market:', error);
      alert('Failed to update market');
    }
  };

  const handleDeleteMarket = async () => {
    if (!confirm(`Are you sure you want to delete "${market.question}"? All bets will be refunded.`)) {
      return;
    }

    try {
      const response = await fetch(`https://api.binary-bets.com/api/markets/${market.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.ok) {
        alert('Market deleted successfully! All bets have been refunded.');
        loadMarkets();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete market');
      }
    } catch (error) {
      console.error('Error deleting market:', error);
      alert('Failed to delete market');
    }
  };

  const betCount = parseInt(market.total_bets) || 0;
  const betText = betCount === 1 ? 'bet placed' : 'bets placed';

  return (
    <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all">
      <div className="p-4 bg-gradient-to-r from-purple-500 to-pink-500">
        <div className="flex items-center justify-between mb-2">
          <span className="px-3 py-1 bg-white bg-opacity-90 rounded-full text-xs font-semibold text-gray-700 flex items-center gap-1">
            {category.icon} {category.name}
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${isExpired ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
            {isExpired ? '🔴 CLOSED' : '🟢 LIVE'}
          </span>
        </div>
        <h3 className="text-lg font-bold text-white">{market.question}</h3>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
          <span>⏰ {timeUntil}</span>
          <span>👥 {betCount} {betText}</span>
        </div>

        {market.options && market.options.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <span>Betting Options & Odds</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {market.options.map(option => (
                <div key={option.id} className="bg-gradient-to-br from-purple-50 to-pink-50 p-3 rounded-lg border border-purple-200">
                  <div className="text-center">
                    <div className="font-semibold text-gray-800">{option.name}</div>
                    <div className="text-2xl font-bold text-purple-600 mt-1">
                      {parseFloat(option.odds || 1.0).toFixed(2)}x
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {option.bet_count || 0} {option.bet_count === 1 ? 'bet' : 'bets'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => onBet(market)}
            disabled={isExpired || !user}
            className="flex-1 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {!user ? 'Login to Bet' : isExpired ? 'Market Closed' : 'Place Bet'}
          </button>
          
          {isCreator && !isExpired && !hasBets && (
            <button
              onClick={() => setShowEditModal(true)}
              className="px-4 py-2 bg-blue-100 text-blue-600 rounded-lg font-semibold hover:bg-blue-200 transition-all"
              title="Edit market"
            >
              ✏️
            </button>
          )}

          {isAdmin && (
            <button
              onClick={handleDeleteMarket}
              className="px-4 py-2 bg-red-100 text-red-600 rounded-lg font-semibold hover:bg-red-200 transition-all"
              title="Delete market (admin)"
            >
              🗑️
            </button>
          )}
          
          {user && !isExpired && (
            <button
              onClick={() => setShowReportModal(true)}
              className="px-4 py-2 bg-orange-100 text-orange-600 rounded-lg font-semibold hover:bg-orange-200 transition-all"
              title="Report this market"
            >
              🚩
            </button>
          )}
          
          {!isExpired && (
            <div className="relative">
              <button onClick={handleShareClick} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all">
                Share
              </button>
              {showShareMenu === market.id && (
                <div className="absolute right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50 min-w-[160px]">
                  <button onClick={(e) => handleSocialClick(e, 'facebook')} className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm">
                    Facebook
                  </button>
                  <button onClick={(e) => handleSocialClick(e, 'x')} className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm">
                    X (Twitter)
                  </button>
                  <button onClick={(e) => handleSocialClick(e, 'bluesky')} className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm">
                    Bluesky
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Edit Market</h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleEditMarket} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Question</label>
                <input
                  type="text"
                  required
                  value={editForm.question}
                  onChange={(e) => setEditForm({...editForm, question: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Deadline</label>
                <input
                  type="date"
                  required
                  value={editForm.deadline}
                  onChange={(e) => setEditForm({...editForm, deadline: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800">
                  Note: You can only edit markets that have no bets yet.
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
              >
                Update Market
              </button>
            </form>
          </div>
        </div>
      )}

      {showReportModal && (
        <ReportModal marketId={market.id} setShowReportModal={setShowReportModal} token={token} loadMarkets={loadMarkets} />
      )}
    </div>
  );
}

export default MarketCard;
