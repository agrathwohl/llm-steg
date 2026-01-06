/**
 * llm-steg - Transport-Agnostic Steganography for LLM Streams
 *
 * Hide data within AI-generated text streams with first-class support
 * for OpenAI, Anthropic, Mistral, Cohere, Google, and Ollama.
 *
 * @packageDocumentation
 * @module llm-steg
 *
 * @example
 * ```typescript
 * import {
 *   StegEngine,
 *   StegTransport,
 *   StreamNormalizer,
 *   LSBAlgorithm,
 *   UdpAdapter,
 *   MemoryAdapter
 * } from 'llm-steg';
 *
 * // Create steganography engine
 * const engine = new StegEngine({ debug: true });
 * engine.setAlgorithm(new LSBAlgorithm());
 *
 * // Create transport adapter
 * const adapter = new UdpAdapter('192.168.1.100', 5004);
 *
 * // Wrap with steganography
 * const transport = new StegTransport(adapter, engine);
 *
 * // Normalize LLM stream
 * const normalizer = new StreamNormalizer({ provider: 'openai' });
 *
 * normalizer.on('chunk', (chunk) => {
 *   // Use chunk text as cover media and embed secret
 *   engine.addCoverMedia(Buffer.from(chunk.text));
 *   transport.send(Buffer.from('secret message'));
 * });
 * ```
 */

// ─────────────────────────────────────────────────────────────
// Core
// ─────────────────────────────────────────────────────────────

export {
  StegEngine,
  StegEngineOptions,
  createStegEngine
} from './core/steg-engine';

export {
  StegTransport,
  createStegTransport
} from './core/steg-transport';

// ─────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────

export {
  // Transport
  TransportStream,
  TransportMetadata,
  TransportOptions,
  TransportProtocol,
  ConnectionState,
  SendCallback,
  DataHandler,

  // Steganography Config
  StegConfig,
  StegAlgorithmMode,
  CoverMedia,
  StegEncodeResult,
  StegDecodeResult,

  // LLM Stream
  LLMStream,
  LLMMetadata,
  LLMProvider,
  LLMChunk,
  NormalizedChunk,
  PROVIDER_EXTRACTION_CONFIG,

  // Algorithm
  StegAlgorithm,
  AlgorithmFactory,
  AlgorithmMetrics
} from './interfaces';

// ─────────────────────────────────────────────────────────────
// Algorithms
// ─────────────────────────────────────────────────────────────

export {
  LSBAlgorithm,
  createLSBAlgorithm
} from './algorithms';

// ─────────────────────────────────────────────────────────────
// Transport Adapters
// ─────────────────────────────────────────────────────────────

export {
  BaseAdapter,
  UdpAdapter,
  UdpAdapterOptions,
  createUdpAdapter,
  MemoryAdapter,
  createMemoryAdapter
} from './adapters';

// ─────────────────────────────────────────────────────────────
// LLM Stream Normalization
// ─────────────────────────────────────────────────────────────

export {
  StreamNormalizer,
  StreamNormalizerOptions,
  createStreamNormalizer,
  normalizeResponse
} from './llm';

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────

export {
  // Cover Generation
  CoverGenerator,
  CoverGeneratorOptions,
  createCoverGenerator,
  generateCoverForPayload,

  // Bit Manipulation
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
  interleaveBits,
  parity,
  checksum,
  crc8
} from './utils';
