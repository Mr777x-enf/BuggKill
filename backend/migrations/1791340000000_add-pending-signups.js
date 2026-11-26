exports.up = (pgm) => {
    pgm.createTable("pending_signups", {
        email: {
            type: "varchar(255)",
            primaryKey: true
        },
        name: {
            type: "varchar(100)",
            notNull: true
        },
        password: {
            type: "text",
            notNull: true
        },
        otp_hash: {
            type: "text",
            notNull: true
        },
        expires_at: {
            type: "timestamp",
            notNull: true
        },
        attempts: {
            type: "integer",
            notNull: true,
            default: 0
        },
        sent_at: {
            type: "timestamp",
            notNull: true,
            default: pgm.func("current_timestamp")
        }
    });
};

exports.down = (pgm) => {
    pgm.dropTable("pending_signups");
};
