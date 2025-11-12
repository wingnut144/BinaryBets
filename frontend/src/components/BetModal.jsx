function BetModal({ selectedMarket, setShowBetModal, betAmount, setBetAmount, selectedOption, setSelectedOption, placeBet }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Place Bet</h2>
          <button onClick={() => setShowBetModal(false)} className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-gray-700 mb-4">{selectedMarket.question}</p>

        <div className="space-y-3 mb-4">
          {selectedMarket.options && selectedMarket.options.map(option => (
            <button
              key={option.id}
              onClick={() => setSelectedOption(option)}
              className={`w-full p-4 rounded-lg border-2 transition-all ${
                selectedOption?.id === option.id
                  ? 'border-purple-600 bg-purple-50'
                  : 'border-gray-200 hover:border-purple-300'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-800">{option.name}</span>
                <span className="text-purple-600 font-bold">{parseFloat(option.odds || 1.0).toFixed(2)}x</span>
              </div>
            </button>
          ))}
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Bet Amount</label>
          <input
            type="number"
            min="1"
            step="0.01"
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
            placeholder="Enter amount"
          />
          {selectedOption && betAmount && (
            <p className="text-sm text-gray-600 mt-2">
              Potential payout: ${(parseFloat(betAmount) * parseFloat(selectedOption.odds || 1.0)).toFixed(2)}
            </p>
          )}
        </div>

        <button
          onClick={placeBet}
          disabled={!betAmount || !selectedOption}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Place Bet
        </button>
      </div>
    </div>
  );
}

export default BetModal;
