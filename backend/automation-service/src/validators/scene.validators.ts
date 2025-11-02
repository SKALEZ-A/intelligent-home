import Joi from 'joi';

const sceneActionSchema = Joi.object({
  deviceId: Joi.string().required(),
  action: Joi.string().required(),
  parameters: Joi.object().default({}),
  delay: Joi.number().min(0).default(0),
  order: Joi.number().required(),
});

export const sceneValidators = {
  createScene: Joi.object({
    name: Joi.string().required().min(1).max(100),
    description: Joi.string().max(500),
    icon: Joi.string().max(50),
    category: Joi.string().valid(
      'lighting',
      'climate',
      'security',
      'entertainment',
      'morning',
      'evening',
      'away',
      'home',
      'sleep',
      'custom'
    ),
    actions: Joi.array().items(sceneActionSchema).min(1).required(),
  }),

  updateScene: Joi.object({
    name: Joi.string().min(1).max(100),
    description: Joi.string().max(500),
    icon: Joi.string().max(50),
    category: Joi.string().valid(
      'lighting',
      'climate',
      'security',
      'entertainment',
      'morning',
      'evening',
      'away',
      'home',
      'sleep',
      'custom'
    ),
    actions: Joi.array().items(sceneActionSchema).min(1),
  }).min(1),
};
