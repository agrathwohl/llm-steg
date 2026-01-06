import {
  CoverGenerator,
  createCoverGenerator,
  generateCoverForPayload
} from '../src/utils/cover-generator';

describe('CoverGenerator', () => {
  let generator: CoverGenerator;

  beforeEach(() => {
    generator = new CoverGenerator();
  });

  describe('initialization', () => {
    it('should create with default options', () => {
      expect(generator).toBeInstanceOf(CoverGenerator);
    });

    it('should create via factory', () => {
      const g = createCoverGenerator({ minSize: 128 });
      expect(g).toBeInstanceOf(CoverGenerator);
    });
  });

  describe('generateNoise', () => {
    it('should generate noise of specified size', () => {
      const cover = generator.generateNoise(256);

      expect(cover.data.length).toBe(256);
      expect(cover.type).toBe('noise');
      expect(cover.capacity).toBe(32); // 256 / 8
    });

    it('should generate random data', () => {
      const cover1 = generator.generateNoise(100);
      const cover2 = generator.generateNoise(100);

      // Extremely unlikely to be equal
      expect(cover1.data.equals(cover2.data)).toBe(false);
    });

    it('should have variance in byte values', () => {
      const cover = generator.generateNoise(1000);
      const unique = new Set(cover.data);

      // Should have many unique values
      expect(unique.size).toBeGreaterThan(100);
    });
  });

  describe('generateTextCover', () => {
    it('should generate lorem ipsum text', () => {
      const cover = generator.generateTextCover('lorem', 500);

      expect(cover.data.length).toBe(500);
      expect(cover.type).toBe('text:lorem');

      const text = cover.data.toString();
      expect(text).toContain('Lorem');
    });

    it('should generate random text', () => {
      const cover = generator.generateTextCover('random', 200);

      expect(cover.data.length).toBe(200);
      expect(cover.type).toBe('text:random');
    });

    it('should generate whitespace', () => {
      const cover = generator.generateTextCover('whitespace', 100);

      expect(cover.data.length).toBe(100);
      expect(cover.type).toBe('text:whitespace');

      const text = cover.data.toString();
      expect(text.trim().length).toBeLessThan(text.length);
    });
  });

  describe('generatePattern', () => {
    it('should generate repeating pattern', () => {
      const cover = generator.generatePattern([0xAA, 0x55], 10);

      expect(cover.data.length).toBe(10);
      expect(cover.data[0]).toBe(0xAA);
      expect(cover.data[1]).toBe(0x55);
      expect(cover.data[2]).toBe(0xAA);
    });

    it('should handle single-byte pattern', () => {
      const cover = generator.generatePattern([0xFF], 5);

      for (let i = 0; i < 5; i++) {
        expect(cover.data[i]).toBe(0xFF);
      }
    });
  });

  describe('generateGradient', () => {
    it('should generate ascending gradient', () => {
      const cover = generator.generateGradient(256, 0, 255);

      expect(cover.data.length).toBe(256);
      expect(cover.data[0]).toBe(0);
      expect(cover.data[255]).toBe(255);
      expect(cover.type).toBe('gradient');
    });

    it('should generate descending gradient', () => {
      const cover = generator.generateGradient(256, 255, 0);

      expect(cover.data[0]).toBe(255);
      expect(cover.data[255]).toBe(0);
    });

    it('should handle custom range', () => {
      const cover = generator.generateGradient(100, 100, 200);

      expect(cover.data[0]).toBe(100);
      expect(cover.data[99]).toBe(200);
    });
  });

  describe('generateAudioLike', () => {
    it('should generate audio-like samples', () => {
      const cover = generator.generateAudioLike(100);

      // 100 samples * 2 bytes = 200 bytes
      expect(cover.data.length).toBe(200);
      expect(cover.type).toBe('audio');
    });

    it('should have wave-like characteristics', () => {
      const cover = generator.generateAudioLike(1000);

      // Check for sign changes (sine wave oscillates)
      let signChanges = 0;
      for (let i = 2; i < cover.data.length; i += 2) {
        const current = cover.data.readInt16LE(i);
        const previous = cover.data.readInt16LE(i - 2);

        if ((current > 0 && previous < 0) || (current < 0 && previous > 0)) {
          signChanges++;
        }
      }

      // Should have some oscillation
      expect(signChanges).toBeGreaterThan(0);
    });
  });

  describe('ensureCapacity', () => {
    it('should generate cover with sufficient capacity', () => {
      const cover = generator.ensureCapacity(100);

      // Need (100 + 4) * 8 = 832 bytes for 100 byte payload + header
      expect(cover.data.length).toBeGreaterThanOrEqual(832);
    });

    it('should handle small payloads', () => {
      const cover = generator.ensureCapacity(1);

      expect(cover.data.length).toBeGreaterThanOrEqual(40); // (1 + 4) * 8
    });

    it('should handle large payloads', () => {
      const cover = generator.ensureCapacity(10000);

      expect(cover.capacity).toBeGreaterThanOrEqual(10000);
    });
  });

  describe('generateCoverForPayload helper', () => {
    it('should generate cover buffer directly', () => {
      const buffer = generateCoverForPayload(50);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThanOrEqual((50 + 4) * 8);
    });
  });

  describe('capacity calculations', () => {
    it('should calculate capacity for noise', () => {
      const cover = generator.generateNoise(800);
      expect(cover.capacity).toBe(100); // 800 / 8
    });

    it('should calculate capacity for text', () => {
      const cover = generator.generateTextCover('lorem', 160);
      expect(cover.capacity).toBe(20); // 160 / 8
    });
  });
});
