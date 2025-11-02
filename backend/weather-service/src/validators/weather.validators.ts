import Joi from 'joi';

export const weatherValidators = {
  getWeather: Joi.object({
    location: Joi.string().min(1).max(100).optional(),
    latitude: Joi.number().min(-90).max(90).optional(),
    longitude: Joi.number().min(-180).max(180).optional(),
  }).or('location', 'latitude'),

  getForecast: Joi.object({
    location: Joi.string().min(1).max(100).optional(),
    latitude: Joi.number().min(-90).max(90).optional(),
    longitude: Joi.number().min(-180).max(180).optional(),
    days: Joi.number().integer().min(1).max(14).default(7),
  }).or('location', 'latitude'),

  createAlert: Joi.object({
    location: Joi.string().min(1).max(100).required(),
    type: Joi.string().valid('temperature', 'precipitation', 'wind', 'storm').required(),
    condition: Joi.string().valid('above', 'below', 'equals').required(),
    threshold: Joi.number().required(),
    enabled: Joi.boolean().default(true),
  }),
};
