import { EventEmitter } from 'events';
import {
  TransportStream,
  TransportMetadata,
  TransportOptions,
  TransportProtocol,
  ConnectionState,
  SendCallback,
  DataHandler
} from '../interfaces/transport-stream.interface';

/**
 * Abstract base class for transport adapters.
 *
 * Provides common functionality for connection state management,
 * event handling, and metadata. Extend this class to implement
 * protocol-specific adapters.
 *
 * @example
 * ```typescript
 * class MyAdapter extends BaseAdapter {
 *   readonly protocol = 'custom';
 *
 *   protected doSend(data: Buffer, callback?: SendCallback): void {
 *     // Your protocol-specific send logic
 *   }
 *
 *   protected doClose(): void {
 *     // Your cleanup logic
 *   }
 * }
 * ```
 */
export abstract class BaseAdapter extends EventEmitter implements TransportStream {
  /** Protocol type for this adapter */
  abstract readonly protocol: TransportProtocol;

  protected options: TransportOptions;
  protected state: ConnectionState = 'disconnected';
  protected dataHandlers: DataHandler[] = [];

  constructor(options: TransportOptions = {}) {
    super();
    this.options = options;
  }

  /**
   * Send data through the transport
   */
  public send(data: Buffer | Uint8Array, callback?: SendCallback): void {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

    if (this.state === 'error' || this.state === 'disconnected') {
      callback?.(new Error(`Cannot send: transport is ${this.state}`));
      return;
    }

    try {
      this.doSend(buffer, callback);
    } catch (err) {
      this.handleError(err as Error);
      callback?.(err as Error);
    }
  }

  /**
   * Register handler for incoming data
   */
  public onData(handler: DataHandler): void {
    this.dataHandlers.push(handler);
  }

  /**
   * Close the transport
   */
  public close(): void {
    if (this.state === 'disconnected') return;

    try {
      this.doClose();
    } catch (err) {
      this.handleError(err as Error);
    }

    this.state = 'disconnected';
    this.emit('close');
  }

  /**
   * Get transport metadata
   */
  public getMetadata(): TransportMetadata {
    return {
      protocol: this.protocol,
      connectionState: this.state,
      remoteAddress: this.options.remoteAddress,
      remotePort: this.options.remotePort,
      localAddress: this.options.localAddress,
      localPort: this.options.localPort
    };
  }

  /**
   * Get current connection state
   */
  public getState(): ConnectionState {
    return this.state;
  }

  // ─────────────────────────────────────────────────────────────
  // Protected Methods for Subclasses
  // ─────────────────────────────────────────────────────────────

  /**
   * Implement protocol-specific send logic
   */
  protected abstract doSend(data: Buffer, callback?: SendCallback): void;

  /**
   * Implement protocol-specific close/cleanup logic
   */
  protected abstract doClose(): void;

  /**
   * Set connection state
   */
  protected setState(state: ConnectionState): void {
    const previousState = this.state;
    this.state = state;

    if (previousState !== state) {
      this.emit('stateChange', { from: previousState, to: state });
    }
  }

  /**
   * Emit received data to all handlers
   */
  protected emitData(data: Buffer | Uint8Array): void {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

    for (const handler of this.dataHandlers) {
      try {
        handler(buffer);
      } catch (err) {
        this.emit('error', { type: 'handler', error: err });
      }
    }
  }

  /**
   * Handle errors
   */
  protected handleError(error: Error): void {
    this.state = 'error';
    this.emit('error', error);

    if (this.options.debug) {
      console.error(`[${this.protocol}] Error:`, error.message);
    }
  }

  /**
   * Debug logging
   */
  protected log(message: string, data?: unknown): void {
    if (this.options.debug) {
      console.log(`[${this.protocol}] ${message}`, data ?? '');
    }
  }
}
