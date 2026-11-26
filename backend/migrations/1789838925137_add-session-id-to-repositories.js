export const up = (pgm) => {
    pgm.addColumn("repositories", {
        session_id: {
            type: "uuid",
            notNull: true,
            default: pgm.func("gen_random_uuid()")
        }
    });
};

export const down = (pgm) => {
    pgm.dropColumn("repositories", "session_id");
};