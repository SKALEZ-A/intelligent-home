import { Request, Response } from 'express';
import { NLPService } from '../services/nlp.service';
import { CommandExecutorService } from '../services/command-executor.service';
import { VoiceProfileService } from '../services/voice-profile.service';
import { logger } from '../../../shared/utils/logger';

export class VoiceController {
  private nlpService: NLPService;
  private commandExecutor: CommandExecutorService;
  private voiceProfileService: VoiceProfileService;

  constructor() {
    this.nlpService = new NLPService();
    this.commandExecutor = new CommandExecutorService();
    this.voiceProfileService = new VoiceProfileService();
  }

  async processVoiceCommand(req: Request, res: Response): Promise<void> {
    try {
      const { text, audioData, userId } = req.body;

      let commandText = text;
      if (audioData && !text) {
        commandText = await this.transcribeAudio(audioData);
      }

      const intent = await this.nlpService.parseCommand(commandText);
      const result = await this.commandExecutor.execute(intent, userId);

      res.json({
        success: true,
        intent,
        result,
        response: this.generateResponse(intent, result),
      });
    } catch (error: any) {
      logger.error('Voice command processing failed', { error });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async createVoiceProfile(req: Request, res: Response): Promise<void> {
    try {
      const { userId, voiceSamples } = req.body;
      const profile = await this.voiceProfileService.createProfile(userId, voiceSamples);

      res.json({
        success: true,
        profile,
      });
    } catch (error: any) {
      logger.error('Voice profile creation failed', { error });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async verifyVoice(req: Request, res: Response): Promise<void> {
    try {
      const { userId, audioData } = req.body;
      const verified = await this.voiceProfileService.verifyVoice(userId, audioData);

      res.json({
        success: true,
        verified,
      });
    } catch (error: any) {
      logger.error('Voice verification failed', { error });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  private async transcribeAudio(audioData: Buffer): Promise<string> {
    // Implement audio transcription
    return 'transcribed text';
  }

  private generateResponse(intent: any, result: any): string {
    // Generate natural language response
    return `Command executed successfully`;
  }
}
