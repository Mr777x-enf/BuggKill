const express = require("express");
const authenticate = require("../middleware/auth.middleware");

const {
    registerUser,
    verifySignupOtp,
    resendSignupOtp,
    verifyEmail,
    resendVerificationEmail,
    getUserByEmail,
    loginUser,
    refreshAccessToken,
    getCurrentUser,
    forgotPassword,
    resetPassword,
    logoutUser
} = require("../controllers/userController");

const router = express.Router();

router.post("/register", registerUser);
router.post("/verify-signup", verifySignupOtp);
router.post("/resend-signup-otp", resendSignupOtp);
router.post("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerificationEmail);

router.get("/email/:email", authenticate, getUserByEmail);
router.get("/me", getCurrentUser);
router.post("/login",loginUser);
router.post("/logout",logoutUser)
router.post("/refresh",refreshAccessToken);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

module.exports = router;