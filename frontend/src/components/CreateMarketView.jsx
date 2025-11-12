function CreateMarketView({ createMarketForm, setCreateMarketForm, categories, handleCreateMarket, getMinDate, getMaxDate }) {
  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Create New Market</h2>
      <form onSubmit={handleCreateMarket} className="bg-white rounded-xl shadow-lg p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Question</label>
          <input
            type="text"
            required
            value={createMarketForm.question}
            onChange={(e) => setCreateMarketForm({...createMarketForm, question: e.target.value})}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            placeholder="Will X happen by Y date?"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
          <select
            required
            value={createMarketForm.category_id}
            onChange={(e) => setCreateMarketForm({...createMarketForm, category_id: e.target.value})}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
          >
            <option value="">Select a category</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Deadline Date
            <span className="text-xs text-gray-500 ml-2">(Market closes at end of this day)</span>
          </label>
          <input
            type="date"
            required
            min={getMinDate()}
            max={getMaxDate()}
            value={createMarketForm.deadline}
            onChange={(e) => setCreateMarketForm({...createMarketForm, deadline: e.target.value})}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
          {createMarketForm.options.map((option, index) => (
            <input
              key={index}
              type="text"
              required
              value={option}
              onChange={(e) => {
                const newOptions = [...createMarketForm.options];
                newOptions[index] = e.target.value;
                setCreateMarketForm({...createMarketForm, options: newOptions});
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent mb-2"
              placeholder={`Option ${index + 1}`}
            />
          ))}
          {createMarketForm.options.length < 6 && (
            <button
              type="button"
              onClick={() => setCreateMarketForm({...createMarketForm, options: [...createMarketForm.options, '']})}
              className="text-sm text-purple-600 hover:text-purple-700 font-medium"
            >
              + Add Option
            </button>
          )}
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <label className="block text-sm font-semibold text-gray-800 mb-3">
            Initial Odds Generation
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="oddsType"
                checked={!createMarketForm.useAiOdds}
                onChange={() => setCreateMarketForm({...createMarketForm, useAiOdds: false})}
                className="w-4 h-4 text-purple-600"
              />
              <div>
                <span className="text-sm font-medium text-gray-800">Equal Odds (50/50)</span>
                <p className="text-xs text-gray-600">All options start with equal probability</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="oddsType"
                checked={createMarketForm.useAiOdds}
                onChange={() => setCreateMarketForm({...createMarketForm, useAiOdds: true})}
                className="w-4 h-4 text-purple-600"
              />
              <div>
                <span className="text-sm font-medium text-gray-800">🤖 AI-Generated Odds</span>
                <p className="text-xs text-gray-600">AI analyzes the question to set initial probabilities</p>
              </div>
            </label>
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
        >
          Create Market
        </button>
      </form>
    </div>
  );
}

export default CreateMarketView;
