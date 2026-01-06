import { StegAlgorithm, AlgorithmOptions } from '../interfaces/algorithm.interface';

/**
 * Header size in bytes for storing payload length
 */
const HEADER_SIZE_BYTES = 4;
const HEADER_SIZE_BITS = HEADER_SIZE_BYTES * 8;

/**
 * Least Significant Bit (LSB) steganography algorithm.
 *
 * Hides data by modifying the least significant bit of each byte
 * in the cover media. This is a simple but effective technique
 * for hiding data in binary or image data.
 *
 * Capacity: 1 bit per cover byte = cover.length / 8 bytes of payload
 *           (minus 4 bytes for length header)
 *
 * @example
 * ```typescript
 * const lsb = new LSBAlgorithm();
 * const cover = Buffer.alloc(1024, 0xFF);
 * const secret = Buffer.from('Hello, World!');
 *
 * const encoded = lsb.encode(secret, cover);
 * const decoded = lsb.decode(encoded);
 *
 * console.log(decoded.toString()); // "Hello, World!"
 * ```
 */
export class LSBAlgorithm implements StegAlgorithm {
  public readonly name = 'lsb';
  /** Reserved for future deterministic encoding support */
  private seed: string | null = null;

  constructor(options?: AlgorithmOptions) {
    if (options?.seed) {
      this.seed = options.seed;
    }
  }

  /**
   * Encode data into cover media using LSB steganography
   */
  public encode(data: Buffer, cover: Buffer): Buffer {
    // Validate capacity
    const requiredCoverSize = (data.length + HEADER_SIZE_BYTES) * 8;
    if (cover.length < requiredCoverSize) {
      throw new Error(
        `Cover media too small: needs ${requiredCoverSize} bytes, got ${cover.length}`
      );
    }

    // Create a copy of the cover to modify
    const result = Buffer.from(cover);

    // Store payload length in header (first 32 bits)
    this.encodeLengthHeader(result, data.length);

    // Encode payload data
    for (let i = 0; i < data.length * 8; i++) {
      const coverIndex = i + HEADER_SIZE_BITS;
      const byteIndex = Math.floor(i / 8);
      const bitIndex = i % 8;

      // Extract bit from payload
      const bit = (data[byteIndex] >> bitIndex) & 1;

      // Set LSB of cover byte
      result[coverIndex] = (result[coverIndex] & 0xFE) | bit;
    }

    return result;
  }

  /**
   * Decode hidden data from steganographic media
   */
  public decode(stegData: Buffer): Buffer {
    if (stegData.length < HEADER_SIZE_BITS) {
      throw new Error('Data too small to contain valid steganographic content');
    }

    // Extract payload length from header
    const dataLength = this.decodeLengthHeader(stegData);

    // Validate length
    if (dataLength <= 0) {
      throw new Error('Invalid data length: zero or negative');
    }

    const maxPossibleLength = (stegData.length - HEADER_SIZE_BITS) / 8;
    if (dataLength > maxPossibleLength) {
      throw new Error(
        `Invalid data length: ${dataLength} exceeds maximum ${Math.floor(maxPossibleLength)}`
      );
    }

    // Extract payload data
    const result = Buffer.alloc(dataLength);

    for (let i = 0; i < dataLength * 8; i++) {
      const coverIndex = i + HEADER_SIZE_BITS;
      const byteIndex = Math.floor(i / 8);
      const bitIndex = i % 8;

      // Extract LSB from steg data
      const bit = stegData[coverIndex] & 1;

      // Set bit in result
      if (bit === 1) {
        result[byteIndex] |= (1 << bitIndex);
      }
    }

    return result;
  }

  /**
   * Calculate how many bytes can be hidden in cover media
   */
  public calculateCapacity(cover: Buffer): number {
    // Each byte of cover can hold 1 bit
    // Subtract header size
    const totalBits = cover.length - HEADER_SIZE_BITS;
    return Math.max(0, Math.floor(totalBits / 8));
  }

  /**
   * Set seed for deterministic behavior.
   * Reserved for future deterministic encoding support.
   */
  public setSeed(seed: string): void {
    this.seed = seed;
  }

  /**
   * Get current seed value
   */
  public getSeed(): string | null {
    return this.seed;
  }

  /**
   * Validate cover media suitability
   */
  public validateCover(cover: Buffer): boolean {
    // LSB works with any binary data
    // Minimum size: header + at least 1 byte of payload
    return cover.length >= (HEADER_SIZE_BYTES + 1) * 8;
  }

  // ─────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────

  private encodeLengthHeader(cover: Buffer, length: number): void {
    for (let i = 0; i < HEADER_SIZE_BITS; i++) {
      // Extract bit from length
      const bit = (length >> i) & 1;

      // Set LSB of cover byte
      cover[i] = (cover[i] & 0xFE) | bit;
    }
  }

  private decodeLengthHeader(stegData: Buffer): number {
    let length = 0;

    for (let i = 0; i < HEADER_SIZE_BITS; i++) {
      const bit = stegData[i] & 1;
      if (bit === 1) {
        length |= (1 << i);
      }
    }

    return length;
  }
}

/**
 * Factory function for LSB algorithm
 */
export function createLSBAlgorithm(options?: AlgorithmOptions): LSBAlgorithm {
  return new LSBAlgorithm(options);
}
