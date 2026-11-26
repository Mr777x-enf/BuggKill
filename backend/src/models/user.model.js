const db = require("../db/connection");

const createUser = async (name, email, password) => {
    const result = await db.query(
        `INSERT INTO users (name, email, password, email_verified)
         VALUES ($1, $2, $3, FALSE)
         RETURNING id, name, email, email_verified, created_at`,
        [name, email, password]
    );

    return result.rows[0];
};

const createPendingSignup = async (name, email, password, otpHash, expiresAt) => {
    await db.query(
        "DELETE FROM pending_signups WHERE expires_at <= NOW()"
    );

    const result = await db.query(
        `
        INSERT INTO pending_signups (
            name, email, password, otp_hash, expires_at, sent_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (email) DO UPDATE
        SET name = EXCLUDED.name,
            password = EXCLUDED.password,
            otp_hash = EXCLUDED.otp_hash,
            expires_at = EXCLUDED.expires_at,
            attempts = 0,
            sent_at = NOW()
        WHERE pending_signups.sent_at <= NOW() - INTERVAL '1 minute'
        RETURNING email
        `,
        [name, email, password, otpHash, expiresAt]
    );

    return result.rows[0];
};

const findPendingSignupByEmail = async (email) => {
    const result = await db.query(
        `
        SELECT name, password, otp_hash, expires_at, attempts
        FROM pending_signups
        WHERE email = $1
        `,
        [email]
    );

    return result.rows[0];
};

const incrementPendingSignupAttempts = async (email) => {
    const result = await db.query(
        `
        UPDATE pending_signups
        SET attempts = attempts + 1
        WHERE email = $1
          AND expires_at > NOW()
          AND attempts < $2
        RETURNING attempts
        `,
        [email, 5]
    );

    return result.rows[0];
};

const updatePendingSignupOtp = async (email, otpHash, expiresAt) => {
    const result = await db.query(
        `
        UPDATE pending_signups
        SET otp_hash = $2,
            expires_at = $3,
            attempts = 0,
            sent_at = NOW()
        WHERE email = $1
          AND sent_at <= NOW() - INTERVAL '1 minute'
        RETURNING name
        `,
        [email, otpHash, expiresAt]
    );

    return result.rows[0];
};

const clearPendingSignupSentAt = async (email) => {
    await db.query(
        `
        UPDATE pending_signups
        SET sent_at = NOW() - INTERVAL '1 minute'
        WHERE email = $1
        `,
        [email]
    );
};

const completePendingSignup = async (email, otpHash, maxAttempts) => {
    const client = await db.connect();

    try {
        await client.query("BEGIN");
        const pendingResult = await client.query(
            `
            SELECT name, password
            FROM pending_signups
            WHERE email = $1
              AND otp_hash = $2
              AND expires_at > NOW()
              AND attempts < $3
            FOR UPDATE
            `,
            [email, otpHash, maxAttempts]
        );
        const pendingSignup = pendingResult.rows[0];

        if (!pendingSignup) {
            await client.query("ROLLBACK");
            return undefined;
        }

        const userResult = await client.query(
            `
            INSERT INTO users (name, email, password, email_verified)
            VALUES ($1, $2, $3, TRUE)
            RETURNING id, name, email, email_verified, created_at
            `,
            [pendingSignup.name, email, pendingSignup.password]
        );

        await client.query(
            "DELETE FROM pending_signups WHERE email = $1",
            [email]
        );
        await client.query("COMMIT");

        return userResult.rows[0];
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

const findUserByEmail = async (email) => {
    const result = await db.query(
        `SELECT id, name, email, password, email_verified
         FROM users
         WHERE email = $1`,
        [email]
    );

    return result.rows[0];
};

const saveEmailVerificationToken = async (
    userId,
    tokenHash,
    expiresAt,
    bypassRateLimit = false
) => {
    const result = await db.query(
        `
        UPDATE users
        SET email_verification_token_hash = $2,
            email_verification_expires = $3,
            email_verification_sent_at = NOW()
        WHERE id = $1
          AND email_verified = FALSE
          AND (
              $4::boolean
              OR email_verification_sent_at IS NULL
              OR email_verification_sent_at <= NOW() - INTERVAL '1 minute'
          )
        RETURNING id, name, email
        `,
        [userId, tokenHash, expiresAt, bypassRateLimit]
    );

    return result.rows[0];
};

const markEmailVerified = async (tokenHash) => {
    const result = await db.query(
        `
        UPDATE users
        SET email_verified = TRUE,
            email_verification_token_hash = NULL,
            email_verification_expires = NULL,
            email_verification_sent_at = NULL
        WHERE email_verification_token_hash = $1
          AND email_verification_expires > NOW()
          AND email_verified = FALSE
        RETURNING id, name, email, email_verified
        `,
        [tokenHash]
    );

    return result.rows[0];
};

const clearEmailVerificationSentAt = async (userId, tokenHash) => {
    await db.query(
        `
        UPDATE users
        SET email_verification_sent_at = NULL
        WHERE id = $1
          AND email_verification_token_hash = $2
          AND email_verified = FALSE
        `,
        [userId, tokenHash]
    );
};

const setPasswordResetToken = async (userId, tokenHash, expiresAt) => {
    const result = await db.query(
        `UPDATE users
         SET reset_password_token = $1, reset_password_expires = $2
         WHERE id = $3
         RETURNING id`,
        [tokenHash, expiresAt, userId]
    );

    return result.rowCount === 1;
};

const updateUserPassword = async (userId, hashedPassword, tokenHash) => {
    const result = await db.query(
        `
        UPDATE users
        SET password = $1,
            reset_password_token = NULL,
            reset_password_expires = NULL
        WHERE id = $2
          AND reset_password_token = $3
          AND reset_password_expires > NOW()
        RETURNING id, name, email
        `,
        [hashedPassword, userId, tokenHash]
    );

    return result.rows[0];
};



module.exports = {
    createUser,
    createPendingSignup,
    findPendingSignupByEmail,
    incrementPendingSignupAttempts,
    updatePendingSignupOtp,
    clearPendingSignupSentAt,
    completePendingSignup,
    findUserByEmail,
    saveEmailVerificationToken,
    markEmailVerified,
    clearEmailVerificationSentAt,
    setPasswordResetToken,
    updateUserPassword
};