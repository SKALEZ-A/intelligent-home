import Joi from 'joi';

const triggerSchema = Joi.object({
  type: Joi.string().required().valid(
    'device_state_change',
    'time_based',
    'location_based',
    'weather_based',
    'energy_threshold',
    'manual'
  ),
  deviceId: Joi.string().when('type', {
    is: 'device_state_change',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  property: Joi.string(),
  value: Joi.any(),
  operator: Joi.string().valid('equals', 'not_equals', 'greater_than', 'less_than', 'contains'),
  schedule: Joi.object({
    type: Joi.string().valid('cron', 'interval', 'once'),
    expression: Joi.string(),
    interval: Joi.number(),
    time: Joi.date(),
  }).when('type', {
    is: 'time_based',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  location: Joi.object({
    latitude: Joi.number().required(),
    longitude: Joi.number().required(),
    radius: Joi.number().required(),
    event: Joi.string().valid('enter', 'exit').required(),
  }).when('type', {
    is: 'location_based',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  weatherCondition: Joi.object({
    condition: Joi.string().required(),
    operator: Joi.string().valid('equals', 'greater_than', 'less_than').required(),
    value: Joi.any().required(),
  }).when('type', {
    is: 'weather_based',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  energyThreshold: Joi.object({
    metric: Joi.string().required(),
    threshold: Joi.number().required(),
    operator: Joi.string().valid('greater_than', 'less_than').required(),
  }).when('type', {
    is: 'energy_threshold',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
});

const conditionSchema = Joi.object({
  type: Joi.string().required().valid(
    'device_state',
    'time_range',
    'day_of_week',
    'weather',
    'energy_usage',
    'user_presence'
  ),
  deviceId: Joi.string(),
  property: Joi.string(),
  operator: Joi.string().valid('equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'between'),
  value: Joi.any(),
  timeRange: Joi.object({
    start: Joi.string().required(),
    end: Joi.string().required(),
  }),
  daysOfWeek: Joi.array().items(Joi.number().min(0).max(6)),
  logicalOperator: Joi.string().valid('AND', 'OR'),
});

const actionSchema = Joi.object({
  type: Joi.string().required().valid(
    'device_command',
    'scene_execution',
    'notification',
    'delay',
    'http_request'
  ),
  deviceId: Joi.string().when('type', {
    is: 'device_command',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  command: Joi.string(),
  parameters: Joi.object(),
  sceneId: Joi.string().when('type', {
    is: 'scene_execution',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  notification: Joi.object({
    title: Joi.string().required(),
    message: Joi.string().required(),
    priority: Joi.string().valid('low', 'medium', 'high'),
    channels: Joi.array().items(Joi.string().valid('push', 'email', 'sms')),
  }).when('type', {
    is: 'notification',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  delay: Joi.number().when('type', {
    is: 'delay',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  httpRequest: Joi.object({
    url: Joi.string().uri().required(),
    method: Joi.string().valid('GET', 'POST', 'PUT', 'DELETE').required(),
    headers: Joi.object(),
    body: Joi.any(),
  }).when('type', {
    is: 'http_request',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  order: Joi.number().required(),
});

export const automationValidators = {
  createAutomation: Joi.object({
    name: Joi.string().required().min(1).max(100),
    description: Joi.string().max(500),
    enabled: Joi.boolean().default(true),
    trigger: triggerSchema.required(),
    conditions: Joi.array().items(conditionSchema).default([]),
    actions: Joi.array().items(actionSchema).min(1).required(),
    priority: Joi.number().min(0).max(10).default(5),
    tags: Joi.array().items(Joi.string()),
    metadata: Joi.object(),
  }),

  updateAutomation: Joi.object({
    name: Joi.string().min(1).max(100),
    description: Joi.string().max(500),
    enabled: Joi.boolean(),
    trigger: triggerSchema,
    conditions: Joi.array().items(conditionSchema),
    actions: Joi.array().items(actionSchema).min(1),
    priority: Joi.number().min(0).max(10),
    tags: Joi.array().items(Joi.string()),
    metadata: Joi.object(),
  }).min(1),

  toggleAutomation: Joi.object({
    enabled: Joi.boolean().required(),
  }),
};
