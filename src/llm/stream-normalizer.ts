import { EventEmitter } from 'events';
import {
  LLMStream,
  LLMMetadata,
  LLMProvider,
  NormalizedChunk,
  PROVIDER_EXTRACTION_CONFIG
} from '../interfaces/llm-stream.interface';

/**
 * Options for stream normalizer
 */
export interface StreamNormalizerOptions {
  /** Provider to use (auto-detected if not specified) */
  provider?: LLMProvider;
  /** Include metadata in normalized output */
  includeMetadata?: boolean;
  /** Buffer partial chunks before emitting */
  bufferPartials?: boolean;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Universal LLM stream normalizer.
 *
 * Converts provider-specific streaming formats into a unified stream
 * of text chunks suitable for steganographic encoding.
 *
 * Supports: OpenAI, Anthropic, Mistral, Cohere, Google, Ollama
 *
 * @example
 * ```typescript
 * const normalizer = new StreamNormalizer({ provider: 'openai' });
 *
 * normalizer.on('chunk', (chunk: NormalizedChunk) => {
 *   console.log('Text:', chunk.text);
 *   console.log('Type:', chunk.type);
 * });
 *
 * normalizer.on('complete', (full: string) => {
 *   console.log('Full text:', full);
 * });
 *
 * // Feed provider-specific chunks
 * normalizer.feed(openaiStreamChunk);
 * ```
 */
export class StreamNormalizer extends EventEmitter implements LLMStream {
  private options: StreamNormalizerOptions;
  private provider: LLMProvider;
  private buffer: string = '';
  private chunks: NormalizedChunk[] = [];
  private collectedMetadata: LLMMetadata[] = [];
  private streamEnded: boolean = false;

  constructor(options: StreamNormalizerOptions = {}) {
    super();
    this.options = options;
    this.provider = options.provider ?? 'openai';
  }

  // ─────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────

  /**
   * Feed a raw provider chunk into the normalizer
   */
  public feed(chunk: unknown): void {
    try {
      const normalized = this.normalize(chunk);

      if (normalized) {
        this.chunks.push(normalized);
        this.buffer += normalized.text;
        this.emit('chunk', normalized);
        this.log('Chunk', { type: normalized.type, length: normalized.text.length });
      }
    } catch (err) {
      this.emit('error', err);
    }
  }

  /**
   * Feed a raw SSE line (data: {...})
   */
  public feedSSE(line: string): void {
    if (!line.startsWith('data: ')) return;
    if (line === 'data: [DONE]') {
      this.complete();
      return;
    }

    try {
      const json = JSON.parse(line.slice(6));
      this.feed(json);
    } catch {
      // Ignore malformed lines
    }
  }

  /**
   * Mark stream as complete
   */
  public complete(): void {
    if (this.streamEnded) return;

    this.streamEnded = true;
    this.emit('complete', this.buffer);
    this.log('Complete', { totalLength: this.buffer.length, chunks: this.chunks.length });
  }

  /**
   * Get accumulated text
   */
  public getText(): string {
    return this.buffer;
  }

  /**
   * Get all normalized chunks
   */
  public getChunks(): NormalizedChunk[] {
    return [...this.chunks];
  }

  /**
   * Get text as Buffer for steganography
   */
  public getBuffer(): Buffer {
    return Buffer.from(this.buffer, 'utf-8');
  }

  /**
   * Get all metadata collected so far
   */
  public getMetadata(): LLMMetadata[] {
    return [...this.collectedMetadata];
  }

  /**
   * Get the provider type for this stream
   */
  public getProvider(): LLMProvider {
    return this.provider;
  }

  /**
   * Check if stream has ended
   */
  public isEnded(): boolean {
    return this.streamEnded;
  }

  /**
   * Manually end the stream
   */
  public end(): void {
    this.complete();
  }

  /**
   * Set provider for auto-detection override
   */
  public setProvider(provider: LLMProvider): void {
    this.provider = provider;
  }

  /**
   * Auto-detect provider from chunk structure
   */
  public detectProvider(chunk: unknown): LLMProvider {
    if (!chunk || typeof chunk !== 'object') return 'openai';

    const obj = chunk as Record<string, unknown>;

    // Anthropic: has 'type' field with 'content_block_delta'
    if (obj.type === 'content_block_delta' || obj.type === 'message_start') {
      return 'anthropic';
    }

    // Cohere: has 'event_type' field
    if ('event_type' in obj) {
      return 'cohere';
    }

    // Google: has 'candidates' array
    if ('candidates' in obj && Array.isArray(obj.candidates)) {
      return 'google';
    }

    // Ollama: has 'message' with 'content' directly
    if (obj.message && typeof obj.message === 'object') {
      const msg = obj.message as Record<string, unknown>;
      if ('content' in msg && !('choices' in obj)) {
        return 'ollama';
      }
    }

    // Mistral: has 'choices' but different structure markers
    if ('choices' in obj && 'model' in obj) {
      const model = obj.model as string;
      if (model?.includes('mistral') || model?.includes('mixtral')) {
        return 'mistral';
      }
    }

    // Default to OpenAI format
    return 'openai';
  }

  /**
   * Reset normalizer state
   */
  public reset(): void {
    this.buffer = '';
    this.chunks = [];
    this.collectedMetadata = [];
    this.streamEnded = false;
  }

  // ─────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────

  private normalize(chunk: unknown): NormalizedChunk | null {
    if (!chunk || typeof chunk !== 'object') return null;

    const config = PROVIDER_EXTRACTION_CONFIG[this.provider];
    const obj = chunk as Record<string, unknown>;

    // Extract text using provider-specific paths (try each path until one works)
    let text: string | null = null;
    for (const path of config.textPaths) {
      text = this.extractByPath(obj, path);
      if (text) break;
    }
    if (!text) return null;

    // Extract metadata if available
    for (const metaPath of config.metadataPaths) {
      const meta = this.extractByPath(obj, metaPath);
      if (meta && typeof meta === 'object') {
        this.collectedMetadata.push({
          type: 'custom',
          provider: this.provider,
          content: meta,
          timestamp: Date.now()
        });
      }
    }

    // Determine chunk type
    const type = this.determineChunkType(obj, text);

    return {
      text,
      type,
      timestamp: Date.now(),
      raw: this.options.includeMetadata ? obj : undefined
    };
  }

  private extractByPath(obj: unknown, path: string): string | null {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return null;

      // Handle array access like [0]
      const arrayMatch = part.match(/^(\w+)?\[(\d+)\]$/);
      if (arrayMatch) {
        const prop = arrayMatch[1];
        const index = parseInt(arrayMatch[2], 10);

        if (prop) {
          current = (current as Record<string, unknown>)[prop];
        }

        if (!Array.isArray(current)) return null;
        current = current[index];
      } else {
        current = (current as Record<string, unknown>)[part];
      }
    }

    return typeof current === 'string' ? current : null;
  }

  private determineChunkType(
    obj: Record<string, unknown>,
    text: string
  ): 'text' | 'thinking' | 'tool_use' | 'metadata' {
    // Anthropic thinking blocks
    if (this.provider === 'anthropic') {
      if (obj.type === 'content_block_start') {
        const block = obj.content_block as Record<string, unknown> | undefined;
        if (block?.type === 'thinking') return 'thinking';
        if (block?.type === 'tool_use') return 'tool_use';
      }
    }

    // OpenAI tool calls
    if (this.provider === 'openai') {
      const choices = obj.choices as Array<Record<string, unknown>> | undefined;
      const delta = choices?.[0]?.delta as Record<string, unknown> | undefined;
      if (delta?.tool_calls) return 'tool_use';
    }

    // Heuristic: text starting with common thinking markers
    if (text.startsWith('<thinking>') || text.startsWith('[Thinking]')) {
      return 'thinking';
    }

    return 'text';
  }

  private log(message: string, data?: unknown): void {
    if (this.options.debug) {
      console.log(`[normalizer:${this.provider}] ${message}`, data ?? '');
    }
  }
}

/**
 * Create a stream normalizer
 */
export function createStreamNormalizer(
  options?: StreamNormalizerOptions
): StreamNormalizer {
  return new StreamNormalizer(options);
}

/**
 * Normalize a complete response (non-streaming)
 */
export function normalizeResponse(
  response: unknown,
  provider: LLMProvider = 'openai'
): NormalizedChunk | null {
  const normalizer = new StreamNormalizer({ provider });
  normalizer.feed(response);
  normalizer.complete();

  const chunks = normalizer.getChunks();
  return chunks.length > 0 ? chunks[0] : null;
}
