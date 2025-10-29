import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.binary-bets.com';

const CreateMarket = ({ onMarketCreated }) => {
  const [question, setQuestion] = useState('');
  const [deadline, setDeadline] = useState('');
  const [options, setOptions] = useState(['Yes', 'No']);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // AI Odds Generation
  const [generatingOdds, setGeneratingOdds] = useState(false);
  const [aiOdds, setAiOdds] = useState(null);
  const [showOddsPreview, setShowOddsPreview] = useState(false);

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
  }, []);

  // Fetch subcategories when category changes
  useEffect(() => {
    if (selectedCategory) {
      fetchSubcategories(selectedCategory);
    } else {
      setSubcategories([]);
      setSelectedSubcategory('');
    }
  }, [selectedCategory]);

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/api/categories`);
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchSubcategories = async (categoryId) => {
    try {
      const response = await fetch(`${API_URL}/api/categories/${categoryId}`);
      const data = await response.json();
      setSubcategories(data.category?.subcategories || []);
    } catch (error) {
      console.error('Error fetching subcategories:', error);
    }
  };

  const handleAddOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  // AI Odds Generation
  const handleGenerateOdds = async () => {
    if (!question.trim()) {
      setError('Please enter a question first');
      return;
    }

    const validOptions = options.filter(opt => opt.trim());
    if (validOptions.length < 2) {
      setError('Please provide at least 2 options');
      return;
    }

    setGeneratingOdds(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/generate-odds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          question: question.trim(),
          options: validOptions
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate odds');
      }

      setAiOdds(data.odds);
      setShowOddsPreview(true);
    } catch (error) {
      console.error('Error generating odds:', error);
      setError(error.message || 'Failed to generate AI odds. Please try again.');
    } finally {
      setGeneratingOdds(false);
    }
  };

  const handleAcceptOdds = () => {
    // Odds accepted, they'll be included in the submission
    setShowOddsPreview(false);
  };

  const handleRejectOdds = () => {
    // User rejected AI odds
    setAiOdds(null);
    setShowOddsPreview(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate
    if (!question.trim()) {
      setError('Please enter a question');
      setLoading(false);
      return;
    }

    if (!deadline) {
      setError('Please select a deadline');
      setLoading(false);
      return;
    }

    const validOptions = options.filter(opt => opt.trim());
    if (validOptions.length < 2) {
      setError('Please provide at least 2 options');
      setLoading(false);
      return;
    }

    if (new Date(deadline) <= new Date()) {
      setError('Deadline must be in the future');
      setLoading(false);
      return;
    }

    try {
      const marketData = {
        question: question.trim(),
        options: validOptions,
        close_date: deadline,
        category_id: selectedCategory || null,
        subcategory_id: selectedSubcategory || null,
        ai_odds: aiOdds // Include AI odds if generated
      };

      const response = await fetch(`${API_URL}/api/markets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(marketData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create market');
      }

      // Reset form
      setQuestion('');
      setDeadline('');
      setOptions(['Yes', 'No']);
      setSelectedCategory('');
      setSelectedSubcategory('');
      setAiOdds(null);
      setShowOddsPreview(false);

      if (onMarketCreated) {
        onMarketCreated(data.market);
      }

      alert('Market created successfully!');
    } catch (error) {
      console.error('Error creating market:', error);
      setError(error.message || 'Failed to create market');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-market-container">
      <h2>Create New Market</h2>
      
      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} className="create-market-form">
        {/* Question Field */}
        <div className="form-group">
          <label htmlFor="question">Market Question *</label>
          <input
            type="text"
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Will it rain tomorrow in New York?"
            required
          />
        </div>

        {/* AI Odds Generation Button */}
        <div className="form-group">
          <button
            type="button"
            onClick={handleGenerateOdds}
            disabled={generatingOdds || !question.trim()}
            className="ai-odds-button"
          >
            {generatingOdds ? '🤖 Generating AI Odds...' : '🤖 Generate AI Odds'}
          </button>
        </div>

        {/* AI Odds Preview */}
        {showOddsPreview && aiOdds && (
          <div className="ai-odds-preview">
            <h3>🤖 AI Predicted Odds:</h3>
            <div className="odds-display">
              {Object.entries(aiOdds).map(([option, probability]) => (
                <div key={option} className="odds-item">
                  <span className="option-name">{option}:</span>
                  <span className="probability">{(probability * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
            <div className="odds-actions">
              <button type="button" onClick={handleAcceptOdds} className="accept-odds">
                ✓ Accept Odds
              </button>
              <button type="button" onClick={handleRejectOdds} className="reject-odds">
                ✗ Reject Odds
              </button>
            </div>
          </div>
        )}

        {/* Category Selection */}
        <div className="form-group">
          <label htmlFor="category">Category (Optional)</label>
          <select
            id="category"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">No Category</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Subcategory Selection */}
        {selectedCategory && subcategories.length > 0 && (
          <div className="form-group">
            <label htmlFor="subcategory">Subcategory (Optional)</label>
            <select
              id="subcategory"
              value={selectedSubcategory}
              onChange={(e) => setSelectedSubcategory(e.target.value)}
            >
              <option value="">No Subcategory</option>
              {subcategories.map(sub => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Deadline */}
        <div className="form-group">
          <label htmlFor="deadline">Deadline *</label>
          <input
            type="datetime-local"
            id="deadline"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            required
          />
        </div>

        {/* Answer Options */}
        <div className="form-group">
          <label>Answer Options * (minimum 2)</label>
          {options.map((option, index) => (
            <div key={index} className="option-input-group">
              <input
                type="text"
                value={option}
                onChange={(e) => handleOptionChange(index, e.target.value)}
                placeholder={`Option ${index + 1}`}
                required
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => handleRemoveOption(index)}
                  className="remove-option"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {options.length < 10 && (
            <button
              type="button"
              onClick={handleAddOption}
              className="add-option"
            >
              + Add Option
            </button>
          )}
        </div>

        {/* Submit Button */}
        <button type="submit" disabled={loading} className="submit-button">
          {loading ? 'Creating Market...' : 'Create Market'}
        </button>
      </form>

      {/* Tips Section */}
      <div className="tips-section">
        <h3>Tips for creating good markets:</h3>
        <ul>
          <li>Make your question clear and unambiguous</li>
          <li>Choose a reasonable deadline (not too far in the future)</li>
          <li>Provide distinct answer options</li>
          <li>Select a relevant category to help users find your market</li>
          <li>Subcategories make your market even easier to discover</li>
          <li>Use AI odds generation to get initial probability estimates</li>
        </ul>
      </div>
    </div>
  );
};

export default CreateMarket;
