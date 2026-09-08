import jwt from "jsonwebtoken";
import { UserRole } from "../models/index.js";

// JWT Secret (should be in environment variables)
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";

// Helper function to generate JWT token for admin
export function generateAdminToken(admin) {
  // Handle both ObjectId _id and UUID id field
  const adminId = admin.id || (admin._id ? (typeof admin._id === 'string' ? admin._id : admin._id.toString()) : null);
  
  return jwt.sign(
    {
      id: adminId,
      username: admin.username,
      email: admin.email,
      role: admin.role || "admin",
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// Helper function to generate JWT token for user
export function generateUserToken(user) {
  // Handle both ObjectId _id and UUID id field
  const userId = user.id || (user._id ? (typeof user._id === 'string' ? user._id : user._id.toString()) : null);
  
  return jwt.sign(
    {
      id: userId,
      username: user.username,
      email: user.email,
      role: user.role || "user",
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// Middleware to verify JWT token for admin
export function verifyAdminToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ 
        detail: "No token provided",
        hint: "Make sure to include 'Authorization: Bearer <token>' header"
      });
    }

    const token = authHeader.substring(7).trim();
    
    if (!token) {
      return res.status(401).json({ 
        detail: "Token is empty",
        hint: "Make sure the token is provided after 'Bearer '"
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    // Set both req.admin and req.user for compatibility
    req.admin = decoded;
    req.user = decoded;
    next();
  } catch (error) {
    let errorMessage = "Invalid or expired token";
    let hint = "";
    
    if (error.name === "TokenExpiredError") {
      errorMessage = "Token has expired";
      hint = "Please login again to get a new token";
    } else if (error.name === "JsonWebTokenError") {
      errorMessage = "Invalid token format";
      hint = "The token may be corrupted or signed with a different secret. Try logging in again.";
    } else if (error.name === "NotBeforeError") {
      errorMessage = "Token not active yet";
      hint = "The token is not valid yet";
    }
    
    if (process.env.DEBUG === "true" || process.env.TICKET_DEBUG === "true") {
      console.error("Token verification error:", error.name, error.message);
    }
    
    return res.status(401).json({ 
      detail: errorMessage,
      hint: hint,
      error_type: error.name
    });
  }
}

// Middleware to verify JWT token for users
export function verifyUserToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ 
        detail: "No token provided",
        hint: "Make sure to include 'Authorization: Bearer <token>' header"
      });
    }

    const token = authHeader.substring(7).trim();
    
    if (!token) {
      return res.status(401).json({ 
        detail: "Token is empty",
        hint: "Make sure the token is provided after 'Bearer '"
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    let errorMessage = "Invalid or expired token";
    let hint = "";
    
    if (error.name === "TokenExpiredError") {
      errorMessage = "Token has expired";
      hint = "Please login again to get a new token";
    } else if (error.name === "JsonWebTokenError") {
      errorMessage = "Invalid token format";
      hint = "The token may be corrupted or signed with a different secret. Try logging in again.";
    }
    
    return res.status(401).json({ 
      detail: errorMessage,
      hint: hint,
      error_type: error.name
    });
  }
}

// Middleware to require admin role
export function requireAdmin(req, res, next) {
  if (req.user && req.user.role === UserRole.ADMIN) {
    return next();
  }
  return res.status(403).json({
    detail: "Admin access required"
  });
}

// Middleware to verify token for admin, assignee, builder, or contractor (supports both admin and user tokens)
export function verifyAdminOrAssigneeToken(req, res, next) {
  // First try to verify as admin token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ 
      detail: "No token provided",
      hint: "Make sure to include 'Authorization: Bearer <token>' header"
    });
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return res.status(401).json({ 
      detail: "Token is empty",
      hint: "Make sure the token is provided after 'Bearer '"
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if it's an admin, assignee, builder, or contractor token
    if (decoded.role === "admin" || decoded.role === "assignee" || decoded.role === "builder" || decoded.role === "contractor") {
      // Set both req.admin and req.user for compatibility
      req.admin = decoded;
      req.user = decoded;
      return next();
    }
    
    return res.status(403).json({
      detail: "Access denied. Admin, assignee, builder, or contractor role required.",
    });
  } catch (error) {
    let errorMessage = "Invalid or expired token";
    let hint = "";
    
    if (error.name === "TokenExpiredError") {
      errorMessage = "Token has expired";
      hint = "Please login again to get a new token";
    } else if (error.name === "JsonWebTokenError") {
      errorMessage = "Invalid token format";
      hint = "The token may be corrupted or signed with a different secret. Try logging in again.";
    }
    
    return res.status(401).json({ 
      detail: errorMessage,
      hint: hint,
      error_type: error.name
    });
  }
}

