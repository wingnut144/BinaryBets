// ==========================================
// EMAIL SERVICE - Binary Bets
// Location: backend/emailService.js
// ==========================================

import nodemailer from 'nodemailer';
import crypto from 'crypto';

// Email transporter configuration from .env
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Verify transporter configuration
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email service error:', error);
  } else {
    console.log('✅ Email service ready');
  }
});

// Generate verification token
export function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Welcome/Registration Email Template
export function getWelcomeEmailTemplate(username, verificationLink) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: white;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px 20px;
      text-align: center;
      color: white;
    }
    .logo {
      font-size: 48px;
      margin-bottom: 10px;
    }
    .header h1 {
      margin: 0;
      font-size: 32px;
      font-weight: 700;
    }
    .content {
      padding: 40px 30px;
      color: #333;
    }
    .welcome-text {
      font-size: 18px;
      line-height: 1.6;
      margin-bottom: 30px;
    }
    .username-badge {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 15px 25px;
      border-radius: 50px;
      display: inline-block;
      font-size: 24px;
      font-weight: 700;
      margin: 20px 0;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      padding: 18px 40px;
      border-radius: 50px;
      font-size: 18px;
      font-weight: 700;
      margin: 30px 0;
      transition: transform 0.3s ease;
      box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
    }
    .cta-button:hover {
      transform: translateY(-2px);
    }
    .features {
      background: #f8f9ff;
      padding: 25px;
      border-radius: 15px;
      margin: 30px 0;
    }
    .feature {
      display: flex;
      align-items: center;
      margin: 15px 0;
      font-size: 16px;
    }
    .feature-icon {
      font-size: 24px;
      margin-right: 15px;
      min-width: 30px;
    }
    .footer {
      background: #f8f9fa;
      padding: 30px;
      text-align: center;
      color: #666;
      font-size: 14px;
      border-top: 1px solid #e0e0e0;
    }
    .security-note {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
      border-radius: 5px;
      font-size: 14px;
    }
    @media (max-width: 600px) {
      .container {
        margin: 20px;
      }
      .content {
        padding: 30px 20px;
      }
      .header h1 {
        font-size: 24px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🎲</div>
      <h1>Welcome to Binary Bets!</h1>
    </div>
    
    <div class="content">
      <p class="welcome-text">
        🎉 Hey there!
      </p>
      
      <div style="text-align: center;">
        <div class="username-badge">@${username}</div>
      </div>
      
      <p class="welcome-text">
        You've just joined the most exciting prediction market platform! We're thrilled to have you on board. 
      </p>
      
      <div style="text-align: center;">
        <a href="${verificationLink}" class="cta-button">
          ✅ Verify Your Email
        </a>
      </div>
      
      <div class="security-note">
        <strong>Security First:</strong> Click the button above to verify your email and activate your account. This link expires in 24 hours.
      </div>
      
      <div class="features">
        <h3 style="margin-top: 0; color: #667eea;">🚀 What You Can Do:</h3>
        <div class="feature">
          <span class="feature-icon">💰</span>
          <span>Start with <strong>$10,000</strong> in virtual credits</span>
        </div>
        <div class="feature">
          <span class="feature-icon">📊</span>
          <span>Create new and bet on existing prediction markets</span>
        </div>
        <div class="feature">
          <span class="feature-icon">🤖</span>
          <span>Get AI-powered odds calculations</span>
        </div>
        <div class="feature">
          <span class="feature-icon">🏆</span>
          <span>Climb the leaderboard and compete</span>
        </div>
        <div class="feature">
          <span class="feature-icon">⚡</span>
          <span>Place bets instantly with real-time updates</span>
        </div>
      </div>
      
      <p style="color: #666; font-size: 14px; margin-top: 30px;">
        If you didn't create an account on Binary Bets, please ignore this email or contact support if you have concerns.
      </p>
    </div>
    
    <div class="footer">
      <p><strong>Binary Bets</strong> - The Future of Prediction Markets</p>
      <p>Questions? Reply to this email or visit our support page.</p>
      <p style="margin-top: 20px; font-size: 12px; color: #999;">
        © 2025 Binary Bets. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

// Password Reset Email Template
export function getPasswordResetTemplate(username, resetLink) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: white;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px 20px;
      text-align: center;
      color: white;
    }
    .logo {
      font-size: 48px;
      margin-bottom: 10px;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .content {
      padding: 40px 30px;
      color: #333;
    }
    .alert-box {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 20px;
      margin: 20px 0;
      border-radius: 5px;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      padding: 18px 40px;
      border-radius: 50px;
      font-size: 18px;
      font-weight: 700;
      margin: 30px 0;
      transition: transform 0.3s ease;
      box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
    }
    .security-tips {
      background: #f8f9ff;
      padding: 25px;
      border-radius: 15px;
      margin: 30px 0;
    }
    .tip {
      display: flex;
      align-items: flex-start;
      margin: 12px 0;
      font-size: 14px;
    }
    .tip-icon {
      font-size: 20px;
      margin-right: 12px;
      min-width: 25px;
    }
    .footer {
      background: #f8f9fa;
      padding: 30px;
      text-align: center;
      color: #666;
      font-size: 14px;
      border-top: 1px solid #e0e0e0;
    }
    @media (max-width: 600px) {
      .container {
        margin: 20px;
      }
      .content {
        padding: 30px 20px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🔐</div>
      <h1>Password Reset Request</h1>
    </div>
    
    <div class="content">
      <p style="font-size: 18px;">
        Hi <strong>@${username}</strong>,
      </p>
      
      <p style="font-size: 16px; line-height: 1.6;">
        We received a request to reset your Binary Bets password. No worries - it happens to the best of us! 
      </p>
      
      <div style="text-align: center;">
        <a href="${resetLink}" class="cta-button">
          🔑 Reset My Password
        </a>
      </div>
      
      <div class="alert-box">
        <strong>⏰ Important:</strong> This link expires in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email.
      </div>
      
      <div class="security-tips">
        <h3 style="margin-top: 0; color: #667eea;">🛡️ Security Tips:</h3>
        <div class="tip">
          <span class="tip-icon">✓</span>
          <span>Choose a strong password with at least 8 characters</span>
        </div>
        <div class="tip">
          <span class="tip-icon">✓</span>
          <span>Use a mix of uppercase, lowercase, numbers, and symbols</span>
        </div>
        <div class="tip">
          <span class="tip-icon">✓</span>
          <span>Don't reuse passwords from other sites</span>
        </div>
        <div class="tip">
          <span class="tip-icon">✓</span>
          <span>Never share your password with anyone</span>
        </div>
      </div>
      
      <p style="color: #dc3545; font-size: 14px; background: #f8d7da; padding: 15px; border-radius: 8px; margin-top: 20px;">
        <strong>🚨 Didn't request this?</strong><br>
        If you didn't ask for a password reset, someone else might be trying to access your account. Please secure your account immediately or contact our support team.
      </p>
    </div>
    
    <div class="footer">
      <p><strong>Binary Bets</strong> - Keeping Your Account Secure</p>
      <p>Questions? Contact support@binary-bets.com</p>
      <p style="margin-top: 20px; font-size: 12px; color: #999;">
        © 2025 Binary Bets. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

// Send welcome email with verification
export async function sendWelcomeEmail(email, username, verificationToken) {
  const verificationLink = `${process.env.FRONTEND_URL || 'https://binary-bets.com'}/verify-email?token=${verificationToken}`;
  
  const mailOptions = {
    from: `"Binary Bets" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '🎉 Welcome to Binary Bets - Verify Your Email',
    html: getWelcomeEmailTemplate(username, verificationLink),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Welcome email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending welcome email:', error);
    return { success: false, error: error.message };
  }
}

// Send password reset email
export async function sendPasswordResetEmail(email, username, resetToken) {
  const resetLink = `${process.env.FRONTEND_URL || 'https://binary-bets.com'}/reset-password?token=${resetToken}`;
  
  const mailOptions = {
    from: `"Binary Bets" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '🔐 Binary Bets - Password Reset Request',
    html: getPasswordResetTemplate(username, resetLink),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Password reset email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending password reset email:', error);
    return { success: false, error: error.message };
  }
}

export default {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  generateToken,
};
