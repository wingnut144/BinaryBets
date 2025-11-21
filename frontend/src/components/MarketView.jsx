import { useState, useEffect } from 'react';

const API_URL = 'https://api.binary-bets.com';

function MarketView({ token, user, selectedCategory, onSelectMarket }) {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMarkets();
    const interval = setInterval(fetchMarkets, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchMarkets = async () => {
    try {
      const response = await fetch(`${API_URL}/api/markets`);
      if (response.ok) {
        const data = await response.json();
        setMarkets(data);
      }
    } catch (error) {
      console.error('Error fetching markets:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter by selected category
  const filteredMarkets = selectedCategory 
    ? markets.filter(m => m.category_id === selectedCategory)
    : markets;

  if (loading) {
    return <div className="text-center py-8">Loading markets...</div>;
  }

  if (filteredMarkets.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 text-lg">
          {selectedCategory ? 'No markets in this category yet.' : 'No active bets at the moment. Be the first to create one!'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {filteredMarkets.map(market => (
        <div key={market.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              {market.category_icon && <span>{market.category_icon}</span>}
              <span className="text-xs text-purple-600 font-semibold">{market.category_name}</span>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">{market.question}</h3>
            {market.description && (
              <p className="text-sm text-gray-600">{market.description}</p>
            )}
          </div>
          
          <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
            <span>📅 {new Date(market.deadline).toLocaleDateString()}</span>
            <span className={`px-2 py-1 rounded ${
              market.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {market.status}
            </span>
          </div>

          <button
            onClick={() => onSelectMarket(market.id)}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-2 rounded-lg font-semibold hover:shadow-lg transition-all"
          >
            View Market
          </button>
        </div>
      ))}
    </div>
  );
}

export default MarketView;
