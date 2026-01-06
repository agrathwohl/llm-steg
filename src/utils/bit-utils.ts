/**
 * Bit manipulation utilities for steganography operations.
 *
 * Provides low-level bit operations used by steganographic algorithms.
 */

/**
 * Get a specific bit from a byte
 */
export function getBit(byte: number, position: number): number {
  return (byte >> position) & 1;
}

/**
 * Set a specific bit in a byte
 */
export function setBit(byte: number, position: number, value: 0 | 1): number {
  if (value === 1) {
    return byte | (1 << position);
  } else {
    return byte & ~(1 << position);
  }
}

/**
 * Get the LSB (least significant bit) of a byte
 */
export function getLSB(byte: number): number {
  return byte & 1;
}

/**
 * Set the LSB of a byte
 */
export function setLSB(byte: number, value: 0 | 1): number {
  return (byte & 0xFE) | value;
}

/**
 * Extract bits from a buffer
 */
export function extractBits(
  buffer: Buffer,
  startBit: number,
  count: number
): number[] {
  const bits: number[] = [];

  for (let i = 0; i < count; i++) {
    const bitIndex = startBit + i;
    const byteIndex = Math.floor(bitIndex / 8);
    const bitPosition = 7 - (bitIndex % 8);

    if (byteIndex >= buffer.length) break;

    bits.push(getBit(buffer[byteIndex], bitPosition));
  }

  return bits;
}

/**
 * Pack bits into bytes
 */
export function packBits(bits: number[]): Buffer {
  const byteCount = Math.ceil(bits.length / 8);
  const buffer = Buffer.alloc(byteCount);

  for (let i = 0; i < bits.length; i++) {
    const byteIndex = Math.floor(i / 8);
    const bitPosition = 7 - (i % 8);

    if (bits[i]) {
      buffer[byteIndex] = setBit(buffer[byteIndex], bitPosition, 1);
    }
  }

  return buffer;
}

/**
 * Unpack bytes into bits
 */
export function unpackBits(buffer: Buffer): number[] {
  const bits: number[] = [];

  for (const byte of buffer) {
    for (let i = 7; i >= 0; i--) {
      bits.push(getBit(byte, i));
    }
  }

  return bits;
}

/**
 * XOR two buffers
 */
export function xorBuffers(a: Buffer, b: Buffer): Buffer {
  const length = Math.min(a.length, b.length);
  const result = Buffer.alloc(length);

  for (let i = 0; i < length; i++) {
    result[i] = a[i] ^ b[i];
  }

  return result;
}

/**
 * Count set bits in a buffer (population count)
 */
export function popCount(buffer: Buffer): number {
  let count = 0;

  for (const byte of buffer) {
    let b = byte;
    while (b) {
      count += b & 1;
      b >>= 1;
    }
  }

  return count;
}

/**
 * Calculate Hamming distance between two buffers
 */
export function hammingDistance(a: Buffer, b: Buffer): number {
  return popCount(xorBuffers(a, b));
}

/**
 * Rotate bits left
 */
export function rotateLeft(value: number, count: number, bits: number = 8): number {
  const mask = (1 << bits) - 1;
  count = count % bits;
  return ((value << count) | (value >> (bits - count))) & mask;
}

/**
 * Rotate bits right
 */
export function rotateRight(value: number, count: number, bits: number = 8): number {
  const mask = (1 << bits) - 1;
  count = count % bits;
  return ((value >> count) | (value << (bits - count))) & mask;
}

/**
 * Interleave bits from two bytes
 */
export function interleaveBits(a: number, b: number): number {
  let result = 0;

  for (let i = 0; i < 8; i++) {
    result |= ((a >> i) & 1) << (i * 2);
    result |= ((b >> i) & 1) << (i * 2 + 1);
  }

  return result;
}

/**
 * Calculate parity of a byte
 */
export function parity(byte: number): number {
  let p = byte;
  p ^= p >> 4;
  p ^= p >> 2;
  p ^= p >> 1;
  return p & 1;
}

/**
 * Simple checksum for data integrity
 */
export function checksum(buffer: Buffer): number {
  let sum = 0;

  for (const byte of buffer) {
    sum = (sum + byte) & 0xFF;
  }

  return sum;
}

/**
 * Calculate CRC-8 for data integrity
 */
export function crc8(buffer: Buffer, polynomial: number = 0x07): number {
  let crc = 0;

  for (const byte of buffer) {
    crc ^= byte;

    for (let i = 0; i < 8; i++) {
      if (crc & 0x80) {
        crc = ((crc << 1) ^ polynomial) & 0xFF;
      } else {
        crc = (crc << 1) & 0xFF;
      }
    }
  }

  return crc;
}
