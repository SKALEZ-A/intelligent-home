export class TemperatureFormatter {
  static celsiusToFahrenheit(celsius: number): number {
    return (celsius * 9/5) + 32;
  }

  static fahrenheitToCelsius(fahrenheit: number): number {
    return (fahrenheit - 32) * 5/9;
  }

  static celsiusToKelvin(celsius: number): number {
    return celsius + 273.15;
  }

  static kelvinToCelsius(kelvin: number): number {
    return kelvin - 273.15;
  }

  static formatTemperature(value: number, unit: 'C' | 'F' | 'K' = 'C', decimals: number = 1): string {
    return `${value.toFixed(decimals)}°${unit}`;
  }

  static convertTemperature(value: number, from: 'C' | 'F' | 'K', to: 'C' | 'F' | 'K'): number {
    if (from === to) return value;

    // Convert to Celsius first
    let celsius: number;
    switch (from) {
      case 'C':
        celsius = value;
        break;
      case 'F':
        celsius = this.fahrenheitToCelsius(value);
        break;
      case 'K':
        celsius = this.kelvinToCelsius(value);
        break;
    }

    // Convert from Celsius to target unit
    switch (to) {
      case 'C':
        return celsius;
      case 'F':
        return this.celsiusToFahrenheit(celsius);
      case 'K':
        return this.celsiusToKelvin(celsius);
    }
  }

  static getComfortLevel(temperature: number, unit: 'C' | 'F' = 'C'): string {
    const tempC = unit === 'F' ? this.fahrenheitToCelsius(temperature) : temperature;

    if (tempC < 15) return 'Cold';
    if (tempC < 18) return 'Cool';
    if (tempC < 22) return 'Comfortable';
    if (tempC < 26) return 'Warm';
    return 'Hot';
  }

  static calculateHeatIndex(temperature: number, humidity: number, unit: 'C' | 'F' = 'C'): number {
    const tempF = unit === 'C' ? this.celsiusToFahrenheit(temperature) : temperature;
    
    // Rothfusz regression
    const c1 = -42.379;
    const c2 = 2.04901523;
    const c3 = 10.14333127;
    const c4 = -0.22475541;
    const c5 = -0.00683783;
    const c6 = -0.05481717;
    const c7 = 0.00122874;
    const c8 = 0.00085282;
    const c9 = -0.00000199;

    const heatIndex = c1 + (c2 * tempF) + (c3 * humidity) + (c4 * tempF * humidity) +
                     (c5 * tempF * tempF) + (c6 * humidity * humidity) +
                     (c7 * tempF * tempF * humidity) + (c8 * tempF * humidity * humidity) +
                     (c9 * tempF * tempF * humidity * humidity);

    return unit === 'C' ? this.fahrenheitToCelsius(heatIndex) : heatIndex;
  }

  static calculateWindChill(temperature: number, windSpeed: number, unit: 'C' | 'F' = 'C'): number {
    const tempF = unit === 'C' ? this.celsiusToFahrenheit(temperature) : temperature;
    const windMph = windSpeed * 2.237; // Convert m/s to mph

    if (tempF > 50 || windMph < 3) {
      return temperature; // Wind chill not applicable
    }

    const windChill = 35.74 + (0.6215 * tempF) - (35.75 * Math.pow(windMph, 0.16)) +
                     (0.4275 * tempF * Math.pow(windMph, 0.16));

    return unit === 'C' ? this.fahrenheitToCelsius(windChill) : windChill;
  }

  static getDewPoint(temperature: number, humidity: number, unit: 'C' | 'F' = 'C'): number {
    const tempC = unit === 'F' ? this.fahrenheitToCelsius(temperature) : temperature;
    
    const a = 17.27;
    const b = 237.7;
    const alpha = ((a * tempC) / (b + tempC)) + Math.log(humidity / 100);
    const dewPoint = (b * alpha) / (a - alpha);

    return unit === 'F' ? this.celsiusToFahrenheit(dewPoint) : dewPoint;
  }
}
