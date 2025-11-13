// Admin middleware
function requireAdmin(req, res, next) {
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// === BET REPORTS ===

// Report a bet
app.post('/api/bets/:id/report', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id: betId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ error: 'Please provide a detailed reason (at least 10 characters)' });
    }

    await client.query('BEGIN');

    // Check if bet exists
    const betCheck = await client.query(
      'SELECT * FROM bets WHERE id = $1',
      [betId]
    );

    if (betCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Bet not found' });
    }

    // Check if already reported by this user
    const existingReport = await client.query(
      'SELECT id FROM bet_reports WHERE bet_id = $1 AND reported_by = $2',
      [betId, userId]
    );

    if (existingReport.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You have already reported this bet' });
    }

    // Create report
    const reportResult = await client.query(
      `INSERT INTO bet_reports (bet_id, reported_by, reason, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [betId, userId, reason.trim()]
    );

    // Send automated message to user
    await client.query(
      `INSERT INTO messages (from_user_id, to_user_id, subject, message)
       VALUES (1, $1, 'Bet Report Received', $2)`,
      [
        userId,
        `Thank you for reporting bet #${betId}. Our moderation team will review your report shortly. You will be notified once action has been taken.

Report Reason: ${reason}

Reference ID: ${reportResult.rows[0].id}`
      ]
    );

    // Notify all admins
    const admins = await client.query('SELECT id FROM users WHERE is_admin = true');
    for (const admin of admins.rows) {
      await client.query(
        `INSERT INTO messages (from_user_id, to_user_id, subject, message)
         VALUES ($1, $2, 'New Bet Report', $3)`,
        [
          userId,
          admin.id,
          `A bet has been reported and requires review.

Bet ID: #${betId}
Reported by: User #${userId}
Reason: ${reason}

Please review this report in the admin dashboard.`
        ]
      );
    }

    await client.query('COMMIT');

    res.json({ 
      success: true, 
      message: 'Bet reported successfully. You will be notified once reviewed.',
      report: reportResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error reporting bet:', error);
    res.status(500).json({ error: 'Failed to report bet' });
  } finally {
    client.release();
  }
});

// Get all reports (admin only)
app.get('/api/admin/reports', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT 
        br.*,
        b.amount,
        b.potential_payout,
        m.question as market_question,
        o.name as option_name,
        u.username as reported_by_username,
        reviewer.username as reviewed_by_username
      FROM bet_reports br
      JOIN bets b ON br.bet_id = b.id
      JOIN users u ON br.reported_by = u.id
      LEFT JOIN users reviewer ON br.reviewed_by = reviewer.id
      JOIN options o ON b.option_id = o.id
      JOIN markets m ON b.market_id = m.id
    `;
    
    const params = [];
    if (status) {
      params.push(status);
      query += ` WHERE br.status = $1`;
    }
    
    query += ` ORDER BY br.created_at DESC`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Review report (admin only)
app.post('/api/admin/reports/:id/review', authenticateToken, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id: reportId } = req.params;
    const { action, admin_notes } = req.body; // action: 'approve' or 'dismiss'
    const adminId = req.user.id;

    await client.query('BEGIN');

    const reportResult = await client.query(
      'SELECT * FROM bet_reports WHERE id = $1',
      [reportId]
    );

    if (reportResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = reportResult.rows[0];

    if (action === 'approve') {
      // Delete the bet
      await client.query('DELETE FROM bets WHERE id = $1', [report.bet_id]);
      
      // Update report status
      await client.query(
        `UPDATE bet_reports 
         SET status = 'reviewed', reviewed_by = $1, reviewed_at = NOW(), admin_notes = $2
         WHERE id = $3`,
        [adminId, admin_notes, reportId]
      );

      // Notify reporter
      await client.query(
        `INSERT INTO messages (from_user_id, to_user_id, subject, message)
         VALUES (1, $1, 'Report Resolved - Action Taken', $2)`,
        [
          report.reported_by,
          `Your report (ID: ${reportId}) has been reviewed and the bet has been removed.

Admin notes: ${admin_notes || 'No additional notes'}

Thank you for helping keep Binary Bets fair and safe!`
        ]
      );
    } else {
      // Dismiss report
      await client.query(
        `UPDATE bet_reports 
         SET status = 'dismissed', reviewed_by = $1, reviewed_at = NOW(), admin_notes = $2
         WHERE id = $3`,
        [adminId, admin_notes, reportId]
      );

      // Notify reporter
      await client.query(
        `INSERT INTO messages (from_user_id, to_user_id, subject, message)
         VALUES (1, $1, 'Report Resolved - No Action Taken', $2)`,
        [
          report.reported_by,
          `Your report (ID: ${reportId}) has been reviewed. After investigation, no action was taken.

Admin notes: ${admin_notes || 'The reported content did not violate our policies.'}

If you have additional concerns, please submit a new report with more details.`
        ]
      );
    }

    await client.query('COMMIT');

    res.json({ success: true, message: 'Report reviewed successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error reviewing report:', error);
    res.status(500).json({ error: 'Failed to review report' });
  } finally {
    client.release();
  }
});

// === ANNOUNCEMENTS ===

// Get active announcements
app.get('/api/announcements', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, u.username as created_by_username
       FROM announcements a
       JOIN users u ON a.created_by = u.id
       WHERE a.is_active = true 
       AND (a.expires_at IS NULL OR a.expires_at > NOW())
       ORDER BY a.created_at DESC
       LIMIT 10`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// Create announcement (admin only)
app.post('/api/admin/announcements', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title, message, expires_at } = req.body;
    const adminId = req.user.id;

    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message required' });
    }

    const result = await pool.query(
      `INSERT INTO announcements (title, message, created_by, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [title, message, adminId, expires_at || null]
    );

    res.json({ success: true, announcement: result.rows[0] });
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

// Delete announcement (admin only)
app.delete('/api/admin/announcements/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query(
      'UPDATE announcements SET is_active = false WHERE id = $1',
      [id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

// === MESSAGES ===

// Get user's messages
app.get('/api/messages', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { type } = req.query; // 'inbox' or 'sent'

    let query;
    if (type === 'sent') {
      query = `
        SELECT m.*, 
               to_user.username as to_username,
               from_user.username as from_username
        FROM messages m
        JOIN users to_user ON m.to_user_id = to_user.id
        JOIN users from_user ON m.from_user_id = from_user.id
        WHERE m.from_user_id = $1
        ORDER BY m.created_at DESC
      `;
    } else {
      query = `
        SELECT m.*, 
               to_user.username as to_username,
               from_user.username as from_username
        FROM messages m
        JOIN users to_user ON m.to_user_id = to_user.id
        JOIN users from_user ON m.from_user_id = from_user.id
        WHERE m.to_user_id = $1
        ORDER BY m.is_read ASC, m.created_at DESC
      `;
    }

    const result = await pool.query(query, [userId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Get unread message count
app.get('/api/messages/unread-count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM messages WHERE to_user_id = $1 AND is_read = false',
      [userId]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// Send message
app.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    const { to_user_id, subject, message, parent_message_id } = req.body;
    const fromUserId = req.user.id;

    if (!to_user_id || !message) {
      return res.status(400).json({ error: 'Recipient and message required' });
    }

    // Check if recipient exists
    const userCheck = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [to_user_id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    const result = await pool.query(
      `INSERT INTO messages (from_user_id, to_user_id, subject, message, parent_message_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [fromUserId, to_user_id, subject, message, parent_message_id || null]
    );

    res.json({ success: true, message: result.rows[0] });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Mark message as read
app.post('/api/messages/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await pool.query(
      'UPDATE messages SET is_read = true WHERE id = $1 AND to_user_id = $2',
      [id, userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

// Get all admins (for messaging)
app.get('/api/admins', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username FROM users WHERE is_admin = true ORDER BY username'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
});

