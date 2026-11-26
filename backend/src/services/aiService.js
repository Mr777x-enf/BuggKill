class AiServiceError extends Error {
    constructor(message, code, statusCode = 502) {
        super(message);
        this.name = "AiServiceError";
        this.code = code;
        this.statusCode = statusCode;
    }
}

const postAiService = async (endpoint, payload) => {
    const baseUrl = process.env.AI_SERVICE_URL || "http://localhost:8000";
    const timeoutMs = Number(process.env.AI_SERVICE_TIMEOUT_MS || 300000);

    if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
        throw new Error("AI_SERVICE_TIMEOUT_MS must be a positive integer");
    }

    let url;
    try {
        url = new URL(endpoint, `${baseUrl.replace(/\/+$/, "")}/`);
    } catch {
        throw new Error("AI_SERVICE_URL must be a valid HTTP URL");
    }

    if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("AI_SERVICE_URL must use HTTP or HTTPS");
    }

    let response;
    try {
        response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(timeoutMs)
        });
    } catch (error) {
        if (error.name === "TimeoutError" || error.name === "AbortError") {
            throw new AiServiceError(
                "AI service request timed out",
                "AI_SERVICE_TIMEOUT",
                504
            );
        }

        throw new AiServiceError(
            "AI service is unavailable",
            "AI_SERVICE_UNAVAILABLE"
        );
    }

    if (!response.ok) {
        let detail = "Upstream response details unavailable";

        try {
            const body = await response.json();

            if (Array.isArray(body.detail)) {
                detail = body.detail
                    .slice(0, 5)
                    .map((issue) => {
                        const location = Array.isArray(issue?.loc)
                            ? issue.loc
                                .map((part) =>
                                    (typeof part === "string" &&
                                        /^[a-z0-9_-]{1,64}$/i.test(part)) ||
                                    (Number.isInteger(part) &&
                                        Math.abs(part) <= 1000000)
                                        ? String(part)
                                        : "[field]"
                                )
                                .join(".")
                            : "request";
                        const type = typeof issue?.type === "string" &&
                            /^[a-z0-9_.-]{1,64}$/i.test(issue.type)
                            ? issue.type
                            : "validation_error";

                        return `${location} (${type})`;
                    })
                    .join("; ") || "Validation error (details omitted)";
            } else if (typeof body.detail === "string") {
                detail = "Upstream error detail omitted";
            }
        } catch {
            detail = "Upstream error response was not structured JSON";
        }

        console.error("AI service returned an unsuccessful response", {
            status: response.status,
            detail
        });

        throw new AiServiceError(
            "AI service returned an unsuccessful response",
            "AI_SERVICE_HTTP_ERROR"
        );
    }

    try {
        return await response.json();
    } catch {
        throw new AiServiceError(
            "AI service returned invalid JSON",
            "AI_SERVICE_BAD_RESPONSE"
        );
    }
};

module.exports = {
    AiServiceError,
    postAiService
};
