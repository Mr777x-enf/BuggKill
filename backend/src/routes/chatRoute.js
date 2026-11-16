const express = require("express");

const authenticate = require("../middleware/auth.middleware");
const {
    chatController
} = require("../controllers/chatController");
const {
    getSessionsController,
    getHistoryController,
    deleteHistoryController,
    deleteSessionController,
    deleteAllSessionsController,
    renameSessionController
} = require("../controllers/history.Controller");

const router = express.Router();

router.post("/", authenticate, chatController);
router.get("/sessions", authenticate, getSessionsController);
router.get("/history/:session_id", authenticate, getHistoryController);
router.delete("/history/:session_id", authenticate, deleteHistoryController);
router.delete("/sessions/:session_id", authenticate, deleteSessionController);
router.delete("/sessions", authenticate, deleteAllSessionsController);
router.patch("/sessions/:session_id", authenticate, renameSessionController);

module.exports = router;
