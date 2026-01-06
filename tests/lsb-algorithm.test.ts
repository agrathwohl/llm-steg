import { LSBAlgorithm, createLSBAlgorithm } from '../src/algorithms/lsb';

describe('LSBAlgorithm', () => {
  let lsb: LSBAlgorithm;

  beforeEach(() => {
    lsb = new LSBAlgorithm();
  });

  describe('encode/decode roundtrip', () => {
    it('should encode and decode simple message', () => {
      const message = Buffer.from('Hello, World!');
      const cover = Buffer.alloc(256, 0xFF);

      const encoded = lsb.encode(message, cover);
      const decoded = lsb.decode(encoded);

      expect(decoded.toString()).toBe('Hello, World!');
    });

    it('should encode and decode binary data', () => {
      const binary = Buffer.from([0x00, 0xFF, 0x55, 0xAA, 0x12, 0x34]);
      const cover = Buffer.alloc(128, 0xCC);

      const encoded = lsb.encode(binary, cover);
      const decoded = lsb.decode(encoded);

      expect(decoded).toEqual(binary);
    });

    it('should handle empty payload', () => {
      const empty = Buffer.alloc(0);
      const cover = Buffer.alloc(64, 0x00);

      const encoded = lsb.encode(empty, cover);
      const decoded = lsb.decode(encoded);

      expect(decoded.length).toBe(0);
    });

    it('should handle single byte payload', () => {
      const single = Buffer.from([0x42]);
      const cover = Buffer.alloc(64, 0x00);

      const encoded = lsb.encode(single, cover);
      const decoded = lsb.decode(encoded);

      expect(decoded).toEqual(single);
    });

    it('should preserve UTF-8 characters', () => {
      const utf8 = Buffer.from('こんにちは 🌍 Привет');
      const cover = Buffer.alloc(512, 0x80);

      const encoded = lsb.encode(utf8, cover);
      const decoded = lsb.decode(encoded);

      expect(decoded.toString('utf-8')).toBe('こんにちは 🌍 Привет');
    });
  });

  describe('calculateCapacity', () => {
    it('should calculate capacity correctly', () => {
      const cover = Buffer.alloc(100);
      // 100 bytes / 8 bits per payload byte = 12 bytes
      // Minus 4 bytes for header = 8 bytes capacity
      expect(lsb.calculateCapacity(cover)).toBe(8);
    });

    it('should return 0 for covers smaller than header', () => {
      const tinycover = Buffer.alloc(31); // 31 bytes < 32 bits header
      expect(lsb.calculateCapacity(tinycover)).toBe(0);
    });

    it('should handle exact header size', () => {
      const cover = Buffer.alloc(32); // Exactly 4 bytes header capacity
      expect(lsb.calculateCapacity(cover)).toBe(0);
    });

    it('should calculate capacity for large buffers', () => {
      const cover = Buffer.alloc(10000);
      // (10000 / 8) - 4 = 1246 bytes
      expect(lsb.calculateCapacity(cover)).toBe(1246);
    });
  });

  describe('edge cases', () => {
    it('should throw when payload exceeds capacity', () => {
      const largePayload = Buffer.alloc(100);
      const smallCover = Buffer.alloc(100); // capacity ~8 bytes

      expect(() => lsb.encode(largePayload, smallCover)).toThrow();
    });

    it('should handle cover media with various byte values', () => {
      const message = Buffer.from('test');

      // Cover with alternating bits
      const cover = Buffer.alloc(128);
      for (let i = 0; i < cover.length; i++) {
        cover[i] = i % 2 === 0 ? 0xAA : 0x55;
      }

      const encoded = lsb.encode(message, cover);
      const decoded = lsb.decode(encoded);

      expect(decoded.toString()).toBe('test');
    });

    it('should minimally modify cover media', () => {
      const message = Buffer.from('x');
      const cover = Buffer.alloc(128, 0xFF);

      const encoded = lsb.encode(message, cover);

      // Count differences in LSBs
      let differences = 0;
      for (let i = 0; i < encoded.length; i++) {
        if ((cover[i] & 1) !== (encoded[i] & 1)) {
          differences++;
        }
      }

      // Should only modify bits needed for header + payload
      // Header: 32 bits, payload 'x' = 8 bits = 40 bits total
      expect(differences).toBeLessThanOrEqual(40);
    });
  });

  describe('factory function', () => {
    it('should create algorithm via factory', () => {
      const algo = createLSBAlgorithm();
      expect(algo).toBeInstanceOf(LSBAlgorithm);
      expect(algo.name).toBe('lsb');
    });
  });

  describe('algorithm properties', () => {
    it('should have correct name', () => {
      expect(lsb.name).toBe('lsb');
    });

    it('should support seed setting', () => {
      // LSB is deterministic, but seed should be accepted without error
      expect(() => lsb.setSeed?.('test-seed')).not.toThrow();
    });
  });
});
