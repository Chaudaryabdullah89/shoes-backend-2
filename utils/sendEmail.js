const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // Modern HTML email template
    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #f7fafc; padding: 32px;">
        <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); overflow: hidden;">
          <div style="background: #facc15; padding: 24px 32px; text-align: center;">
            <h1 style="margin: 0; color: #1a202c; font-size: 2rem; letter-spacing: 1px;">
              ${process.env.FROM_NAME || 'Admin Email'}
            </h1>
          </div>
          <div style="padding: 32px; color: #1a202c; font-size: 1.1rem;">
            <h2 style="margin-top: 0; color: #ca8a04;">${options.subject}</h2>
            <hr>
            <div style="margin: 24px 0; line-height: 1.7;">
              ${options.message.replace(/\n/g, '<br/>')}
            </div>
            <div style="margin-top: 32px; background: #f9fafb; border-radius: 8px; padding: 20px;">
              <h3 style="margin: 0 0 12px 0; color: #1e293b; font-size: 1.15rem;">Email Details</h3>
              <table style="width: 100%; font-size: 1rem; color: #374151;">
                <tr>
                  <td style="padding: 6px 0; font-weight: bold; width: 120px;">To:</td>
                  <td style="padding: 6px 0;">${options.email}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold;">Subject:</td>
                  <td style="padding: 6px 0;">${options.subject}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold;">Sent At:</td>
                  <td style="padding: 6px 0;">${new Date().toLocaleString()}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: bold;">From:</td>
                  <td style="padding: 6px 0;">${process.env.FROM_NAME || 'Admin Panel'} &lt;${process.env.FROM_EMAIL || 'noreply@example.com'}&gt;</td>
                </tr>
              </table>
            </div>
          </div>
          <div style="background: #f3f4f6; color: #6b7280; text-align: center; padding: 18px 32px; font-size: 0.95rem;">
            <div>Sent from <b>${process.env.FROM_NAME || 'Admin Panel'}</b></div>
            <div style="margin-top: 4px;">&copy; ${new Date().getFullYear()} All rights reserved.</div>
          </div>
        </div>
      </div>
    `;

    // Email options
    const mailOptions = {
      from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
      to: options.email,
      subject: options.subject,
      text: options.message,
      html,
      attachments: options.attachment ? [{
        filename: options.attachment.originalname,
        path: options.attachment.path
      }] : []
    };

    // Send email
    await transporter.sendMail(mailOptions);
    console.log('Email sent to', options.email, 'with subject', options.subject);
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

module.exports = sendEmail; 