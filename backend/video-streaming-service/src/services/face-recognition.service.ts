interface FaceProfile {
  profileId: string;
  userId: string;
  name: string;
  faceDescriptor: number[];
  photos: string[];
  createdAt: Date;
  lastSeen?: Date;
}

interface FaceDetection {
  detectionId: string;
  streamId: string;
  profileId?: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  timestamp: Date;
  snapshot?: string;
}

export class FaceRecognitionService {
  private profiles: Map<string, FaceProfile> = new Map();
  private detections: Map<string, FaceDetection[]> = new Map();
  private recognitionActive: Map<string, boolean> = new Map();

  async createProfile(profile: Omit<FaceProfile, 'profileId' | 'createdAt'>): Promise<string> {
    const profileId = `profile_${Date.now()}`;
    
    const newProfile: FaceProfile = {
      ...profile,
      profileId,
      createdAt: new Date()
    };

    this.profiles.set(profileId, newProfile);
    return profileId;
  }

  async updateProfile(profileId: string, updates: Partial<FaceProfile>): Promise<boolean> {
    const profile = this.profiles.get(profileId);
    if (!profile) return false;

    Object.assign(profile, updates);
    return true;
  }

  async deleteProfile(profileId: string): Promise<boolean> {
    return this.profiles.delete(profileId);
  }

  async startRecognition(streamId: string): Promise<void> {
    this.recognitionActive.set(streamId, true);
    console.log(`Face recognition started for stream ${streamId}`);
  }

  async stopRecognition(streamId: string): Promise<void> {
    this.recognitionActive.set(streamId, false);
    console.log(`Face recognition stopped for stream ${streamId}`);
  }

  async detectFace(streamId: string, faceDescriptor: number[]): Promise<FaceDetection> {
    const matchedProfile = this.findMatchingProfile(faceDescriptor);

    const detection: FaceDetection = {
      detectionId: `det_${Date.now()}`,
      streamId,
      profileId: matchedProfile?.profileId,
      confidence: matchedProfile ? 0.95 : 0.5,
      boundingBox: { x: 100, y: 100, width: 200, height: 200 },
      timestamp: new Date()
    };

    const streamDetections = this.detections.get(streamId) || [];
    streamDetections.push(detection);

    if (streamDetections.length > 1000) {
      streamDetections.shift();
    }

    this.detections.set(streamId, streamDetections);

    if (matchedProfile) {
      matchedProfile.lastSeen = new Date();
    }

    return detection;
  }

  private findMatchingProfile(faceDescriptor: number[]): FaceProfile | null {
    for (const profile of this.profiles.values()) {
      const similarity = this.calculateSimilarity(faceDescriptor, profile.faceDescriptor);
      if (similarity > 0.6) {
        return profile;
      }
    }
    return null;
  }

  private calculateSimilarity(desc1: number[], desc2: number[]): number {
    if (desc1.length !== desc2.length) return 0;

    let sum = 0;
    for (let i = 0; i < desc1.length; i++) {
      sum += Math.pow(desc1[i] - desc2[i], 2);
    }

    const distance = Math.sqrt(sum);
    return Math.max(0, 1 - distance);
  }

  async getDetections(streamId: string, since?: Date): Promise<FaceDetection[]> {
    const detections = this.detections.get(streamId) || [];
    
    if (since) {
      return detections.filter(d => d.timestamp > since);
    }

    return detections;
  }

  async getProfiles(userId: string): Promise<FaceProfile[]> {
    return Array.from(this.profiles.values()).filter(p => p.userId === userId);
  }

  isRecognitionActive(streamId: string): boolean {
    return this.recognitionActive.get(streamId) || false;
  }
}

export const faceRecognitionService = new FaceRecognitionService();
