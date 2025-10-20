import nodemailer from 'nodemailer';

const createTransporter = () => {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER) {
    console.warn('⚠️  Email not configured. Set EMAIL_HOST, EMAIL_USER, EMAIL_PASS in .env');
    return null;
  }

  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

export async function sendVerificationEmail(user, verificationToken) {
  const transporter = createTransporter();
  if (!transporter) {
    return { success: false, message: 'Email not configured' };
  }

  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify?token=${verificationToken}`;

  const mailOptions = {
    from: `"BinaryBets" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: 'Verify Your BinaryBets Account',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 15px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎲 Welcome to BinaryBets!</h1>
          </div>
          <div class="content">
            <h2>Hi @${user.username}!</h2>
            <p>Thanks for signing up! Please verify your email address to start betting.</p>
            <p>Click the button below to verify your account:</p>
            <a href="${verificationUrl}" class="button">Verify My Account</a>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #667eea;">${verificationUrl}</p>
            <p><strong>Starting Balance:</strong> $10,000</p>
            <p>Good luck with your bets! 🍀</p>
          </div>
          <div class="footer">
            <p>If you didn't create this account, please ignore this email.</p>
            <p>&copy; 2025 BinaryBets. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Verification email sent to:', user.email);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending verification email:', error);
    return { success: false, error: error.message };
  }
}

export async function sendWinnerEmail(user, bet, market, winnings) {
  const transporter = createTransporter();
  if (!transporter) {
    return { success: false, message: 'Email not configured' };
  }

  const mailOptions = {
    from: `"BinaryBets" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: '🎉 You Won! Your Bet Paid Out',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .winner-box { background: white; padding: 20px; border-left: 4px solid #10b981; margin: 20px 0; border-radius: 5px; }
          .amount { font-size: 32px; color: #10b981; font-weight: bold; }
          .details { background: #e5e7eb; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Congratulations @${user.username}!</h1>
            <p style="font-size: 20px; margin: 0;">YOU WON!</p>
          </div>
          <div class="content">
            <div class="winner-box">
              <p style="margin: 0; font-size: 18px;">Your Winnings:</p>
              <p class="amount">$${parseFloat(winnings).toFixed(2)}</p>
            </div>
            
            <h3>Bet Details:</h3>
            <div class="details">
              <p><strong>Question:</strong> ${market.question}</p>
              <p><strong>Your Bet:</strong> ${bet.choice ? bet.choice.toUpperCase() : bet.option_name} at ${parseFloat(bet.odds).toFixed(2)}x odds</p>
              <p><strong>Bet Amount:</strong> $${parseFloat(bet.amount).toFixed(2)}</p>
              <p><strong>Potential Win:</strong> $${parseFloat(bet.potential_win).toFixed(2)}</p>
              <p><strong>Status:</strong> ✅ WON</p>
            </div>
            
            <p><strong>New Balance:</strong> $${parseFloat(user.balance).toFixed(2)}</p>
            <p>Your winnings have been credited to your account. Keep betting! 🚀</p>
          </div>
          <div class="footer">
            <p>Visit <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}">BinaryBets</a> to place more bets!</p>
            <p>&copy; 2025 BinaryBets. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Winner email sent to:', user.email);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending winner email:', error);
    return { success: false, error: error.message };
  }
}

export default {
  sendVerificationEmail,
  sendWinnerEmail,
};
