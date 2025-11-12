function ClosedMarketsView({ loading, markets, getCategoryBadge }) {
  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center gap-3">
        🏁 Closed Markets
      </h2>
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-600 border-t-transparent"></div>
        </div>
      ) : markets.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-lg">
          <div className="text-6xl mb-4">🏁</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Closed Markets</h3>
          <p className="text-gray-600">Markets will appear here after they close.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {markets.map(market => {
            const category = getCategoryBadge(market.category_id);
            const hasWinner = market.outcome && market.outcome !== 'Unresolved';
            
            return (
              <div key={market.id} className="bg-white rounded-xl shadow-lg overflow-hidden opacity-75">
                <div className="p-4 bg-gradient-to-r from-gray-500 to-gray-600">
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-3 py-1 bg-white bg-opacity-90 rounded-full text-xs font-semibold text-gray-700">
                      {category.icon} {category.name}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500 text-white">
                      🏁 CLOSED
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white">{market.question}</h3>
                </div>

                <div className="p-4">
                  {hasWinner && (
                    <div className="bg-green-100 border-2 border-green-300 rounded-lg p-3 mb-4">
                      <div className="text-center">
                        <div className="text-sm text-green-800 font-semibold mb-1">Winner</div>
                        <div className="text-xl font-bold text-green-600">{market.outcome}</div>
                      </div>
                    </div>
                  )}
                  <div className="text-center text-gray-600 text-sm">
                    <p>Total Bets: {market.total_bets || 0}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ClosedMarketsView;
