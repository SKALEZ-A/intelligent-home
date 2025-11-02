import { EventEmitter } from 'events';

interface AutomationTest {
  id: string;
  automationId: string;
  name: string;
  scenarios: TestScenario[];
  status: 'pending' | 'running' | 'passed' | 'failed';
  results?: TestResults;
  createdAt: number;
  executedAt?: number;
}

interface TestScenario {
  name: string;
  description: string;
  initialState: DeviceState[];
  trigger: TriggerEvent;
  expectedActions: ExpectedAction[];
  timeout: number;
}

interface DeviceState {
  deviceId: string;
  state: any;
}

interface TriggerEvent {
  type: string;
  data: any;
}

interface ExpectedAction {
  deviceId: string;
  action: string;
  parameters: any;
  timing?: {
    minDelay: number;
    maxDelay: number;
  };
}

interface TestResults {
  passed: boolean;
  scenarios: ScenarioResult[];
  duration: number;
  errors: string[];
}

interface ScenarioResult {
  scenarioName: string;
  passed: boolean;
  actualActions: any[];
  missingActions: ExpectedAction[];
  unexpectedActions: any[];
  timing: {
    triggered: number;
    completed: number;
    duration: number;
  };
}

export class AutomationTestingService extends EventEmitter {
  private tests: Map<string, AutomationTest> = new Map();
  private mockDeviceStates: Map<string, any> = new Map();

  public createTest(
    automationId: string,
    name: string,
    scenarios: TestScenario[]
  ): AutomationTest {
    const test: AutomationTest = {
      id: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      automationId,
      name,
      scenarios,
      status: 'pending',
      createdAt: Date.now()
    };

    this.tests.set(test.id, test);
    this.emit('testCreated', test);

    return test;
  }

  public async executeTest(testId: string): Promise<TestResults> {
    const test = this.tests.get(testId);

    if (!test) {
      throw new Error('Test not found');
    }

    test.status = 'running';
    test.executedAt = Date.now();
    this.emit('testStarted', test);

    const startTime = Date.now();
    const scenarioResults: ScenarioResult[] = [];
    const errors: string[] = [];

    for (const scenario of test.scenarios) {
      try {
        const result = await this.executeScenario(scenario);
        scenarioResults.push(result);
      } catch (error: any) {
        errors.push(`Scenario "${scenario.name}": ${error.message}`);
        scenarioResults.push({
          scenarioName: scenario.name,
          passed: false,
          actualActions: [],
          missingActions: scenario.expectedActions,
          unexpectedActions: [],
          timing: {
            triggered: Date.now(),
            completed: Date.now(),
            duration: 0
          }
        });
      }
    }

    const results: TestResults = {
      passed: scenarioResults.every(r => r.passed) && errors.length === 0,
      scenarios: scenarioResults,
      duration: Date.now() - startTime,
      errors
    };

    test.results = results;
    test.status = results.passed ? 'passed' : 'failed';

    this.emit('testCompleted', { test, results });

    return results;
  }

  private async executeScenario(scenario: TestScenario): Promise<ScenarioResult> {
    this.setupInitialState(scenario.initialState);

    const triggeredAt = Date.now();
    const actualActions: any[] = [];

    const actionPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Scenario timeout'));
      }, scenario.timeout);

      this.once('automationAction', (action) => {
        actualActions.push(action);
        clearTimeout(timeout);
        resolve();
      });

      this.triggerAutomation(scenario.trigger);
    });

    try {
      await actionPromise;
    } catch (error) {
      // Timeout or error occurred
    }

    const completedAt = Date.now();

    const missingActions = scenario.expectedActions.filter(expected => 
      !actualActions.some(actual => 
        this.actionsMatch(actual, expected)
      )
    );

    const unexpectedActions = actualActions.filter(actual =>
      !scenario.expectedActions.some(expected =>
        this.actionsMatch(actual, expected)
      )
    );

    const passed = missingActions.length === 0 && unexpectedActions.length === 0;

    return {
      scenarioName: scenario.name,
      passed,
      actualActions,
      missingActions,
      unexpectedActions,
      timing: {
        triggered: triggeredAt,
        completed: completedAt,
        duration: completedAt - triggeredAt
      }
    };
  }

  private setupInitialState(states: DeviceState[]): void {
    states.forEach(state => {
      this.mockDeviceStates.set(state.deviceId, state.state);
    });
  }

  private triggerAutomation(trigger: TriggerEvent): void {
    this.emit('triggerAutomation', trigger);
  }

  private actionsMatch(actual: any, expected: ExpectedAction): boolean {
    if (actual.deviceId !== expected.deviceId) return false;
    if (actual.action !== expected.action) return false;

    const paramsMatch = JSON.stringify(actual.parameters) === 
                       JSON.stringify(expected.parameters);

    return paramsMatch;
  }

  public getTest(testId: string): AutomationTest | undefined {
    return this.tests.get(testId);
  }

  public getTestsByAutomation(automationId: string): AutomationTest[] {
    return Array.from(this.tests.values())
      .filter(t => t.automationId === automationId);
  }

  public generateTestReport(testId: string): string {
    const test = this.tests.get(testId);

    if (!test || !test.results) {
      return 'Test not found or not executed';
    }

    let report = `Test Report: ${test.name}\n`;
    report += `Status: ${test.status}\n`;
    report += `Duration: ${test.results.duration}ms\n\n`;

    test.results.scenarios.forEach((scenario, index) => {
      report += `Scenario ${index + 1}: ${scenario.scenarioName}\n`;
      report += `  Status: ${scenario.passed ? 'PASSED' : 'FAILED'}\n`;
      report += `  Duration: ${scenario.timing.duration}ms\n`;

      if (scenario.missingActions.length > 0) {
        report += `  Missing Actions:\n`;
        scenario.missingActions.forEach(action => {
          report += `    - ${action.deviceId}: ${action.action}\n`;
        });
      }

      if (scenario.unexpectedActions.length > 0) {
        report += `  Unexpected Actions:\n`;
        scenario.unexpectedActions.forEach(action => {
          report += `    - ${action.deviceId}: ${action.action}\n`;
        });
      }

      report += '\n';
    });

    if (test.results.errors.length > 0) {
      report += 'Errors:\n';
      test.results.errors.forEach(error => {
        report += `  - ${error}\n`;
      });
    }

    return report;
  }
}

export const automationTestingService = new AutomationTestingService();
