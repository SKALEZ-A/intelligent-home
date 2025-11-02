import Joi from 'joi';

export const energyValidators = {
  recordReading: Joi.object({
    deviceId: Joi.string().required(),
    consumption: Joi.number().positive().required(),
    unit: Joi.string().valid('kWh', 'Wh', 'W').required(),
    cost: Joi.number().positive().optional(),
    timestamp: Joi.date().optional(),
    metadata: Joi.object().optional(),
  }),

  getReadings: Joi.object({
    deviceId: Joi.string().optional(),
    startDate: Joi.date().required(),
    endDate: Joi.date().required().greater(Joi.ref('startDate')),
    limit: Joi.number().integer().min(1).max(1000).optional(),
  }),

  getAggregated: Joi.object({
    period: Joi.string().valid('hour', 'day', 'week', 'month').required(),
    startDate: Joi.date().required(),
    endDate: Joi.date().required().greater(Joi.ref('startDate')),
  }),

  createProfile: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    peakHours: Joi.array().items(Joi.number().min(0).max(23)).required(),
    offPeakHours: Joi.array().items(Joi.number().min(0).max(23)).required(),
    peakRate: Joi.number().positive().required(),
    offPeakRate: Joi.number().positive().required(),
    currency: Joi.string().length(3).required(),
  }),
};
