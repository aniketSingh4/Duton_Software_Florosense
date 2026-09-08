// User Role Enum
export const UserRole = {
  ADMIN: "admin",
  USER: "user",
  CLIENT: "client",
  BUILDER: "builder",
  CONTRACTOR: "contractor",
};

// User Model Schema
export class User {
  constructor(data) {
    this.id = data.id || null;
    this._id = data._id || null;
    this.username = data.username || "";
    this.email = data.email || "";
    this.password_hash = data.password_hash || null;
    this.client_name = data.client_name || "";
    this.site_name = data.site_name || "";
    this.site_address = data.site_address || "";
    this.spoc_name = data.spoc_name || "";
    this.spoc_contact = data.spoc_contact || null;
    this.role = data.role || UserRole.USER;
    this.is_active = data.is_active !== false;
    this.created_at = data.created_at || null;
    this.last_login = data.last_login || null;
  }

  toJSON() {
    return {
      id: this.id || (this._id ? (typeof this._id === 'string' ? this._id : this._id.toString()) : null),
      username: this.username,
      email: this.email,
      client_name: this.client_name,
      site_name: this.site_name,
      site_address: this.site_address,
      spoc_name: this.spoc_name,
      spoc_contact: this.spoc_contact,
      role: this.role,
      is_active: this.is_active,
      created_at: this.created_at,
      last_login: this.last_login,
    };
  }

  toMongoDoc() {
    const doc = {
      username: this.username,
      email: this.email,
      password_hash: this.password_hash,
      client_name: this.client_name,
      site_name: this.site_name,
      site_address: this.site_address,
      spoc_name: this.spoc_name,
      spoc_contact: this.spoc_contact,
      role: this.role,
      is_active: this.is_active,
    };

    if (this.id) {
      doc.id = this.id;
    }
    if (this.created_at) {
      doc.created_at = this.created_at;
    }
    if (this.last_login) {
      doc.last_login = this.last_login;
    }

    return doc;
  }
}

// Admin Model Schema
export class Admin {
  constructor(data) {
    this.id = data.id || null;
    this._id = data._id || null;
    this.username = data.username || "";
    this.email = data.email || "";
    this.password_hash = data.password_hash || null;
    this.full_name = data.full_name || "";
    this.role = data.role || "admin";
    this.is_active = data.is_active !== false;
    this.created_at = data.created_at || null;
    this.last_login = data.last_login || null;
  }

  toJSON() {
    return {
      id: this.id || (this._id ? (typeof this._id === 'string' ? this._id : this._id.toString()) : null),
      username: this.username,
      email: this.email,
      full_name: this.full_name,
      role: this.role,
      is_active: this.is_active,
      created_at: this.created_at,
      last_login: this.last_login,
    };
  }

  toMongoDoc() {
    const doc = {
      username: this.username,
      email: this.email,
      password_hash: this.password_hash,
      full_name: this.full_name,
      role: this.role,
      is_active: this.is_active,
    };

    if (this.id) {
      doc.id = this.id;
    }
    if (this.created_at) {
      doc.created_at = this.created_at;
    }
    if (this.last_login) {
      doc.last_login = this.last_login;
    }

    return doc;
  }
}

// User validation functions
export function validateUserRole(role) {
  const validRoles = [UserRole.ADMIN, UserRole.USER, UserRole.CLIENT, UserRole.BUILDER, UserRole.CONTRACTOR];
  if (!validRoles.includes(role)) {
    throw new Error(`role must be one of: ${validRoles.join(", ")}`);
  }
  return true;
}

export function validateEmail(email) {
  if (!email || typeof email !== "string") {
    throw new Error("email is required");
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error("email must be a valid email address");
  }
  return true;
}
