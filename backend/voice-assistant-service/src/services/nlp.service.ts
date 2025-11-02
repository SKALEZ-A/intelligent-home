import natural from 'natural';
import compromise from 'compromise';
import { logger } from '../utils/logger';

interface ParsedCommand {
  intent: string;
  entities: Record<string, any>;
  confidence: number;
  originalText: string;
}

interface Intent {
  name: string;
  patterns: string[];
  entities: string[];
  action: string;
}

export class NLPService {
  private tokenizer: natural.WordTokenizer;
  private classifier: natural.BayesClassifier;
  private intents: Intent[];
  private initialized: boolean = false;

  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.classifier = new natural.BayesClassifier();
    this.intents = this.loadIntents();
  }

  private loadIntents(): Intent[] {
    return [
      {
        name: 'turn_on_device',
        patterns: [
          'turn on {device}',
          'switch on {device}',
          'enable {device}',
          'activate {device}',
          'power on {device}',
          'start {device}'
        ],
        entities: ['device'],
        action: 'device.control'
      },
      {
        name: 'turn_off_device',
        patterns: [
          'turn off {device}',
          'switch off {device}',
          'disable {device}',
          'deactivate {device}',
          'power off {device}',
          'stop {device}'
        ],
        entities: ['device'],
        action: 'device.control'
      },
      {
        name: 'set_temperature',
        patterns: [
          'set temperature to {value} degrees',
          'change temperature to {value}',
          'make it {value} degrees',
          'adjust temperature to {value}'
        ],
        entities: ['value', 'unit'],
        action: 'climate.control'
      },
      {
        name: 'set_brightness',
        patterns: [
          'set {device} brightness to {value} percent',
          'dim {device} to {value}',
          'brighten {device} to {value}',
          'adjust {device} brightness to {value}'
        ],
        entities: ['device', 'value'],
        action: 'light.control'
      },
      {
        name: 'activate_scene',
        patterns: [
          'activate {scene} scene',
          'run {scene} scene',
          'start {scene} mode',
          'enable {scene} mode',
          'set {scene} scene'
        ],
        entities: ['scene'],
        action: 'scene.activate'
      },
      {
        name: 'query_status',
        patterns: [
          'what is the status of {device}',
          'is {device} on',
          'check {device} status',
          'show me {device} status',
          'tell me about {device}'
        ],
        entities: ['device'],
        action: 'device.query'
      },
      {
        name: 'query_temperature',
        patterns: [
          'what is the temperature',
          'how hot is it',
          'how cold is it',
          'what is the current temperature',
          'tell me the temperature'
        ],
        entities: ['location'],
        action: 'sensor.query'
      },
      {
        name: 'lock_door',
        patterns: [
          'lock {device}',
          'secure {device}',
          'lock the {device}',
          'engage {device} lock'
        ],
        entities: ['device'],
        action: 'lock.control'
      },
      {
        name: 'unlock_door',
        patterns: [
          'unlock {device}',
          'open {device}',
          'unlock the {device}',
          'disengage {device} lock'
        ],
        entities: ['device'],
        action: 'lock.control'
      },
      {
        name: 'set_color',
        patterns: [
          'set {device} to {color}',
          'change {device} color to {color}',
          'make {device} {color}',
          'turn {device} {color}'
        ],
        entities: ['device', 'color'],
        action: 'light.control'
      }
    ];
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    logger.info('Initializing NLP Service...');

    // Train classifier with intent patterns
    this.intents.forEach(intent => {
      intent.patterns.forEach(pattern => {
        // Remove entity placeholders for training
        const cleanPattern = pattern.replace(/\{[^}]+\}/g, '');
        this.classifier.addDocument(cleanPattern, intent.name);
      });
    });

    this.classifier.train();
    this.initialized = true;
    logger.info('NLP Service initialized successfully');
  }

  async parseCommand(text: string): Promise<ParsedCommand> {
    if (!this.initialized) {
      await this.initialize();
    }

    const normalizedText = text.toLowerCase().trim();
    
    // Get intent classification
    const classifications = this.classifier.getClassifications(normalizedText);
    const topIntent = classifications[0];

    // Extract entities using compromise
    const doc = compromise(normalizedText);
    const entities = this.extractEntities(doc, normalizedText);

    return {
      intent: topIntent.label,
      entities,
      confidence: topIntent.value,
      originalText: text
    };
  }

  private extractEntities(doc: any, text: string): Record<string, any> {
    const entities: Record<string, any> = {};

    // Extract device names
    const devices = ['light', 'lights', 'lamp', 'fan', 'thermostat', 'door', 'lock', 
                     'camera', 'tv', 'television', 'speaker', 'garage', 'window', 
                     'blinds', 'curtains', 'heater', 'ac', 'air conditioner'];
    
    for (const device of devices) {
      if (text.includes(device)) {
        entities.device = device;
        break;
      }
    }

    // Extract room names
    const rooms = ['living room', 'bedroom', 'kitchen', 'bathroom', 'garage', 
                   'office', 'dining room', 'hallway', 'basement', 'attic'];
    
    for (const room of rooms) {
      if (text.includes(room)) {
        entities.location = room;
        break;
      }
    }

    // Extract numbers
    const numbers = doc.numbers().out('array');
    if (numbers.length > 0) {
      entities.value = parseInt(numbers[0]);
    }

    // Extract colors
    const colors = ['red', 'blue', 'green', 'yellow', 'white', 'warm white', 
                    'cool white', 'orange', 'purple', 'pink'];
    
    for (const color of colors) {
      if (text.includes(color)) {
        entities.color = color;
        break;
      }
    }

    // Extract scene names
    const scenes = ['good morning', 'good night', 'movie', 'party', 'relax', 
                    'away', 'home', 'sleep', 'wake up', 'dinner'];
    
    for (const scene of scenes) {
      if (text.includes(scene)) {
        entities.scene = scene;
        break;
      }
    }

    return entities;
  }

  async addCustomIntent(intent: Intent): Promise<void> {
    this.intents.push(intent);
    
    // Retrain classifier
    intent.patterns.forEach(pattern => {
      const cleanPattern = pattern.replace(/\{[^}]+\}/g, '');
      this.classifier.addDocument(cleanPattern, intent.name);
    });
    
    this.classifier.retrain();
    logger.info(`Added custom intent: ${intent.name}`);
  }

  getIntents(): Intent[] {
    return this.intents;
  }

  async getSuggestions(partialText: string): Promise<string[]> {
    const suggestions: string[] = [];
    const normalizedText = partialText.toLowerCase();

    this.intents.forEach(intent => {
      intent.patterns.forEach(pattern => {
        if (pattern.toLowerCase().startsWith(normalizedText)) {
          suggestions.push(pattern);
        }
      });
    });

    return suggestions.slice(0, 5);
  }
}

export const nlpService = new NLPService();
