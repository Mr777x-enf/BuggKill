const { google } = require("googleapis");
const dotenv = require("dotenv");

dotenv.config();

const mailUser = process.env.MAIL_USER || process.env.EMAIL_USER;
const clientId = process.env.CLIENT_ID?.trim();
const clientSecret = process.env.CLIENT_SECRET?.trim();
const refreshToken = process.env.REFRESH_TOKEN?.trim();
// Must match the redirect URI used when you generated the refresh token
const redirectUri =
    process.env.REDIRECT_URI?.trim() ||
    "https://developers.google.com/oauthplayground";

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

const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
oAuth2Client.setCredentials({ refresh_token: refreshToken });

const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

// Strip CR/LF to prevent header injection
const clean = (value) => String(value).replace(/[\r\n]+/g, " ").trim();

function buildRawMessage({ from, to, subject, text }) {
    const encodedSubject = `=?UTF-8?B?${Buffer.from(clean(subject)).toString("base64")}?=`;

    const message = [
        `From: ${from}`,
        `To: ${clean(to)}`,
        `Subject: ${encodedSubject}`,
        "MIME-Version: 1.0",
        'Content-Type: text/plain; charset="UTF-8"',
        "Content-Transfer-Encoding: base64",
        "",
        Buffer.from(text).toString("base64"),
    ].join("\r\n");

    // Gmail API requires base64url
    return Buffer.from(message).toString("base64url");
}

async function verifyTransporter() {
    try {
        const { data } = await gmail.users.getProfile({ userId: "me" });
        console.log("[EMAIL] Gmail API verified for:", data.emailAddress);
        return true;
    } catch (error) {
        console.error("[EMAIL] Gmail API verification failed:", {
            message: error.message,
            code: error.code,
            details: error.response?.data,
        });
        return false;
    }
}

async function sendEmail(to, subject, text) {
    try {
        if (!to || !subject || !text) {
            throw new Error("Recipient, subject and message are required.");
        }

        console.log("[EMAIL] Sending email to:", to);

        const raw = buildRawMessage({
            from: `"BugKill" <${mailUser}>`,
            to,
            subject,
            text,
        });

        const { data } = await gmail.users.messages.send({
            userId: "me",
            requestBody: { raw },
        });

        console.log("[EMAIL] Email sent successfully:", { id: data.id });
        return data;
    } catch (error) {
        console.error("[EMAIL] Email sending failed:", {
            message: error.message,
            code: error.code,
            details: error.response?.data,
        });
        throw error;
    }
}

module.exports = sendEmail;
module.exports.verifyTransporter = verifyTransporter;
