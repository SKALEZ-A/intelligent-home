export interface HomeKitAccessory {
  aid: number;
  name: string;
  category: string;
  services: HomeKitService[];
}

export interface HomeKitService {
  iid: number;
  type: string;
  characteristics: HomeKitCharacteristic[];
}

export interface HomeKitCharacteristic {
  iid: number;
  type: string;
  value: any;
  perms: string[];
  format: string;
}

export class HomeKitService {
  private accessories: Map<number, HomeKitAccessory> = new Map();

  async discoverAccessories(): Promise<HomeKitAccessory[]> {
    return Array.from(this.accessories.values());
  }

  async addAccessory(accessory: HomeKitAccessory): Promise<void> {
    this.accessories.set(accessory.aid, accessory);
  }

  async removeAccessory(aid: number): Promise<boolean> {
    return this.accessories.delete(aid);
  }

  async getAccessory(aid: number): Promise<HomeKitAccessory | null> {
    return this.accessories.get(aid) || null;
  }

  async getCharacteristic(aid: number, iid: number): Promise<any> {
    const accessory = this.accessories.get(aid);
    if (!accessory) return null;

    for (const service of accessory.services) {
      const characteristic = service.characteristics.find(c => c.iid === iid);
      if (characteristic) return characteristic.value;
    }

    return null;
  }

  async setCharacteristic(aid: number, iid: number, value: any): Promise<boolean> {
    const accessory = this.accessories.get(aid);
    if (!accessory) return false;

    for (const service of accessory.services) {
      const characteristic = service.characteristics.find(c => c.iid === iid);
      if (characteristic) {
        if (!characteristic.perms.includes('pw')) {
          throw new Error('Characteristic is not writable');
        }
        characteristic.value = value;
        return true;
      }
    }

    return false;
  }

  async turnOn(aid: number): Promise<boolean> {
    return this.setCharacteristicByType(aid, 'On', true);
  }

  async turnOff(aid: number): Promise<boolean> {
    return this.setCharacteristicByType(aid, 'On', false);
  }

  async setBrightness(aid: number, brightness: number): Promise<boolean> {
    return this.setCharacteristicByType(aid, 'Brightness', brightness);
  }

  async setTargetTemperature(aid: number, temperature: number): Promise<boolean> {
    return this.setCharacteristicByType(aid, 'TargetTemperature', temperature);
  }

  async setTargetPosition(aid: number, position: number): Promise<boolean> {
    return this.setCharacteristicByType(aid, 'TargetPosition', position);
  }

  async lockDoor(aid: number): Promise<boolean> {
    return this.setCharacteristicByType(aid, 'LockTargetState', 1);
  }

  async unlockDoor(aid: number): Promise<boolean> {
    return this.setCharacteristicByType(aid, 'LockTargetState', 0);
  }

  private async setCharacteristicByType(aid: number, type: string, value: any): Promise<boolean> {
    const accessory = this.accessories.get(aid);
    if (!accessory) return false;

    for (const service of accessory.services) {
      const characteristic = service.characteristics.find(c => c.type === type);
      if (characteristic) {
        characteristic.value = value;
        return true;
      }
    }

    return false;
  }

  async getAccessoriesByCategory(category: string): Promise<HomeKitAccessory[]> {
    return Array.from(this.accessories.values()).filter(a => a.category === category);
  }

  async subscribeToCharacteristic(aid: number, iid: number, callback: (value: any) => void): Promise<void> {
    console.log(`Subscribed to characteristic ${iid} on accessory ${aid}`);
  }
}
