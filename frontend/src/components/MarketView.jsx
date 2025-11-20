import { useState, useEffect } from 'react';
import MarketsView from './MarketsView';
import BetModal from './BetModal';

const API_URL = 'https://api.binary-bets.com';

function MarketView({ token, user, refreshUser, requireAuth }) {
  const [markets, setMarkets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [showBetModal, setShowBetModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(null);

  useEffect(() => {
    loadMarkets();
    loadCategories();
  }, []);

  const loadMarkets = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/markets`);
      if (response.ok) {
        const data = await response.json();
        setMarkets(data);
      }
    } catch (error) {
      console.error('Error loading markets:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/api/categories`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const getCategoryBadge = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return { name: 'Unknown', icon: '❓', color: 'gray' };
    
    const colors = {
      Politics: 'blue',
      Sports: 'green',
      Technology: 'purple',
      Economics: 'yellow',
      Entertainment: 'pink',
      Science: 'indigo',
      Weather: 'cyan',
      Crypto: 'orange',
      Business: 'red',
      Other: 'gray'
    };
    
    return {
      name: category.name,
      icon: category.icon || '❓',
      color: colors[category.name] || 'gray'
    };
  };

  const shareToSocial = (platform, market) => {
    const url = `https://binary-bets.com`;
    const text = `Check out this prediction market: ${market.question}`;
    
    const shareUrls = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
    };
    
    if (shareUrls[platform]) {
      window.open(shareUrls[platform], '_blank', 'width=600,height=400');
    }
    
    setShowShareMenu(null);
  };

  return (
    <>
      <MarketsView
        loading={loading}
        markets={markets}
        getCategoryBadge={getCategoryBadge}
        user={user}
        setShowAuthModal={setShowAuthModal}
        setSelectedMarket={setSelectedMarket}
        setShowBetModal={setShowBetModal}
        shareToSocial={shareToSocial}
        showShareMenu={showShareMenu}
        setShowShareMenu={setShowShareMenu}
        token={token}
        loadMarkets={loadMarkets}
      />
      
      {showBetModal && selectedMarket && (
        <BetModal
          market={selectedMarket}
          onClose={() => {
            setShowBetModal(false);
            setSelectedMarket(null);
          }}
          token={token}
          user={user}
          refreshUser={refreshUser}
          loadMarkets={loadMarkets}
        />
      )}
    </>
  );
}

export default MarketView;
