import { EventEmitter } from 'events';

interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: string;
  data: any;
  timestamp: number;
  status: 'pending' | 'synced' | 'failed';
  retryCount: number;
}

interface SyncConflict {
  operationId: string;
  localVersion: any;
  remoteVersion: any;
  resolution?: 'local' | 'remote' | 'merge';
}

export class DataSyncService extends EventEmitter {
  private pendingOperations: Map<string, SyncOperation> = new Map();
  private conflicts: SyncConflict[] = [];
  private syncInterval: NodeJS.Timeout | null = null;
  private readonly maxRetries = 3;

  public startSync(intervalMs: number = 30000): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      this.performSync();
    }, intervalMs);

    this.performSync();
  }

  public stopSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  public queueOperation(operation: Omit<SyncOperation, 'id' | 'status' | 'retryCount'>): void {
    const op: SyncOperation = {
      ...operation,
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      retryCount: 0
    };

    this.pendingOperations.set(op.id, op);
    this.emit('operationQueued', op);
  }

  private async performSync(): Promise<void> {
    const pending = Array.from(this.pendingOperations.values())
      .filter(op => op.status === 'pending' && op.retryCount < this.maxRetries);

    for (const operation of pending) {
      try {
        await this.syncOperation(operation);
        operation.status = 'synced';
        this.pendingOperations.delete(operation.id);
        this.emit('operationSynced', operation);
      } catch (error: any) {
        operation.retryCount++;
        
        if (operation.retryCount >= this.maxRetries) {
          operation.status = 'failed';
          this.emit('operationFailed', { operation, error });
        }
      }
    }
  }

  private async syncOperation(operation: SyncOperation): Promise<void> {
    this.emit('syncOperation', operation);
  }

  public detectConflict(operationId: string, localVersion: any, remoteVersion: any): void {
    const conflict: SyncConflict = {
      operationId,
      localVersion,
      remoteVersion
    };

    this.conflicts.push(conflict);
    this.emit('conflictDetected', conflict);
  }

  public resolveConflict(
    operationId: string,
    resolution: SyncConflict['resolution']
  ): void {
    const conflict = this.conflicts.find(c => c.operationId === operationId);
    
    if (conflict) {
      conflict.resolution = resolution;
      this.emit('conflictResolved', conflict);
    }
  }

  public getPendingOperations(): SyncOperation[] {
    return Array.from(this.pendingOperations.values());
  }

  public getConflicts(): SyncConflict[] {
    return this.conflicts.filter(c => !c.resolution);
  }

  public getSyncStatus(): {
    pending: number;
    synced: number;
    failed: number;
    conflicts: number;
  } {
    const operations = Array.from(this.pendingOperations.values());
    
    return {
      pending: operations.filter(op => op.status === 'pending').length,
      synced: operations.filter(op => op.status === 'synced').length,
      failed: operations.filter(op => op.status === 'failed').length,
      conflicts: this.conflicts.filter(c => !c.resolution).length
    };
  }
}

export const dataSyncService = new DataSyncService();
