import {
  StreamNormalizer,
  createStreamNormalizer,
  normalizeResponse
} from '../src/llm/stream-normalizer';

describe('StreamNormalizer', () => {
  let normalizer: StreamNormalizer;

  beforeEach(() => {
    normalizer = new StreamNormalizer();
  });

  describe('initialization', () => {
    it('should create with default options', () => {
      expect(normalizer).toBeInstanceOf(StreamNormalizer);
    });

    it('should create via factory', () => {
      const n = createStreamNormalizer({ provider: 'anthropic' });
      expect(n).toBeInstanceOf(StreamNormalizer);
    });
  });

  describe('OpenAI format', () => {
    beforeEach(() => {
      normalizer.setProvider('openai');
    });

    it('should extract text from OpenAI chunk', () => {
      const chunk = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        choices: [{
          index: 0,
          delta: {
            content: 'Hello'
          }
        }]
      };

      normalizer.feed(chunk);
      expect(normalizer.getText()).toBe('Hello');
    });

    it('should accumulate multiple chunks', () => {
      const chunks = [
        { choices: [{ delta: { content: 'Hello' } }] },
        { choices: [{ delta: { content: ' ' } }] },
        { choices: [{ delta: { content: 'World' } }] }
      ];

      chunks.forEach(c => normalizer.feed(c));
      expect(normalizer.getText()).toBe('Hello World');
    });

    it('should emit chunk events', (done) => {
      normalizer.on('chunk', (chunk) => {
        expect(chunk.text).toBe('test');
        expect(chunk.type).toBe('text');
        done();
      });

      normalizer.feed({
        choices: [{ delta: { content: 'test' } }]
      });
    });
  });

  describe('Anthropic format', () => {
    beforeEach(() => {
      normalizer.setProvider('anthropic');
    });

    it('should extract text from Anthropic delta', () => {
      const chunk = {
        type: 'content_block_delta',
        index: 0,
        delta: {
          type: 'text_delta',
          text: 'Hello from Claude'
        }
      };

      normalizer.feed(chunk);
      expect(normalizer.getText()).toBe('Hello from Claude');
    });
  });

  describe('Google/Gemini format', () => {
    beforeEach(() => {
      normalizer.setProvider('google');
    });

    it('should extract text from Gemini candidates', () => {
      const chunk = {
        candidates: [{
          content: {
            parts: [{
              text: 'Gemini response'
            }]
          }
        }]
      };

      normalizer.feed(chunk);
      expect(normalizer.getText()).toBe('Gemini response');
    });
  });

  describe('Ollama format', () => {
    beforeEach(() => {
      normalizer.setProvider('ollama');
    });

    it('should extract text from Ollama message', () => {
      const chunk = {
        model: 'llama2',
        message: {
          role: 'assistant',
          content: 'Local model response'
        }
      };

      normalizer.feed(chunk);
      expect(normalizer.getText()).toBe('Local model response');
    });
  });

  describe('Cohere format', () => {
    beforeEach(() => {
      normalizer.setProvider('cohere');
    });

    it('should extract text from Cohere event', () => {
      const chunk = {
        event_type: 'text-generation',
        text: 'Cohere output'
      };

      normalizer.feed(chunk);
      expect(normalizer.getText()).toBe('Cohere output');
    });
  });

  describe('provider auto-detection', () => {
    it('should detect Anthropic format', () => {
      const anthropicChunk = {
        type: 'content_block_delta',
        delta: { text: 'test' }
      };

      expect(normalizer.detectProvider(anthropicChunk)).toBe('anthropic');
    });

    it('should detect Google format', () => {
      const googleChunk = {
        candidates: [{ content: { parts: [] } }]
      };

      expect(normalizer.detectProvider(googleChunk)).toBe('google');
    });

    it('should detect Cohere format', () => {
      const cohereChunk = {
        event_type: 'text-generation'
      };

      expect(normalizer.detectProvider(cohereChunk)).toBe('cohere');
    });

    it('should default to OpenAI', () => {
      const unknownChunk = { data: 'something' };
      expect(normalizer.detectProvider(unknownChunk)).toBe('openai');
    });
  });

  describe('SSE parsing', () => {
    it('should parse SSE data lines', () => {
      normalizer.setProvider('openai');

      normalizer.feedSSE('data: {"choices":[{"delta":{"content":"SSE test"}}]}');

      expect(normalizer.getText()).toBe('SSE test');
    });

    it('should handle [DONE] marker', (done) => {
      normalizer.on('complete', () => {
        done();
      });

      normalizer.feedSSE('data: [DONE]');
    });

    it('should ignore non-data lines', () => {
      normalizer.feedSSE('event: message');
      normalizer.feedSSE(': comment');
      normalizer.feedSSE('');

      expect(normalizer.getText()).toBe('');
    });
  });

  describe('completion', () => {
    it('should emit complete event with full text', (done) => {
      normalizer.setProvider('openai');

      normalizer.on('complete', (text) => {
        expect(text).toBe('Full message');
        done();
      });

      normalizer.feed({ choices: [{ delta: { content: 'Full message' } }] });
      normalizer.complete();
    });

    it('should only complete once', () => {
      let completeCount = 0;
      normalizer.on('complete', () => completeCount++);

      normalizer.complete();
      normalizer.complete();
      normalizer.complete();

      expect(completeCount).toBe(1);
    });
  });

  describe('buffer operations', () => {
    it('should get text as Buffer', () => {
      normalizer.setProvider('openai');
      normalizer.feed({ choices: [{ delta: { content: 'buffer' } }] });

      const buf = normalizer.getBuffer();
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.toString()).toBe('buffer');
    });

    it('should get all chunks', () => {
      normalizer.setProvider('openai');
      normalizer.feed({ choices: [{ delta: { content: 'a' } }] });
      normalizer.feed({ choices: [{ delta: { content: 'b' } }] });

      const chunks = normalizer.getChunks();
      expect(chunks.length).toBe(2);
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      normalizer.setProvider('openai');
      normalizer.feed({ choices: [{ delta: { content: 'test' } }] });

      normalizer.reset();

      expect(normalizer.getText()).toBe('');
      expect(normalizer.getChunks().length).toBe(0);
    });
  });

  describe('metadata', () => {
    it('should return metadata', () => {
      normalizer.setProvider('anthropic');
      const meta = normalizer.getMetadata();

      expect(meta.provider).toBe('anthropic');
      expect(meta.timestamp).toBeDefined();
    });
  });

  describe('normalizeResponse helper', () => {
    it('should normalize non-streaming response', () => {
      const response = {
        choices: [{ delta: { content: 'Complete response' } }]
      };

      const chunk = normalizeResponse(response, 'openai');
      expect(chunk?.text).toBe('Complete response');
    });

    it('should return null for invalid response', () => {
      const chunk = normalizeResponse({}, 'openai');
      expect(chunk).toBeNull();
    });
  });
});
