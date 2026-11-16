exports.up = (pgm) => {
    pgm.addColumns("repositories", {
        title: {
            type: "text"
        },
        updated_at: {
            type: "timestamp",
            notNull: true,
            default: pgm.func("current_timestamp")
        }
    });

    pgm.sql(`
        UPDATE repositories
        SET updated_at = COALESCE(created_at, CURRENT_TIMESTAMP)
    `);
};

exports.down = (pgm) => {
    pgm.dropColumns("repositories", ["title", "updated_at"]);
};
