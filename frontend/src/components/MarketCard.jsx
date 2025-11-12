import { useState } from 'react';
import ReportModal from './ReportModal';

function MarketCard({ market, category, user, onBet, onShare, showShareMenu, setShowShareMenu, token, loadMarkets }) {
  const deadline = new Date(market.deadline);
  const now = new Date();
  const isExpired = deadline < now;
  const timeUntil = isExpired ? 'Expired' : `Ends ${deadline.toLocaleDateString()}`;
  const [showReportModal, setShowReportModal] = useState(false);

  const handleShareClick = (e) => {
    e.stopPropagation();
    setShowShareMenu(showShareMenu === market.id ? null : market.id);
  };

  const handleSocialClick = (e, platform) => {
    e.stopPropagation();
    onShare(market, platform);
  };

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
          <span>👥 {market.total_bets || 0} bets</span>
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
          
          {user && !isExpired && (
            <button
              onClick={() => setShowReportModal(true)}
              className="px-4 py-2 bg-red-100 text-red-600 rounded-lg font-semibold hover:bg-red-200 transition-all"
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

      {showReportModal && (
        <ReportModal marketId={market.id} setShowReportModal={setShowReportModal} token={token} loadMarkets={loadMarkets} />
      )}
    </div>
  );
}

export default MarketCard;
