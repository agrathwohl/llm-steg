import * as dgram from 'dgram';
import {
  TransportProtocol,
  SendCallback
} from '../interfaces/transport-stream.interface';
import { BaseAdapter } from './base-adapter';

/**
 * Options for UDP adapter
 */
export interface UdpAdapterOptions {
  /** Remote address to send to */
  remoteAddress: string;
  /** Remote port to send to */
  remotePort: number;
  /** Local address to bind to */
  localAddress?: string;
  /** Local port to bind to */
  localPort?: number;
  /** Socket type */
  type?: 'udp4' | 'udp6';
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * UDP transport adapter using Node.js dgram.
 *
 * Provides bidirectional UDP communication for steganographic data transfer.
 *
 * @example
 * ```typescript
 * const udp = new UdpAdapter({
 *   remoteAddress: '192.168.1.100',
 *   remotePort: 5004
 * });
 *
 * udp.send(Buffer.from('Hello'));
 *
 * udp.onData((data) => {
 *   console.log('Received:', data);
 * });
 *
 * udp.close();
 * ```
 */
export class UdpAdapter extends BaseAdapter {
  readonly protocol: TransportProtocol = 'udp';

  private socket: dgram.Socket | null = null;
  private remoteAddress: string;
  private remotePort: number;

  constructor(options: UdpAdapterOptions);
  constructor(remoteAddress: string, remotePort: number);
  constructor(
    optionsOrAddress: UdpAdapterOptions | string,
    remotePort?: number
  ) {
    const opts = typeof optionsOrAddress === 'string'
      ? { remoteAddress: optionsOrAddress, remotePort: remotePort! }
      : optionsOrAddress;

    super({
      remoteAddress: opts.remoteAddress,
      remotePort: opts.remotePort,
      localAddress: opts.localAddress,
      localPort: opts.localPort,
      debug: opts.debug
    });

    this.remoteAddress = opts.remoteAddress;
    this.remotePort = opts.remotePort;

    this.initSocket(opts.type ?? 'udp4');
  }

  // ─────────────────────────────────────────────────────────────
  // Protected Implementations
  // ─────────────────────────────────────────────────────────────

  protected doSend(data: Buffer, callback?: SendCallback): void {
    if (!this.socket) {
      callback?.(new Error('Socket not initialized'));
      return;
    }

    this.socket.send(
      data,
      0,
      data.length,
      this.remotePort,
      this.remoteAddress,
      (err) => {
        if (err) {
          this.handleError(err);
        }
        callback?.(err ?? undefined);
      }
    );
  }

  protected doClose(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────

  private initSocket(type: 'udp4' | 'udp6'): void {
    try {
      this.socket = dgram.createSocket(type);

      this.socket.on('error', (err) => {
        this.handleError(err);
      });

      this.socket.on('message', (msg, rinfo) => {
        this.log('Received message', { size: msg.length, from: rinfo.address });
        this.emitData(msg);
      });

      this.socket.on('listening', () => {
        const addr = this.socket?.address();
        this.log('Listening', addr);
        this.setState('connected');
      });

      this.socket.on('close', () => {
        this.setState('disconnected');
      });

      // Bind if local port specified
      if (this.options.localPort) {
        this.socket.bind(
          this.options.localPort,
          this.options.localAddress
        );
      } else {
        // For send-only, mark as connected immediately
        this.setState('connected');
      }

    } catch (err) {
      this.handleError(err as Error);
    }
  }
}

/**
 * Create a UDP adapter
 */
export function createUdpAdapter(
  remoteAddress: string,
  remotePort: number
): UdpAdapter {
  return new UdpAdapter(remoteAddress, remotePort);
}
