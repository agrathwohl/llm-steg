// Transport interfaces
export {
  TransportStream,
  TransportMetadata,
  TransportOptions,
  TransportProtocol,
  ConnectionState,
  SendCallback,
  DataHandler
} from './transport-stream.interface';

// Steganography configuration
export {
  StegConfig,
  StegAlgorithmMode,
  StegEncodeResult,
  StegDecodeResult,
  CoverMedia,
  CoverMediaType,
  LLMProvider as StegLLMProvider
} from './steg-config.interface';

// LLM stream interfaces
export {
  LLMStream,
  LLMMetadata,
  LLMMetadataType,
  LLMProvider,
  LLMChunk,
  NormalizedChunk,
  LLMStreamNormalizerAdapter,
  LLMStreamNormalizerOptions,
  ExtractedContent,
  TextExtractionPaths,
  PROVIDER_EXTRACTION_CONFIG
} from './llm-stream.interface';

// Algorithm interfaces
export {
  StegAlgorithm,
  AlgorithmOptions,
  AlgorithmFactory,
  AlgorithmRegistryEntry,
  AlgorithmMetrics
} from './algorithm.interface';
