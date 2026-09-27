const nodemailer = require('nodemailer');

/**
 * Sends an email using nodemailer with SMTP / Gmail configurations from environment variables.
 * 
 * Supports:
 * - SMTP_HOST, SMTP_PORT, SMTP_USER / SMTP_EMAIL, SMTP_PASS / SMTP_PASSWORD
 * - GMAIL_USER, GMAIL_PASS (or GMAIL_APP_PASSWORD)
 * - FROM_NAME, FROM_EMAIL
 * 
 * @param {object} options
 * @param {string} options.email - Recipient email address
 * @param {string} options.subject - Email subject line
 * @param {string} options.message - Plain text message
 * @param {string} [options.html] - Optional HTML formatted body
 */
const sendEmail = async (options) => {
  const user =
    process.env.SMTP_USER ||
    process.env.SMTP_EMAIL ||
    process.env.GMAIL_USER ||
    process.env.EMAIL_USER;

  const pass =
    process.env.SMTP_PASS ||
    process.env.SMTP_PASSWORD ||
    process.env.GMAIL_PASS ||
    process.env.GMAIL_APP_PASSWORD ||
    process.env.EMAIL_PASS;

  const fromName = process.env.FROM_NAME || 'AttendEdge ERP';
  const fromEmail = process.env.FROM_EMAIL || user || 'no-reply@attendedge.edu';

  let transporter;

  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user,
        pass,
      },
    });
  } else if (user && pass) {
    // Default to Gmail service if user and pass are provided
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass,
      },
    });
  } else {
    // Development fallback when credentials are not configured yet
    console.warn(
      '\n[Email Service Warning]: SMTP/Gmail credentials not detected in .env. Logging email payload to console:\n' +
      `To: ${options.email}\n` +
      `Subject: ${options.subject}\n` +
      `Message: ${options.message}\n`
    );
    // If in development mode and no SMTP configured, allow the flow to proceed without crashing
    return {
      messageId: 'simulated-dev-message-id',
      simulated: true,
    };
  }

  const message = {
    from: `"${fromName}" <${fromEmail}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html || options.message,
  };

  const info = await transporter.sendMail(message);
  console.log(`[Email Service]: Message sent to ${options.email} (ID: ${info.messageId})`);
  return info;
};

module.exports = sendEmail;
