import { useState, useEffect } from 'react';
import BetCard from './BetCard';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.binary-bets.com';

function MyBetsView({ token, user, setUser, loadMarkets }) {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingBet, setEditingBet] = useState(null);

  useEffect(() => {
    loadBets();
  }, []);

  const loadBets = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/bets/my-bets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setBets(data);
      }
    } catch (error) {
      console.error('Error loading bets:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-6">My Bets</h2>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Loading your bets...</p>
        </div>
      ) : bets.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-lg">
          <div className="text-6xl mb-4">🎲</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Bets Yet</h3>
          <p className="text-gray-600">Place your first bet to get started!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {bets.map(bet => (
            <BetCard 
              key={bet.id} 
              bet={bet} 
              token={token}
              user={user}
              setUser={setUser}
              loadBets={loadBets}
              loadMarkets={loadMarkets}
              editingBet={editingBet}
              setEditingBet={setEditingBet}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default MyBetsView;
