const assert = require("node:assert/strict");
const test = require("node:test");

const { postAiService } = require("../src/services/aiService");

test("postAiService logs upstream status and safe validation details", async () => {
    const previousUrl = process.env.AI_SERVICE_URL;
    const previousFetch = global.fetch;
    const previousConsoleError = console.error;
    const logEntries = [];

    process.env.AI_SERVICE_URL = "https://ai.example";
    global.fetch = async (url, options) => {
        assert.equal(url.href, "https://ai.example/api/chat/");
        assert.equal(options.method, "POST");
        return {
            ok: false,
            status: 422,
            json: async () => ({
                detail: [{
                    loc: ["body", "question"],
                    type: "missing",
                    msg: "Question is missing",
                    input: "private question",
                    ctx: { token: "private token" }
                }]
            })
        };
    };
    console.error = (...args) => logEntries.push(args);

    try {
        await assert.rejects(
            postAiService("api/chat/", { question: "private question" }),
            (error) =>
                error.code === "AI_SERVICE_HTTP_ERROR" &&
                error.statusCode === 502
        );
    } finally {
        global.fetch = previousFetch;
        console.error = previousConsoleError;
        if (previousUrl === undefined) {
            delete process.env.AI_SERVICE_URL;
        } else {
            process.env.AI_SERVICE_URL = previousUrl;
        }
    }

    assert.equal(logEntries.length, 1);
    assert.equal(logEntries[0][1].status, 422);
    assert.equal(logEntries[0][1].detail, "body.question (missing)");
    assert.doesNotMatch(JSON.stringify(logEntries), /private question|private token/);
});
