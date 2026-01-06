import { EventEmitter } from 'events';
import {
  StegConfig,
  StegEncodeResult,
  StegDecodeResult,
  CoverMedia
} from '../interfaces/steg-config.interface';
import { StegAlgorithm } from '../interfaces/algorithm.interface';

/**
 * Options for StegEngine constructor (alias for StegConfig)
 */
export type StegEngineOptions = StegConfig;

/**
 * Core steganography engine that manages encoding/decoding operations.
 *
 * The StegEngine is the central component that:
 * - Manages cover media pool
 * - Coordinates algorithm selection
 * - Handles encode/decode operations
 * - Emits events for monitoring
 *
 * @example
 * ```typescript
 * const engine = new StegEngine({
 *   algorithm: 'lsb',
 *   coverMedia: [Buffer.alloc(1024, 0xFF)],
 *   enabled: true
 * });
 *
 * const result = engine.encode(Buffer.from('secret'));
 * console.log('Hidden in:', result.data.length, 'bytes');
 *
 * const decoded = engine.decode(result.data);
 * console.log('Extracted:', decoded.data.toString());
 * ```
 */
export class StegEngine extends EventEmitter {
  private config: Required<StegConfig>;
  private algorithm: StegAlgorithm | null = null;
  private coverMediaPool: CoverMedia[] = [];
  private coverIndex: number = 0;

  constructor(config: StegConfig) {
    super();

    // Apply defaults
    this.config = {
      enabled: config.enabled ?? true,
      algorithm: config.algorithm ?? 'lsb',
      coverMedia: config.coverMedia ?? [],
      algorithmCode: config.algorithmCode ?? '',
      llmPrompt: config.llmPrompt ?? '',
      llmProvider: config.llmProvider ?? undefined as any,
      seed: config.seed ?? this.generateRandomSeed(),
      encodingRatio: config.encodingRatio ?? 100,
      onError: config.onError ?? 'passthrough',
      debug: config.debug ?? false
    };

    // Normalize cover media
    this.normalizeCoverMedia();

    // Log initialization
    this.log('StegEngine initialized', {
      algorithm: this.config.algorithm,
      coverMediaCount: this.coverMediaPool.length,
      enabled: this.config.enabled
    });
  }

  /**
   * Register an algorithm implementation
   */
  public setAlgorithm(algorithm: StegAlgorithm): void {
    this.algorithm = algorithm;
    if (this.config.seed && algorithm.setSeed) {
      algorithm.setSeed(this.config.seed);
    }
    this.log('Algorithm set', { name: algorithm.name });
  }

  /**
   * Get the current algorithm
   */
  public getAlgorithm(): StegAlgorithm | null {
    return this.algorithm;
  }

  /**
   * Encode data into cover media
   */
  public encode(data: Buffer): StegEncodeResult {
    const startTime = Date.now();

    // Check if enabled
    if (!this.config.enabled) {
      return {
        data,
        payloadSize: data.length,
        coverSize: data.length,
        algorithm: this.config.algorithm,
        success: true
      };
    }

    // Check algorithm
    if (!this.algorithm) {
      return this.handleError('No algorithm set', data);
    }

    // Get cover media
    const cover = this.getNextCover();
    if (!cover) {
      return this.handleError('No cover media available', data);
    }

    // Check capacity
    const capacity = this.algorithm.calculateCapacity(cover.data);
    if (data.length > capacity) {
      return this.handleError(
        `Data too large: ${data.length} bytes > ${capacity} capacity`,
        data
      );
    }

    try {
      // Encode
      const encoded = this.algorithm.encode(data, cover.data);

      const result: StegEncodeResult = {
        data: encoded,
        payloadSize: data.length,
        coverSize: cover.data.length,
        algorithm: this.config.algorithm,
        success: true
      };

      this.emit('encode', {
        ...result,
        durationMs: Date.now() - startTime
      });

      this.log('Encoded successfully', {
        payloadSize: data.length,
        coverSize: cover.data.length,
        outputSize: encoded.length
      });

      return result;

    } catch (err) {
      return this.handleError(
        `Encoding failed: ${(err as Error).message}`,
        data
      );
    }
  }

  /**
   * Decode hidden data from steganographic media
   */
  public decode(stegData: Buffer): StegDecodeResult {
    const startTime = Date.now();

    if (!this.config.enabled) {
      return {
        data: stegData,
        payloadSize: stegData.length,
        algorithm: this.config.algorithm,
        success: true
      };
    }

    if (!this.algorithm) {
      return {
        data: Buffer.alloc(0),
        payloadSize: 0,
        algorithm: this.config.algorithm,
        success: false,
        error: 'No algorithm set'
      };
    }

    try {
      const decoded = this.algorithm.decode(stegData);

      const result: StegDecodeResult = {
        data: decoded,
        payloadSize: decoded.length,
        algorithm: this.config.algorithm,
        success: true
      };

      this.emit('decode', {
        ...result,
        durationMs: Date.now() - startTime
      });

      this.log('Decoded successfully', { payloadSize: decoded.length });

      return result;

    } catch (err) {
      const result: StegDecodeResult = {
        data: Buffer.alloc(0),
        payloadSize: 0,
        algorithm: this.config.algorithm,
        success: false,
        error: `Decoding failed: ${(err as Error).message}`
      };

      this.emit('error', { type: 'decode', error: err });
      return result;
    }
  }

  /**
   * Add cover media to the pool
   */
  public addCoverMedia(media: Buffer | CoverMedia): void {
    const normalized = this.normalizeSingleCover(media);
    if (normalized) {
      this.coverMediaPool.push(normalized);
      this.log('Cover media added', {
        capacity: normalized.capacity,
        poolSize: this.coverMediaPool.length
      });
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): StegConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<StegConfig>): void {
    Object.assign(this.config, config);

    if (config.coverMedia) {
      this.normalizeCoverMedia();
    }

    if (config.seed && this.algorithm?.setSeed) {
      this.algorithm.setSeed(config.seed);
    }

    this.emit('configUpdated', this.config);
    this.log('Config updated', config);
  }

  /**
   * Get pool statistics
   */
  public getPoolStats(): {
    size: number;
    totalCapacity: number;
    averageCapacity: number;
  } {
    const totalCapacity = this.coverMediaPool.reduce(
      (sum, c) => sum + (c.capacity ?? 0),
      0
    );

    return {
      size: this.coverMediaPool.length,
      totalCapacity,
      averageCapacity: this.coverMediaPool.length > 0
        ? Math.floor(totalCapacity / this.coverMediaPool.length)
        : 0
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────

  private getNextCover(): CoverMedia | null {
    if (this.coverMediaPool.length === 0) {
      return null;
    }

    // Round-robin selection
    const cover = this.coverMediaPool[this.coverIndex];
    this.coverIndex = (this.coverIndex + 1) % this.coverMediaPool.length;

    return cover;
  }

  private normalizeCoverMedia(): void {
    this.coverMediaPool = [];

    for (const media of this.config.coverMedia ?? []) {
      const normalized = this.normalizeSingleCover(media);
      if (normalized) {
        this.coverMediaPool.push(normalized);
      }
    }
  }

  private normalizeSingleCover(media: Buffer | CoverMedia): CoverMedia | null {
    if (Buffer.isBuffer(media)) {
      const capacity = this.algorithm
        ? this.algorithm.calculateCapacity(media)
        : Math.floor((media.length - 4) / 8); // Default LSB estimate

      return {
        data: media,
        type: 'binary',
        capacity
      };
    }

    if (media && typeof media === 'object' && 'data' in media) {
      const capacity = media.capacity ?? (
        this.algorithm
          ? this.algorithm.calculateCapacity(media.data)
          : Math.floor((media.data.length - 4) / 8)
      );

      return {
        ...media,
        capacity
      };
    }

    return null;
  }

  private handleError(message: string, originalData: Buffer): StegEncodeResult {
    const error = new Error(message);
    this.emit('error', { type: 'encode', error });
    this.log('Error', { message });

    switch (this.config.onError) {
      case 'throw':
        throw error;

      case 'drop':
        return {
          data: Buffer.alloc(0),
          payloadSize: 0,
          coverSize: 0,
          algorithm: this.config.algorithm,
          success: false,
          error: message
        };

      case 'passthrough':
      default:
        return {
          data: originalData,
          payloadSize: originalData.length,
          coverSize: originalData.length,
          algorithm: this.config.algorithm,
          success: false,
          error: message
        };
    }
  }

  private generateRandomSeed(): string {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  private log(message: string, data?: Record<string, unknown>): void {
    if (this.config.debug) {
      console.log(`[StegEngine] ${message}`, data ?? '');
    }
  }
}

/**
 * Create a StegEngine with default LSB configuration
 */
export function createStegEngine(config: StegEngineOptions = {}): StegEngine {
  return new StegEngine(config);
}
