import ExcelJS from 'exceljs';
import { RequestHandler } from 'express';
import {
  getAllUsers,
  getUserWithPurchases,
  query,
  getAdminCredentials,
  verifyPassword,
  updateAdminPassword,
} from '../lib/db';
import crypto from 'crypto';

const adminSessions = new Map<string, { username: string; expiresAt: number }>();

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function validateSession(token: string): string | null {
  const session = adminSessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    adminSessions.delete(token);
    return null;
  }
  return session.username;
}

export const handleAdminLogin: RequestHandler = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    const admin = await getAdminCredentials(username);
    if (!admin || !verifyPassword(password, admin.password_hash)) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    const token = generateSessionToken();
    adminSessions.set(token, {
      username: admin.username,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });

    res.json({ success: true, token, username: admin.username });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const handleAdminChangePassword: RequestHandler = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const token = req.headers['x-admin-token'] as string;
    const username = validateSession(token);

    if (!username) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    const admin = await getAdminCredentials(username);
    if (!admin || !verifyPassword(currentPassword, admin.password_hash)) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    await updateAdminPassword(username, newPassword);
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const requireAdmin: RequestHandler = (req, res, next) => {
  const token = req.headers['x-admin-token'] as string;
  const username = validateSession(token);

  if (!username) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized - Invalid or expired session',
    });
  }

  next();
};

export const handleGetAllUsers: RequestHandler = async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const result = await query(`
      SELECT u.*,
        COALESCE(qs.quiz_count, 0) as quiz_count,
        COALESCE(p.purchase_count, 0) as purchase_count,
        COALESCE(p.total_spend, 0) as total_spend,
        COALESCE(dl.download_count, 0) as download_count
      FROM users u
      LEFT JOIN (
        SELECT user_email, COUNT(*) as quiz_count
        FROM quiz_submissions
        GROUP BY user_email
      ) qs ON u.email = qs.user_email
      LEFT JOIN (
        SELECT user_id, COUNT(*) as purchase_count, COALESCE(SUM(total_price), 0) as total_spend
        FROM purchases
        GROUP BY user_id
      ) p ON u.id = p.user_id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as download_count
        FROM downloads
        GROUP BY user_id
      ) dl ON u.id = dl.user_id
      ORDER BY u.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const countResult = await query('SELECT COUNT(*) as count FROM users');
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      users: result.rows,
      pagination: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit) },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const handleGetUserDetails: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;
    const userDetails = await getUserWithPurchases(parseInt(userId));

    if (!userDetails.user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const downloadsResult = await query(
      'SELECT * FROM downloads WHERE user_id = $1 ORDER BY created_at DESC',
      [parseInt(userId)]
    );

    res.json({
      success: true,
      user: userDetails.user,
      purchases: userDetails.purchases,
      latestQuiz: userDetails.latestQuiz,
      downloads: downloadsResult.rows,
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const handleAdminDashboard: RequestHandler = async (req, res) => {
  try {
    const usersResult = await query('SELECT COUNT(*) as count FROM users');
    const totalUsers = parseInt(usersResult.rows[0].count);

    const quizResult = await query('SELECT COUNT(*) as count FROM quiz_submissions');
    const totalQuizAttempts = parseInt(quizResult.rows[0].count);

    const quizResponsesResult = await query('SELECT COUNT(*) as count FROM quiz_responses');
    const totalQuizResponses = parseInt(quizResponsesResult.rows[0].count);

    const purchasesResult = await query('SELECT COUNT(*) as count FROM purchases');
    const totalPurchases = parseInt(purchasesResult.rows[0].count);

    const completedResult = await query(
      "SELECT COUNT(*) as count FROM purchases WHERE payment_status = 'completed'"
    );
    const completedPurchases = parseInt(completedResult.rows[0].count);

    const revenueResult = await query(
      "SELECT COALESCE(SUM(total_price), 0) as total FROM purchases WHERE payment_status = 'completed'"
    );
    const totalRevenue = parseFloat(revenueResult.rows[0].total) || 0;

    const downloadsResult = await query('SELECT COUNT(*) as count FROM downloads');
    const totalDownloads = parseInt(downloadsResult.rows[0].count);

    const emailResult = await query(
      "SELECT status, COUNT(*) as count FROM email_logs GROUP BY status"
    );
    const emailStats = emailResult.rows.reduce((acc: any, row: any) => {
      acc[row.status] = parseInt(row.count);
      return acc;
    }, {});

    const recentResult = await query(`
      SELECT 
        p.id, p.user_id, p.total_price, p.payment_status, p.created_at, p.plan_id,
        u.email, u.name
      FROM purchases p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      statistics: {
        totalUsers,
        totalQuizAttempts,
        totalQuizResponses,
        totalPurchases,
        completedPurchases,
        totalRevenue,
        totalDownloads,
        emailStats,
      },
      recentPurchases: recentResult.rows,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const handleGetAllPurchases: RequestHandler = async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const status = req.query.status as string;

    let queryStr = `
      SELECT p.*, u.email, u.name, u.phone
      FROM purchases p
      JOIN users u ON p.user_id = u.id
    `;
    const params: any[] = [];

    if (status) {
      queryStr += ` WHERE p.payment_status = $${params.length + 1}`;
      params.push(status);
    }

    queryStr += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(queryStr, params);

    let countQuery = 'SELECT COUNT(*) as count FROM purchases';
    const countParams: any[] = [];
    if (status) {
      countQuery += ' WHERE payment_status = $1';
      countParams.push(status);
    }
    const countResult = await query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      purchases: result.rows,
      pagination: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit) },
    });
  } catch (error) {
    console.error('Error fetching purchases:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const handleGetQuizResponses: RequestHandler = async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const result = await query(`
      SELECT 
        qs.id, qs.user_name, qs.user_email, qs.user_phone, qs.user_age, 
        qs.user_gender, qs.user_location, qs.analysis_id, qs.quiz_data,
        qs.ip_address, qs.created_at
      FROM quiz_submissions qs
      ORDER BY qs.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const countResult = await query('SELECT COUNT(*) as count FROM quiz_submissions');
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      quizResponses: result.rows,
      pagination: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit) },
    });
  } catch (error) {
    console.error('Error fetching quiz responses:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const handleGetDownloads: RequestHandler = async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const result = await query(`
      SELECT d.*, u.name as user_name, u.phone, u.age, u.location
      FROM downloads d
      LEFT JOIN users u ON d.user_id = u.id
      ORDER BY d.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const countResult = await query('SELECT COUNT(*) as count FROM downloads');
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      downloads: result.rows,
      pagination: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit) },
    });
  } catch (error) {
    console.error('Error fetching downloads:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const handleGetEmailLogs: RequestHandler = async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const result = await query(`
      SELECT el.*, u.name as user_name
      FROM email_logs el
      LEFT JOIN users u ON el.user_id = u.id
      ORDER BY el.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const countResult = await query('SELECT COUNT(*) as count FROM email_logs');
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      emailLogs: result.rows,
      pagination: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit) },
    });
  } catch (error) {
    console.error('Error fetching email logs:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const handleExportUsersCSV: RequestHandler = async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        u.id, u.email, u.name, u.age, u.gender, u.phone, u.location,
        COUNT(DISTINCT qr.id) as total_quizzes,
        COUNT(DISTINCT p.id) as total_purchases,
        COUNT(DISTINCT d.id) as total_downloads,
        u.created_at
      FROM users u
      LEFT JOIN quiz_responses qr ON u.id = qr.user_id
      LEFT JOIN purchases p ON u.id = p.user_id
      LEFT JOIN downloads d ON u.id = d.user_id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);

    const csv = [
      ['ID', 'Email', 'Name', 'Age', 'Gender', 'Phone', 'Location', 'Total Quizzes', 'Total Purchases', 'Total Downloads', 'Created At'],
      ...result.rows.map((row: any) => [
        row.id, row.email, row.name || '', row.age || '', row.gender || '',
        row.phone || '', row.location || '', row.total_quizzes || 0,
        row.total_purchases || 0, row.total_downloads || 0, row.created_at,
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="users-export.csv"');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting users:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const handleExportExcel: RequestHandler = async (req, res) => {
  try {
    const exportType = req.query.type as string || 'users';
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Data');

    let rows: any[] = [];
    let columns: any[] = [];
    let filename = 'export.xlsx';

    if (exportType === 'users') {
      const result = await query(`
        SELECT u.id, u.email, u.name, u.age, u.gender, u.phone, u.location,
          COUNT(DISTINCT qs.id) as quiz_attempts,
          COUNT(DISTINCT p.id) as purchases,
          COUNT(DISTINCT d.id) as downloads,
          u.created_at
        FROM users u
        LEFT JOIN quiz_submissions qs ON u.email = qs.user_email
        LEFT JOIN purchases p ON u.id = p.user_id
        LEFT JOIN downloads d ON u.id = d.user_id
        GROUP BY u.id ORDER BY u.created_at DESC
      `);
      columns = [
        { header: 'ID', key: 'id' },
        { header: 'Email', key: 'email' },
        { header: 'Name', key: 'name' },
        { header: 'Age', key: 'age' },
        { header: 'Gender', key: 'gender' },
        { header: 'Phone', key: 'phone' },
        { header: 'Location', key: 'location' },
        { header: 'Quiz Attempts', key: 'quiz_attempts' },
        { header: 'Purchases', key: 'purchases' },
        { header: 'Downloads', key: 'downloads' },
        { header: 'Registered', key: 'created_at' }
      ];
      rows = result.rows;
      filename = 'users-export.xlsx';
    } else if (exportType === 'purchases') {
      const result = await query(`
        SELECT p.id, u.name, u.email, u.phone, p.plan_id, p.total_price, p.payment_status, p.created_at, p.completed_at
        FROM purchases p JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC
      `);
      columns = [
        { header: 'ID', key: 'id' },
        { header: 'Name', key: 'name' },
        { header: 'Email', key: 'email' },
        { header: 'Phone', key: 'phone' },
        { header: 'Plan', key: 'plan_id' },
        { header: 'Price', key: 'total_price' },
        { header: 'Status', key: 'payment_status' },
        { header: 'Date', key: 'created_at' },
        { header: 'Completed', key: 'completed_at' }
      ];
      rows = result.rows;
      filename = 'purchases-export.xlsx';
    } else if (exportType === 'downloads') {
      const result = await query(`
        SELECT d.id, d.user_email, u.name as user_name, u.phone, d.product_name, d.plan_tier, d.email_sent, d.created_at, d.pdf_record_id
        FROM downloads d LEFT JOIN users u ON d.user_id = u.id ORDER BY d.created_at DESC
      `);
      columns = [
        { header: 'ID', key: 'id' },
        { header: 'Email', key: 'user_email' },
        { header: 'Name', key: 'user_name' },
        { header: 'Phone', key: 'phone' },
        { header: 'Product', key: 'product_name' },
        { header: 'Plan', key: 'plan_tier' },
        { header: 'Email Sent', key: 'email_sent' },
        { header: 'Date', key: 'created_at' },
        { header: 'PDF Link', key: 'pdf_link' }
      ];
      const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      rows = result.rows.map(r => ({
        ...r,
        email_sent: r.email_sent ? 'Yes' : 'No',
        pdf_link: r.pdf_record_id ? `${appUrl}/api/wellness/download-pdf/${r.pdf_record_id}` : 'N/A'
      }));
      filename = 'downloads-export.xlsx';
    } else if (exportType === 'traffic') {
      const result = await query(`
        SELECT id, ip_address, country, region, city, timezone, isp, page_visited, referrer, user_agent, created_at
        FROM visitor_tracking ORDER BY created_at DESC
      `);
      columns = [
        { header: 'ID', key: 'id' },
        { header: 'IP Address', key: 'ip_address' },
        { header: 'Country', key: 'country' },
        { header: 'Region', key: 'region' },
        { header: 'City', key: 'city' },
        { header: 'Timezone', key: 'timezone' },
        { header: 'ISP', key: 'isp' },
        { header: 'Page Visited', key: 'page_visited' },
        { header: 'Referrer', key: 'referrer' },
        { header: 'User Agent', key: 'user_agent' },
        { header: 'Date', key: 'created_at' }
      ];
      rows = result.rows;
      filename = 'traffic-export.xlsx';
    } else if (exportType === 'quiz') {
      const result = await query(`
        SELECT qs.id, qs.user_name, qs.user_email, qs.user_phone, qs.user_age, 
               qs.user_gender, qs.user_location, qs.analysis_id, qs.ip_address, qs.created_at
        FROM quiz_submissions qs ORDER BY qs.created_at DESC
      `);
      columns = [
        { header: 'ID', key: 'id' },
        { header: 'Name', key: 'user_name' },
        { header: 'Email', key: 'user_email' },
        { header: 'Phone', key: 'user_phone' },
        { header: 'Age', key: 'user_age' },
        { header: 'Gender', key: 'user_gender' },
        { header: 'Location', key: 'user_location' },
        { header: 'Analysis ID', key: 'analysis_id' },
        { header: 'IP Address', key: 'ip_address' },
        { header: 'Date', key: 'created_at' }
      ];
      rows = result.rows;
      filename = 'quiz-export.xlsx';
    }

    sheet.columns = columns;
    sheet.addRows(rows);

    // Style header
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting Excel:', error);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
};

const BOT_PATTERN = 'googlebot|bingbot|yandex|baidu|slurp|duckduckbot|facebookexternalhit|twitterbot|linkedinbot|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|bytespider|crawler|spider|bot';

export const handleGetTrafficData: RequestHandler = async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const result = await query(`
      SELECT id, ip_address, country, region, city, latitude, longitude, timezone, isp, page_visited, referrer, user_agent, created_at,
        CASE WHEN user_agent ~* '${BOT_PATTERN}' THEN true ELSE false END as is_bot
      FROM visitor_tracking
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const countResult = await query('SELECT COUNT(*) as count FROM visitor_tracking');
    const totalCount = parseInt(countResult.rows[0].count);

    const countryStats = await query(`
      SELECT country, COUNT(*) as visits
      FROM visitor_tracking
      WHERE country IS NOT NULL AND country != 'Unknown'
      GROUP BY country
      ORDER BY visits DESC
      LIMIT 20
    `);

    const cityStats = await query(`
      SELECT city, region, country, COUNT(*) as visits
      FROM visitor_tracking
      WHERE city IS NOT NULL AND city != 'Unknown'
      GROUP BY city, region, country
      ORDER BY visits DESC
      LIMIT 20
    `);

    const dailyStats = await query(`
      SELECT DATE(created_at) as date, COUNT(*) as visits
      FROM visitor_tracking
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    const uniqueVisitors = await query(`
      SELECT COUNT(DISTINCT ip_address) as count FROM visitor_tracking
    `);

    const todayVisitors = await query(`
      SELECT COUNT(*) as total, COUNT(DISTINCT ip_address) as unique_count
      FROM visitor_tracking
      WHERE DATE(created_at) = CURRENT_DATE
    `);

    const botResult = await query(`
      SELECT COUNT(*) as count FROM visitor_tracking
      WHERE user_agent ~* '${BOT_PATTERN}'
    `);
    const botVisits = parseInt(botResult.rows[0].count);

    res.json({
      success: true,
      visitors: result.rows,
      pagination: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit) },
      demographics: {
        totalVisits: totalCount,
        uniqueVisitors: parseInt(uniqueVisitors.rows[0].count),
        todayTotal: parseInt(todayVisitors.rows[0].total),
        todayUnique: parseInt(todayVisitors.rows[0].unique_count),
        botVisits,
        byCountry: countryStats.rows,
        byCity: cityStats.rows,
        daily: dailyStats.rows,
      },
    });
  } catch (error) {
    console.error('Error fetching traffic data:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const handleGetProducts: RequestHandler = async (req, res) => {
  try {
    const result = await query('SELECT * FROM managed_products ORDER BY sort_order ASC, created_at DESC');
    res.json({ success: true, products: result.rows });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const handleCreateProduct: RequestHandler = async (req, res) => {
  try {
    const { plan_id, name, description, details, price, original_price, color, icon, page_count, badge, popular, visible, sort_order } = req.body;

    if (!plan_id || !name) {
      return res.status(400).json({ success: false, message: 'plan_id and name are required' });
    }

    const result = await query(
      `INSERT INTO managed_products (plan_id, name, description, details, price, original_price, color, icon, page_count, badge, popular, visible, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [plan_id, name, description || null, JSON.stringify(details || []), price || 0, original_price || null, color || 'blue', icon || 'star', page_count || 10, badge || null, popular || false, visible !== false, sort_order || 0]
    );

    res.json({ success: true, product: result.rows[0] });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'A product with this plan_id already exists' });
    }
    console.error('Error creating product:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const handleUpdateProduct: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, details, price, original_price, color, icon, page_count, badge, popular, visible, sort_order } = req.body;

    const result = await query(
      `UPDATE managed_products SET
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        details = COALESCE($4, details),
        price = COALESCE($5, price),
        original_price = $6,
        color = COALESCE($7, color),
        icon = COALESCE($8, icon),
        page_count = COALESCE($9, page_count),
        badge = $10,
        popular = COALESCE($11, popular),
        visible = COALESCE($12, visible),
        sort_order = COALESCE($13, sort_order),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 RETURNING *`,
      [parseInt(id), name, description, details ? JSON.stringify(details) : null, price, original_price, color, icon, page_count, badge, popular, visible, sort_order]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, product: result.rows[0] });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const handleToggleProductVisibility: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE managed_products SET visible = NOT visible, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [parseInt(id)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, product: result.rows[0] });
  } catch (error) {
    console.error('Error toggling product visibility:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const handleResendDownloadEmail: RequestHandler = async (req, res) => {
  try {
    const { downloadId } = req.body;

    if (!downloadId) {
      return res.status(400).json({ success: false, message: 'Download ID is required' });
    }

    const downloadResult = await query(
      `SELECT d.*, u.name as user_name, u.id as uid
       FROM downloads d
       LEFT JOIN users u ON d.user_id = u.id
       WHERE d.id = $1`,
      [downloadId]
    );

    if (downloadResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Download record not found' });
    }

    const download = downloadResult.rows[0];
    const { sendConfirmationEmail } = await import('../lib/email-service');

    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const downloadLink = download.pdf_record_id
      ? `${appUrl}/api/wellness/download-pdf/${download.pdf_record_id}`
      : `${appUrl}/download`;

    const sent = await sendConfirmationEmail(
      download.uid || download.user_id || 0,
      download.user_email,
      download.user_name || 'User',
      download.product_name || 'Wellness Blueprint',
      downloadLink
    );

    if (sent) {
      await query('UPDATE downloads SET email_sent = true WHERE id = $1', [downloadId]);
      res.json({ success: true, message: `Email sent successfully to ${download.user_email}` });
    } else {
      res.status(500).json({ success: false, message: 'Email service not configured or failed to send. Check GMAIL_USER and GMAIL_APP_PASSWORD environment variables.' });
    }
  } catch (error) {
    console.error('Error resending download email:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const handleDeleteProduct: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM managed_products WHERE id = $1 RETURNING *', [parseInt(id)]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const handleGetPublicProducts: RequestHandler = async (req, res) => {
  try {
    const result = await query('SELECT * FROM managed_products WHERE visible = true ORDER BY sort_order ASC');
    res.json({ success: true, products: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const handleGetPublicAddons: RequestHandler = async (req, res) => {
  try {
    const result = await query('SELECT * FROM managed_addons WHERE visible = true ORDER BY sort_order ASC');
    res.json({ success: true, addons: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const handleGetAddons: RequestHandler = async (req, res) => {
  try {
    const result = await query('SELECT * FROM managed_addons ORDER BY sort_order ASC');
    res.json({ success: true, addons: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const handleCreateAddon: RequestHandler = async (req, res) => {
  try {
    const { addon_id, name, description, features, price, original_price, icon, page_count_addition, visible, sort_order } = req.body;
    if (!addon_id || !name) return res.status(400).json({ success: false, message: 'addon_id and name are required' });
    const priceNum = parseFloat(price);
    if (priceNum < 99 || priceNum > 399) return res.status(400).json({ success: false, message: 'Price must be between ₹99 and ₹399' });
    const result = await query(
      `INSERT INTO managed_addons (addon_id, name, description, features, price, original_price, icon, page_count_addition, visible, sort_order)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [addon_id, name, description || null, JSON.stringify(features || []), priceNum, original_price || null, icon || 'star', page_count_addition || 2, visible !== false, sort_order || 0]
    );
    res.json({ success: true, addon: result.rows[0] });
  } catch (error: any) {
    if (error.code === '23505') return res.status(409).json({ success: false, message: 'An add-on with this ID already exists' });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const handleUpdateAddon: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, features, price, original_price, icon, page_count_addition, visible, sort_order } = req.body;
    if (price !== undefined) {
      const priceNum = parseFloat(price);
      if (priceNum < 99 || priceNum > 399) return res.status(400).json({ success: false, message: 'Price must be between ₹99 and ₹399' });
    }
    const result = await query(
      `UPDATE managed_addons SET
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        features = COALESCE($4::jsonb, features),
        price = COALESCE($5, price),
        original_price = $6,
        icon = COALESCE($7, icon),
        page_count_addition = COALESCE($8, page_count_addition),
        visible = COALESCE($9, visible),
        sort_order = COALESCE($10, sort_order),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [parseInt(id), name, description, features ? JSON.stringify(features) : null, price ? parseFloat(price) : null, original_price, icon, page_count_addition, visible, sort_order]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Add-on not found' });
    res.json({ success: true, addon: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const handleDeleteAddon: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM managed_addons WHERE id = $1 RETURNING *', [parseInt(id)]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Add-on not found' });
    res.json({ success: true, message: 'Add-on deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const handleToggleAddonVisibility: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('UPDATE managed_addons SET visible = NOT visible, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *', [parseInt(id)]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Add-on not found' });
    res.json({ success: true, addon: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const handleGetPublicSettings: RequestHandler = async (req, res) => {
  try {
    const result = await query('SELECT setting_key, setting_value FROM site_settings ORDER BY id ASC');
    const settings: Record<string, string> = {};
    result.rows.forEach((r: any) => { settings[r.setting_key] = r.setting_value; });
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const handleGetSiteSettings: RequestHandler = async (req, res) => {
  try {
    const result = await query('SELECT * FROM site_settings ORDER BY id ASC');
    res.json({ success: true, settings: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const handleUpdateSiteSetting: RequestHandler = async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    if (value === undefined || value === null) return res.status(400).json({ success: false, message: 'value is required' });
    const result = await query(
      `INSERT INTO site_settings (setting_key, setting_value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2, updated_at = CURRENT_TIMESTAMP RETURNING *`,
      [key, String(value)]
    );
    res.json({ success: true, setting: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const handleBulkUpdateSiteSettings: RequestHandler = async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') return res.status(400).json({ success: false, message: 'settings object required' });
    for (const [key, value] of Object.entries(settings)) {
      await query(
        `INSERT INTO site_settings (setting_key, setting_value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2, updated_at = CURRENT_TIMESTAMP`,
        [key, String(value)]
      );
    }
    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
