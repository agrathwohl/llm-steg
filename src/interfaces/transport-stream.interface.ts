/**
 * Transport protocol types supported by llm-steg
 */
export type TransportProtocol =
  | 'udp'
  | 'tcp'
  | 'websocket'
  | 'webrtc'
  | 'rtp'
  | 'srtp'
  | 'unix'
  | 'custom';

/**
 * Connection state for transport streams
 */
export type ConnectionState =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

/**
 * Metadata about the transport connection
 */
export interface TransportMetadata {
  /** Protocol type */
  protocol: TransportProtocol;
  /** Current connection state */
  connectionState: ConnectionState;
  /** Remote address (if applicable) */
  remoteAddress?: string;
  /** Remote port (if applicable) */
  remotePort?: number;
  /** Local address (if applicable) */
  localAddress?: string;
  /** Local port (if applicable) */
  localPort?: number;
  /** Custom metadata from adapter */
  custom?: Record<string, unknown>;
}

/**
 * Callback type for send operations
 */
export type SendCallback = (error?: Error) => void;

/**
 * Callback type for data reception
 */
export type DataHandler = (data: Buffer | Uint8Array) => void;

/**
 * Generic transport interface for any streaming protocol.
 * Supports: UDP, TCP, WebSocket, WebRTC DataChannel, RTP, SRTP, Unix sockets, etc.
 *
 * This interface enables transport-agnostic steganography by abstracting
 * the underlying network protocol. Implement this interface to add support
 * for any custom transport mechanism.
 *
 * @example
 * ```typescript
 * const udpTransport: TransportStream = {
 *   send(data, callback) {
 *     socket.send(data, 0, data.length, port, address, callback);
 *   },
 *   close() {
 *     socket.close();
 *   }
 * };
 * ```
 */
export interface TransportStream {
  /**
   * Send data through the transport.
   *
   * @param data - The binary data to send (Buffer or Uint8Array)
   * @param callback - Optional callback invoked on completion or error
   */
  send(data: Buffer | Uint8Array, callback?: SendCallback): void;

  /**
   * Register a handler for incoming data (bidirectional transports).
   * Optional - only needed for transports that receive data.
   *
   * @param handler - Function called when data is received
   */
  onData?(handler: DataHandler): void;

  /**
   * Close the transport and release resources.
   * Should be idempotent (safe to call multiple times).
   */
  close?(): void;

  /**
   * Get metadata about the transport connection.
   * Useful for logging, debugging, and protocol-specific behavior.
   */
  getMetadata?(): TransportMetadata;
}

/**
 * Options for creating transport adapters
 */
export interface TransportOptions {
  /** Remote address to connect/send to */
  remoteAddress?: string;
  /** Remote port to connect/send to */
  remotePort?: number;
  /** Local address to bind to */
  localAddress?: string;
  /** Local port to bind to */
  localPort?: number;
  /** Connection timeout in milliseconds */
  timeout?: number;
  /** Enable debug logging */
  debug?: boolean;
}
