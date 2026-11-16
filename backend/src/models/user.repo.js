const db = require("../db/connection");

const createRepository = async (userId, repoLink, sessionId) => {
    const result = await db.query(
        `
        INSERT INTO repositories (user_id, repo_link, session_id)
        VALUES ($1, $2, $3)
        RETURNING id, user_id, repo_link, session_id, created_at
        `,
        [userId, repoLink, sessionId]
    );

    return result.rows[0];
};

const getRepositoryByLink = async (userId, repoLink) => {
    const result = await db.query(
        `
        SELECT id, user_id, repo_link, session_id, commit_sha,
               ingestion_status, title, updated_at
        FROM repositories
        WHERE user_id = $1 AND regexp_replace(repo_link, '/+$', '') = regexp_replace($2, '/+$', '')
        ORDER BY updated_at DESC
        LIMIT 1
        `,
        [userId, repoLink]
    );

    return result.rows[0];
};

const setRepositoryIngestionStatus = async (
    repositoryId,
    status,
    commitSha = null
) => {
    const result = await db.query(
        `
        UPDATE repositories
        SET ingestion_status = $2,
            commit_sha = COALESCE($3, commit_sha)
        WHERE id = $1
        RETURNING id, session_id, commit_sha, ingestion_status
        `,
        [repositoryId, status, commitSha]
    );

    return result.rows[0];
};

const claimRepositoryForIngestion = async (repositoryId) => {
    const result = await db.query(
        `
        UPDATE repositories
        SET ingestion_status = 'indexing'
        WHERE id = $1
          AND ingestion_status IN ('pending', 'failed')
        RETURNING id, user_id, repo_link, session_id, commit_sha, ingestion_status
        `,
        [repositoryId]
    );

    return result.rows[0];
};

module.exports = {
    createRepository,
    getRepositoryByLink,
    setRepositoryIngestionStatus,
    claimRepositoryForIngestion
};