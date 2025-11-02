export const API_VERSION = '1.0.0';

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const;

export const DEVICE_TYPES = {
  LIGHT: 'light',
  SWITCH: 'switch',
  THERMOSTAT: 'thermostat',
  LOCK: 'lock',
  CAMERA: 'camera',
  SENSOR: 'sensor',
  PLUG: 'plug',
  FAN: 'fan',
  BLINDS: 'blinds',
  GARAGE_DOOR: 'garage_door',
  DOORBELL: 'doorbell',
  SPEAKER: 'speaker',
  TV: 'tv',
  VACUUM: 'vacuum',
  AIR_PURIFIER: 'air_purifier'
} as const;

export const DEVICE_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  UNAVAILABLE: 'unavailable',
  UPDATING: 'updating',
  ERROR: 'error'
} as const;

export const PROTOCOLS = {
  ZIGBEE: 'zigbee',
  ZWAVE: 'zwave',
  WIFI: 'wifi',
  BLUETOOTH: 'bluetooth',
  MATTER: 'matter',
  THREAD: 'thread'
} as const;

export const EVENT_TYPES = {
  DEVICE_ADDED: 'device.added',
  DEVICE_REMOVED: 'device.removed',
  DEVICE_UPDATED: 'device.updated',
  DEVICE_STATE_CHANGED: 'device.state_changed',
  AUTOMATION_TRIGGERED: 'automation.triggered',
  AUTOMATION_EXECUTED: 'automation.executed',
  SCENE_ACTIVATED: 'scene.activated',
  USER_LOGGED_IN: 'user.logged_in',
  USER_LOGGED_OUT: 'user.logged_out',
  ALERT_CREATED: 'alert.created',
  NOTIFICATION_SENT: 'notification.sent'
} as const;

export const CACHE_TTL = {
  SHORT: 60,
  MEDIUM: 300,
  LONG: 3600,
  VERY_LONG: 86400
} as const;

export const RATE_LIMITS = {
  DEFAULT: 100,
  AUTH: 5,
  DEVICE_CONTROL: 50,
  API_GATEWAY: 1000
} as const;

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100
} as const;

export const TEMPERATURE_UNITS = {
  CELSIUS: 'celsius',
  FAHRENHEIT: 'fahrenheit'
} as const;

export const ENERGY_UNITS = {
  WATT_HOUR: 'Wh',
  KILOWATT_HOUR: 'kWh',
  MEGAWATT_HOUR: 'MWh'
} as const;
