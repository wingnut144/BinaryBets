// CATEGORY API ENDPOINTS
// Add these to your server.js file after the existing endpoints

// Get all categories with subcategory counts
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.id,
        c.name,
        c.description,
        c.icon,
        COUNT(s.id) as subcategory_count,
        COUNT(m.id) as market_count
      FROM categories c
      LEFT JOIN subcategories s ON c.id = s.category_id
      LEFT JOIN markets m ON c.id = m.category_id AND m.status = 'active'
      GROUP BY c.id, c.name, c.description, c.icon
      ORDER BY c.name
    `);
    res.json({ categories: result.rows });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single category with its subcategories
app.get('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get category details
    const categoryResult = await pool.query(`
      SELECT 
        c.id,
        c.name,
        c.description,
        c.icon,
        COUNT(DISTINCT m.id) as market_count
      FROM categories c
      LEFT JOIN markets m ON c.id = m.category_id AND m.status = 'active'
      WHERE c.id = $1
      GROUP BY c.id, c.name, c.description, c.icon
    `, [id]);
    
    if (categoryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Get subcategories with market counts
    const subcategoriesResult = await pool.query(`
      SELECT 
        s.id,
        s.name,
        s.description,
        COUNT(m.id) as market_count
      FROM subcategories s
      LEFT JOIN markets m ON s.id = m.subcategory_id AND m.status = 'active'
      WHERE s.category_id = $1
      GROUP BY s.id, s.name, s.description
      ORDER BY s.name
    `, [id]);
    
    const category = categoryResult.rows[0];
    category.subcategories = subcategoriesResult.rows;
    
    res.json(category);
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all subcategories for a category
app.get('/api/categories/:categoryId/subcategories', async (req, res) => {
  try {
    const { categoryId } = req.params;
    
    const result = await pool.query(`
      SELECT 
        s.id,
        s.category_id,
        s.name,
        s.description,
        COUNT(m.id) as market_count
      FROM subcategories s
      LEFT JOIN markets m ON s.id = m.subcategory_id AND m.status = 'active'
      WHERE s.category_id = $1
      GROUP BY s.id, s.category_id, s.name, s.description
      ORDER BY s.name
    `, [categoryId]);
    
    res.json({ subcategories: result.rows });
  } catch (error) {
    console.error('Get subcategories error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get markets by category
app.get('/api/categories/:categoryId/markets', async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { subcategory_id } = req.query;
    
    let query = `
      SELECT 
        m.*,
        u.username as creator_username,
        c.name as category_name,
        sc.name as subcategory_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', mo.id,
              'option_text', mo.option_text,
              'total_amount', mo.total_amount
            )
            ORDER BY mo.id
          ) FILTER (WHERE mo.id IS NOT NULL),
          '[]'
        ) as options
      FROM markets m
      LEFT JOIN users u ON m.creator_id = u.id
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN subcategories sc ON m.subcategory_id = sc.id
      LEFT JOIN market_options mo ON m.id = mo.market_id
      WHERE m.category_id = $1
    `;
    
    const params = [categoryId];
    
    if (subcategory_id) {
      query += ' AND m.subcategory_id = $2';
      params.push(subcategory_id);
    }
    
    query += ' GROUP BY m.id, u.username, c.name, sc.name ORDER BY m.created_at DESC';
    
    const result = await pool.query(query, params);
    res.json({ markets: result.rows });
  } catch (error) {
    console.error('Get category markets error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get markets by subcategory
app.get('/api/subcategories/:subcategoryId/markets', async (req, res) => {
  try {
    const { subcategoryId } = req.params;
    
    const result = await pool.query(`
      SELECT 
        m.*,
        u.username as creator_username,
        c.name as category_name,
        sc.name as subcategory_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', mo.id,
              'option_text', mo.option_text,
              'total_amount', mo.total_amount
            )
            ORDER BY mo.id
          ) FILTER (WHERE mo.id IS NOT NULL),
          '[]'
        ) as options
      FROM markets m
      LEFT JOIN users u ON m.creator_id = u.id
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN subcategories sc ON m.subcategory_id = sc.id
      LEFT JOIN market_options mo ON m.id = mo.market_id
      WHERE m.subcategory_id = $1
      GROUP BY m.id, u.username, c.name, sc.name
      ORDER BY m.created_at DESC
    `, [subcategoryId]);
    
    res.json({ markets: result.rows });
  } catch (error) {
    console.error('Get subcategory markets error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update the existing GET /api/markets endpoint to support category filtering
// Replace or modify your existing app.get('/api/markets', ...) with this:
app.get('/api/markets', async (req, res) => {
  try {
    const { status, category_id, subcategory_id } = req.query;
    
    let query = `
      SELECT 
        m.*,
        u.username as creator_username,
        c.name as category_name,
        sc.name as subcategory_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', mo.id,
              'option_text', mo.option_text,
              'total_amount', mo.total_amount
            )
            ORDER BY mo.id
          ) FILTER (WHERE mo.id IS NOT NULL),
          '[]'
        ) as options
      FROM markets m
      LEFT JOIN users u ON m.creator_id = u.id
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN subcategories sc ON m.subcategory_id = sc.id
      LEFT JOIN market_options mo ON m.id = mo.market_id
    `;

    const conditions = [];
    const params = [];
    let paramCount = 1;
    
    if (status) {
      conditions.push(`m.status = $${paramCount}`);
      params.push(status);
      paramCount++;
    }
    
    if (category_id) {
      conditions.push(`m.category_id = $${paramCount}`);
      params.push(category_id);
      paramCount++;
    }
    
    if (subcategory_id) {
      conditions.push(`m.subcategory_id = $${paramCount}`);
      params.push(subcategory_id);
      paramCount++;
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' GROUP BY m.id, u.username, c.name, sc.name ORDER BY m.created_at DESC';

    const result = await pool.query(query, params);
    res.json({ markets: result.rows });
  } catch (error) {
    console.error('Get markets error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});
