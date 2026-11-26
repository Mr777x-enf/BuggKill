CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS code_chunks (
    id text PRIMARY KEY,
    repository_id text NOT NULL,
    commit_sha text NOT NULL,
    session_id text NOT NULL,
    file_path text NOT NULL,
    language varchar(50) NOT NULL,
    symbol_name text,
    symbol_type varchar(50),
    parent_symbol text,
    start_line integer,
    end_line integer,
    source text NOT NULL,
    parser_version varchar(100),
    chunker_version varchar(100),
    embedding vector(1536),
    created_at timestamp DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS code_chunks_repository_id_commit_sha_idx
    ON code_chunks (repository_id, commit_sha);
