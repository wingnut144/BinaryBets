import { useState, useEffect } from 'react';

const API_URL = 'https://api.binary-bets.com';

function CreateMarketView({ token, onMarketCreated }) {
  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState([]);
  const [imageUrl, setImageUrl] = useState('');
  const [isMultiChoice, setIsMultiChoice] = useState(false);
  const [options, setOptions] = useState(['', '']);
  const [skipAiResolution, setSkipAiResolution] = useState(false);
  const [useAiOdds, setUseAiOdds] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

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

  const handleSubmit = async (e) => {
    e.preventDefault();

    const marketData = {
      question,
      description,
      deadline,
      category_id: categoryId || null,
      image_url: imageUrl || null,
      is_multi_choice: isMultiChoice,
      options: isMultiChoice ? options.filter(o => o.trim()) : ['Yes', 'No'],
      skip_ai_resolution: skipAiResolution,
      use_ai_odds: useAiOdds
    };

    try {
      const response = await fetch(`${API_URL}/api/markets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(marketData)
      });

      if (response.ok) {
        alert('Market created successfully!');
        setQuestion('');
        setDescription('');
        setDeadline('');
        setCategoryId('');
        setImageUrl('');
        setIsMultiChoice(false);
        setOptions(['', '']);
        setSkipAiResolution(false);
        setUseAiOdds(false);
        onMarketCreated();
      } else {
        const error = await response.json();
        alert(`Failed to create market: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating market:', error);
      alert('Failed to create market');
    }
  };

  const addOption = () => {
    setOptions([...options, '']);
  };

  const removeOption = (index) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const updateOption = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">📝 Create New Market</h2>
      
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-8 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Question *
          </label>
          <input
            type="text"
            required
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
            placeholder="Will Bitcoin reach $100,000 by 2025?"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
            rows="3"
            placeholder="Provide more details about this market..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Deadline *
          </label>
          <input
            type="datetime-local"
            required
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Category
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
          >
            <option value="">Select a category (optional)</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Image URL
          </label>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
            placeholder="https://example.com/image.jpg"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isMultiChoice"
            checked={isMultiChoice}
            onChange={(e) => setIsMultiChoice(e.target.checked)}
            className="w-4 h-4 text-purple-600 focus:ring-purple-600 rounded"
          />
          <label htmlFor="isMultiChoice" className="text-sm font-medium text-gray-700">
            Multi-choice market (more than Yes/No)
          </label>
        </div>

        {isMultiChoice && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Options
            </label>
            {options.map((option, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
                  placeholder={`Option ${index + 1}`}
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addOption}
              className="mt-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              + Add Option
            </button>
          </div>
        )}

        <div className="border-t pt-4">
          <div className="flex items-start gap-2 mb-3">
            <input
              type="checkbox"
              id="skipAiResolution"
              checked={skipAiResolution}
              onChange={(e) => setSkipAiResolution(e.target.checked)}
              className="w-4 h-4 mt-1 text-purple-600 focus:ring-purple-600 rounded"
            />
            <div>
              <label htmlFor="skipAiResolution" className="text-sm font-medium text-gray-700 cursor-pointer">
                🚫 Skip AI Resolution
              </label>
              <p className="text-xs text-gray-600 mt-1">
                Check this to prevent the AI from automatically resolving this market early. 
                You'll need to resolve it manually when the deadline arrives.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="useAiOdds"
              checked={useAiOdds}
              onChange={(e) => setUseAiOdds(e.target.checked)}
              className="w-4 h-4 mt-1 text-purple-600 focus:ring-purple-600 rounded"
            />
            <div>
              <label htmlFor="useAiOdds" className="text-sm font-medium text-gray-700 cursor-pointer">
                🤖 Use AI-Powered Initial Odds
              </label>
              <p className="text-xs text-gray-600 mt-1">
                Let AI analyze the market and set intelligent starting odds based on current information.
              </p>
            </div>
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
