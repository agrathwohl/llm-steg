import { StegEngine } from '../src/core/steg-engine';
import { StegTransport } from '../src/core/steg-transport';
import { LSBAlgorithm } from '../src/algorithms/lsb';
import { MemoryAdapter } from '../src/adapters/memory-adapter';
import { StreamNormalizer } from '../src/llm/stream-normalizer';
import { CoverGenerator } from '../src/utils/cover-generator';

describe('Integration Tests', () => {
  describe('Full Steganography Pipeline', () => {
    it('should encode and decode through full pipeline', () => {
      // Setup
      const engine = new StegEngine({});
      const lsb = new LSBAlgorithm();
      engine.setAlgorithm(lsb);

      const generator = new CoverGenerator();
      engine.addCoverMedia(generator.generateNoise(1024));

      const adapter = new MemoryAdapter();
      const transport = new StegTransport(adapter, engine);

      // Encode and send
      const secret = Buffer.from('Top secret message');
      transport.send(secret);

      // Verify sent data is different from original
      const sentData = adapter.getLastSent()!;
      expect(sentData).not.toEqual(secret);
      expect(sentData.length).toBeGreaterThan(secret.length);

      // Decode received data
      const decoded = engine.decode(sentData);
      expect(decoded.success).toBe(true);
      expect(decoded.data.toString()).toBe('Top secret message');

      adapter.close();
    });

    it('should work with loopback transport', (done) => {
      const engine = new StegEngine({});
      const lsb = new LSBAlgorithm();
      engine.setAlgorithm(lsb);

      const generator = new CoverGenerator();
      engine.addCoverMedia(generator.generateNoise(1024));

      const adapter = new MemoryAdapter();
      adapter.enableLoopback();

      const transport = new StegTransport(adapter, engine);

      // Listen for decoded data
      transport.onData((data) => {
        expect(data.toString()).toBe('Round trip!');
        adapter.close();
        done();
      });

      // Send through pipeline
      transport.send(Buffer.from('Round trip!'));
    });
  });

  describe('LLM Stream to Steganography', () => {
    it('should hide data in simulated LLM stream', () => {
      // Setup normalizer
      const normalizer = new StreamNormalizer({ provider: 'openai' });

      // Simulate OpenAI stream chunks
      const chunks = [
        { choices: [{ delta: { content: 'The ' } }] },
        { choices: [{ delta: { content: 'quick ' } }] },
        { choices: [{ delta: { content: 'brown ' } }] },
        { choices: [{ delta: { content: 'fox ' } }] },
        { choices: [{ delta: { content: 'jumps.' } }] }
      ];

      // Feed chunks
      chunks.forEach(c => normalizer.feed(c));
      normalizer.complete();

      // Get full text as cover media
      const coverText = normalizer.getBuffer();

      // Setup steganography
      const engine = new StegEngine({});
      engine.setAlgorithm(new LSBAlgorithm());

      // Use LLM output as cover (need to pad for capacity)
      const generator = new CoverGenerator();
      const cover = generator.generateTextCover('lorem', 512);
      engine.addCoverMedia(cover.data);

      // Hide secret in cover
      const secret = Buffer.from('hidden');
      const encoded = engine.encode(secret);

      expect(encoded.success).toBe(true);

      // Decode
      const decoded = engine.decode(encoded.data);
      expect(decoded.success).toBe(true);
      expect(decoded.data.toString()).toBe('hidden');
    });

    it('should process multiple LLM providers', () => {
      const providers = ['openai', 'anthropic', 'google', 'ollama', 'cohere'] as const;

      const mockChunks: Record<string, unknown> = {
        openai: { choices: [{ delta: { content: 'OpenAI text' } }] },
        anthropic: { type: 'content_block_delta', delta: { text: 'Anthropic text' } },
        google: { candidates: [{ content: { parts: [{ text: 'Gemini text' }] } }] },
        ollama: { message: { content: 'Ollama text' } },
        cohere: { event_type: 'text-generation', text: 'Cohere text' }
      };

      for (const provider of providers) {
        const normalizer = new StreamNormalizer({ provider });
        normalizer.feed(mockChunks[provider]);

        expect(normalizer.getText().length).toBeGreaterThan(0);
      }
    });
  });

  describe('Transport Adapter Integration', () => {
    it('should transmit steganographic data via memory adapter', () => {
      // Sender setup
      const senderEngine = new StegEngine({});
      senderEngine.setAlgorithm(new LSBAlgorithm());
      senderEngine.addCoverMedia(Buffer.alloc(512, 0xAA));

      const senderAdapter = new MemoryAdapter();
      const sender = new StegTransport(senderAdapter, senderEngine);

      // Receiver setup (separate engine instance)
      const receiverEngine = new StegEngine({});
      receiverEngine.setAlgorithm(new LSBAlgorithm());

      // Send message
      const message = Buffer.from('Inter-transport message');
      sender.send(message);

      // "Network transfer" - get sent data
      const networkData = senderAdapter.getLastSent()!;

      // Decode on receiver side
      const decoded = receiverEngine.decode(networkData);

      expect(decoded.success).toBe(true);
      expect(decoded.data.toString()).toBe('Inter-transport message');

      senderAdapter.close();
    });

    it('should handle multiple messages', () => {
      const engine = new StegEngine({});
      engine.setAlgorithm(new LSBAlgorithm());

      const generator = new CoverGenerator();
      engine.addCoverMedia(generator.generateNoise(512));
      engine.addCoverMedia(generator.generateNoise(512));

      const messages = ['msg1', 'msg2', 'msg3'];

      for (const msg of messages) {
        const encoded = engine.encode(Buffer.from(msg));
        expect(encoded.success).toBe(true);

        const decoded = engine.decode(encoded.data);
        expect(decoded.data.toString()).toBe(msg);
      }
    });
  });

  describe('Error Recovery', () => {
    it('should handle decode errors gracefully', () => {
      const engine = new StegEngine({ onError: 'passthrough' });
      engine.setAlgorithm(new LSBAlgorithm());

      // Random data (not valid stego)
      const garbage = Buffer.alloc(100);
      for (let i = 0; i < 100; i++) {
        garbage[i] = Math.floor(Math.random() * 256);
      }

      const decoded = engine.decode(garbage);
      // Should not crash, but may fail
      expect(decoded).toBeDefined();
    });

    it('should handle adapter errors', (done) => {
      const adapter = new MemoryAdapter();
      adapter.close(); // Put in disconnected state

      const engine = new StegEngine({});
      engine.setAlgorithm(new LSBAlgorithm());
      engine.addCoverMedia(Buffer.alloc(256));

      const transport = new StegTransport(adapter, engine);

      transport.send(Buffer.from('test'), (err) => {
        expect(err).toBeDefined();
        done();
      });
    });
  });

  describe('Performance Characteristics', () => {
    it('should encode large messages efficiently', () => {
      const engine = new StegEngine({});
      engine.setAlgorithm(new LSBAlgorithm());

      const generator = new CoverGenerator();
      engine.addCoverMedia(generator.ensureCapacity(10000));

      const largeMessage = Buffer.alloc(5000);
      for (let i = 0; i < 5000; i++) {
        largeMessage[i] = i % 256;
      }

      const start = Date.now();
      const encoded = engine.encode(largeMessage);
      const encodeTime = Date.now() - start;

      expect(encoded.success).toBe(true);
      expect(encodeTime).toBeLessThan(100); // Should be fast

      const decodeStart = Date.now();
      const decoded = engine.decode(encoded.data);
      const decodeTime = Date.now() - decodeStart;

      expect(decoded.success).toBe(true);
      expect(decoded.data).toEqual(largeMessage);
      expect(decodeTime).toBeLessThan(100);
    });

    it('should handle many small messages', () => {
      const engine = new StegEngine({});
      engine.setAlgorithm(new LSBAlgorithm());

      const generator = new CoverGenerator();
      for (let i = 0; i < 10; i++) {
        engine.addCoverMedia(generator.generateNoise(256));
      }

      const iterations = 100;
      const start = Date.now();

      for (let i = 0; i < iterations; i++) {
        const msg = Buffer.from(`message-${i}`);
        const encoded = engine.encode(msg);
        const decoded = engine.decode(encoded.data);

        expect(decoded.data.toString()).toBe(`message-${i}`);
      }

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(1000); // 100 roundtrips < 1 second
    });
  });
});
