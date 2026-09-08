import bcrypt from "bcrypt";
import * as database from "../services/database.js";
import { UserRole, validateEmail, validateUserRole } from "../models/index.js";
import { generateUserToken } from "../middleware/auth.js";

export const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        detail: "Username and password are required",
      });
    }

    // Try exact username first, then case-insensitive
    let user = await database.getUserByUsername(username);
    
    // If not found, try case-insensitive search
    if (!user) {
      const allUsers = await database.getAllUsers({});
      user = allUsers.find(u => 
        u.username && u.username.toLowerCase() === username.toLowerCase()
      );
      // If found case-insensitive, get the actual user from database
      if (user) {
        user = await database.getUserByUsername(user.username);
      }
    }

    if (!user) {
      return res.status(401).json({
        detail: "Invalid username or password",
      });
    }

    if (user.is_active === false) {
      return res.status(403).json({
        detail: "User account is deactivated",
      });
    }

    // Check if password_hash exists
    if (!user.password_hash) {
      console.error(`❌ User "${username}" has no password_hash`);
      return res.status(500).json({
        detail: "User account configuration error. Please contact administrator.",
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        detail: "Invalid username or password",
      });
    }

    await database.updateUserLastLogin(username);
    const token = generateUserToken(user);

    // Handle both ObjectId _id and UUID id field
    const userId = user.id || (user._id ? (typeof user._id === 'string' ? user._id : user._id.toString()) : null);

    res.json({
      success: true,
      token,
      user: {
        id: userId,
        username: user.username,
        email: user.email,
        client_name: user.client_name,
        site_name: user.site_name,
        site_address: user.site_address,
        spoc_name: user.spoc_name,
        spoc_contact: user.spoc_contact,
        role: user.role || "user",
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (req, res, next) => {
  try {
    const user = await database.getUserByUsername(req.user.username);
    if (!user) {
      return res.status(404).json({
        detail: "User not found",
      });
    }

    // Handle both ObjectId _id and UUID id field
    const userId = user.id || (user._id ? (typeof user._id === 'string' ? user._id : user._id.toString()) : null);
    const toISOString = (value) => {
      if (!value) return null;
      if (value instanceof Date) return value.toISOString();
      if (typeof value === 'string') {
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date.toISOString();
      }
      return null;
    };

    res.json({
      success: true,
      message: "Profile retrieved successfully",
      data: {
        profile: {
          id: userId,
          username: user.username,
          email: user.email,
          client_name: user.client_name,
          site_name: user.site_name,
          site_address: user.site_address,
          spoc_name: user.spoc_name,
          spoc_contact: user.spoc_contact,
          role: user.role || "user",
          is_active: user.is_active,
          created_at: toISOString(user.created_at),
          last_login: toISOString(user.last_login),
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const user = await database.getUserByUsername(req.user.username);
    if (!user) {
      return res.status(404).json({
        detail: "User not found",
      });
    }

    const updates = {};
    const allowedFields = [
      "client_name",
      "site_name",
      "site_address",
      "spoc_name",
      "spoc_contact",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const updatedUser = await database.updateUser(user._id, updates);
    if (!updatedUser) {
      return res.status(404).json({
        detail: "User not found",
      });
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: {
        profile: updatedUser
      }
    });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { username, password, new_password } = req.body;

    if (!username || !password || !new_password) {
      return res.status(400).json({
        detail: "Username, password (current), and new_password are required",
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        detail: "New password must be at least 6 characters long",
      });
    }

    // Try exact username first, then case-insensitive
    let user = await database.getUserByUsername(username);
    
    // If not found, try case-insensitive search
    if (!user) {
      const allUsers = await database.getAllUsers({});
      user = allUsers.find(u => 
        u.username && u.username.toLowerCase() === username.toLowerCase()
      );
      // If found case-insensitive, get the actual user from database
      if (user) {
        user = await database.getUserByUsername(user.username);
      }
    }

    if (!user) {
      return res.status(404).json({
        detail: "User not found",
      });
    }

    if (user.is_active === false) {
      return res.status(403).json({
        detail: "User account is deactivated",
      });
    }

    // Check if password_hash exists
    if (!user.password_hash) {
      return res.status(500).json({
        detail: "User account configuration error. Please contact administrator.",
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        detail: "Current password is incorrect",
      });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(new_password, 10);

    // Update password
    const userId = user.id || (user._id ? (typeof user._id === 'string' ? user._id : user._id.toString()) : null);
    const updatedUser = await database.updateUser(userId, { password_hash: newPasswordHash });
    
    if (!updatedUser) {
      return res.status(500).json({
        detail: "Failed to update password",
      });
    }

    res.json({
      success: true,
      message: "Password changed successfully",
      username: updatedUser.username
    });
  } catch (error) {
    next(error);
  }
};

export const listUsers = async (req, res, next) => {
  try {
    const filters = {
      is_active: req.query.is_active !== undefined ? req.query.is_active === "true" : undefined,
      search: req.query.search || null,
    };

    if (req.query.roles) {
      filters.roles = req.query.roles.split(",").map((role) => role.trim()).filter(Boolean);
    } else if (req.query.role) {
      filters.role = req.query.role;
    }

    const users = await database.getAllUsers(filters);
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 100;
    const totalCount = users.length;
    const paginatedUsers = users.slice(skip, skip + limit);

    res.json({
      success: true,
      message: "Users retrieved successfully",
      data: {
        users: paginatedUsers,
        total_count: totalCount,
        skip: skip,
        limit: limit
      }
    });
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req, res, next) => {
  try {
    const { username, email, password, client_name, site_name, site_address, spoc_name, spoc_contact, role } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        detail: "Username, email, and password are required",
      });
    }

    try {
      validateEmail(email);
    } catch (validationError) {
      return res.status(400).json({
        detail: validationError.message,
      });
    }

    const userRole = role || "user";
    try {
      validateUserRole(userRole);
    } catch (validationError) {
      return res.status(400).json({
        detail: validationError.message,
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        detail: "Password must be at least 6 characters long",
      });
    }

    const existingUsername = await database.getUserByUsername(username);
    if (existingUsername) {
      return res.status(400).json({
        detail: "Username already exists",
      });
    }

    const existingEmail = await database.getUserByEmail(email);
    if (existingEmail) {
      return res.status(400).json({
        detail: "Email already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const userData = {
      username,
      email,
      password_hash: passwordHash,
      client_name: client_name || "",
      site_name: site_name || "",
      site_address: site_address || "",
      spoc_name: spoc_name || "",
      spoc_contact: spoc_contact || null,
      role: userRole,
      is_active: true,
    };

    const newUser = await database.createUser(userData);

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: {
        user: newUser
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const user = await database.getUserById(req.params.user_id);
    if (!user) {
      return res.status(404).json({
        detail: "User not found",
      });
    }

    const sensors = await database.getUserSensors(user.username);

    // Handle both ObjectId _id and UUID id field
    const userId = user.id || (user._id ? (typeof user._id === 'string' ? user._id : user._id.toString()) : null);
    const toISOString = (value) => {
      if (!value) return null;
      if (value instanceof Date) return value.toISOString();
      if (typeof value === 'string') {
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date.toISOString();
      }
      return null;
    };

    res.json({
      success: true,
      message: "User retrieved successfully",
      data: {
        user: {
          id: userId,
          username: user.username,
          email: user.email,
          client_name: user.client_name,
          site_name: user.site_name,
          site_address: user.site_address,
          spoc_name: user.spoc_name,
          spoc_contact: user.spoc_contact,
          role: user.role || "user",
          is_active: user.is_active,
          created_at: toISOString(user.created_at),
          last_login: toISOString(user.last_login),
        },
        sensors: sensors
      }
    });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const user = await database.getUserById(req.params.user_id);
    if (!user) {
      return res.status(404).json({
        detail: "User not found",
      });
    }

    const updates = {};
    const allowedFields = [
      "client_name",
      "site_name",
      "site_address",
      "spoc_name",
      "spoc_contact",
      "role",
      "is_active",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === "role") {
          try {
            validateUserRole(req.body[field]);
            updates[field] = req.body[field];
          } catch (validationError) {
            return res.status(400).json({
              detail: validationError.message,
            });
          }
        } else if (field === "is_active") {
          updates[field] = req.body[field] === true || req.body[field] === "true";
        } else {
          updates[field] = req.body[field];
        }
      }
    }

    const updatedUser = await database.updateUser(req.params.user_id, updates);
    if (!updatedUser) {
      return res.status(404).json({
        detail: "User not found",
      });
    }

    res.json({
      success: true,
      message: "User updated successfully",
      data: {
        user: updatedUser
      }
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserStatus = async (req, res, next) => {
  try {
    const { is_active } = req.body;
    
    if (is_active === undefined) {
      return res.status(400).json({
        detail: "is_active is required",
      });
    }

    const user = await database.getUserById(req.params.user_id);
    if (!user) {
      return res.status(404).json({
        detail: "User not found",
      });
    }

    const updatedUser = await database.updateUser(req.params.user_id, { 
      is_active: is_active === true || is_active === "true" 
    });

    res.json({
      success: true,
      message: `User ${updatedUser.is_active ? "activated" : "deactivated"} successfully`,
      data: {
        user: updatedUser
      }
    });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const user = await database.getUserById(req.params.user_id);
    if (!user) {
      return res.status(404).json({
        detail: "User not found",
      });
    }

    if (user.username === req.user.username) {
      return res.status(400).json({
        detail: "Cannot delete your own account",
      });
    }

    const deleted = await database.deleteUser(req.params.user_id);
    if (!deleted) {
      return res.status(404).json({
        detail: "User not found",
      });
    }

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const verifyToken = async (req, res, next) => {
  try {
    const user = await database.getUserByUsername(req.user.username);
    if (!user || user.is_active === false) {
      return res.status(401).json({
        detail: "User not found or deactivated",
      });
    }

    // Handle both ObjectId _id and UUID id field
    const userId = user.id || (user._id ? (typeof user._id === 'string' ? user._id : user._id.toString()) : null);

    res.json({
      success: true,
      user: {
        id: userId,
        username: user.username,
        email: user.email,
        client_name: user.client_name,
        site_name: user.site_name,
        site_address: user.site_address,
        spoc_name: user.spoc_name,
        spoc_contact: user.spoc_contact,
        role: user.role || "user",
      },
    });
  } catch (error) {
    next(error);
  }
};

