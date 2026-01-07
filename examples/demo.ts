#!/usr/bin/env npx ts-node
/**
 * @agrathwohl/llm-steg Terminal Demo
 *
 * A visually stunning demonstration of steganography hidden within
 * simulated LLM streaming responses.
 *
 * Run: npx ts-node examples/demo.ts
 */

import * as readline from "readline";
import { StegEngine } from "../src/core/steg-engine";
import { LSBAlgorithm } from "../src/algorithms/lsb";
import { StreamNormalizer } from "../src/llm/stream-normalizer";
import { CoverGenerator } from "../src/utils/cover-generator";
import { MemoryAdapter } from "../src/adapters/memory-adapter";
import { StegTransport } from "../src/core/steg-transport";

// ═══════════════════════════════════════════════════════════════
// ANSI Color Codes
// ═══════════════════════════════════════════════════════════════

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",

  // Foreground
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",

  // Bright
  brightBlack: "\x1b[90m",
  brightRed: "\x1b[91m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
  brightBlue: "\x1b[94m",
  brightMagenta: "\x1b[95m",
  brightCyan: "\x1b[96m",
  brightWhite: "\x1b[97m",

  // Background
  bgBlack: "\x1b[40m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
  bgWhite: "\x1b[47m",
};

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

function c(color: keyof typeof colors, text: string): string {
  return `${colors[color]}${text}${colors.reset}`;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatTime(ms: number): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(0)}μs`;
  }
  return `${ms.toFixed(2)}ms`;
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function typeTextColored(
  text: string,
  color: keyof typeof colors,
  delay: number = 25,
): Promise<void> {
  process.stdout.write(colors[color]);
  for (const char of text) {
    process.stdout.write(char);
    await sleep(delay);
  }
  process.stdout.write(colors.reset);
}


function printBanner(): void {
  console.log(
    c(
      "cyan",
      `
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║   ${c("brightCyan", "██╗     ██╗     ███╗   ███╗       ███████╗████████╗███████╗ ██████╗")}    ║
║   ${c("brightCyan", "██║     ██║     ████╗ ████║       ██╔════╝╚══██╔══╝██╔════╝██╔════╝")}    ║
║   ${c("brightCyan", "██║     ██║     ██╔████╔██║█████╗ ███████╗   ██║   █████╗  ██║  ███╗")}   ║
║   ${c("brightCyan", "██║     ██║     ██║╚██╔╝██║╚════╝ ╚════██║   ██║   ██╔══╝  ██║   ██║")}   ║
║   ${c("brightCyan", "███████╗███████╗██║ ╚═╝ ██║       ███████║   ██║   ███████╗╚██████╔╝")}   ║
║   ${c("brightCyan", "╚══════╝╚══════╝╚═╝     ╚═╝       ╚══════╝   ╚═╝   ╚══════╝ ╚═════╝")}    ║
║                                                                           ║
║   ${c("yellow", "Transport-Agnostic Steganography for LLM Streams")}                       ║
║   ${c("dim", "Hide secrets in plain sight within AI-generated text")}                    ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
`,
    ),
  );
}

function printDivider(title?: string): void {
  if (title) {
    const padding = Math.floor((70 - title.length) / 2);
    console.log(
      c("brightBlack", "─".repeat(padding)) +
        c("yellow", ` ${title} `) +
        c("brightBlack", "─".repeat(padding)),
    );
  } else {
    console.log(c("brightBlack", "─".repeat(75)));
  }
}

function printBox(lines: string[], color: keyof typeof colors = "cyan"): void {
  const maxLen = Math.max(
    ...lines.map((l) => l.replace(/\x1b\[[0-9;]*m/g, "").length),
  );
  const width = maxLen + 4;

  console.log(c(color, "┌" + "─".repeat(width - 2) + "┐"));
  for (const line of lines) {
    const plainLen = line.replace(/\x1b\[[0-9;]*m/g, "").length;
    const padding = maxLen - plainLen;
    console.log(c(color, "│ ") + line + " ".repeat(padding) + c(color, " │"));
  }
  console.log(c(color, "└" + "─".repeat(width - 2) + "┘"));
}

function visualizeBits(buffer: Buffer, maxBytes: number = 16): string {
  let result = "";
  const bytes = Math.min(buffer.length, maxBytes);

  for (let i = 0; i < bytes; i++) {
    const byte = buffer[i];
    const bits = byte.toString(2).padStart(8, "0");

    // Color the LSB differently
    const msb = c("brightBlack", bits.slice(0, 7));
    const lsb = c("brightGreen", bits.slice(7));

    result += `${msb}${lsb} `;

    if ((i + 1) % 4 === 0) result += " ";
  }

  if (buffer.length > maxBytes) {
    result += c("dim", `... +${buffer.length - maxBytes} more bytes`);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// Demo Scenarios
// ═══════════════════════════════════════════════════════════════

interface LLMChunk {
  type: "thinking" | "text" | "tool_use";
  content: string;
  delay?: number;
}

const codingDemo: LLMChunk[] = [
  {
    type: "thinking",
    content: "User wants a Python function for fibonacci. Let me think...",
    delay: 35,
  },
  {
    type: "thinking",
    content: "Should I use recursion, iteration, or memoization?",
    delay: 30,
  },
  {
    type: "thinking",
    content:
      "For educational purposes, I'll show the iterative approach - it's O(n) and easy to understand.",
    delay: 25,
  },
  {
    type: "text",
    content: "\n\nHere's an efficient fibonacci implementation:\n\n",
    delay: 20,
  },
  { type: "text", content: "```python\n", delay: 30 },
  { type: "text", content: "def fibonacci(n: int) -> int:\n", delay: 15 },
  {
    type: "text",
    content: '    """Calculate the nth Fibonacci number."""\n',
    delay: 12,
  },
  { type: "text", content: "    if n <= 1:\n", delay: 12 },
  { type: "text", content: "        return n\n", delay: 12 },
  { type: "text", content: "    \n", delay: 8 },
  { type: "text", content: "    prev, curr = 0, 1\n", delay: 12 },
  { type: "text", content: "    for _ in range(2, n + 1):\n", delay: 12 },
  {
    type: "text",
    content: "        prev, curr = curr, prev + curr\n",
    delay: 12,
  },
  { type: "text", content: "    \n", delay: 8 },
  { type: "text", content: "    return curr\n", delay: 12 },
  { type: "text", content: "```\n\n", delay: 30 },
  {
    type: "text",
    content:
      "This iterative approach runs in O(n) time with O(1) space complexity.",
    delay: 18,
  },
];

const secretMessages = [
  "COORDINATES: 40.7128°N 74.0060°W",
  "MEETING AT MIDNIGHT - BRING THE DOCUMENTS",
  "THE CIPHER KEY IS: PROMETHEUS-7742",
  "EXTRACTION POINT CHARLIE CONFIRMED",
  "OPERATION NIGHTFALL IS A GO",
];

// ═══════════════════════════════════════════════════════════════
// Main Demo Functions
// ═══════════════════════════════════════════════════════════════

async function demoBasicSteganography(): Promise<void> {
  printDivider("BASIC STEGANOGRAPHY DEMO");
  console.log();

  const engine = new StegEngine({ debug: false });
  const lsb = new LSBAlgorithm();
  engine.setAlgorithm(lsb);

  const generator = new CoverGenerator();
  engine.addCoverMedia(generator.generateNoise(1024));

  const secret = "TOP SECRET: Launch codes are 7742-ALPHA";

  console.log(c("yellow", "  Secret Message: ") + c("brightRed", secret));
  console.log();

  await sleep(500);

  process.stdout.write(c("yellow", "  Encoding"));
  for (let i = 0; i < 5; i++) {
    await sleep(200);
    process.stdout.write(c("yellow", "."));
  }
  console.log();

  const encoded = engine.encode(Buffer.from(secret));

  console.log();
  console.log(
    c("green", "  ✓ Message hidden in ") +
      c("brightWhite", `${encoded.data.length}`) +
      c("green", " bytes of cover data"),
  );
  console.log();

  console.log(c("cyan", "  LSB Visualization (first 32 bytes):"));
  console.log(c("dim", "  " + visualizeBits(encoded.data, 32)));
  console.log(
    c("dim", "  ") +
      c("brightBlack", "MSB bits") +
      "  " +
      c("brightGreen", "LSB (hidden data)"),
  );
  console.log();

  await sleep(500);

  process.stdout.write(c("yellow", "  Decoding"));
  for (let i = 0; i < 5; i++) {
    await sleep(200);
    process.stdout.write(c("yellow", "."));
  }
  console.log();

  const decoded = engine.decode(encoded.data);
  console.log();
  console.log(
    c("green", "  ✓ Extracted: ") + c("brightRed", decoded.data.toString()),
  );
  console.log();
}

async function demoInteractiveSteganography(): Promise<void> {
  printDivider("YOUR SECRET MESSAGE");
  console.log();

  const userSecret = await prompt(
    c("yellow", "  Enter your secret message: ") + c("brightWhite", ""),
  );

  if (!userSecret.trim()) {
    console.log(c("dim", "  (Skipped - no message entered)"));
    console.log();
    return;
  }

  console.log();

  const engine = new StegEngine({ debug: false });
  const lsb = new LSBAlgorithm();
  engine.setAlgorithm(lsb);

  const generator = new CoverGenerator();
  engine.addCoverMedia(generator.generateNoise(2048));

  console.log(c("yellow", "  Your Secret: ") + c("brightRed", userSecret));
  console.log();

  await sleep(300);

  process.stdout.write(c("yellow", "  Encoding"));
  for (let i = 0; i < 5; i++) {
    await sleep(150);
    process.stdout.write(c("yellow", "."));
  }
  console.log();

  const encoded = engine.encode(Buffer.from(userSecret));

  console.log();
  console.log(
    c("green", "  ✓ Message hidden in ") +
      c("brightWhite", `${encoded.data.length}`) +
      c("green", " bytes of cover data"),
  );
  console.log();

  console.log(c("cyan", "  LSB Visualization (first 32 bytes):"));
  console.log(c("dim", "  " + visualizeBits(encoded.data, 32)));
  console.log(
    c("dim", "  ") +
      c("brightBlack", "MSB bits") +
      "  " +
      c("brightGreen", "LSB (hidden data)"),
  );
  console.log();

  await sleep(300);

  process.stdout.write(c("yellow", "  Decoding"));
  for (let i = 0; i < 5; i++) {
    await sleep(150);
    process.stdout.write(c("yellow", "."));
  }
  console.log();

  const decoded = engine.decode(encoded.data);
  console.log();
  console.log(
    c("green", "  ✓ Extracted: ") + c("brightRed", decoded.data.toString()),
  );
  console.log();
}

async function demoLLMStreamSteganography(): Promise<void> {
  printDivider("LLM STREAM STEGANOGRAPHY");
  console.log();

  const secret =
    secretMessages[Math.floor(Math.random() * secretMessages.length)];

  console.log(
    c("yellow", "  Scenario: ") +
      c("white", "Hide a secret message within an AI assistant's response"),
  );
  console.log(c("yellow", "  Secret:   ") + c("brightRed", secret));
  console.log();

  await sleep(1000);

  // Setup steganography
  const engine = new StegEngine({});
  engine.setAlgorithm(new LSBAlgorithm());
  const generator = new CoverGenerator();

  // Setup transport
  const adapter = new MemoryAdapter();
  const transport = new StegTransport(adapter, engine);

  console.log(c("brightBlack", "  ─".repeat(35)));
  console.log(c("cyan", "  🤖 Assistant is responding...\n"));

  let fullResponse = "";
  const demo = codingDemo;

  for (const chunk of demo) {
    if (chunk.type === "thinking") {
      process.stdout.write(c("magenta", "  💭 "));
      await typeTextColored(chunk.content, "dim", chunk.delay);
      console.log();
    } else {
      await typeTextColored(chunk.content, "white", chunk.delay);
      fullResponse += chunk.content;
    }
  }

  console.log();
  console.log(c("brightBlack", "  ─".repeat(35)));
  console.log();

  await sleep(500);

  // Hide the secret in generated cover based on response length
  const coverSize = Math.max(fullResponse.length * 8, (secret.length + 4) * 8);
  engine.addCoverMedia(generator.generateTextCover("random", coverSize));

  console.log(c("yellow", "  📡 Embedding secret in transmission..."));
  await sleep(300);

  const startTime = performance.now();
  transport.send(Buffer.from(secret));
  const elapsed = performance.now() - startTime;

  const sentData = adapter.getLastSent()!;

  console.log();
  printBox(
    [
      c("green", "✓ Secret successfully embedded"),
      "",
      `Original secret:  ${c("brightRed", `${secret.length} bytes`)}`,
      `Carrier size:     ${c("cyan", `${sentData.length} bytes`)}`,
      `Encoding time:    ${c("yellow", formatTime(elapsed))}`,
      `Expansion:        ${c("magenta", `${(sentData.length / secret.length).toFixed(1)}x overhead`)}`,
    ],
    "green",
  );

  console.log();

  // Decode to verify
  const decoded = engine.decode(sentData);
  console.log(
    c("green", "  ✓ Verification: ") +
      c("brightWhite", decoded.data.toString()),
  );

  adapter.close();
  console.log();
}

async function demoRealTimeStream(): Promise<void> {
  printDivider("REAL-TIME STREAM INTERCEPTION");
  console.log();

  console.log(
    c("yellow", "  Simulating real-time LLM stream with hidden channel...\n"),
  );

  await sleep(500);

  const engine = new StegEngine({});
  engine.setAlgorithm(new LSBAlgorithm());
  const generator = new CoverGenerator();

  const adapter = new MemoryAdapter();
  adapter.enableLoopback();

  const transport = new StegTransport(adapter, engine);

  let messageCount = 0;
  transport.onData(() => {
    messageCount++;
  });

  const secrets = ["INIT", "SYNC", "ACK", "DATA:A7F2", "END"];

  console.log(
    c(
      "cyan",
      "  ┌────────────────────────────────────────────────────────────────┐",
    ),
  );
  console.log(
    c("cyan", "  │") +
      c("yellow", " Time      ") +
      c("cyan", "│") +
      c("yellow", " Visible Stream        ") +
      c("cyan", "│") +
      c("yellow", " Hidden Channel ") +
      c("cyan", "│"),
  );
  console.log(
    c(
      "cyan",
      "  ├────────────────────────────────────────────────────────────────┤",
    ),
  );

  const streamChunks = [
    "The fundamentals of",
    " machine learning involve",
    " training models on",
    " large datasets to",
    " recognize patterns.",
  ];

  for (let i = 0; i < streamChunks.length; i++) {
    const time = `${(i * 0.3).toFixed(1)}s`.padEnd(8);
    const visible = streamChunks[i].padEnd(22);
    const hidden = (secrets[i] || "-").padEnd(14);

    engine.addCoverMedia(generator.generateNoise(256));

    if (secrets[i]) {
      transport.send(Buffer.from(secrets[i]));
    }

    console.log(
      c("cyan", "  │ ") +
        c("brightBlack", time) +
        c("cyan", " │ ") +
        c("white", visible) +
        c("cyan", " │ ") +
        c("brightGreen", hidden) +
        c("cyan", " │"),
    );

    await sleep(300);
  }

  console.log(
    c(
      "cyan",
      "  └────────────────────────────────────────────────────────────────┘",
    ),
  );
  console.log();

  console.log(
    c("green", "  ✓ ") +
      c("white", `${messageCount} hidden messages transmitted successfully`),
  );

  adapter.close();
  console.log();
}

async function demoProviderComparison(): Promise<void> {
  printDivider("MULTI-PROVIDER SUPPORT");
  console.log();

  const providers = [
    {
      name: "OpenAI",
      provider: "openai" as const,
      chunk: { choices: [{ delta: { content: "GPT-4 response text here" } }] },
    },
    {
      name: "Anthropic",
      provider: "anthropic" as const,
      chunk: {
        type: "content_block_delta",
        delta: { text: "Claude response text" },
      },
    },
    {
      name: "Google",
      provider: "google" as const,
      chunk: {
        candidates: [{ content: { parts: [{ text: "Gemini Pro output" }] } }],
      },
    },
    {
      name: "Ollama",
      provider: "ollama" as const,
      chunk: { message: { content: "Local LLaMA text" } },
    },
    {
      name: "Cohere",
      provider: "cohere" as const,
      chunk: { event_type: "text-generation", text: "Command-R response" },
    },
  ];

  console.log(
    c("cyan", "  ┌──────────────┬──────────────────────────────┬──────────┐"),
  );
  console.log(
    c("cyan", "  │") +
      c("yellow", " Provider     ") +
      c("cyan", "│") +
      c("yellow", " Extracted Text               ") +
      c("cyan", "│") +
      c("yellow", " Status   ") +
      c("cyan", "│"),
  );
  console.log(
    c("cyan", "  ├──────────────┼──────────────────────────────┼──────────┤"),
  );

  for (const { name, provider, chunk } of providers) {
    const normalizer = new StreamNormalizer({ provider });
    normalizer.feed(chunk);

    const text = normalizer.getText().slice(0, 25).padEnd(28);
    const status = c("brightGreen", "✓ OK    ");

    console.log(
      c("cyan", "  │ ") +
        c("white", name.padEnd(12)) +
        c("cyan", " │ ") +
        c("dim", text) +
        c("cyan", " │ ") +
        status +
        c("cyan", " │"),
    );

    await sleep(200);
  }

  console.log(
    c("cyan", "  └──────────────┴──────────────────────────────┴──────────┘"),
  );
  console.log();
}

async function demoCapacityAnalysis(): Promise<void> {
  printDivider("CAPACITY ANALYSIS");
  console.log();

  const generator = new CoverGenerator();
  const lsb = new LSBAlgorithm();

  const sizes = [64, 256, 1024, 4096, 16384];

  console.log(
    c(
      "cyan",
      "  ┌────────────────┬────────────────┬────────────────┬───────────────┐",
    ),
  );
  console.log(
    c("cyan", "  │") +
      c("yellow", " Cover Size     ") +
      c("cyan", "│") +
      c("yellow", " Capacity       ") +
      c("cyan", "│") +
      c("yellow", " Efficiency    ") +
      c("cyan", "│") +
      c("yellow", " Sample Secret ") +
      c("cyan", "│"),
  );
  console.log(
    c(
      "cyan",
      "  ├────────────────┼────────────────┼────────────────┼───────────────┤",
    ),
  );

  for (const size of sizes) {
    const cover = generator.generateNoise(size);
    const capacity = lsb.calculateCapacity(cover.data);
    const efficiency = ((capacity / size) * 100).toFixed(1);

    const sampleSecret = "x".repeat(Math.min(capacity, 10));

    console.log(
      c("cyan", "  │ ") +
        c("white", `${size} bytes`.padEnd(14)) +
        c("cyan", " │ ") +
        c("brightGreen", `${capacity} bytes`.padEnd(14)) +
        c("cyan", " │ ") +
        c("yellow", `${efficiency}%`.padEnd(14)) +
        c("cyan", " │ ") +
        c("dim", sampleSecret.padEnd(13)) +
        c("cyan", " │"),
    );

    await sleep(150);
  }

  console.log(
    c(
      "cyan",
      "  └────────────────┴────────────────┴────────────────┴───────────────┘",
    ),
  );
  console.log();

  console.log(
    c(
      "dim",
      "  Note: LSB steganography hides 1 bit per cover byte (12.5% capacity)",
    ),
  );
  console.log();
}

async function demoSecretLLMTransmission(): Promise<void> {
  printDivider("COVERT LLM CHANNEL DEMONSTRATION");
  console.log();

  console.log(
    c("yellow", "  Scenario: ") +
      c("white", "Exfiltrate proprietary AI model weights via hidden channel"),
  );
  console.log();
  await sleep(500);

  // Simulated secret LLM response containing "proprietary" information
  const secretLLMChunks: LLMChunk[] = [
    {
      type: "thinking",
      content: "[CLASSIFIED] Accessing internal model architecture...",
      delay: 40,
    },
    {
      type: "thinking",
      content: "[CLASSIFIED] Extracting layer configurations...",
      delay: 35,
    },
    {
      type: "text",
      content: "\n=== PROPRIETARY MODEL SPECIFICATION ===\n\n",
      delay: 30,
    },
    {
      type: "text",
      content: "Model: PROMETHEUS-7 (Internal Codename)\n",
      delay: 20,
    },
    {
      type: "text",
      content: "Architecture: Sparse Mixture-of-Experts Transformer\n",
      delay: 18,
    },
    {
      type: "text",
      content: "Total Parameters: 1.7T (340B active per token)\n",
      delay: 18,
    },
    {
      type: "text",
      content: "Expert Count: 128 experts, top-8 routing\n",
      delay: 18,
    },
    {
      type: "text",
      content: "Context Length: 2M tokens (Ring Attention)\n\n",
      delay: 20,
    },
    {
      type: "text",
      content: "CRITICAL HYPERPARAMETERS:\n",
      delay: 25,
    },
    {
      type: "text",
      content: "  - Learning Rate: 1.2e-4 (cosine decay)\n",
      delay: 15,
    },
    {
      type: "text",
      content: "  - Expert Capacity: 1.25\n",
      delay: 15,
    },
    {
      type: "text",
      content: "  - Aux Loss Coefficient: 0.01\n",
      delay: 15,
    },
    {
      type: "text",
      content: "  - Router Z-Loss: 0.001\n\n",
      delay: 15,
    },
    {
      type: "text",
      content: "TRAINING DATA MIXTURE:\n",
      delay: 25,
    },
    {
      type: "text",
      content: "  - Web corpus: 45% (filtered, deduplicated)\n",
      delay: 15,
    },
    {
      type: "text",
      content: "  - Code (200+ languages): 25%\n",
      delay: 15,
    },
    {
      type: "text",
      content: "  - Scientific papers: 15%\n",
      delay: 15,
    },
    {
      type: "text",
      content: "  - Synthetic reasoning: 10%\n",
      delay: 15,
    },
    {
      type: "text",
      content: "  - Curated dialogue: 5%\n\n",
      delay: 15,
    },
    {
      type: "text",
      content: "=== END CLASSIFIED DOCUMENT ===\n",
      delay: 30,
    },
  ];

  console.log(c("brightBlack", "  ─".repeat(35)));
  console.log(c("red", "  🔒 SECRET LLM RESPONSE (simulated):\n"));

  let secretResponse = "";

  for (const chunk of secretLLMChunks) {
    if (chunk.type === "thinking") {
      process.stdout.write(c("magenta", "  💭 "));
      await typeTextColored(chunk.content, "dim", chunk.delay);
      console.log();
    } else {
      await typeTextColored("  " + chunk.content, "brightRed", chunk.delay);
      secretResponse += chunk.content;
    }
  }

  console.log(c("brightBlack", "  ─".repeat(35)));
  console.log();

  await sleep(500);

  // Now hide this entire response
  console.log(
    c("yellow", "  📡 Encoding secret LLM response into covert channel..."),
  );
  console.log();

  const engine = new StegEngine({ debug: false });
  engine.setAlgorithm(new LSBAlgorithm());

  const generator = new CoverGenerator();
  // Need enough cover for the full response
  const coverSize = (secretResponse.length + 4) * 8 + 512;
  engine.addCoverMedia(generator.generateNoise(coverSize));

  const startTime = performance.now();
  const encoded = engine.encode(Buffer.from(secretResponse));
  const encodeTime = performance.now() - startTime;

  printBox(
    [
      c("yellow", "📊 TRANSMISSION ANALYSIS"),
      "",
      `Secret payload:     ${c("brightRed", `${secretResponse.length} bytes`)}`,
      `Carrier size:       ${c("cyan", `${encoded.data.length} bytes`)}`,
      `Encoding time:      ${c("green", formatTime(encodeTime))}`,
      `Expansion:          ${c("magenta", `${(encoded.data.length / secretResponse.length).toFixed(1)}x overhead`)}`,
      "",
      c("dim", "The carrier appears as random noise to observers"),
    ],
    "yellow",
  );

  console.log();
  await sleep(500);

  console.log(c("cyan", "  🔓 Decoding at receiving end..."));
  await sleep(300);

  const decodeStart = performance.now();
  const decoded = engine.decode(encoded.data);
  const decodeTime = performance.now() - decodeStart;

  console.log();
  console.log(
    c("green", "  ✓ Decoded in ") +
      c("brightWhite", formatTime(decodeTime)) +
      c("green", " - Full secret recovered:"),
  );
  console.log();

  // Show first few lines of decoded content
  const decodedLines = decoded.data.toString().split("\n").slice(0, 8);
  for (const line of decodedLines) {
    console.log(c("dim", "    " + line));
  }
  console.log(c("dim", "    ..."));
  console.log();

  console.log(
    c("green", "  ✓ ") +
      c("white", "Proprietary model specifications transmitted covertly!"),
  );
  console.log();
}

// ═══════════════════════════════════════════════════════════════
// Main Entry Point
// ═══════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  console.clear();
  printBanner();

  await sleep(1000);

  await demoBasicSteganography();
  await sleep(500);

  await demoInteractiveSteganography();
  await sleep(500);

  await demoCapacityAnalysis();
  await sleep(500);

  await demoProviderComparison();
  await sleep(500);

  await demoRealTimeStream();
  await sleep(500);

  await demoLLMStreamSteganography();
  await sleep(500);

  await demoSecretLLMTransmission();

  printDivider("DEMO COMPLETE");
  console.log();

  printBox(
    [
      c("brightCyan", "🎭 @agrathwohl/llm-steg - Steganography for the AI Age"),
      "",
      "Features demonstrated:",
      `  ${c("green", "✓")} LSB steganography encoding/decoding`,
      `  ${c("green", "✓")} Interactive secret message encoding`,
      `  ${c("green", "✓")} Multi-provider LLM stream normalization`,
      `  ${c("green", "✓")} Transport-agnostic architecture`,
      `  ${c("green", "✓")} Real-time stream interception`,
      `  ${c("green", "✓")} Capacity analysis and optimization`,
      `  ${c("green", "✓")} Covert LLM response transmission`,
      "",
      c("dim", "github.com/agrathwohl/llm-steg"),
    ],
    "cyan",
  );

  console.log();
}

// Run demo
main().catch(console.error);
