import express from "express";
import * as userController from "../controllers/userController.js";
import { verifyUserToken, requireAdmin } from "../middleware/auth.js";
import * as database from "../services/database.js";

const router = express.Router();

// Public routes
router.post("/login", userController.login);
router.post("/change-password", userController.changePassword);

// GET /users/debug/:username - Debug user lookup (for troubleshooting)
router.get("/debug/:username", async (req, res, next) => {
  try {
    const { username } = req.params;
    const user = await database.getUserByUsername(username);
    
    if (!user) {
      // Try case-insensitive
      const allUsers = await database.getAllUsers({});
      const foundUser = allUsers.find(u => 
        u.username && u.username.toLowerCase() === username.toLowerCase()
      );
      
      return res.json({
        found: false,
        searched_username: username,
        case_insensitive_match: foundUser ? {
          actual_username: foundUser.username,
          email: foundUser.email,
          role: foundUser.role
        } : null,
        message: foundUser ? `User found with different case. Actual username: ${foundUser.username}` : "User not found"
      });
    }

    res.json({
      found: true,
      username: user.username,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      has_password_hash: !!user.password_hash,
      password_hash_length: user.password_hash ? user.password_hash.length : 0,
      password_hash_prefix: user.password_hash ? user.password_hash.substring(0, 10) + "..." : null,
      password_hash_starts_with_bcrypt: user.password_hash ? user.password_hash.startsWith('$2') : false,
      created_at: user.created_at,
      last_login: user.last_login
    });
  } catch (error) {
    next(error);
  }
});

// POST /users/reset-password - Reset user password (admin only, or for debugging)
router.post("/reset-password", async (req, res, next) => {
  try {
    const { username, new_password } = req.body;
    
    if (!username || !new_password) {
      return res.status(400).json({
        detail: "Username and new_password are required",
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        detail: "Password must be at least 6 characters long",
      });
    }

    const user = await database.getUserByUsername(username);
    if (!user) {
      return res.status(404).json({
        detail: "User not found",
      });
    }

    // Hash the new password
    const bcrypt = await import("bcrypt");
    const passwordHash = await bcrypt.hash(new_password, 10);

    // Update password
    const updatedUser = await database.updateUser(user._id || user.id, { password_hash: passwordHash });

    res.json({
      success: true,
      message: `Password reset successfully for user: ${username}`,
      username: updatedUser.username
    });
  } catch (error) {
    next(error);
  }
});

// Protected routes
router.get("/profile", verifyUserToken, userController.getProfile);
router.put("/profile", verifyUserToken, userController.updateProfile);
router.get("/verify", verifyUserToken, userController.verifyToken);

// Admin only routes
router.get("/list", verifyUserToken, requireAdmin, userController.listUsers);
router.post("/", verifyUserToken, requireAdmin, userController.createUser);
router.get("/:user_id", verifyUserToken, requireAdmin, userController.getUserById);
router.put("/:user_id", verifyUserToken, requireAdmin, userController.updateUser);
router.put("/:user_id/status", verifyUserToken, requireAdmin, userController.updateUserStatus);
router.delete("/:user_id", verifyUserToken, requireAdmin, userController.deleteUser);

export default router;

