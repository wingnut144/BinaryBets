import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.binary-bets.com';

const CategoryManagement = () => {
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Category form state
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    icon: '',
    color: '#3B82F6'
  });

  // Subcategory form state
  const [subcategoryForm, setSubcategoryForm] = useState({
    category_id: '',
    name: '',
    description: ''
  });

  const [editingCategory, setEditingCategory] = useState(null);
  const [editingSubcategory, setEditingSubcategory] = useState(null);

  // Fetch categories
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/api/categories`);
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  // Fetch subcategories for selected category
  const fetchSubcategories = async (categoryId) => {
    try {
      const response = await fetch(`${API_URL}/api/categories/${categoryId}`);
      const data = await response.json();
      setSubcategories(data.category?.subcategories || []);
    } catch (error) {
      console.error('Error fetching subcategories:', error);
    }
  };

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    fetchSubcategories(category.id);
    setSubcategoryForm({ ...subcategoryForm, category_id: category.id });
  };

  // Create/Update Category
  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const url = editingCategory 
        ? `${API_URL}/api/admin/categories/${editingCategory.id}`
        : `${API_URL}/api/admin/categories`;
      
      const response = await fetch(url, {
        method: editingCategory ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(categoryForm)
      });

      if (response.ok) {
        setMessage({ type: 'success', text: editingCategory ? 'Category updated!' : 'Category created!' });
        setCategoryForm({ name: '', description: '', icon: '', color: '#3B82F6' });
        setEditingCategory(null);
        fetchCategories();
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to save category' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Server error' });
    } finally {
      setLoading(false);
    }
  };

  // Create/Update Subcategory
  const handleSubcategorySubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const url = editingSubcategory 
        ? `${API_URL}/api/admin/subcategories/${editingSubcategory.id}`
        : `${API_URL}/api/admin/subcategories`;
      
      const response = await fetch(url, {
        method: editingSubcategory ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(subcategoryForm)
      });

      if (response.ok) {
        setMessage({ type: 'success', text: editingSubcategory ? 'Subcategory updated!' : 'Subcategory created!' });
        setSubcategoryForm({ category_id: selectedCategory?.id || '', name: '', description: '' });
        setEditingSubcategory(null);
        if (selectedCategory) fetchSubcategories(selectedCategory.id);
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to save subcategory' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Server error' });
    } finally {
      setLoading(false);
    }
  };

  // Delete Category
  const handleDeleteCategory = async (id) => {
    if (!confirm('Delete this category? This will also delete all subcategories and remove the category from markets.')) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/admin/categories/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Category deleted!' });
        fetchCategories();
        if (selectedCategory?.id === id) {
          setSelectedCategory(null);
          setSubcategories([]);
        }
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to delete category' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Server error' });
    }
  };

  // Delete Subcategory
  const handleDeleteSubcategory = async (id) => {
    if (!confirm('Delete this subcategory? This will remove it from all markets.')) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/admin/subcategories/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Subcategory deleted!' });
        if (selectedCategory) fetchSubcategories(selectedCategory.id);
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to delete subcategory' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Server error' });
    }
  };

  const startEditCategory = (category) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description || '',
      icon: category.icon || '',
      color: category.color || '#3B82F6'
    });
  };

  const startEditSubcategory = (subcategory) => {
    setEditingSubcategory(subcategory);
    setSubcategoryForm({
      category_id: selectedCategory?.id || '',
      name: subcategory.name,
      description: subcategory.description || ''
    });
  };

  const cancelEdit = () => {
    setEditingCategory(null);
    setEditingSubcategory(null);
    setCategoryForm({ name: '', description: '', icon: '', color: '#3B82F6' });
    setSubcategoryForm({ category_id: selectedCategory?.id || '', name: '', description: '' });
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Category Management</h1>

      {message.text && (
        <div className={`mb-4 p-4 rounded ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Categories Section */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">
              {editingCategory ? 'Edit Category' : 'Add New Category'}
            </h2>
            <form onSubmit={handleCategorySubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Icon (Emoji)</label>
                  <input
                    type="text"
                    value={categoryForm.icon}
                    onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="🏛️"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Color</label>
                  <input
                    type="color"
                    value={categoryForm.color}
                    onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                    className="w-full border rounded px-3 py-2 h-10"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {loading ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}
                </button>
                {editingCategory && (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="px-4 py-2 border rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">All Categories</h2>
            <div className="space-y-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className={`p-4 border rounded cursor-pointer hover:bg-gray-50 ${
                    selectedCategory?.id === category.id ? 'border-blue-500 bg-blue-50' : ''
                  }`}
                  onClick={() => handleCategorySelect(category)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{category.icon}</span>
                      <div>
                        <div className="font-semibold">{category.name}</div>
                        <div className="text-sm text-gray-500">{category.market_count || 0} markets</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditCategory(category);
                        }}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCategory(category.id);
                        }}
                        className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {category.description && (
                    <p className="text-sm text-gray-600 mt-2">{category.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Subcategories Section */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">
              {editingSubcategory ? 'Edit Subcategory' : 'Add Subcategory'}
            </h2>
            {selectedCategory ? (
              <form onSubmit={handleSubcategorySubmit} className="space-y-4">
                <div className="p-3 bg-blue-50 rounded">
                  <span className="text-sm text-gray-600">Adding to: </span>
                  <span className="font-semibold">{selectedCategory.icon} {selectedCategory.name}</span>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    value={subcategoryForm.name}
                    onChange={(e) => setSubcategoryForm({ ...subcategoryForm, name: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={subcategoryForm.description}
                    onChange={(e) => setSubcategoryForm({ ...subcategoryForm, description: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    rows={3}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
                  >
                    {loading ? 'Saving...' : editingSubcategory ? 'Update Subcategory' : 'Create Subcategory'}
                  </button>
                  {editingSubcategory && (
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="px-4 py-2 border rounded hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            ) : (
              <p className="text-gray-500 text-center py-8">
                ← Select a category to add subcategories
              </p>
            )}
          </div>

          {selectedCategory && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">
                Subcategories in {selectedCategory.icon} {selectedCategory.name}
              </h2>
              <div className="space-y-2">
                {subcategories.length > 0 ? (
                  subcategories.map((subcategory) => (
                    <div key={subcategory.id} className="p-4 border rounded">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">{subcategory.name}</div>
                          <div className="text-sm text-gray-500">{subcategory.market_count || 0} markets</div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEditSubcategory(subcategory)}
                            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteSubcategory(subcategory.id)}
                            className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      {subcategory.description && (
                        <p className="text-sm text-gray-600 mt-2">{subcategory.description}</p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">No subcategories yet</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CategoryManagement;
