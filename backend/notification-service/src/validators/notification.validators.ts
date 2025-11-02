import Joi from 'joi';

export const notificationValidators = {
  create: Joi.object({
    type: Joi.string().valid('alert', 'info', 'warning', 'success').required(),
    title: Joi.string().min(1).max(200).required(),
    message: Joi.string().min(1).max(1000).required(),
    priority: Joi.string().valid('low', 'medium', 'high', 'urgent').required(),
    channels: Joi.array().items(Joi.string().valid('push', 'email', 'sms', 'in_app')).min(1).required(),
    metadata: Joi.object().optional(),
  }),

  updatePreferences: Joi.object({
    enablePush: Joi.boolean().optional(),
    enableEmail: Joi.boolean().optional(),
    enableSms: Joi.boolean().optional(),
    quietHoursStart: Joi.number().min(0).max(23).optional(),
    quietHoursEnd: Joi.number().min(0).max(23).optional(),
    categories: Joi.object().pattern(
      Joi.string(),
      Joi.boolean()
    ).optional(),
  }),
};
