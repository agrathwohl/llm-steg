import { EventEmitter } from 'events';
import {
  TransportStream,
  SendCallback,
  DataHandler,
  TransportMetadata
} from '../interfaces/transport-stream.interface';
import { StegConfig } from '../interfaces/steg-config.interface';
import { StegAlgorithm } from '../interfaces/algorithm.interface';
import { StegEngine } from './steg-engine';

/**
 * Transport wrapper that applies steganography to data.
 *
 * StegTransport wraps any TransportStream and automatically applies
 * steganographic encoding to outgoing data and decoding to incoming data.
 *
 * @example
 * ```typescript
 * import { StegTransport, UdpAdapter, LSBAlgorithm } from 'llm-steg';
 *
 * const udp = new UdpAdapter('192.168.1.100', 5004);
 * const steg = new StegTransport(udp, {
 *   algorithm: 'lsb',
 *   coverMedia: [imageBuffer],
 *   enabled: true
 * });
 *
 * steg.send(Buffer.from('secret message'));
 * ```
 */
export class StegTransport extends EventEmitter implements TransportStream {
  private innerTransport: TransportStream;
  private engine: StegEngine;
  private dataHandlers: DataHandler[] = [];
  private closed: boolean = false;

  constructor(innerTransport: TransportStream, configOrEngine: StegConfig | StegEngine) {
    super();

    this.innerTransport = innerTransport;
    this.engine = configOrEngine instanceof StegEngine
      ? configOrEngine
      : new StegEngine(configOrEngine);

    // Forward engine events
    this.engine.on('encode', (data) => this.emit('encode', data));
    this.engine.on('decode', (data) => this.emit('decode', data));
    this.engine.on('error', (data) => this.emit('error', data));

    // Setup incoming data handling if supported
    if (this.innerTransport.onData) {
      this.innerTransport.onData((data) => {
        this.handleIncomingData(data);
      });
    }
  }

  /**
   * Set the steganography algorithm
   */
  public setAlgorithm(algorithm: StegAlgorithm): void {
    this.engine.setAlgorithm(algorithm);
  }

  /**
   * Send data with steganography applied
   */
  public send(data: Buffer | Uint8Array, callback?: SendCallback): void {
    if (this.closed) {
      callback?.(new Error('Transport is closed'));
      return;
    }

    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

    // Encode with steganography
    const result = this.engine.encode(buffer);

    if (!result.success && this.engine.getConfig().onError === 'drop') {
      callback?.(new Error(result.error ?? 'Encoding failed'));
      return;
    }

    // Send through inner transport
    this.innerTransport.send(result.data, callback);
  }

  /**
   * Register handler for incoming data (after decoding)
   */
  public onData(handler: DataHandler): void {
    this.dataHandlers.push(handler);
  }

  /**
   * Close the transport
   */
  public close(): void {
    if (this.closed) return;

    this.closed = true;

    if (this.innerTransport.close) {
      this.innerTransport.close();
    }

    this.emit('close');
  }

  /**
   * Get transport metadata
   */
  public getMetadata(): TransportMetadata {
    const innerMeta = this.innerTransport.getMetadata?.();

    return {
      protocol: innerMeta?.protocol ?? 'custom',
      connectionState: this.closed ? 'disconnected' : (innerMeta?.connectionState ?? 'connected'),
      remoteAddress: innerMeta?.remoteAddress,
      remotePort: innerMeta?.remotePort,
      custom: {
        ...innerMeta?.custom,
        steganography: {
          enabled: this.engine.getConfig().enabled,
          algorithm: this.engine.getConfig().algorithm,
          poolStats: this.engine.getPoolStats()
        }
      }
    };
  }

  /**
   * Encode data manually (without sending)
   */
  public encode(data: Buffer, cover: Buffer): Buffer {
    const algorithm = this.engine.getAlgorithm();
    if (!algorithm) {
      throw new Error('No algorithm set');
    }
    return algorithm.encode(data, cover);
  }

  /**
   * Decode data manually (without receiving)
   */
  public decode(stegData: Buffer): Buffer {
    const result = this.engine.decode(stegData);
    if (!result.success) {
      throw new Error(result.error ?? 'Decoding failed');
    }
    return result.data;
  }

  /**
   * Get current configuration
   */
  public getConfig(): StegConfig {
    return this.engine.getConfig();
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<StegConfig>): void {
    this.engine.updateConfig(config);
  }

  /**
   * Add cover media to the pool
   */
  public addCoverMedia(media: Buffer): void {
    this.engine.addCoverMedia(media);
  }

  /**
   * Get the underlying engine
   */
  public getEngine(): StegEngine {
    return this.engine;
  }

  /**
   * Get the inner transport
   */
  public getInnerTransport(): TransportStream {
    return this.innerTransport;
  }

  // ─────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────

  private handleIncomingData(data: Buffer | Uint8Array): void {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

    // Decode steganography
    const result = this.engine.decode(buffer);

    // Emit raw data if decoding fails
    const outputData = result.success ? result.data : buffer;

    // Call all handlers
    for (const handler of this.dataHandlers) {
      try {
        handler(outputData);
      } catch (err) {
        this.emit('error', { type: 'handler', error: err });
      }
    }
  }
}

/**
 * Factory function to create a StegTransport
 */
export function createStegTransport(
  transport: TransportStream,
  configOrEngine: StegConfig | StegEngine
): StegTransport {
  return new StegTransport(transport, configOrEngine);
}
