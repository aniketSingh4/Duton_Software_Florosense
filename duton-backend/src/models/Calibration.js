// Calibration Model Schema
export class Calibration {
  constructor(data) {
    this.id = data.id || null;
    this._id = data._id || null;
    this.sensor_id = data.sensor_id || "";
    
    // Required fields (used in formula)
    this.rh_strength_a = data.rh_strength_a ?? 0;
    this.rh_curvature_b = data.rh_curvature_b ?? 0;
    this.initial_offset_k0 = data.initial_offset_k0 ?? 0;
    this.fine_multiplier_k1 = data.fine_multiplier_k1 ?? 1;
    
    // Optional fields (store but do not use in formula)
    this.offset_alpha = data.offset_alpha ?? null;
    this.scale_factor_beta = data.scale_factor_beta ?? null;
    this.pm_swap = data.pm_swap ?? false;
    this.random_offset_pm25 = data.random_offset_pm25 ?? null;
    this.random_offset_pm10 = data.random_offset_pm10 ?? null;
    
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
  }

  toJSON() {
    return {
      id: this.id || (this._id ? (typeof this._id === 'string' ? this._id : this._id.toString()) : null),
      sensor_id: this.sensor_id,
      rh_strength_a: this.rh_strength_a,
      rh_curvature_b: this.rh_curvature_b,
      initial_offset_k0: this.initial_offset_k0,
      fine_multiplier_k1: this.fine_multiplier_k1,
      offset_alpha: this.offset_alpha,
      scale_factor_beta: this.scale_factor_beta,
      pm_swap: this.pm_swap,
      random_offset_pm25: this.random_offset_pm25,
      random_offset_pm10: this.random_offset_pm10,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }

  toMongoDoc() {
    const doc = {
      sensor_id: this.sensor_id,
      rh_strength_a: this.rh_strength_a,
      rh_curvature_b: this.rh_curvature_b,
      initial_offset_k0: this.initial_offset_k0,
      fine_multiplier_k1: this.fine_multiplier_k1,
    };

    if (this.id) {
      doc.id = this.id;
    }
    if (this.offset_alpha !== null && this.offset_alpha !== undefined) {
      doc.offset_alpha = this.offset_alpha;
    }
    if (this.scale_factor_beta !== null && this.scale_factor_beta !== undefined) {
      doc.scale_factor_beta = this.scale_factor_beta;
    }
    if (this.pm_swap !== undefined) {
      doc.pm_swap = this.pm_swap;
    }
    if (this.random_offset_pm25 !== null && this.random_offset_pm25 !== undefined) {
      doc.random_offset_pm25 = this.random_offset_pm25;
    }
    if (this.random_offset_pm10 !== null && this.random_offset_pm10 !== undefined) {
      doc.random_offset_pm10 = this.random_offset_pm10;
    }
    if (this.created_at) {
      doc.created_at = this.created_at;
    }
    if (this.updated_at) {
      doc.updated_at = this.updated_at;
    }

    return doc;
  }
}

