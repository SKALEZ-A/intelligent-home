export interface DeviceValidationResult {
  valid: boolean;
  errors: string[];
}

export class DeviceValidator {
  static validateDeviceId(deviceId: string): DeviceValidationResult {
    const errors: string[] = [];

    if (!deviceId) {
      errors.push('Device ID is required');
    }

    if (deviceId && deviceId.length < 3) {
      errors.push('Device ID must be at least 3 characters');
    }

    if (deviceId && !/^[a-zA-Z0-9_-]+$/.test(deviceId)) {
      errors.push('Device ID can only contain alphanumeric characters, hyphens, and underscores');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  static validateDeviceName(name: string): DeviceValidationResult {
    const errors: string[] = [];

    if (!name) {
      errors.push('Device name is required');
    }

    if (name && name.length < 2) {
      errors.push('Device name must be at least 2 characters');
    }

    if (name && name.length > 100) {
      errors.push('Device name must not exceed 100 characters');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  static validateDeviceType(type: string): DeviceValidationResult {
    const errors: string[] = [];
    const validTypes = [
      'light',
      'switch',
      'sensor',
      'thermostat',
      'lock',
      'camera',
      'speaker',
      'tv',
      'fan',
      'blind',
      'outlet',
      'garage',
      'doorbell',
      'alarm',
      'other'
    ];

    if (!type) {
      errors.push('Device type is required');
    }

    if (type && !validTypes.includes(type.toLowerCase())) {
      errors.push(`Invalid device type. Must be one of: ${validTypes.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  static validateProtocol(protocol: string): DeviceValidationResult {
    const errors: string[] = [];
    const validProtocols = [
      'zigbee',
      'zwave',
      'wifi',
      'bluetooth',
      'thread',
      'matter',
      'http',
      'mqtt'
    ];

    if (!protocol) {
      errors.push('Protocol is required');
    }

    if (protocol && !validProtocols.includes(protocol.toLowerCase())) {
      errors.push(`Invalid protocol. Must be one of: ${validProtocols.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  static validateDeviceState(state: Record<string, any>): DeviceValidationResult {
    const errors: string[] = [];

    if (!state || typeof state !== 'object') {
      errors.push('Device state must be an object');
    }

    if (state && Object.keys(state).length === 0) {
      errors.push('Device state cannot be empty');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  static validateCapabilities(capabilities: string[]): DeviceValidationResult {
    const errors: string[] = [];
    const validCapabilities = [
      'on_off',
      'brightness',
      'color',
      'color_temperature',
      'temperature',
      'humidity',
      'motion',
      'contact',
      'lock',
      'unlock',
      'open',
      'close',
      'volume',
      'mute',
      'play',
      'pause',
      'stop'
    ];

    if (!Array.isArray(capabilities)) {
      errors.push('Capabilities must be an array');
    }

    if (capabilities && capabilities.length === 0) {
      errors.push('At least one capability is required');
    }

    if (capabilities) {
      const invalidCapabilities = capabilities.filter(
        cap => !validCapabilities.includes(cap)
      );

      if (invalidCapabilities.length > 0) {
        errors.push(`Invalid capabilities: ${invalidCapabilities.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  static validateDevice(device: any): DeviceValidationResult {
    const errors: string[] = [];

    const idValidation = this.validateDeviceId(device.id);
    const nameValidation = this.validateDeviceName(device.name);
    const typeValidation = this.validateDeviceType(device.type);
    const protocolValidation = this.validateProtocol(device.protocol);

    errors.push(...idValidation.errors);
    errors.push(...nameValidation.errors);
    errors.push(...typeValidation.errors);
    errors.push(...protocolValidation.errors);

    if (device.capabilities) {
      const capabilitiesValidation = this.validateCapabilities(device.capabilities);
      errors.push(...capabilitiesValidation.errors);
    }

    if (device.state) {
      const stateValidation = this.validateDeviceState(device.state);
      errors.push(...stateValidation.errors);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
