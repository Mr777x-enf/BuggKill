import { readFileSync } from "node:fs";

/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

const schema = readFileSync(
    new URL("./1791302442249_create-code-chunks.sql", import.meta.url),
    "utf8"
);

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => pgm.sql(schema);

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropTable("code_chunks");
};