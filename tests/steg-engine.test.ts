import { StegEngine, createStegEngine } from '../src/core/steg-engine';
import { LSBAlgorithm } from '../src/algorithms/lsb';

describe('StegEngine', () => {
  let engine: StegEngine;
  let lsb: LSBAlgorithm;

  beforeEach(() => {
    engine = new StegEngine({});
    lsb = new LSBAlgorithm();
    engine.setAlgorithm(lsb);
  });

  describe('initialization', () => {
    it('should create engine with default config', () => {
      const e = new StegEngine({});
      expect(e.getConfig().enabled).toBe(true);
      expect(e.getConfig().algorithm).toBe('lsb');
    });

    it('should accept custom configuration', () => {
      const e = new StegEngine({
        enabled: false,
        algorithm: 'custom',
        debug: true
      });

      expect(e.getConfig().enabled).toBe(false);
      expect(e.getConfig().algorithm).toBe('custom');
    });

    it('should create engine via factory', () => {
      const e = createStegEngine({ enabled: true });
      expect(e).toBeInstanceOf(StegEngine);
    });
  });

  describe('algorithm management', () => {
    it('should set and get algorithm', () => {
      const algo = new LSBAlgorithm();
      engine.setAlgorithm(algo);
      expect(engine.getAlgorithm()).toBe(algo);
    });

    it('should fail encode without algorithm', () => {
      const freshEngine = new StegEngine({});
      freshEngine.addCoverMedia(Buffer.alloc(256));

      const result = freshEngine.encode(Buffer.from('test'));
      expect(result.success).toBe(false);
      expect(result.error).toContain('No algorithm');
    });
  });

  describe('cover media management', () => {
    it('should add buffer as cover media', () => {
      engine.addCoverMedia(Buffer.alloc(256, 0xFF));
      expect(engine.getPoolStats().size).toBe(1);
    });

    it('should add CoverMedia object', () => {
      engine.addCoverMedia({
        data: Buffer.alloc(128),
        type: 'test',
        capacity: 12
      });
      expect(engine.getPoolStats().size).toBe(1);
    });

    it('should calculate total capacity', () => {
      engine.addCoverMedia(Buffer.alloc(256)); // ~28 bytes capacity
      engine.addCoverMedia(Buffer.alloc(256)); // ~28 bytes capacity

      const stats = engine.getPoolStats();
      expect(stats.size).toBe(2);
      expect(stats.totalCapacity).toBeGreaterThan(0);
    });

    it('should rotate through cover media pool', () => {
      engine.addCoverMedia(Buffer.alloc(256, 0xAA));
      engine.addCoverMedia(Buffer.alloc(256, 0xBB));

      const msg = Buffer.from('x');

      const result1 = engine.encode(msg);
      const result2 = engine.encode(msg);

      // Different covers produce different encoded outputs
      expect(result1.data).not.toEqual(result2.data);
    });
  });

  describe('encode/decode operations', () => {
    beforeEach(() => {
      engine.addCoverMedia(Buffer.alloc(512, 0xFF));
    });

    it('should encode and decode message', () => {
      const message = Buffer.from('Secret message');

      const encoded = engine.encode(message);
      expect(encoded.success).toBe(true);
      expect(encoded.payloadSize).toBe(message.length);

      const decoded = engine.decode(encoded.data);
      expect(decoded.success).toBe(true);
      expect(decoded.data.toString()).toBe('Secret message');
    });

    it('should passthrough when disabled', () => {
      engine.updateConfig({ enabled: false });

      const message = Buffer.from('not hidden');
      const encoded = engine.encode(message);

      expect(encoded.data).toEqual(message);
      expect(encoded.success).toBe(true);
    });

    it('should emit encode event', (done) => {
      engine.on('encode', (event) => {
        expect(event.success).toBe(true);
        expect(event.payloadSize).toBeGreaterThan(0);
        done();
      });

      engine.encode(Buffer.from('test'));
    });

    it('should emit decode event', (done) => {
      engine.on('decode', (event) => {
        expect(event.success).toBe(true);
        done();
      });

      const encoded = engine.encode(Buffer.from('test'));
      engine.decode(encoded.data);
    });
  });

  describe('error handling', () => {
    it('should handle missing cover media', () => {
      const result = engine.encode(Buffer.from('test'));
      expect(result.success).toBe(false);
      expect(result.error).toContain('No cover media');
    });

    it('should handle payload too large', () => {
      engine.addCoverMedia(Buffer.alloc(64)); // ~4 bytes capacity

      const largePayload = Buffer.alloc(100);
      const result = engine.encode(largePayload);

      expect(result.success).toBe(false);
      expect(result.error).toContain('too large');
    });

    it('should throw on error when configured', () => {
      const throwEngine = new StegEngine({ onError: 'throw' });
      throwEngine.setAlgorithm(lsb);

      expect(() => throwEngine.encode(Buffer.from('test'))).toThrow();
    });

    it('should drop data when configured', () => {
      const dropEngine = new StegEngine({ onError: 'drop' });
      dropEngine.setAlgorithm(lsb);

      const result = dropEngine.encode(Buffer.from('test'));
      expect(result.data.length).toBe(0);
    });

    it('should emit error event', (done) => {
      engine.on('error', (event) => {
        expect(event.type).toBe('encode');
        done();
      });

      engine.encode(Buffer.from('test')); // No cover media
    });
  });

  describe('configuration updates', () => {
    it('should update config dynamically', () => {
      engine.updateConfig({ enabled: false });
      expect(engine.getConfig().enabled).toBe(false);
    });

    it('should emit configUpdated event', (done) => {
      engine.on('configUpdated', (config) => {
        expect(config.enabled).toBe(false);
        done();
      });

      engine.updateConfig({ enabled: false });
    });

    it('should normalize new cover media on config update', () => {
      engine.updateConfig({
        coverMedia: [Buffer.alloc(256), Buffer.alloc(128)]
      });

      expect(engine.getPoolStats().size).toBe(2);
    });
  });
});
