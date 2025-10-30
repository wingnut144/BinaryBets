import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.binary-bets.com';

function CreateMarket({ onMarketCreated }) {
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [formData, setFormData] = useState({
    question: '',
    category_id: '',
    subcategory_id: '',
    close_date: '',
    bet_type: 'binary',
    options: ['Yes', 'No'],
    ai_odds: null
  });
  const [generatingOdds, setGeneratingOdds] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (formData.category_id) {
      fetchSubcategories(formData.category_id);
    } else {
      setSubcategories([]);
    }
  }, [formData.category_id]);

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

  const handleGenerateOdds = async () => {
    if (!formData.question) {
      alert('Please enter a question first');
      return;
    }

    setGeneratingOdds(true);
    try {
      const response = await fetch(`${API_URL}/api/generate-odds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          question: formData.question,
          options: formData.options.filter(opt => opt.trim())
        })
      });

      const data = await response.json();

      if (response.ok) {
        setFormData({ ...formData, ai_odds: data });
      } else {
        alert(data.error || 'Failed to generate odds');
      }
    } catch (error) {
      console.error('Error generating odds:', error);
      alert('Failed to generate odds');
    } finally {
      setGeneratingOdds(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.question || !formData.close_date) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/markets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          question: formData.question,
          options: formData.options.filter(opt => opt.trim()),
          deadline: formData.close_date,
          category_id: formData.category_id || null,
          subcategory_id: formData.subcategory_id || null,
          ai_odds: formData.ai_odds
        })
      });

      const data = await response.json();

      if (response.ok) {
        alert('Bet created successfully!');
        setFormData({
          question: '',
          category_id: '',
          subcategory_id: '',
          close_date: '',
          bet_type: 'binary',
          options: ['Yes', 'No'],
          ai_odds: null
        });
        if (onMarketCreated) {
          onMarketCreated(data.market);
        }
      } else {
        alert(data.error || 'Failed to create bet');
      }
    } catch (error) {
      console.error('Error creating bet:', error);
      alert('Failed to create bet');
    }
  };

  return (
    <div className="create-market-container">
      <div className="create-market-content">
        <h2>Create New Bet</h2>

        <form onSubmit={handleSubmit} className="market-form">
          {/* Question */}
          <div className="form-group">
            <label htmlFor="question">Bet Question *</label>
            <input
              id="question"
              type="text"
              value={formData.question}
              onChange={(e) => setFormData({ ...formData, question: e.target.value })}
              placeholder="Will it rain tomorrow in New York?"
              required
            />
          </div>

          {/* Category */}
          <div className="form-group">
            <label htmlFor="category">Category (Optional)</label>
            <select
              id="category"
              value={formData.category_id}
              onChange={(e) => setFormData({ 
                ...formData, 
                category_id: e.target.value,
                subcategory_id: '' 
              })}
            >
              <option value="">Select a category...</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subcategory */}
          {subcategories.length > 0 && (
            <div className="form-group">
              <label htmlFor="subcategory">Subcategory (Optional)</label>
              <select
                id="subcategory"
                value={formData.subcategory_id}
                onChange={(e) => setFormData({ ...formData, subcategory_id: e.target.value })}
              >
                <option value="">Select a subcategory...</option>
                {subcategories.map(subcat => (
                  <option key={subcat.id} value={subcat.id}>
                    {subcat.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Deadline - DATE ONLY */}
          <div className="form-group">
            <label htmlFor="deadline">Deadline *</label>
            <input
              id="deadline"
              type="date"
              value={formData.close_date}
              onChange={(e) => setFormData({ ...formData, close_date: e.target.value })}
              min={new Date().toISOString().split('T')[0]}
              required
            />
          </div>

          {/* Bet Type Selector */}
          <div className="form-group">
            <label htmlFor="bet-type">Bet Type *</label>
            <select
              id="bet-type"
              value={formData.bet_type}
              onChange={(e) => {
                const newType = e.target.value;
                setFormData({ 
                  ...formData, 
                  bet_type: newType,
                  options: newType === 'binary' ? ['Yes', 'No'] : ['Option 1', 'Option 2', 'Option 3'],
                  ai_odds: null
                });
              }}
            >
              <option value="binary">Yes/No (Binary)</option>
              <option value="multiple">Multiple Choice</option>
            </select>
          </div>

          {/* Answer Options */}
          <div className="form-group">
            <label>Answer Options * (minimum 2)</label>
            <div className="options-list">
              {formData.options.map((option, index) => (
                <div key={index} className="option-row">
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...formData.options];
                      newOptions[index] = e.target.value;
                      setFormData({ ...formData, options: newOptions });
                    }}
                    placeholder={`Option ${index + 1}`}
                    disabled={formData.bet_type === 'binary'}
                    className={formData.bet_type === 'binary' ? 'option-input' : ''}
                    required
                  />
                  {formData.bet_type === 'multiple' && formData.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newOptions = formData.options.filter((_, i) => i !== index);
                        setFormData({ ...formData, options: newOptions });
                      }}
                      className="remove-option-btn"
                      title="Remove option"
                    >
                      ❌
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            {formData.bet_type === 'multiple' && formData.options.length < 10 && (
              <button
                type="button"
                onClick={() => {
                  setFormData({ 
                    ...formData, 
                    options: [...formData.options, `Option ${formData.options.length + 1}`] 
                  });
                }}
                className="button-secondary add-option-btn"
              >
                + Add Option
              </button>
            )}
            
            {formData.bet_type === 'binary' && (
              <p className="helper-text">Yes/No options are fixed for binary bets</p>
            )}
          </div>

          {/* AI Odds Preview */}
          {formData.ai_odds && (
            <div className="ai-odds-preview">
              <h3>
                <span>🎯</span>
                AI-Generated Probabilities
              </h3>
              <div className="odds-display">
                {Object.entries(formData.ai_odds.odds).map(([option, probability]) => (
                  <div key={option} className="odds-item">
                    <span className="option-name">{option}</span>
                    <span className="probability">{(probability * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
              <div className="odds-actions">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, ai_odds: null })}
                  className="reject-odds"
                >
                  <span>❌</span>
                  <span>Reject</span>
                </button>
                <button
                  type="button"
                  onClick={() => {}}
                  className="accept-odds"
                >
                  <span>✅</span>
                  <span>Use These Odds</span>
                </button>
              </div>
            </div>
          )}

          {/* AI Odds Button - MOVED RIGHT ABOVE SUBMIT */}
          <button
            type="button"
            onClick={handleGenerateOdds}
            disabled={generatingOdds || !formData.question}
            className="ai-odds-button"
          >
            {generatingOdds ? (
              <>
                <span className="loading"></span>
                <span className="text">Generating...</span>
              </>
            ) : (
              <>
                <span className="icon">🤖</span>
                <span className="text">Generate AI Odds</span>
              </>
            )}
          </button>

          {/* Submit Button - Changed from "Create Market" to "Create Bet" */}
          <button type="submit" className="button-primary btn-large">
            Create Bet
          </button>
        </form>

        {/* Tips Section */}
        <div className="tips-section">
          <h3>Tips for creating good bets:</h3>
          <ul>
            <li>Make your question clear and unambiguous</li>
            <li>Choose a reasonable deadline (not too far in the future)</li>
            <li>Provide distinct answer options</li>
            <li>Select a relevant category to help users find your bet</li>
            <li>Subcategories make your bet even easier to discover</li>
            <li>Use AI odds generation to get initial probability estimates</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default CreateMarket;
