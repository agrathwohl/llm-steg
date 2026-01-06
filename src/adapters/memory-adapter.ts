import {
  TransportProtocol,
  SendCallback
} from '../interfaces/transport-stream.interface';
import { BaseAdapter } from './base-adapter';

/**
 * In-memory transport adapter for testing and demos.
 *
 * Buffers all sent data in memory and allows inspection.
 * Useful for unit tests and demonstrations without network I/O.
 *
 * @example
 * ```typescript
 * const mem = new MemoryAdapter();
 *
 * mem.send(Buffer.from('test'));
 *
 * const sent = mem.getSentData();
 * console.log('Sent:', sent.length, 'packets');
 *
 * // Simulate received data
 * mem.receive(Buffer.from('incoming'));
 * ```
 */
export class MemoryAdapter extends BaseAdapter {
  readonly protocol: TransportProtocol = 'custom';

  private sentData: Buffer[] = [];
  private receivedData: Buffer[] = [];

  constructor(debug: boolean = false) {
    super({ debug });
    this.setState('connected');
  }

  // ─────────────────────────────────────────────────────────────
  // Protected Implementations
  // ─────────────────────────────────────────────────────────────

  protected doSend(data: Buffer, callback?: SendCallback): void {
    this.sentData.push(Buffer.from(data));
    this.log('Sent', { size: data.length, total: this.sentData.length });

    // Async callback to simulate network delay
    setImmediate(() => callback?.());
  }

  protected doClose(): void {
    this.log('Closed', {
      sentCount: this.sentData.length,
      receivedCount: this.receivedData.length
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Public Methods for Testing
  // ─────────────────────────────────────────────────────────────

  /**
   * Get all sent data
   */
  public getSentData(): Buffer[] {
    return [...this.sentData];
  }

  /**
   * Get the last sent data
   */
  public getLastSent(): Buffer | undefined {
    return this.sentData[this.sentData.length - 1];
  }

  /**
   * Get all received data
   */
  public getReceivedData(): Buffer[] {
    return [...this.receivedData];
  }

  /**
   * Simulate receiving data
   */
  public receive(data: Buffer): void {
    this.receivedData.push(Buffer.from(data));
    this.emitData(data);
    this.log('Received', { size: data.length, total: this.receivedData.length });
  }

  /**
   * Clear all buffers
   */
  public clear(): void {
    this.sentData = [];
    this.receivedData = [];
    this.log('Cleared buffers');
  }

  /**
   * Get statistics
   */
  public getStats(): {
    sentCount: number;
    sentBytes: number;
    receivedCount: number;
    receivedBytes: number;
  } {
    return {
      sentCount: this.sentData.length,
      sentBytes: this.sentData.reduce((sum, b) => sum + b.length, 0),
      receivedCount: this.receivedData.length,
      receivedBytes: this.receivedData.reduce((sum, b) => sum + b.length, 0)
    };
  }

  /**
   * Create a loopback connection (send → receive)
   */
  public enableLoopback(): void {
    this.sentData = [];
    const originalSend = this.doSend.bind(this);

    // Override to also trigger receive
    (this as any).doSend = (data: Buffer, callback?: SendCallback) => {
      originalSend(data, callback);
      // Simulate network delay
      setImmediate(() => this.receive(data));
    };
  }
}

/**
 * Create a memory adapter
 */
export function createMemoryAdapter(debug: boolean = false): MemoryAdapter {
  return new MemoryAdapter(debug);
}
