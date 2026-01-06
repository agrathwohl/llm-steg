# llm-steg

> Transport-agnostic steganography for LLM streams. Hide data in plain sight within AI-generated text.

[![npm version](https://img.shields.io/npm/v/llm-steg.svg)](https://www.npmjs.com/package/llm-steg)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **🎭 Multi-Provider LLM Support** - OpenAI, Anthropic, Mistral, Cohere, Google, Ollama
- **📡 Transport Agnostic** - Works with UDP, WebSocket, WebRTC, RTP, or any custom transport
- **🔧 Pluggable Algorithms** - LSB steganography included, extensible for custom algorithms
- **⚡ High Performance** - Minimal overhead, suitable for real-time streaming
- **🧪 Fully Tested** - Comprehensive test suite with integration tests

## Installation

```bash
npm install llm-steg
```

## Quick Start

```typescript
import {
  StegEngine,
  StegTransport,
  StreamNormalizer,
  LSBAlgorithm,
  MemoryAdapter,
  CoverGenerator
} from 'llm-steg';

// 1. Create steganography engine
const engine = new StegEngine({});
engine.setAlgorithm(new LSBAlgorithm());

// 2. Generate cover media
const generator = new CoverGenerator();
engine.addCoverMedia(generator.generateNoise(1024));

// 3. Encode a secret message
const secret = Buffer.from('TOP SECRET: The eagle has landed');
const encoded = engine.encode(secret);

console.log('Hidden in', encoded.data.length, 'bytes');

// 4. Decode the secret
const decoded = engine.decode(encoded.data);
console.log('Extracted:', decoded.data.toString());
```

## LLM Stream Integration

Normalize streaming responses from any LLM provider:

```typescript
import { StreamNormalizer } from 'llm-steg';

// Works with OpenAI, Anthropic, Google, Mistral, Cohere, Ollama
const normalizer = new StreamNormalizer({ provider: 'openai' });

normalizer.on('chunk', (chunk) => {
  console.log('Text:', chunk.text);
  console.log('Type:', chunk.type); // 'text' | 'thinking' | 'tool_use'
});

normalizer.on('complete', (fullText) => {
  console.log('Full response:', fullText);
});

// Feed provider-specific streaming chunks
for await (const chunk of openaiStream) {
  normalizer.feed(chunk);
}
normalizer.complete();
```

## Transport Adapters

Use any transport with steganography:

```typescript
import { StegTransport, UdpAdapter } from 'llm-steg';

// UDP transport
const udp = new UdpAdapter({
  remoteAddress: '192.168.1.100',
  remotePort: 5004
});

const transport = new StegTransport(udp, engine);

// Data is automatically encoded before sending
transport.send(Buffer.from('hidden message'));

// Incoming data is automatically decoded
transport.onData((data) => {
  console.log('Received:', data.toString());
});
```

## Cover Media Generation

Generate various types of cover media:

```typescript
import { CoverGenerator } from 'llm-steg';

const generator = new CoverGenerator();

// Random noise (best capacity)
const noise = generator.generateNoise(1024);

// Text-based covers
const lorem = generator.generateTextCover('lorem', 500);
const random = generator.generateTextCover('random', 500);

// Pattern-based
const pattern = generator.generatePattern([0xAA, 0x55], 512);

// Audio-like samples
const audio = generator.generateAudioLike(1000); // 1000 16-bit samples

// Auto-size for payload
const cover = generator.ensureCapacity(100); // Fits 100-byte payload
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Application                             │
├─────────────────────────────────────────────────────────────┤
│  StreamNormalizer   │  StegEngine   │   CoverGenerator       │
│  (LLM → Text)       │  (Encode/     │   (Cover Media)        │
│                     │   Decode)      │                        │
├─────────────────────────────────────────────────────────────┤
│                     StegTransport                            │
│                   (Compose Transport + Steg)                 │
├─────────────────────────────────────────────────────────────┤
│  UdpAdapter │ MemoryAdapter │ [WebSocketAdapter] │ [Custom]  │
└─────────────────────────────────────────────────────────────┘
```

## API Reference

### StegEngine

Core steganography operations.

```typescript
const engine = new StegEngine({
  enabled: true,           // Enable/disable encoding
  algorithm: 'lsb',        // Algorithm name
  debug: false,            // Debug logging
  onError: 'passthrough'   // 'passthrough' | 'throw' | 'drop'
});

engine.setAlgorithm(new LSBAlgorithm());
engine.addCoverMedia(buffer);

const encoded = engine.encode(payload);
const decoded = engine.decode(stegData);
```

### StreamNormalizer

Normalize LLM streaming responses.

```typescript
const normalizer = new StreamNormalizer({
  provider: 'openai',     // Provider format
  includeMetadata: false, // Include raw data in chunks
  debug: false
});

normalizer.feed(chunk);           // Feed provider-specific chunk
normalizer.feedSSE(line);         // Feed SSE data line
normalizer.complete();            // Mark stream complete

normalizer.getText();             // Get accumulated text
normalizer.getBuffer();           // Get as Buffer
normalizer.getChunks();           // Get all chunks
normalizer.detectProvider(chunk); // Auto-detect provider
```

### LSBAlgorithm

Least Significant Bit steganography.

```typescript
const lsb = new LSBAlgorithm();

const encoded = lsb.encode(payload, cover);
const decoded = lsb.decode(stegData);
const capacity = lsb.calculateCapacity(cover);
```

## Demo

Run the interactive terminal demo:

```bash
npm run demo
```

This showcases:
- Basic steganography encoding/decoding
- LSB bit visualization
- Multi-provider LLM stream normalization
- Real-time stream interception
- Capacity analysis

## Testing

```bash
npm test                 # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

## License

MIT © [agrathwohl](https://github.com/agrathwohl)
