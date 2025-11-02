export interface DiagnosticTest {
  name: string;
  description: string;
  execute: (deviceId: string) => Promise<DiagnosticResult>;
}

export interface DiagnosticResult {
  testName: string;
  passed: boolean;
  message: string;
  details?: any;
  timestamp: Date;
}

export class DeviceDiagnosticsService {
  private tests: Map<string, DiagnosticTest> = new Map();

  constructor() {
    this.registerDefaultTests();
  }

  private registerDefaultTests(): void {
    this.registerTest({
      name: 'connectivity',
      description: 'Check device network connectivity',
      execute: async (deviceId: string) => {
        const isConnected = Math.random() > 0.1;
        return {
          testName: 'connectivity',
          passed: isConnected,
          message: isConnected ? 'Device is connected' : 'Device is offline',
          details: {
            latency: Math.floor(Math.random() * 100),
            signalStrength: Math.floor(Math.random() * 100)
          },
          timestamp: new Date()
        };
      }
    });

    this.registerTest({
      name: 'battery',
      description: 'Check battery health and level',
      execute: async (deviceId: string) => {
        const batteryLevel = Math.floor(Math.random() * 100);
        const passed = batteryLevel > 20;
        return {
          testName: 'battery',
          passed,
          message: `Battery level: ${batteryLevel}%`,
          details: {
            level: batteryLevel,
            health: passed ? 'good' : 'low',
            voltage: 3.7 + (Math.random() * 0.5)
          },
          timestamp: new Date()
        };
      }
    });

    this.registerTest({
      name: 'firmware',
      description: 'Check firmware version and updates',
      execute: async (deviceId: string) => {
        const currentVersion = '1.2.3';
        const latestVersion = '1.2.4';
        const isUpToDate = currentVersion === latestVersion;
        return {
          testName: 'firmware',
          passed: isUpToDate,
          message: isUpToDate ? 'Firmware is up to date' : 'Update available',
          details: {
            currentVersion,
            latestVersion,
            updateAvailable: !isUpToDate
          },
          timestamp: new Date()
        };
      }
    });

    this.registerTest({
      name: 'sensors',
      description: 'Verify sensor functionality',
      execute: async (deviceId: string) => {
        const sensorsWorking = Math.random() > 0.05;
        return {
          testName: 'sensors',
          passed: sensorsWorking,
          message: sensorsWorking ? 'All sensors operational' : 'Sensor malfunction detected',
          details: {
            temperature: sensorsWorking,
            humidity: sensorsWorking,
            motion: sensorsWorking
          },
          timestamp: new Date()
        };
      }
    });

    this.registerTest({
      name: 'memory',
      description: 'Check device memory usage',
      execute: async (deviceId: string) => {
        const memoryUsage = Math.floor(Math.random() * 100);
        const passed = memoryUsage < 90;
        return {
          testName: 'memory',
          passed,
          message: `Memory usage: ${memoryUsage}%`,
          details: {
            used: memoryUsage,
            available: 100 - memoryUsage,
            total: 100
          },
          timestamp: new Date()
        };
      }
    });
  }

  registerTest(test: DiagnosticTest): void {
    this.tests.set(test.name, test);
  }

  async runDiagnostics(deviceId: string, testNames?: string[]): Promise<DiagnosticResult[]> {
    const testsToRun = testNames 
      ? testNames.map(name => this.tests.get(name)).filter(Boolean) as DiagnosticTest[]
      : Array.from(this.tests.values());

    const results: DiagnosticResult[] = [];

    for (const test of testsToRun) {
      try {
        const result = await test.execute(deviceId);
        results.push(result);
      } catch (error) {
        results.push({
          testName: test.name,
          passed: false,
          message: `Test failed: ${error.message}`,
          timestamp: new Date()
        });
      }
    }

    return results;
  }

  async runSingleTest(deviceId: string, testName: string): Promise<DiagnosticResult> {
    const test = this.tests.get(testName);
    if (!test) {
      throw new Error(`Test '${testName}' not found`);
    }

    return await test.execute(deviceId);
  }

  getAvailableTests(): Array<{ name: string; description: string }> {
    return Array.from(this.tests.values()).map(test => ({
      name: test.name,
      description: test.description
    }));
  }

  async generateDiagnosticReport(deviceId: string): Promise<any> {
    const results = await this.runDiagnostics(deviceId);
    const passedTests = results.filter(r => r.passed).length;
    const totalTests = results.length;

    return {
      deviceId,
      timestamp: new Date(),
      overallHealth: (passedTests / totalTests) * 100,
      passedTests,
      totalTests,
      results,
      recommendations: this.generateRecommendations(results)
    };
  }

  private generateRecommendations(results: DiagnosticResult[]): string[] {
    const recommendations: string[] = [];

    results.forEach(result => {
      if (!result.passed) {
        switch (result.testName) {
          case 'connectivity':
            recommendations.push('Check network connection and router settings');
            break;
          case 'battery':
            recommendations.push('Charge or replace device battery');
            break;
          case 'firmware':
            recommendations.push('Update device firmware to latest version');
            break;
          case 'sensors':
            recommendations.push('Calibrate or replace malfunctioning sensors');
            break;
          case 'memory':
            recommendations.push('Clear device cache or reset to factory settings');
            break;
        }
      }
    });

    return recommendations;
  }
}
