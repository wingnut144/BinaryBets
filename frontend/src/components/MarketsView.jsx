import MarketCard from './MarketCard';

function MarketsView({ loading, markets, getCategoryBadge, user, setShowAuthModal, setSelectedMarket, setShowBetModal, shareToSocial, showShareMenu, setShowShareMenu, token, loadMarkets }) {
  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center gap-3">
        <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
        Active Prediction Markets
      </h2>
      
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Loading markets...</p>
        </div>
      ) : markets.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-lg">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Markets Yet</h3>
          <p className="text-gray-600">Be the first to create a prediction market!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {markets.map(market => (
            <MarketCard
              key={market.id}
              market={market}
              category={getCategoryBadge(market.category_id)}
              user={user}
              onBet={(market) => {
                if (!user) {
                  setShowAuthModal(true);
                  return;
                }
                setSelectedMarket(market);
                setShowBetModal(true);
              }}
              onShare={shareToSocial}
              showShareMenu={showShareMenu}
              setShowShareMenu={setShowShareMenu}
              token={token}
              loadMarkets={loadMarkets}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default MarketsView;
