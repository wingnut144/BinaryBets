import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.binary-bets.com';

function LeaderboardView({ user }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/leaderboard`);
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data);
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const blurUsername = (username) => {
    return username.charAt(0) + '•'.repeat(username.length - 1);
  };

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center gap-3">
        🏆 Leaderboard
      </h2>

      {!user && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-blue-800 text-sm">
            👋 <strong>Login to see full leaderboard!</strong> Usernames are blurred for visitors.
          </p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Loading leaderboard...</p>
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-lg">
          <div className="text-6xl mb-4">🏆</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Players Yet</h3>
          <p className="text-gray-600">Be the first to join!</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Rank</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">Player</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold">Balance</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold">Total Bets</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold">Winnings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leaderboard.map((player, index) => (
                  <tr key={player.id} className={index < 3 ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {index === 0 && <span className="text-2xl">🥇</span>}
                        {index === 1 && <span className="text-2xl">🥈</span>}
                        {index === 2 && <span className="text-2xl">🥉</span>}
                        <span className="font-semibold text-gray-700">#{index + 1}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-medium ${!user ? 'blur-sm select-none' : 'text-gray-800'}`}>
                        {user ? player.username : blurUsername(player.username)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-bold text-green-600">
                        ${player.balance.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">
                      {player.total_bets}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-semibold ${player.total_winnings > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                        ${player.total_winnings.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default LeaderboardView;
