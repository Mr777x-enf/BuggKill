const db = require("../db/connection");


// Create a new message
const createMessage = async (sessionId, role, content) => {

    const result = await db.query(
        `
        INSERT INTO messages
        (session_id, role, content)
        VALUES ($1, $2, $3)
        RETURNING
            id,
            session_id,
            role,
            content,
            created_at
        `,
        [sessionId, role, content]
    );

    return result.rows[0];
};

const createMessagePair = async (sessionId, question, answer) => {
    const client = await db.connect();

    try {
        await client.query("BEGIN");

        const userMessage = await client.query(
            `
            INSERT INTO messages (session_id, role, content)
            VALUES ($1, 'user', $2)
            RETURNING id, session_id, role, content, created_at
            `,
            [sessionId, question]
        );
        const assistantMessage = await client.query(
            `
            INSERT INTO messages (session_id, role, content)
            VALUES ($1, 'assistant', $2)
            RETURNING id, session_id, role, content, created_at
            `,
            [sessionId, answer]
        );

        await client.query(
            `
            UPDATE repositories
            SET title = COALESCE(
                    NULLIF(BTRIM(title), ''),
                    LEFT(BTRIM($2), 80)
                ),
                updated_at = CURRENT_TIMESTAMP
            WHERE session_id = $1
              AND NOT EXISTS (
                  SELECT 1 FROM messages
                  WHERE session_id = $1 AND role = 'user'
                    AND id < $3::bigint
              )
            `,
            [sessionId, question.trim(), userMessage.rows[0].id]
        );
        await client.query(
            "UPDATE repositories SET updated_at = CURRENT_TIMESTAMP WHERE session_id = $1",
            [sessionId]
        );

        await client.query("COMMIT");

        return [userMessage.rows[0], assistantMessage.rows[0]];
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};


// Get all messages of a session
const getMessagesBySession = async (sessionId) => {

    const result = await db.query(
        `
        SELECT
            id,
            session_id,
            role,
            content,
            created_at
        FROM messages
        WHERE session_id = $1
        ORDER BY created_at ASC, id ASC
        `,
        [sessionId]
    );

    return result.rows;
};


// Delete all messages of a session
const deleteMessagesBySession = async (sessionId) => {

    const result = await db.query(
        `
        DELETE FROM messages
        WHERE session_id = $1
        RETURNING id
        `,
        [sessionId]
    );

    return result.rowCount;
};


// Check whether session belongs to user
const getSessionForUser = async (sessionId, userId) => {

    const result = await db.query(
        `
        SELECT
            id,
            user_id,
            repo_link,
            session_id,
            commit_sha,
            ingestion_status,
            title,
            updated_at
        FROM repositories
        WHERE session_id = $1
        AND user_id = $2
        `,
        [sessionId, userId]
    );

    return result.rows[0];
};

const getSessionsForUser = async (userId) => {
    const result = await db.query(
        `
        SELECT
            r.id,
            r.id AS repository_id,
            r.session_id,
            r.repo_link,
            r.commit_sha,
            r.ingestion_status,
            r.title,
            r.created_at,
            r.updated_at,
            COALESCE(
                (SELECT MAX(m.created_at)
                 FROM messages m
                 WHERE m.session_id = r.session_id),
                r.created_at
            ) AS last_activity,
            (SELECT m.content
             FROM messages m
             WHERE m.session_id = r.session_id
             ORDER BY m.created_at DESC, m.id DESC
             LIMIT 1) AS last_message
        FROM repositories r
        WHERE r.user_id = $1
        ORDER BY last_activity DESC
        `,
        [userId]
    );

    return result.rows;
};

const renameSession = async (sessionId, userId, title) => {
    const result = await db.query(
        `
        UPDATE repositories
        SET title = $3, updated_at = CURRENT_TIMESTAMP
        WHERE session_id = $1 AND user_id = $2
        RETURNING session_id, title, updated_at
        `,
        [sessionId, userId, title]
    );
    return result.rows[0];
};

const deleteSession = async (sessionId, userId) => {
    const result = await db.query(
        `
        DELETE FROM repositories
        WHERE session_id = $1 AND user_id = $2
        RETURNING id
        `,
        [sessionId, userId]
    );
    if (result.rowCount) await deleteMessagesBySession(sessionId);
    return result.rowCount;
};

const deleteSessionsForUser = async (userId) => {
    const sessions = await db.query(
        "SELECT session_id FROM repositories WHERE user_id = $1",
        [userId]
    );
    for (const { session_id } of sessions.rows) {
        await deleteMessagesBySession(session_id);
    }
    const result = await db.query(
        "DELETE FROM repositories WHERE user_id = $1 RETURNING id",
        [userId]
    );
    return result.rowCount;
};

module.exports = {
    createMessage,
    createMessagePair,
    getMessagesBySession,
    deleteMessagesBySession,
    getSessionForUser,
    getSessionsForUser,
    renameSession,
    deleteSession,
    deleteSessionsForUser
};