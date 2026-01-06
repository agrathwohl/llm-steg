/**
 * Interface for steganography encoding/decoding algorithms.
 *
 * Implement this interface to create custom steganography algorithms
 * that can be used with the StegEngine.
 *
 * @example
 * ```typescript
 * class MyAlgorithm implements StegAlgorithm {
 *   readonly name = 'my-algorithm';
 *
 *   encode(data: Buffer, cover: Buffer): Buffer {
 *     // Your encoding logic here
 *     return modifiedCover;
 *   }
 *
 *   decode(stegData: Buffer): Buffer {
 *     // Your decoding logic here
 *     return extractedData;
 *   }
 *
 *   calculateCapacity(cover: Buffer): number {
 *     // Calculate how much data can be hidden
 *     return Math.floor(cover.length / 8);
 *   }
 * }
 * ```
 */
export interface StegAlgorithm {
  /** Unique name for this algorithm */
  readonly name: string;

  /**
   * Encode data into cover media using steganography.
   *
   * @param data - The secret data to hide
   * @param cover - The cover media to hide data in
   * @returns Modified cover containing hidden data
   * @throws Error if cover is too small or encoding fails
   */
  encode(data: Buffer, cover: Buffer): Buffer;

  /**
   * Decode hidden data from steganographic media.
   *
   * @param stegData - The steganographic media containing hidden data
   * @returns The extracted secret data
   * @throws Error if decoding fails or data is corrupted
   */
  decode(stegData: Buffer): Buffer;

  /**
   * Calculate the data capacity of a cover media.
   *
   * @param cover - The cover media to analyze
   * @returns Maximum bytes that can be hidden in this cover
   */
  calculateCapacity(cover: Buffer): number;

  /**
   * Optional: Initialize algorithm with a seed for deterministic behavior.
   *
   * @param seed - Seed string for reproducible encoding
   */
  setSeed?(seed: string): void;

  /**
   * Optional: Validate that cover media is suitable for this algorithm.
   *
   * @param cover - The cover media to validate
   * @returns True if cover is valid, false otherwise
   */
  validateCover?(cover: Buffer): boolean;
}

/**
 * Options for algorithm initialization
 */
export interface AlgorithmOptions {
  /** Random seed for deterministic behavior */
  seed?: string;
  /** Algorithm-specific configuration */
  config?: Record<string, unknown>;
  /** Enable debug mode */
  debug?: boolean;
}

/**
 * Factory function type for creating algorithms
 */
export type AlgorithmFactory = (options?: AlgorithmOptions) => StegAlgorithm;

/**
 * Registry entry for algorithms
 */
export interface AlgorithmRegistryEntry {
  /** Algorithm name */
  name: string;
  /** Factory function to create instances */
  factory: AlgorithmFactory;
  /** Human-readable description */
  description?: string;
  /** Supported cover media types */
  supportedMediaTypes?: string[];
}

/**
 * Algorithm performance metrics
 */
export interface AlgorithmMetrics {
  /** Time to encode in milliseconds */
  encodeTimeMs: number;
  /** Time to decode in milliseconds */
  decodeTimeMs: number;
  /** Bytes per second encoding throughput */
  encodeThroughput: number;
  /** Bytes per second decoding throughput */
  decodeThroughput: number;
  /** Ratio of hidden data to cover size */
  capacityRatio: number;
}
