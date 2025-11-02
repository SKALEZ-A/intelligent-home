import Joi from 'joi';

export const createDeviceSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  type: Joi.string().valid(
    'light', 'switch', 'thermostat', 'lock', 'camera', 'sensor', 'plug', 
    'fan', 'blind', 'garage', 'doorbell', 'valve', 'appliance', 'speaker', 
    'tv', 'vacuum', 'air_purifier', 'humidifier', 'dehumidifier', 'heater', 
    'cooler', 'irrigation', 'pool', 'spa'
  ).required(),
  protocol: Joi.string().valid('zigbee', 'zwave', 'wifi', 'bluetooth', 'thread', 'matter', 'http', 'mqtt', 'modbus').required(),
  manufacturer: Joi.string().required(),
  model: Joi.string().required(),
  firmwareVersion: Joi.string().optional(),
  hardwareVersion: Joi.string().optional(),
  serialNumber: Joi.string().optional(),
  capabilities: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    type: Joi.string().valid('boolean', 'number', 'string', 'enum', 'color', 'temperature').required(),
    readable: Joi.boolean().required(),
    writable: Joi.boolean().required(),
    min: Joi.number().optional(),
    max: Joi.number().optional(),
    step: Joi.number().optional(),
    unit: Joi.string().optional(),
    values: Joi.array().items(Joi.string()).optional(),
  })).required(),
  location: Joi.string().required(),
  room: Joi.string().optional(),
  floor: Joi.string().optional(),
  hubId: Joi.string().uuid().required(),
  homeId: Joi.string().uuid().required(),
  metadata: Joi.object({
    tags: Joi.array().items(Joi.string()).optional(),
    category: Joi.string().optional(),
    icon: Joi.string().optional(),
    color: Joi.string().optional(),
    customFields: Joi.object().optional(),
    installDate: Joi.date().optional(),
    warrantyExpiry: Joi.date().optional(),
    purchasePrice: Joi.number().optional(),
    energyRating: Joi.string().optional(),
  }).optional(),
});

export const updateDeviceSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  location: Joi.string().optional(),
  room: Joi.string().optional(),
  floor: Joi.string().optional(),
  capabilities: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    type: Joi.string().valid('boolean', 'number', 'string', 'enum', 'color', 'temperature').required(),
    readable: Joi.boolean().required(),
    writable: Joi.boolean().required(),
    min: Joi.number().optional(),
    max: Joi.number().optional(),
    step: Joi.number().optional(),
    unit: Joi.string().optional(),
    values: Joi.array().items(Joi.string()).optional(),
  })).optional(),
  metadata: Joi.object({
    tags: Joi.array().items(Joi.string()).optional(),
    category: Joi.string().optional(),
    icon: Joi.string().optional(),
    color: Joi.string().optional(),
    customFields: Joi.object().optional(),
    installDate: Joi.date().optional(),
    warrantyExpiry: Joi.date().optional(),
    purchasePrice: Joi.number().optional(),
    energyRating: Joi.string().optional(),
  }).optional(),
});

export const deviceCommandSchema = Joi.object({
  command: Joi.string().required(),
  parameters: Joi.object().optional(),
  priority: Joi.number().min(0).max(10).optional().default(5),
});

export const pairDeviceSchema = Joi.object({
  protocol: Joi.string().valid('zigbee', 'zwave', 'wifi', 'bluetooth', 'thread', 'matter', 'http', 'mqtt', 'modbus').required(),
  deviceInfo: Joi.object().required(),
  homeId: Joi.string().uuid().required(),
});
