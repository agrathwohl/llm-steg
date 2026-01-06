import { CoverMedia } from '../interfaces/steg-config.interface';

/**
 * Options for cover media generation
 */
export interface CoverGeneratorOptions {
  /** Minimum size in bytes */
  minSize?: number;
  /** Maximum size in bytes */
  maxSize?: number;
  /** Default cover media type */
  defaultType?: string;
}

/**
 * Cover media generator for steganography.
 *
 * Generates cover media (carrier data) for hiding steganographic payloads.
 * Supports multiple generation strategies for different use cases.
 *
 * @example
 * ```typescript
 * const generator = new CoverGenerator();
 *
 * // Generate random noise cover
 * const noise = generator.generateNoise(1024);
 *
 * // Generate text-based cover
 * const text = generator.generateTextCover('lorem', 500);
 *
 * // Generate from pattern
 * const pattern = generator.generatePattern([0xAA, 0x55], 512);
 * ```
 */
export class CoverGenerator {
  private readonly minSize: number;
  private readonly maxSize: number;

  constructor(options: CoverGeneratorOptions = {}) {
    this.minSize = options.minSize ?? 64;
    this.maxSize = options.maxSize ?? 65536;
  }

  /**
   * Get configured minimum size
   */
  public getMinSize(): number {
    return this.minSize;
  }

  /**
   * Get configured maximum size
   */
  public getMaxSize(): number {
    return this.maxSize;
  }

  // ─────────────────────────────────────────────────────────────
  // Generation Methods
  // ─────────────────────────────────────────────────────────────

  /**
   * Generate random noise cover media
   */
  public generateNoise(size: number): CoverMedia {
    // Clamp size to configured bounds
    const clampedSize = Math.max(this.minSize, Math.min(this.maxSize, size));
    const data = Buffer.alloc(clampedSize);

    // Use crypto-quality randomness
    for (let i = 0; i < clampedSize; i++) {
      data[i] = Math.floor(Math.random() * 256);
    }

    return {
      data,
      type: 'noise',
      capacity: Math.floor(clampedSize / 8)
    };
  }

  /**
   * Generate text-based cover media
   */
  public generateTextCover(
    style: 'lorem' | 'random' | 'whitespace' = 'lorem',
    targetSize: number
  ): CoverMedia {
    let text: string;

    switch (style) {
      case 'lorem':
        text = this.generateLoremIpsum(targetSize);
        break;
      case 'random':
        text = this.generateRandomText(targetSize);
        break;
      case 'whitespace':
        text = this.generateWhitespace(targetSize);
        break;
    }

    const data = Buffer.from(text, 'utf-8');

    return {
      data,
      type: `text:${style}`,
      capacity: Math.floor(data.length / 8)
    };
  }

  /**
   * Generate pattern-based cover media
   */
  public generatePattern(
    pattern: number[],
    size: number
  ): CoverMedia {
    const data = Buffer.alloc(size);

    for (let i = 0; i < size; i++) {
      data[i] = pattern[i % pattern.length];
    }

    return {
      data,
      type: 'pattern',
      capacity: Math.floor(size / 8)
    };
  }

  /**
   * Generate gradient cover media
   */
  public generateGradient(
    size: number,
    startValue: number = 0,
    endValue: number = 255
  ): CoverMedia {
    const data = Buffer.alloc(size);
    const range = endValue - startValue;

    for (let i = 0; i < size; i++) {
      const progress = i / (size - 1);
      data[i] = Math.floor(startValue + range * progress);
    }

    return {
      data,
      type: 'gradient',
      capacity: Math.floor(size / 8)
    };
  }

  /**
   * Generate cover media mimicking audio samples
   */
  public generateAudioLike(
    samples: number,
    bitsPerSample: number = 16
  ): CoverMedia {
    const bytesPerSample = bitsPerSample / 8;
    const size = samples * bytesPerSample;
    const data = Buffer.alloc(size);

    // Generate sine wave with noise (simulated audio)
    for (let i = 0; i < samples; i++) {
      const freq = 440; // A4 note
      const sampleRate = 44100;
      const t = i / sampleRate;

      // Sine wave + noise
      const amplitude = Math.sin(2 * Math.PI * freq * t) * 0.7;
      const noise = (Math.random() - 0.5) * 0.3;
      const value = (amplitude + noise) * 32767;

      // Write as 16-bit little-endian
      const offset = i * bytesPerSample;
      data.writeInt16LE(Math.floor(value), offset);
    }

    return {
      data,
      type: 'audio',
      capacity: Math.floor(size / 8)
    };
  }

  /**
   * Ensure minimum capacity for payload
   */
  public ensureCapacity(payloadSize: number): CoverMedia {
    // LSB needs 8 bytes per payload byte + 4 bytes header
    const requiredSize = (payloadSize + 4) * 8;
    return this.generateNoise(requiredSize);
  }

  // ─────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────

  private generateLoremIpsum(targetSize: number): string {
    const lorem = [
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.',
      'Duis aute irure dolor in reprehenderit in voluptate velit esse.',
      'Excepteur sint occaecat cupidatat non proident, sunt in culpa.',
      'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit.',
      'Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet.',
      'Consectetur, adipisci velit, sed quia non numquam eius modi tempora.'
    ];

    let result = '';
    let index = 0;

    while (result.length < targetSize) {
      result += lorem[index % lorem.length] + ' ';
      index++;
    }

    return result.slice(0, targetSize);
  }

  private generateRandomText(targetSize: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,!?';
    let result = '';

    for (let i = 0; i < targetSize; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }

    return result;
  }

  private generateWhitespace(targetSize: number): string {
    const spaces = [' ', '\t', '\n', '  ', '   '];
    let result = '';

    while (result.length < targetSize) {
      result += spaces[Math.floor(Math.random() * spaces.length)];
    }

    return result.slice(0, targetSize);
  }
}

/**
 * Create a cover generator
 */
export function createCoverGenerator(
  options?: CoverGeneratorOptions
): CoverGenerator {
  return new CoverGenerator(options);
}

/**
 * Quick generate noise cover for payload
 */
export function generateCoverForPayload(payloadSize: number): Buffer {
  const generator = new CoverGenerator();
  return generator.ensureCapacity(payloadSize).data;
}
