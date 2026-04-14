import { RequestHandler } from "express";
import crypto from "crypto";
import { query } from "../lib/db";
import nodemailer from "nodemailer";

function hash(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function uid(prefix = "") {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function trialExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + 45);
  return d.toISOString();
}

function quizPath(token: string) {
  return `/quiz?b2b=${token}`;
}

function getMailTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
}

export async function initB2BTables() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS b2b_clients (
        id VARCHAR(50) PRIMARY KEY,
        business_name VARCHAR(255) NOT NULL,
        contact_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        phone VARCHAR(50) DEFAULT '',
        password_hash VARCHAR(255) NOT NULL,
        plan VARCHAR(20) NOT NULL DEFAULT 'trial',
        trial_expires_at TIMESTAMP NOT NULL,
        reports_generated INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS b2b_tokens (
        token VARCHAR(100) PRIMARY KEY,
        client_id VARCHAR(50) NOT NULL REFERENCES b2b_clients(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS b2b_links (
        token VARCHAR(100) PRIMARY KEY,
        client_id VARCHAR(50) NOT NULL REFERENCES b2b_clients(id) ON DELETE CASCADE,
        label VARCHAR(255) DEFAULT 'Guest User',
        recipient_email VARCHAR(255) DEFAULT '',
        is_used BOOLEAN DEFAULT FALSE,
        analysis_id VARCHAR(255),
        report_tier VARCHAR(50) DEFAULT 'premium',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        used_at TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS b2b_quiz_submissions (
        id SERIAL PRIMARY KEY,
        client_id VARCHAR(50) NOT NULL REFERENCES b2b_clients(id) ON DELETE CASCADE,
        link_token VARCHAR(100) REFERENCES b2b_links(token) ON DELETE SET NULL,
        analysis_id VARCHAR(255),
        user_name VARCHAR(255),
        user_email VARCHAR(255),
        user_phone VARCHAR(50),
        user_age INT,
        user_gender VARCHAR(50),
        user_location VARCHAR(255),
        quiz_data JSONB,
        ip_address VARCHAR(50),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS b2b_reminder_log (
        id SERIAL PRIMARY KEY,
        client_id VARCHAR(50) NOT NULL REFERENCES b2b_clients(id) ON DELETE CASCADE,
        reminder_type VARCHAR(50) NOT NULL,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_b2b_quiz_sub_client ON b2b_quiz_submissions(client_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_b2b_quiz_sub_link ON b2b_quiz_submissions(link_token)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_b2b_reminder_client ON b2b_reminder_log(client_id, reminder_type)`);
  } catch (err) {
    console.error("B2B tables init error:", err);
  }
}

export const requireB2BAuth: RequestHandler = async (req: any, res, next) => {
  const auth = req.headers["authorization"] || "";
  const token = auth.replace("Bearer ", "").trim();
  if (!token) return res.status(401).json({ success: false, message: "Unauthorized" });
  try {
    const result = await query("SELECT client_id FROM b2b_tokens WHERE token = $1", [token]);
    if (result.rows.length === 0) return res.status(401).json({ success: false, message: "Unauthorized" });
    req.b2bClientId = result.rows[0].client_id;
    next();
  } catch {
    return res.status(500).json({ success: false, message: "Auth check failed" });
  }
};

export const b2bRegister: RequestHandler = async (req, res) => {
  const { businessName, contactName, email, phone, password } = req.body;
  if (!email || !password || !businessName || !contactName)
    return res.status(400).json({ success: false, message: "All fields required" });

  try {
    const existing = await query("SELECT id FROM b2b_clients WHERE email = $1", [email]);
    if (existing.rows.length > 0)
      return res.status(409).json({ success: false, message: "Email already registered" });

    const id = uid("b2b_");
    const passwordHash = hash(password);
    const expiresAt = trialExpiry();

    await query(
      `INSERT INTO b2b_clients (id, business_name, contact_name, email, phone, password_hash, plan, trial_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'trial', $7)`,
      [id, businessName, contactName, email, phone || "", passwordHash, expiresAt]
    );

    const token = uid("tok_");
    await query("INSERT INTO b2b_tokens (token, client_id) VALUES ($1, $2)", [token, id]);

    res.status(201).json({
      success: true,
      client: { id, businessName, contactName, email, phone: phone || "", plan: "trial", trialExpiresAt: expiresAt, reportsGenerated: 0 },
      token,
    });
  } catch (err: any) {
    console.error("B2B register error:", err);
    res.status(500).json({ success: false, message: "Registration failed" });
  }
};

export const b2bLogin: RequestHandler = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, message: "Email and password required" });

  try {
    const result = await query("SELECT * FROM b2b_clients WHERE email = $1", [email]);
    if (result.rows.length === 0 || result.rows[0].password_hash !== hash(password))
      return res.status(401).json({ success: false, message: "Invalid credentials" });

    const client = result.rows[0];
    const token = uid("tok_");
    await query("INSERT INTO b2b_tokens (token, client_id) VALUES ($1, $2)", [token, client.id]);

    res.json({
      success: true,
      client: {
        id: client.id, businessName: client.business_name, contactName: client.contact_name,
        email: client.email, phone: client.phone, plan: client.plan,
        trialExpiresAt: client.trial_expires_at, reportsGenerated: client.reports_generated,
      },
      token,
    });
  } catch (err: any) {
    console.error("B2B login error:", err);
    res.status(500).json({ success: false, message: "Login failed" });
  }
};

export const b2bMe: RequestHandler = async (req: any, res) => {
  try {
    const result = await query("SELECT * FROM b2b_clients WHERE id = $1", [req.b2bClientId]);
    if (result.rows.length === 0) return res.status(404).json({ success: false });
    const c = result.rows[0];
    res.json({
      success: true,
      client: {
        id: c.id, businessName: c.business_name, contactName: c.contact_name,
        email: c.email, phone: c.phone, plan: c.plan,
        trialExpiresAt: c.trial_expires_at, reportsGenerated: c.reports_generated,
      },
    });
  } catch {
    res.status(500).json({ success: false });
  }
};

export const b2bCreateLink: RequestHandler = async (req: any, res) => {
  try {
    const clientResult = await query("SELECT * FROM b2b_clients WHERE id = $1", [req.b2bClientId]);
    if (clientResult.rows.length === 0) return res.status(404).json({ success: false });
    const client = clientResult.rows[0];

    if (client.plan === "trial" && new Date(client.trial_expires_at) < new Date())
      return res.status(403).json({ success: false, message: "Trial expired. Please upgrade to continue." });

    const { label = "Guest User", recipientEmail = "" } = req.body;
    const token = uid("qlnk_");

    await query(
      `INSERT INTO b2b_links (token, client_id, label, recipient_email) VALUES ($1, $2, $3, $4)`,
      [token, client.id, label, recipientEmail]
    );

    const quizUrl = quizPath(token);
    res.json({
      success: true,
      link: { token, clientId: client.id, label, recipientEmail, isUsed: false, analysisId: null, reportTier: "premium", quizUrl },
    });
  } catch (err: any) {
    console.error("B2B create link error:", err);
    res.status(500).json({ success: false, message: "Failed to create link" });
  }
};

export const b2bGetLinks: RequestHandler = async (req: any, res) => {
  try {
    const result = await query(
      "SELECT * FROM b2b_links WHERE client_id = $1 ORDER BY created_at DESC",
      [req.b2bClientId]
    );
    const links = result.rows.map((l: any) => ({
      token: l.token, clientId: l.client_id, label: l.label,
      recipientEmail: l.recipient_email, isUsed: l.is_used,
      analysisId: l.analysis_id, reportTier: l.report_tier,
      createdAt: l.created_at, usedAt: l.used_at,
      quizUrl: quizPath(l.token),
    }));
    res.json({ success: true, links });
  } catch {
    res.status(500).json({ success: false });
  }
};

export const b2bValidateToken: RequestHandler = async (req, res) => {
  const { token } = req.params;
  try {
    const linkResult = await query("SELECT * FROM b2b_links WHERE token = $1", [token]);
    if (linkResult.rows.length === 0) return res.status(404).json({ success: false, message: "Invalid link" });
    const link = linkResult.rows[0];

    const clientResult = await query("SELECT * FROM b2b_clients WHERE id = $1", [link.client_id]);
    if (clientResult.rows.length === 0) return res.status(404).json({ success: false });
    const client = clientResult.rows[0];

    if (client.plan === "trial" && new Date(client.trial_expires_at) < new Date())
      return res.status(403).json({ success: false, message: "This link has expired." });

    res.json({
      success: true,
      tier: "premium",
      label: link.label,
      recipientEmail: link.recipient_email,
      businessName: client.business_name,
    });
  } catch {
    res.status(500).json({ success: false });
  }
};

export const b2bMarkUsed: RequestHandler = async (req, res) => {
  const { token } = req.params;
  const { analysisId, userData } = req.body;
  try {
    const updateResult = await query(
      `UPDATE b2b_links SET is_used = TRUE, analysis_id = $2, used_at = CURRENT_TIMESTAMP
       WHERE token = $1 AND is_used = FALSE
       RETURNING client_id`,
      [token, analysisId]
    );

    if (updateResult.rowCount === 0) {
      const exists = await query("SELECT 1 FROM b2b_links WHERE token = $1", [token]);
      if (exists.rows.length === 0) return res.status(404).json({ success: false, message: "Invalid link" });
      return res.status(409).json({ success: false, message: "This link has already been used." });
    }

    const clientId = updateResult.rows[0].client_id;

    await query(
      "UPDATE b2b_clients SET reports_generated = reports_generated + 1 WHERE id = $1",
      [clientId]
    );

    if (userData) {
      const ip = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "").split(",")[0].trim();
      const ua = req.headers["user-agent"] || "";
      try {
        await query(
          `INSERT INTO b2b_quiz_submissions
            (client_id, link_token, analysis_id, user_name, user_email, user_phone, user_age, user_gender, user_location, quiz_data, ip_address, user_agent)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [clientId, token, analysisId,
           userData.userName || null, userData.userEmail || null, userData.userPhone || null,
           userData.userAge || null, userData.userGender || null, userData.userLocation || null,
           JSON.stringify(userData.quizData || {}), ip, ua]
        );
      } catch (e) {
        console.error("B2B quiz submission save error:", e);
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("B2B mark used error:", err);
    res.status(500).json({ success: false });
  }
};

export const b2bGetSubmissions: RequestHandler = async (req: any, res) => {
  try {
    const result = await query(
      `SELECT s.*, l.label as link_label
       FROM b2b_quiz_submissions s
       LEFT JOIN b2b_links l ON s.link_token = l.token
       WHERE s.client_id = $1
       ORDER BY s.created_at DESC`,
      [req.b2bClientId]
    );
    const submissions = result.rows.map((r: any) => ({
      id: r.id,
      linkToken: r.link_token,
      linkLabel: r.link_label,
      analysisId: r.analysis_id,
      userName: r.user_name,
      userEmail: r.user_email,
      userPhone: r.user_phone,
      userAge: r.user_age,
      userGender: r.user_gender,
      userLocation: r.user_location,
      quizData: r.quiz_data,
      ipAddress: r.ip_address,
      userAgent: r.user_agent,
      createdAt: r.created_at,
    }));
    res.json({ success: true, submissions });
  } catch (err) {
    console.error("B2B get submissions error:", err);
    res.status(500).json({ success: false });
  }
};

export const b2bSendQuizEmail: RequestHandler = async (req: any, res) => {
  const { linkToken, recipientEmail, recipientName } = req.body;
  if (!recipientEmail || !linkToken)
    return res.status(400).json({ success: false, message: "Email and link token required" });

  try {
    const clientResult = await query("SELECT * FROM b2b_clients WHERE id = $1", [req.b2bClientId]);
    if (clientResult.rows.length === 0) return res.status(404).json({ success: false });
    const client = clientResult.rows[0];

    const transporter = getMailTransporter();
    if (!transporter)
      return res.status(503).json({ success: false, message: "Email service not configured" });

    const linkResult = await query("SELECT * FROM b2b_links WHERE token = $1 AND client_id = $2", [linkToken, client.id]);
    if (linkResult.rows.length === 0)
      return res.status(404).json({ success: false, message: "Link not found" });

    const appUrl = process.env.APP_URL || `https://${process.env.REPLIT_DEV_DOMAIN || "genewell.replit.app"}`;
    const fullQuizUrl = `${appUrl}/quiz?b2b=${linkToken}`;
    const name = recipientName || "there";

    await transporter.sendMail({
      from: `"GeneWell" <${process.env.GMAIL_USER}>`,
      to: recipientEmail,
      subject: `${client.business_name} invites you to take your personalized Wellness Quiz`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <div style="text-align:center;margin-bottom:30px;">
            <h1 style="color:#7c3aed;margin:0;">GeneWell</h1>
            <p style="color:#64748b;font-size:14px;">AI-Powered Wellness Blueprint</p>
          </div>
          <p style="font-size:16px;color:#1e293b;">Hi ${name},</p>
          <p style="font-size:15px;color:#475569;line-height:1.6;">
            <strong>${client.business_name}</strong> has invited you to take the GeneWell Wellness Quiz.
            Complete the 3-minute quiz and get your <strong>personalized premium wellness blueprint</strong> — completely free!
          </p>
          <div style="text-align:center;margin:30px 0;">
            <a href="${fullQuizUrl}" style="background:linear-gradient(135deg,#7c3aed,#6366f1);color:white;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block;">
              Take Your Wellness Quiz →
            </a>
          </div>
          <p style="font-size:13px;color:#94a3b8;line-height:1.5;">
            Your personalized report includes metabolic analysis, nutrition plan, training recommendations, and more — tailored to your unique profile.
          </p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:30px 0;" />
          <p style="font-size:12px;color:#94a3b8;text-align:center;">
            Sent by ${client.business_name} via GeneWell · <a href="${appUrl}" style="color:#7c3aed;">genewell.in</a>
          </p>
        </div>
      `,
    });

    if (linkResult.rows[0].recipient_email !== recipientEmail) {
      await query("UPDATE b2b_links SET recipient_email = $2 WHERE token = $1", [linkToken, recipientEmail]);
    }

    res.json({ success: true, message: "Quiz link emailed successfully" });
  } catch (err: any) {
    console.error("B2B send email error:", err);
    res.status(500).json({ success: false, message: "Failed to send email" });
  }
};

export const b2bUpgrade: RequestHandler = async (req: any, res) => {
  try {
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 1);
    await query(
      "UPDATE b2b_clients SET plan = 'paid', trial_expires_at = $2 WHERE id = $1",
      [req.b2bClientId, expiry.toISOString()]
    );
    const result = await query("SELECT * FROM b2b_clients WHERE id = $1", [req.b2bClientId]);
    if (result.rows.length === 0) return res.status(404).json({ success: false });
    const c = result.rows[0];
    res.json({
      success: true,
      client: {
        id: c.id, businessName: c.business_name, contactName: c.contact_name,
        email: c.email, phone: c.phone, plan: c.plan,
        trialExpiresAt: c.trial_expires_at, reportsGenerated: c.reports_generated,
      },
    });
  } catch {
    res.status(500).json({ success: false });
  }
};

export const b2bStats: RequestHandler = async (req: any, res) => {
  try {
    const clientResult = await query("SELECT * FROM b2b_clients WHERE id = $1", [req.b2bClientId]);
    if (clientResult.rows.length === 0) return res.status(404).json({ success: false });
    const c = clientResult.rows[0];

    const linksResult = await query("SELECT is_used FROM b2b_links WHERE client_id = $1", [c.id]);
    const total = linksResult.rows.length;
    const used = linksResult.rows.filter((l: any) => l.is_used).length;

    const daysLeft = Math.max(0, Math.round(
      (new Date(c.trial_expires_at).getTime() - Date.now()) / 86400000
    ));

    res.json({
      success: true,
      client: {
        id: c.id, businessName: c.business_name, contactName: c.contact_name,
        email: c.email, phone: c.phone, plan: c.plan,
        trialExpiresAt: c.trial_expires_at, reportsGenerated: c.reports_generated,
      },
      stats: {
        totalLinks: total,
        usedLinks: used,
        pendingLinks: total - used,
        reportsGenerated: c.reports_generated,
        daysRemaining: daysLeft,
        planStatus: c.plan === "paid" ? "Active (Paid)" : daysLeft > 0 ? `Trial — ${daysLeft} days left` : "Trial Expired",
      },
    });
  } catch {
    res.status(500).json({ success: false });
  }
};

export async function runSubscriptionReminders() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await query(
      `SELECT c.* FROM b2b_clients c
       WHERE c.plan = 'trial'
         AND c.created_at <= $1
         AND NOT EXISTS (
           SELECT 1 FROM b2b_reminder_log r
           WHERE r.client_id = c.id AND r.reminder_type = '30_day'
         )`,
      [thirtyDaysAgo.toISOString()]
    );

    if (result.rows.length === 0) return;

    const transporter = getMailTransporter();
    if (!transporter) {
      console.log("B2B reminders: email service not available");
      return;
    }

    const appUrl = process.env.APP_URL || `https://${process.env.REPLIT_DEV_DOMAIN || "genewell.replit.app"}`;

    for (const client of result.rows) {
      try {
        const daysLeft = Math.max(0, Math.round(
          (new Date(client.trial_expires_at).getTime() - Date.now()) / 86400000
        ));

        await transporter.sendMail({
          from: `"GeneWell" <${process.env.GMAIL_USER}>`,
          to: client.email,
          subject: `Your GeneWell B2B trial ${daysLeft > 0 ? `ends in ${daysLeft} days` : "has expired"} — Upgrade now`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
              <div style="text-align:center;margin-bottom:30px;">
                <h1 style="color:#7c3aed;margin:0;">GeneWell</h1>
                <p style="color:#64748b;font-size:14px;">B2B Subscription Reminder</p>
              </div>
              <p style="font-size:16px;color:#1e293b;">Hi ${client.contact_name},</p>
              <p style="font-size:15px;color:#475569;line-height:1.6;">
                You've been using GeneWell B2B for <strong>${client.business_name}</strong> for 30 days.
                ${daysLeft > 0
                  ? `Your free trial ends in <strong>${daysLeft} days</strong>.`
                  : `Your free trial has <strong>expired</strong>.`}
              </p>
              <p style="font-size:15px;color:#475569;line-height:1.6;">
                So far, you've generated <strong>${client.reports_generated} reports</strong>.
                Upgrade to keep creating unlimited premium wellness reports for your users.
              </p>
              <div style="text-align:center;margin:30px 0;">
                <a href="${appUrl}/b2b/login" style="background:linear-gradient(135deg,#7c3aed,#6366f1);color:white;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block;">
                  Upgrade Your Plan →
                </a>
              </div>
              <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:16px;margin:20px 0;">
                <p style="font-size:14px;color:#6b21a8;margin:0;font-weight:bold;">All Access — ₹1,999/year</p>
                <p style="font-size:13px;color:#7c3aed;margin:4px 0 0;">Unlimited quiz links · Premium reports · All add-ons · Admin dashboard</p>
              </div>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:30px 0;" />
              <p style="font-size:12px;color:#94a3b8;text-align:center;">
                GeneWell · <a href="${appUrl}" style="color:#7c3aed;">genewell.in</a>
              </p>
            </div>
          `,
        });

        await query(
          "INSERT INTO b2b_reminder_log (client_id, reminder_type) VALUES ($1, '30_day')",
          [client.id]
        );

        console.log(`B2B 30-day reminder sent to ${client.email}`);
      } catch (emailErr) {
        console.error(`Failed to send reminder to ${client.email}:`, emailErr);
      }
    }
  } catch (err) {
    console.error("B2B reminder cron error:", err);
  }
}

let reminderInterval: NodeJS.Timeout | null = null;
export function startB2BReminderJob() {
  runSubscriptionReminders().catch(console.error);
  reminderInterval = setInterval(() => {
    runSubscriptionReminders().catch(console.error);
  }, 24 * 60 * 60 * 1000);
}
