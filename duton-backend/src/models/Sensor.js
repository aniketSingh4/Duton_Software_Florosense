// Sensor Model Schema
export class Sensor {
  constructor(data) {
    this.id = data.id || null;
    this._id = data._id || null;
    this.sensor_id = data.sensor_id || "";
    this.device_id = data.device_id || data.sensor_id || "";
    this.location = data.location || {};
    this.is_active = data.is_active !== false;
    this.client_name = data.client_name || "";
    this.site_name = data.site_name || "";
    this.spoc_name = data.spoc_name || null;
    this.spoc_contact = data.spoc_contact || null;
    this.remark = data.remark || null;
    this.remark_date = data.remark_date || null;
    this.created_at = data.created_at || null;
  }

  toJSON() {
    return {
      id: this.id || (this._id ? (typeof this._id === 'string' ? this._id : this._id.toString()) : null),
      sensor_id: this.sensor_id,
      device_id: this.device_id,
      location: this.location,
      is_active: this.is_active,
      client_name: this.client_name,
      site_name: this.site_name,
      spoc_name: this.spoc_name,
      spoc_contact: this.spoc_contact,
      remark: this.remark,
      remark_date: this.remark_date,
      created_at: this.created_at,
    };
  }

  toMongoDoc() {
    const doc = {
      sensor_id: this.sensor_id,
      device_id: this.device_id,
      location: this.location,
      is_active: this.is_active,
      client_name: this.client_name,
      site_name: this.site_name,
    };

    if (this.id) {
      doc.id = this.id;
    }
    if (this.spoc_name) {
      doc.spoc_name = this.spoc_name;
    }
    if (this.spoc_contact) {
      doc.spoc_contact = this.spoc_contact;
    }
    if (this.remark) {
      doc.remark = this.remark;
    }
    if (this.remark_date) {
      doc.remark_date = this.remark_date;
    }
    if (this.created_at) {
      doc.created_at = this.created_at;
    }

    return doc;
  }
}

// UserSensor Model Schema (Assignment)
export class UserSensor {
  constructor(data) {
    this.id = data.id || null;
    this._id = data._id || null;
    this.username = data.username || "";
    this.sensor_id = data.sensor_id || "";
    this.assigned_at = data.assigned_at || null;
  }

  toJSON() {
    return {
      id: this.id || (this._id ? (typeof this._id === 'string' ? this._id : this._id.toString()) : null),
      username: this.username,
      sensor_id: this.sensor_id,
      assigned_at: this.assigned_at,
    };
  }

  toMongoDoc() {
    const doc = {
      username: this.username,
      sensor_id: this.sensor_id,
    };

    if (this.id) {
      doc.id = this.id;
    }
    if (this.assigned_at) {
      doc.assigned_at = this.assigned_at;
    }

    return doc;
  }
}

