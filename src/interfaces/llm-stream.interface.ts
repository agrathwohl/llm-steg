import { EventEmitter } from 'events';

/**
 * Supported LLM providers for stream normalization
 */
export type LLMProvider =
  | 'openai'
  | 'anthropic'
  | 'mistral'
  | 'cohere'
  | 'gemini'
  | 'google'
  | 'ollama'
  | 'vercel-ai'
  | 'custom';

/**
 * Types of metadata that can be extracted from LLM streams
 */
export type LLMMetadataType =
  | 'tool_call'
  | 'tool_result'
  | 'function_call'
  | 'reasoning'
  | 'thinking'
  | 'custom';

/**
 * Metadata extracted from LLM stream chunks
 */
export interface LLMMetadata {
  /** Type of metadata */
  type: LLMMetadataType;
  /** LLM provider that generated this metadata */
  provider: LLMProvider;
  /** The metadata content (structure varies by type) */
  content: unknown;
  /** Optional identifier for the metadata */
  id?: string;
  /** Timestamp when metadata was extracted */
  timestamp?: number;
}

/**
 * Normalized LLM stream interface.
 *
 * Provides a consistent event-based API for consuming text and metadata
 * from any LLM provider's streaming response.
 *
 * @example
 * ```typescript
 * const stream = LLMStreamNormalizer.wrap(anthropicStream, 'anthropic');
 *
 * stream.on('text', (text) => {
 *   console.log('Received:', text);
 * });
 *
 * stream.on('metadata', (meta) => {
 *   if (meta.type === 'tool_call') {
 *     console.log('Tool called:', meta.content);
 *   }
 * });
 *
 * stream.on('end', () => {
 *   console.log('Stream complete');
 * });
 * ```
 */
export interface LLMStream extends EventEmitter {
  /** Emitted when text content is received */
  on(event: 'text', listener: (text: string) => void): this;
  /** Emitted when metadata is extracted (tool calls, reasoning, etc.) */
  on(event: 'metadata', listener: (metadata: LLMMetadata) => void): this;
  /** Emitted when the stream ends normally */
  on(event: 'end', listener: () => void): this;
  /** Emitted when an error occurs */
  on(event: 'error', listener: (error: Error) => void): this;
  /** Emitted for raw chunks (before normalization) */
  on(event: 'raw', listener: (chunk: unknown) => void): this;

  /** Get the provider type for this stream */
  getProvider(): LLMProvider;

  /** Get accumulated text so far */
  getText(): string;

  /** Get all metadata collected so far */
  getMetadata(): LLMMetadata[];

  /** Check if stream has ended */
  isEnded(): boolean;

  /** Manually end the stream */
  end(): void;
}

/**
 * Result of extracting content from an LLM chunk
 */
export interface ExtractedContent {
  /** Extracted text content (empty string if none) */
  text: string;
  /** Extracted metadata (null if none) */
  metadata: LLMMetadata | null;
}

/**
 * Interface for provider-specific stream normalizers
 */
export interface LLMStreamNormalizerAdapter {
  /** Provider this adapter handles */
  provider: LLMProvider;

  /**
   * Extract text content from a provider-specific chunk
   */
  extractText(chunk: unknown): string;

  /**
   * Extract metadata from a provider-specific chunk
   */
  extractMetadata(chunk: unknown): LLMMetadata | null;

  /**
   * Check if a chunk indicates end of stream
   */
  isEndOfStream(chunk: unknown): boolean;
}

/**
 * Options for the LLM stream normalizer
 */
export interface LLMStreamNormalizerOptions {
  /** LLM provider type */
  provider: LLMProvider;
  /** Emit raw chunks in addition to normalized events */
  emitRaw?: boolean;
  /** Buffer text and emit in batches (ms interval) */
  batchInterval?: number;
  /** Custom text extractor function */
  textExtractor?: (chunk: unknown) => string;
  /** Custom metadata extractor function */
  metadataExtractor?: (chunk: unknown) => LLMMetadata | null;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Configuration for text extraction from various LLM formats
 */
export interface TextExtractionPaths {
  /** JSONPath-like paths to try for text extraction */
  textPaths: string[];
  /** JSONPath-like paths for metadata extraction */
  metadataPaths: string[];
  /** Field indicating end of stream */
  endIndicator?: string;
}

/**
 * Normalized chunk from LLM stream
 */
export interface NormalizedChunk {
  /** Extracted text content */
  text: string;
  /** Type of content */
  type: 'text' | 'thinking' | 'tool_use' | 'metadata';
  /** Timestamp when chunk was processed */
  timestamp: number;
  /** Raw chunk data (if includeMetadata is true) */
  raw?: unknown;
}

/**
 * Raw LLM chunk (alias for unknown provider chunk)
 */
export type LLMChunk = unknown;

/**
 * Provider-specific extraction configurations
 */
export const PROVIDER_EXTRACTION_CONFIG: Record<LLMProvider, TextExtractionPaths> = {
  openai: {
    textPaths: [
      'choices[0].delta.content',
      'choices[0].text',
      'choices[0].message.content'
    ],
    metadataPaths: [
      'choices[0].delta.tool_calls',
      'choices[0].delta.function_call',
      'choices[0].delta.reasoning'
    ]
  },
  anthropic: {
    textPaths: [
      'delta.text',
      'content[0].text',
      'completion'
    ],
    metadataPaths: [
      'delta.tool_use',
      'content_block.tool_use'
    ]
  },
  mistral: {
    textPaths: [
      'delta.content',
      'choices[0].delta.content'
    ],
    metadataPaths: [
      'delta.tool_calls'
    ]
  },
  cohere: {
    textPaths: [
      'text',
      'response.text'
    ],
    metadataPaths: [
      'tool_calls'
    ]
  },
  gemini: {
    textPaths: [
      'candidates[0].content.parts[0].text'
    ],
    metadataPaths: [
      'candidates[0].content.parts[0].functionCall'
    ]
  },
  google: {
    textPaths: [
      'candidates[0].content.parts[0].text'
    ],
    metadataPaths: [
      'candidates[0].content.parts[0].functionCall'
    ]
  },
  ollama: {
    textPaths: [
      'response',
      'message.content'
    ],
    metadataPaths: []
  },
  'vercel-ai': {
    textPaths: [
      'choices[0].delta.content',
      'text'
    ],
    metadataPaths: [
      'choices[0].delta.tool_calls'
    ]
  },
  custom: {
    textPaths: [],
    metadataPaths: []
  }
};
