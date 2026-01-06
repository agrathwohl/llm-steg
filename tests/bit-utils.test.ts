import {
  getBit,
  setBit,
  getLSB,
  setLSB,
  extractBits,
  packBits,
  unpackBits,
  xorBuffers,
  popCount,
  hammingDistance,
  rotateLeft,
  rotateRight,
  parity,
  checksum,
  crc8
} from '../src/utils/bit-utils';

describe('bit-utils', () => {
  describe('getBit', () => {
    it('should get bit at position', () => {
      expect(getBit(0b10101010, 0)).toBe(0);
      expect(getBit(0b10101010, 1)).toBe(1);
      expect(getBit(0b10101010, 7)).toBe(1);
    });
  });

  describe('setBit', () => {
    it('should set bit to 1', () => {
      expect(setBit(0b00000000, 0, 1)).toBe(0b00000001);
      expect(setBit(0b00000000, 7, 1)).toBe(0b10000000);
    });

    it('should set bit to 0', () => {
      expect(setBit(0b11111111, 0, 0)).toBe(0b11111110);
      expect(setBit(0b11111111, 7, 0)).toBe(0b01111111);
    });
  });

  describe('getLSB', () => {
    it('should get least significant bit', () => {
      expect(getLSB(0b11111110)).toBe(0);
      expect(getLSB(0b11111111)).toBe(1);
      expect(getLSB(0b00000001)).toBe(1);
      expect(getLSB(0b00000000)).toBe(0);
    });
  });

  describe('setLSB', () => {
    it('should set LSB to 1', () => {
      expect(setLSB(0b11111110, 1)).toBe(0b11111111);
      expect(setLSB(0b00000000, 1)).toBe(0b00000001);
    });

    it('should set LSB to 0', () => {
      expect(setLSB(0b11111111, 0)).toBe(0b11111110);
      expect(setLSB(0b00000001, 0)).toBe(0b00000000);
    });
  });

  describe('extractBits', () => {
    it('should extract bits from buffer', () => {
      const buf = Buffer.from([0b11110000]);
      const bits = extractBits(buf, 0, 8);
      expect(bits).toEqual([1, 1, 1, 1, 0, 0, 0, 0]);
    });

    it('should extract partial bits', () => {
      const buf = Buffer.from([0b10101010]);
      const bits = extractBits(buf, 0, 4);
      expect(bits).toEqual([1, 0, 1, 0]);
    });
  });

  describe('packBits', () => {
    it('should pack bits into bytes', () => {
      const bits = [1, 0, 1, 0, 1, 0, 1, 0];
      const packed = packBits(bits);
      expect(packed[0]).toBe(0b10101010);
    });

    it('should pad incomplete bytes', () => {
      const bits = [1, 1, 1]; // Only 3 bits
      const packed = packBits(bits);
      expect(packed.length).toBe(1);
      expect(packed[0]).toBe(0b11100000);
    });
  });

  describe('unpackBits', () => {
    it('should unpack bytes to bits', () => {
      const buf = Buffer.from([0b10101010]);
      const bits = unpackBits(buf);
      expect(bits).toEqual([1, 0, 1, 0, 1, 0, 1, 0]);
    });

    it('should handle multiple bytes', () => {
      const buf = Buffer.from([0xFF, 0x00]);
      const bits = unpackBits(buf);
      expect(bits.length).toBe(16);
      expect(bits.slice(0, 8).every(b => b === 1)).toBe(true);
      expect(bits.slice(8, 16).every(b => b === 0)).toBe(true);
    });
  });

  describe('xorBuffers', () => {
    it('should XOR two buffers', () => {
      const a = Buffer.from([0xFF, 0x00, 0xAA]);
      const b = Buffer.from([0x0F, 0xF0, 0x55]);

      const result = xorBuffers(a, b);

      expect(result[0]).toBe(0xF0);
      expect(result[1]).toBe(0xF0);
      expect(result[2]).toBe(0xFF);
    });

    it('should use shorter buffer length', () => {
      const a = Buffer.from([0xFF, 0xFF, 0xFF]);
      const b = Buffer.from([0x00]);

      expect(xorBuffers(a, b).length).toBe(1);
    });
  });

  describe('popCount', () => {
    it('should count set bits', () => {
      expect(popCount(Buffer.from([0b11111111]))).toBe(8);
      expect(popCount(Buffer.from([0b00000000]))).toBe(0);
      expect(popCount(Buffer.from([0b10101010]))).toBe(4);
    });

    it('should count across multiple bytes', () => {
      expect(popCount(Buffer.from([0xFF, 0xFF]))).toBe(16);
    });
  });

  describe('hammingDistance', () => {
    it('should calculate hamming distance', () => {
      const a = Buffer.from([0b11111111]);
      const b = Buffer.from([0b11110000]);

      expect(hammingDistance(a, b)).toBe(4);
    });

    it('should return 0 for identical buffers', () => {
      const a = Buffer.from([0xAB, 0xCD]);
      expect(hammingDistance(a, a)).toBe(0);
    });
  });

  describe('rotateLeft', () => {
    it('should rotate bits left', () => {
      expect(rotateLeft(0b00000001, 1)).toBe(0b00000010);
      expect(rotateLeft(0b10000000, 1)).toBe(0b00000001);
      expect(rotateLeft(0b00001111, 4)).toBe(0b11110000);
    });
  });

  describe('rotateRight', () => {
    it('should rotate bits right', () => {
      expect(rotateRight(0b00000010, 1)).toBe(0b00000001);
      expect(rotateRight(0b00000001, 1)).toBe(0b10000000);
      expect(rotateRight(0b11110000, 4)).toBe(0b00001111);
    });
  });

  describe('parity', () => {
    it('should calculate even/odd parity', () => {
      expect(parity(0b00000000)).toBe(0); // 0 bits = even
      expect(parity(0b00000001)).toBe(1); // 1 bit = odd
      expect(parity(0b00000011)).toBe(0); // 2 bits = even
      expect(parity(0b11111111)).toBe(0); // 8 bits = even
    });
  });

  describe('checksum', () => {
    it('should calculate simple checksum', () => {
      expect(checksum(Buffer.from([0]))).toBe(0);
      expect(checksum(Buffer.from([1, 2, 3]))).toBe(6);
      expect(checksum(Buffer.from([0xFF, 0xFF]))).toBe(0xFE); // Wraps at 255
    });
  });

  describe('crc8', () => {
    it('should calculate CRC-8', () => {
      const data = Buffer.from('123456789');
      const crc = crc8(data);
      expect(crc).toBeDefined();
      expect(typeof crc).toBe('number');
    });

    it('should return 0 for empty buffer', () => {
      expect(crc8(Buffer.alloc(0))).toBe(0);
    });

    it('should be deterministic', () => {
      const data = Buffer.from('test');
      expect(crc8(data)).toBe(crc8(data));
    });
  });
});
