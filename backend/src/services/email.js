
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");

// Load local .env file.
// On Render, environment variables are loaded automatically.
dotenv.config();

// Gmail OAuth2 credentials
const mailUser = process.env.MAIL_USER || process.env.EMAIL_USER;
const clientId = process.env.CLIENT_ID?.trim();
const clientSecret = process.env.CLIENT_SECRET?.trim();
const refreshToken = process.env.REFRESH_TOKEN?.trim();

// Validate environment variables
const missingVariables = [];

if (!mailUser) missingVariables.push("MAIL_USER");
if (!clientId) missingVariables.push("CLIENT_ID");
if (!clientSecret) missingVariables.push("CLIENT_SECRET");
if (!refreshToken) missingVariables.push("REFRESH_TOKEN");

if (missingVariables.length > 0) {
    throw new Error(
        `Missing Gmail OAuth environment variables: ${missingVariables.join(", ")}`
    );
}

// Create Gmail transporter
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        type: "OAuth2",
        user: mailUser,
        clientId,
        clientSecret,
        refreshToken,
    },
});

// Verify Gmail connection
async function verifyTransporter() {
    try {
        await transporter.verify();

        console.log("[EMAIL] Gmail transporter verified successfully.");

        return true;

    } catch (error) {
        console.error("[EMAIL] Transporter verification failed:", {
            message: error.message,
            code: error.code,
            command: error.command,
            response: error.response,
        });

        return false;
    }
}

// Send email
async function sendEmail(to, subject, text) {
    try {
        if (!to || !subject || !text) {
            throw new Error(
                "Recipient, subject and message are required."
            );
        }

        console.log("[EMAIL] Sending email to:", to);

        const info = await transporter.sendMail({
            from: `"BugKill" <${mailUser}>`,
            to,
            subject,
            text,
        });

        console.log("[EMAIL] Email sent successfully:", {
            messageId: info.messageId,
            accepted: info.accepted,
            rejected: info.rejected,
        });

        return info;

    } catch (error) {
        console.error("[EMAIL] Email sending failed:", {
            message: error.message,
            code: error.code,
            command: error.command,
            response: error.response,
        });

        throw error;
    }
}

module.exports = sendEmail;
