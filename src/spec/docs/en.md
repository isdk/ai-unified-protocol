# 📋 Overview
<!-- id: overview -->

## Design Principles
<!-- id: overview-principles -->

This specification defines a unified protocol for interacting with AI models across all modalities — text, image, audio, video, and embeddings — regardless of whether the model runs locally or via a remote API.

**Core Insight**: Every AI model is fundamentally an \`Input → Output\` function. All differences between model types (chat, vision, TTS, drawing, etc.) reduce to:
- What input modalities the model accepts
- What output modalities it produces
- What additional features it supports (streaming, multi-turn, tool calling, etc.)

By modeling these three dimensions explicitly, the protocol eliminates the need for per-type interfaces.

### Decisions
- All model types share the same request/response protocol
- Differences are expressed via capability declarations, not separate interfaces
- Provider-specific parameters are passed through transparently — the protocol does not interpret them
- Application-layer concerns (role-play routing, UI state) are excluded from the protocol layer

## Architecture Layers
<!-- id: overview-layers -->

The system is organized into clear layers with strict boundaries:

```text
┌──────────────────────────────────────────────┐
│             Application Layer                │  Role-play, conversation
│    (toRole, replies, charId, private, etc.)   │  management, UI state
├──────────────────────────────────────────────┤
│             Template Engine                  │  ChatML rendering,
│      (chat templates, caps detection)        │  Jinja2 templates
├──────────────────────────────────────────────┤
│             Model Registry                   │  Model catalog, skills,
│      (search, ratings, metadata)             │  scoring, discovery
├──────────────────────────────────────────────┤
│             Model Manager                    │  File download, quantization
│      (download, storage, sharding)           │  selection, shard management
├──────────────────────────────────────────────┤
│           Router / Orchestrator              │  URI resolution, provider
│      (provider://model routing)              │  matching, priority
├──────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────────────┐    │
│  │   Local     │  │      Remote         │    │  Provider adapters
│  │  Provider   │  │     Provider        │    │
│  └──────┬──────┘  └─────────────────────┘    │
│     ┌───┴───┬──────────┐                     │
│     │llama  │whisper   │sd.cpp               │  Local engines
│     │.cpp   │.cpp      │                     │
│     └───────┴──────────┘                     │
├──────────────────────────────────────────────┤
│          Protocol Layer  (this spec)         │  ContentBlock, Request,
│   Modality, Capability, Message, Error, ...  │  Response, Provider interface
└──────────────────────────────────────────────┘
```

# 🧩 Modality & Capability
<!-- id: modality -->

## Modalities
<!-- id: modality-types -->

A **Modality** represents a type of content that can flow into or out of a model. The protocol defines five standard modalities:

```typescript
type Modality = 'text' | 'image' | 'audio' | 'video' | 'embedding'
```

### Notes
- Modalities describe the nature of data, not the format (e.g., "image" covers PNG, JPEG, WebP, etc.)
- New modalities can be added as the ecosystem evolves (e.g., "3d_model", "midi")

## Features
<!-- id: modality-features -->

**Features** describe additional capabilities beyond basic I/O. They are declared as string flags:

```typescript
type Feature =
  | 'stream'          // Supports streaming output
  | 'multi_turn'      // Supports multi-turn conversation
  | 'tool_use'        // Supports function/tool calling
  | 'infill'          // Supports fill-in-the-middle
  | 'system_prompt'   // Supports system role messages
  | 'thinking'        // Supports CoT reasoning output
  | 'json_mode'       // Supports structured JSON output
  | (string & {})     // Provider-extensible
```

### Notes
- Features are extensible — providers can introduce custom features
- Features describe what a model CAN do, not what it MUST do

## ModelCapability
<!-- id: modality-capability -->

A model's capability is the combination of its input modalities, output modalities, and features:

```typescript
interface ModelCapability {
  input:    Modality[]   // What the model accepts
  output:   Modality[]   // What the model produces
  features: Feature[]    // Additional capabilities
}
```

## Type Aliases
<!-- id: modality-aliases -->

Predefined aliases provide shortcuts for common model types. **Aliases only constrain modalities** (input/output). The \`typicalFeatures\` are informational defaults and are **NOT** used for matching.

```typescript
const ModelTypeAliases = {
  chat:      { input: ['text'],          output: ['text'],      typicalFeatures: ['multi_turn', 'system_prompt', 'stream'] },
  vision:    { input: ['text', 'image'], output: ['text'],      typicalFeatures: ['multi_turn', 'stream'] },
  stt:       { input: ['audio'],         output: ['text'],      typicalFeatures: [] },
  tts:       { input: ['text'],          output: ['audio'],     typicalFeatures: ['stream'] },
  drawing:   { input: ['text'],          output: ['image'],     typicalFeatures: [] },
  img2img:   { input: ['text', 'image'], output: ['image'],     typicalFeatures: [] },
  embedding: { input: ['text'],          output: ['embedding'], typicalFeatures: [] },
  infill:    { input: ['text'],          output: ['text'],      typicalFeatures: ['infill'] },
  music:     { input: ['text'],          output: ['audio'],     typicalFeatures: [] },
  video_gen: { input: ['text'],          output: ['video'],     typicalFeatures: [] },
}

// Matching: model capabilities must be a SUPERSET of alias modalities
matchesAlias(gpt4o, 'chat')   // → true (text⊇text, text⊇text)
matchesAlias(gpt4o, 'vision') // → true (text+image⊇text+image)

// Feature-specific queries
matchesAlias(model, 'chat', { requireFeatures: ['multi_turn'] })
```

### Decisions
- A completion-only text→text model IS a "chat" type (matches modalities), but lacks multi_turn feature
- GPT-4o matches both "chat" and "vision" aliases (superset matching)
- Application layer checks features separately to determine UI presentation

# 📦 Content Blocks
<!-- id: content -->

## Design
<!-- id: content-design -->

All input and output data flows through **ContentBlock** — a tagged union with \`type\` discriminator. The \`type\` field is \`string\` (not enum) to allow provider extensions.

Content can appear in two forms:
- **String shorthand**: \`"Hello world"\` — treated as \`[{ type: 'text', text: 'Hello world' }]\`
- **ContentBlock array**: \`[{ type: 'text', text: '...' }, { type: 'image', url: '...' }]\`

Receivers normalize string shorthand internally via \`normalizeContent()\`.

```typescript
type ContentBlock =
  | TextContent         // { type: 'text', text: string }
  | ThinkingContent     // { type: 'thinking', text: string }
  | ImageContent        // { type: 'image', data?: ..., url?: ... }
  | AudioContent        // { type: 'audio', data?: ..., url?: ... }
  | VideoContent        // { type: 'video', data?: ..., url?: ... }
  | EmbeddingContent    // { type: 'embedding', vector: number[] }
  | ContentBlockBase    // { type: string, ... } — provider extensions
```

### Decisions
- type is string, not enum — providers can extend freely
- Data can be inline (base64/ArrayBuffer) or by reference (URL)
- Unknown block types should be handled gracefully (JSON display or skip)

## Standard Types
<!-- id: content-standard -->

Each standard content block type has a defined structure:

```typescript
// Text — the most common type
interface TextContent {
  type: 'text'
  text: string
}

// Thinking — CoT reasoning (parsed by provider from raw output)
interface ThinkingContent {
  type: 'thinking'
  text: string
}

// Image — inline data or URL reference
interface ImageContent {
  type: 'image'
  data?: string | ArrayBuffer    // Base64 or binary
  url?: string                   // URL reference
  mimeType?: string              // e.g., 'image/png'
  width?: number
  height?: number
}

// Audio
interface AudioContent {
  type: 'audio'
  data?: string | ArrayBuffer
  url?: string
  mimeType?: string
  duration?: number              // Seconds
}

// Video
interface VideoContent {
  type: 'video'
  data?: string | ArrayBuffer
  url?: string
  mimeType?: string
  duration?: number
}

// Embedding vector
interface EmbeddingContent {
  type: 'embedding'
  vector: number[]
  dimensions?: number
}
```

## Thinking Content
<!-- id: content-thinking -->

The `thinking` content type represents Chain-of-Thought (CoT) reasoning output. Different models use different marker patterns in their raw output.

**Protocol layer**: Defines `thinking` as a standard ContentBlock type and provides the `shouldThink` parameter in `AIRequest` for control.

**Thinking Mode Configuration (shouldThink)**:

`shouldThink` determines whether to enable thinking mode and its configuration. It can appear in user request parameters or be defined in the model configuration file.

* **Merge Priority**:
  * **Mode Switch (Mode)**: User request parameters take priority. Users can choose any mode supported by the model.
  * **Parsing Structure (Tags/Prompts)**: Model configuration takes priority. Tags and delimiters are determined by the model's nature and typically do not change per request.
* **Capability Verification**:
  * The requested mode must be included in the model's `supports.thinkMode` declaration. If not declared, only the default mode defined in the config is supported.
* **Type**: `boolean | ThinkingMode | ThinkingConfig`
* **Values**:
  * `true`: Enables the model's default mode (or `last`).
  * `false` or `'off'`: Disables thinking mode.
  * `ThinkingMode`: Explicitly specifies a mode.
  * `ThinkingConfig`: Provides enhanced configuration (primarily used at the model definition level).

**Predefined Thinking Modes (ThinkingMode)**:

| Mode | Description |
| :--- | :--- |
| `off` | Disables the thinking process. |
| `last` | Outputs the final answer first, followed by the thinking process. |
| `first` | Outputs the thinking process first, followed by the final answer. |
| `deep` | Deep thinking mode, typically involving long-sequence reasoning before reaching a conclusion. |

**Configuration Object (ThinkingConfig)**:

```typescript
interface ThinkingConfig {
  mode: ThinkingMode            // Required: Thinking mode type
  visible?: boolean             // Whether to display the thinking process in the UI
  depth?: number                // Maximum thinking depth
  steps?: number                // Maximum thinking steps
  /**
   * Tags/delimiters for thinking content.
   * If an array [start, end], represents paired tags.
   * If RegExp, extracts content via capture groups (e.g., (?<think>...)).
   */
  thinkTag?: string | RegExp | [string, string]
  /**
   * Tags/delimiters for answer content.
   * For models using a single delimiter, typically marks the end of thinking and the start of the answer.
   */
  answerTag?: string | RegExp | [string, string]
  skipDefaultPrompt?: boolean    // Whether to skip preset AI thinking instructions
  defaultThinkPrompt?: {         // Custom thinking instructions
    prompt: {
      lastThinkPrompt?: any
      firstThinkPrompt?: any
      deepThinkPrompt?: any
      rolePrompt?: any
    }
    templateFormat?: string     // Template format
  }
}
```

### Decision: Mode-Aware State Parsing

When a model supports multi-mode switching and uses asymmetric delimiters (no explicit start tag, only a middle separator), the Provider must dynamically decide the parsing state based on the current `AIRequest.shouldThink` mode:

1. **Context Awareness**: The parser must read the current thinking mode before processing the raw stream.
2. **State Initialization**:
   - If mode is `deep` or `first` and `thinkTag` is empty/undefined, the initial state is set to `THINKING`.
   - If mode is `off`, the initial state is set to `NORMAL`.
3. **Boundary Handling**: In `THINKING` state, once an `answerTag` is matched, the thinking block must be immediately terminated and switched to the body block, even if no closing `thinkTag` was encountered.

### Notes
- Provider parses raw stream using a state machine: NORMAL → encounter start tag → THINKING → encounter end tag → NORMAL
- In streaming mode, thinking chunks use { type: "thinking", delta: "..." } and content chunks use { type: "text", delta: "..." }
- Application layer only sees clean, separated blocks — no parsing needed

# 💬 Messages
<!-- id: message -->

## Message Structure
<!-- id: message-structure -->

A **Message** represents a single turn in a conversation. The protocol layer keeps messages minimal — only fields relevant to model interaction and template rendering.

Application-layer fields (\`toRole\`, \`replies\`, \`private\`, \`charId\`, \`from\`) belong in the \`metadata\` bucket.

```typescript
interface Message {
  // ── Model interaction (top-level) ──
  role: ChatRole                   // 'user' | 'assistant' | 'system' | 'tool' | string
  content: string | ContentBlock[] // String shorthand or structured blocks
  name?: string                    // Display name / tool function name
  toolCalls?: ToolCall[]           // Assistant's tool invocations
  toolCallId?: string              // Links tool response to its call

  // ── Rendering control (top-level) ──
  templateFormat?: string          // Default: 'jinja2'

  // ── Everything else (nested) ──
  metadata?: Record<string, any>   // Opaque bucket for app/UI/persistence
}

type ChatRole = 'user' | 'assistant' | 'system' | 'tool' | (string & {})
```

### Decisions
- Model interaction fields are top-level — every provider adapter reads them directly
- metadata is Record<string, any> — different layers add their own keys without coordination
- When serializing for remote API calls, strip metadata entirely
- templateFormat is protocol-layer because template rendering is a cross-cutting concern

## Tool Calling
<!-- id: message-tools -->

Tool calling follows the OpenAI convention with some generalizations:

```typescript
// Tool definition (passed in request)
interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters?: Record<string, any>  // JSON Schema
    strict?: boolean
  }
}

// Tool call (in assistant message)
interface ToolCall {
  type: 'function'
  id?: string                    // Unique ID to match responses
  function: {
    name: string
    arguments?: string | Record<string, any>
  }
}

// Tool choice (in request)
type ToolChoice =
  | 'auto'       // Model decides
  | 'none'       // Disabled
  | 'required'   // Must call at least one
  | { type: 'function', function: { name: string } }  // Force specific

// Tool response message
{
  role: 'tool',
  toolCallId: 'call_123',
  content: '{"temperature": 22}',
  name: 'getWeather'
}
```

# 🔄 Request & Response
<!-- id: request -->

## AIRequest
<!-- id: request-structure -->

The unified request type serves all model types. It has two mutually exclusive input modes:

- **\`messages\`**: For conversational scenarios (chat, multi-turn dialogue)
- **\`input\`**: For non-conversational scenarios (TTS, STT, embedding, image generation)

Provide one or the other, never both. Providing neither or both is a validation error.

```typescript
interface AIRequest {
  /**
   * Model identifier.
   * Format: "provider://model-name"
   * Examples: "openai://gpt-4o", "local://qwen-7b"
   */
  model: string

  // ── Input (mutually exclusive) ──
  messages?: Message[]                // Conversational
  input?: string | ContentBlock[]     // Non-conversational

  // ── Thinking Control ──
  shouldThink?: boolean | ThinkingMode | ThinkingConfig

  // ── Tool calling (meaningful with messages only) ──
  tools?: ToolDefinition[]
  toolChoice?: ToolChoice

  // ── Output control ──
  stream?: boolean                    // Request streaming
  options?: Record<string, any>       // Provider-specific (transparent)
  templateFormat?: string             // Default: 'jinja2'
  signal?: AbortSignal                // Cancellation
}
```

### Notes
- tools/toolChoice are ignored in non-conversational (input) mode
- options is fully transparent — temperature, top_p, steps, voice, seed, etc.
- If stream=true but unsupported, provider MUST throw error (no silent degradation)

## Request Examples
<!-- id: request-examples -->

Concrete examples for each model type:

```typescript
// ① Chat (multi-turn)
{
  model: 'openai://gpt-4o',
  messages: [
    { role: 'system', content: 'You are helpful.' },
    { role: 'user', content: 'Explain quantum entanglement.' }
  ],
  stream: true,
  options: { temperature: 0.7, max_tokens: 2048 }
}

// ② Vision (image + text → text)
{
  model: 'openai://gpt-4o',
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: 'What is in this image?' },
      { type: 'image', url: 'https://example.com/photo.jpg' }
    ]
  }]
}

// ③ Embedding (text → vector)
{
  model: 'local://bge-m3',
  input: 'Text to embed'
}

// ④ TTS (text → audio)
{
  model: 'local://kokoro',
  input: 'Hello world, how are you today?',
  options: { voice: 'alloy', speed: 1.0 }
}

// ⑤ STT (audio → text)
{
  model: 'local://whisper',
  input: [{ type: 'audio', data: audioBuffer }]
}

// ⑥ Image generation (text → image)
{
  model: 'local://stable-diffusion',
  input: 'A cat sitting on the moon, watercolor style',
  stream: true,  // Progressive rendering
  options: { width: 1024, height: 1024, steps: 20, seed: 42 }
}

// ⑦ Image-to-Image
{
  model: 'local://stable-diffusion',
  input: [
    { type: 'text', text: 'Make it look like a cartoon' },
    { type: 'image', url: 'file:///path/to/source.jpg' }
  ],
  options: { strength: 0.75, steps: 30 }
}
```

## AIResponse
<!-- id: response-structure -->

The non-streaming response contains the generated content, finish reason, usage statistics, and optional tool calls:

```typescript
interface AIResponse {
  content: string | ContentBlock[]    // Generated output
  finishReason?: FinishReason         // Why generation stopped
  usage?: UsageInfo                   // Token/resource usage
  toolCalls?: ToolCall[]              // Tool calls (chat mode)
  metadata?: Record<string, any>     // Provider-specific
}

type FinishReason =
  | 'stop'            // Natural stop
  | 'length'          // Hit max_tokens
  | 'content_filter'  // Content filter
  | 'tool_calls'      // Requesting tool calls
  | 'abort'           // User cancelled
  | 'error'           // Generation error
  | (string & {})     // Provider extension

interface UsageInfo {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  [key: string]: any   // Provider-specific metrics
}
```

## Streaming
<!-- id: response-streaming -->

Streaming is a **transport-layer concern**. The protocol layer only declares intent (\`stream: true\`) and chunk format. How streaming is implemented (SSE, WebSocket, gRPC, local callback) is the provider's decision.

The **last chunk** carries summary information (finishReason, usage) — following the OpenAI convention.

If a request sets \`stream: true\` but the provider does not support streaming, the provider **MUST** throw an \`UNSUPPORTED_FEATURE\` error (code 604). No silent degradation — the caller's code is structured for streaming and would break on a non-stream response.

```typescript
interface AIResponseChunk {
  type: string            // 'text' | 'thinking' | 'image' | 'audio' | ...

  // ── Text/thinking increments ──
  delta?: string          // Incremental text

  // ── Binary increments ──
  data?: ArrayBuffer      // Binary chunk (image/audio/video)

  // ── Image progressive rendering ──
  step?: number           // Current diffusion step
  totalSteps?: number     // Total steps (from request options or model default)

  // ── Multi-output ──
  index?: number          // Parallel output index (n=3 → 0,1,2)

  // ── Final chunk only ──
  finishReason?: FinishReason
  usage?: UsageInfo

  // ── Provider extensions ──
  toolCalls?: ToolCall[]
  [key: string]: any
}

// Streaming text example:
{ type: 'thinking', delta: 'Let me analyze...' }
{ type: 'thinking', delta: ' the boundary conditions' }
{ type: 'text', delta: 'The answer' }
{ type: 'text', delta: ' is 42.' }
{ type: 'text', finishReason: 'stop', usage: { totalTokens: 150 } }

// Streaming image (progressive rendering):
{ type: 'image', data: <step5_buffer>, step: 5, totalSteps: 20 }
{ type: 'image', data: <step10_buffer>, step: 10, totalSteps: 20 }
{ type: 'image', data: <final_buffer>, step: 20, totalSteps: 20, finishReason: 'stop' }

// Streaming audio:
{ type: 'audio', data: <chunk1_buffer> }
{ type: 'audio', data: <chunk2_buffer> }
{ type: 'audio', data: <chunk3_buffer>, finishReason: 'stop' }
```

# 🔌 Provider
<!-- id: provider -->

## Provider Interface
<!-- id: provider-interface -->

Every provider — local or remote — implements the same interface. The \`invoke\` method uses TypeScript overloads to provide type-safe streaming:

```typescript
interface AIProvider {
  id: string       // Unique ID (used in URI scheme)
  name: string     // Human-readable name

  // Capability declaration
  capabilities(): ModelCapability[]

  // Model discovery
  listModels(): Promise<ModelInfo[]>

  // Unified invocation — single entry point
  invoke(req: AIRequest & { stream: true }): Promise<AsyncIterable<AIResponseChunk>>
  invoke(req: AIRequest & { stream?: false }): Promise<AIResponse>
  invoke(req: AIRequest): Promise<AIResponse | AsyncIterable<AIResponseChunk>>

  // Optional lifecycle
  initialize?(config: ProviderConfig): Promise<void>
  dispose?(): Promise<void>
}

interface ModelInfo {
  id: string                       // Model identifier
  name?: string
  description?: string
  capability: ModelCapability      // What this model can do
  metadata?: Record<string, any>  // Provider-specific
}
```

## Provider Configuration
<!-- id: provider-config -->

Configuration differs between local and remote providers. Both share the same union type:

```typescript
type ProviderConfig = LocalProviderConfig | RemoteProviderConfig

interface RemoteProviderConfig {
  type: 'remote'
  apiUrl: string
  apiKey?: string
  headers?: Record<string, string>
}

interface LocalProviderConfig {
  type: 'local'
  engine: string                       // 'llama.cpp' | 'whisper.cpp' | ...
  modelPath?: string
  engineOptions?: Record<string, any>  // Transparent to protocol
}
```

### Decisions
- Provider-specific options in engineOptions are transparent — protocol does not interpret them
- Unknown parameters are silently ignored by the provider
- No whitelist/blacklist enforcement at protocol level

## Model Configuration Resolution
<!-- id: provider-config-resolution -->

When loading a model, local providers retrieve configuration from two primary sources:

1. **Sidecar Configuration**:
   - **Location**: In the same directory as the model binary file (e.g., `.gguf`).
   - **Naming**: Shares the same basename with a `.config.yaml` suffix.
   - **Example**: `model.gguf` matches `model.config.yaml`.
   - **Role**: Used for fine-tuning specific model files or storing user-defined overrides.

2. **System Built-in Configuration**:
   - **Location**: The system's internal model configuration library.
   - **Matching**: Resolved via `modelPattern` regex matching against the filename.
   - **Role**: Provides recommended defaults for entire model families (e.g., `Llama-3`, `Qwen-2`).

## Parameter Priority
<!-- id: provider-params -->

For local providers, parameters are resolved through a priority chain. Higher-priority sources override lower ones:

1. **Request Options**: Explicit `AIRequest.options` (Highest priority — direct user intent).
2. **Sidecar Config**: `*.config.yaml` file adjacent to the model binary.
3. **System Built-in Config**: Predefined recommended settings for the model family.
4. **Engine Defaults**: Default values of the underlying inference engine (Lowest priority).

### Notes
- **Internal Configuration Priority**: When resolving a Sidecar or System configuration, an internal hierarchy also applies (from high to low): **Version Variant > Base Config > Inherited Config**.
- The protocol layer does not perform this merging — it is the provider/engine's responsibility.
- This chain ensures user intent always wins, with sensible defaults when not specified.

# 🗺️ Routing
<!-- id: routing -->

## URI-based Routing
<!-- id: routing-uri -->

Model identifiers use a URI format: \`provider://model-name\`. The router parses the scheme to find the correct provider.

```typescript
// URI format
"openai://gpt-4o"           → OpenAI provider, model "gpt-4o"
"anthropic://claude-3.5"    → Anthropic provider
"local://qwen-7b"           → Local provider, then internal routing

// If no scheme, router resolves via registered providers
"gpt-4o"                    → Router searches all providers
```

## Local Provider Routing
<!-- id: routing-local -->

Local providers perform a second-level routing internally. When a request arrives at the local provider, it matches the model name against registered engine rules to select the correct engine:

```typescript
```text
Global Router
  │
  ├── "openai://gpt-4o"  → OpenAI Provider (direct API call)
  │
  └── "local://qwen-7b"  → Local Provider
          │
          │  Rules Engine
          │  ├── /qwen|qwq/i         → llama.cpp engine
          │  ├── /whisper/i           → whisper.cpp engine
          │  ├── /stable-diffusion/i  → sd.cpp engine
          │  └── /kokoro|piper/i      → tts engine
          │
          └── Selected: llama.cpp engine
                │
                │  Model Config matching (modelPattern)
                │  ├── /qwen3/i → variant "qwen3"
                │  ├── /qwq/i   → variant "qwq"
                │  └── /@/      → default variant
                │
                └── Load model with variant-specific config
```

## Model Name Rules
<!-- id: routing-rules -->

Model name rules support three matching modes:

```typescript
type ModelNameRule = string | RegExp | ((name: string) => boolean)

// String (exact or glob)
"qwen-7b"

// RegExp (most common in practice)
/(?:^|[-_.])(?:code)?(qwen|qwq)(?:\\d+(?:[.]\\d+)?)?(?:$|[-_.])/i

// Predicate function
(name) => name.includes('stable-diffusion')
```

### Notes
- In model config files, patterns use !re YAML tag for RegExp: !re /pattern/flags
- The "@" key in modelPattern serves as the default/fallback rule
- Patterns are evaluated in order; first match wins

## Router Interface
<!-- id: routing-router -->

The router provides centralized model resolution and invocation:

```typescript
interface AIRouter {
  // Register a provider with optional priority
  register(provider: AIProvider, priority?: number): void

  // Resolve model identifier to a provider
  resolve(model: string, requirement?: Partial<ModelCapability>): AIProvider

  // Unified invoke (auto-routes to correct provider)
  invoke(request: AIRequest): Promise<AIResponse | AsyncIterable<AIResponseChunk>>
}
```

# ⚠️ Error Handling
<!-- id: errors -->

## Error Codes
<!-- id: errors-codes -->

Error codes align with HTTP status codes where applicable. AI-domain extensions start at 600+ to avoid conflicts.

```typescript
const AIErrorCodes = {
  // ── Aligned with HTTP status codes ──
  BAD_REQUEST:              400,  // Malformed request
  AUTH_FAILED:              401,  // Authentication failure
  PERMISSION_DENIED:        403,  // Insufficient permissions
  MODEL_NOT_FOUND:          404,  // Model does not exist
  TIMEOUT:                  408,  // Request timed out
  CONFLICT:                 409,  // Resource conflict (e.g., model loading)
  RATE_LIMITED:              429,  // Too many requests
  CONTENT_FILTERED:         451,  // Content moderation triggered
  INTERNAL_ERROR:           500,  // Provider internal error
  NOT_IMPLEMENTED:          501,  // Feature not implemented
  SERVICE_UNAVAILABLE:      503,  // Service temporarily unavailable

  // ── AI domain extensions (600+) ──
  MODEL_NOT_LOADED:         601,  // Model not in memory
  CONTEXT_LENGTH_EXCEEDED:  602,  // Input exceeds context window
  OUT_OF_MEMORY:            603,  // GPU/RAM exhausted
  UNSUPPORTED_FEATURE:      604,  // Requested feature not supported
  UNSUPPORTED_MODALITY:     605,  // Requested modality not supported
  ENGINE_ERROR:             610,  // Inference engine failure
  ABORTED:                  620,  // User cancelled via AbortSignal
}
```

### Decisions
- Codes 400-503 reuse HTTP semantics — developers recognize them instantly
- Codes 600+ are AI-specific extensions
- Remote providers map original HTTP status to the status field, unified code to the code field
- Providers may use custom codes (700+); unknown codes are treated as INTERNAL_ERROR by callers

## AIError Type
<!-- id: errors-type -->

The standard error type extends JavaScript Error:

```typescript
interface AIError extends Error {
  code: number           // AIErrorCodes value or custom
  status?: number        // Original HTTP status (remote providers)
  provider?: string      // Which provider threw this
  details?: any          // Provider-specific error details
  retryable?: boolean    // Whether caller can retry
}

// Usage:
try {
  const response = await provider.invoke(request)
} catch (err) {
  const aiErr = err as AIError
  if (aiErr.retryable) {
    // Retry with backoff
  }
  switch (aiErr.code) {
    case 429: // Rate limited
      await delay(aiErr.details?.retryAfter ?? 1000)
      break
    case 604: // Unsupported feature
      // Fall back to non-streaming
      break
    case 603: // Out of memory
      // Suggest smaller model
      break
  }
}
```

# ⚙️ Model Configuration
<!-- id: model-config -->

## Configuration Structure
<!-- id: model-config-structure -->

Local models use YAML configuration files that describe how an engine should handle a model family. Configurations support inheritance, version variants, regex-based model file matching, per-variant parameters, and chat templates.

```typescript
interface LocalModelConfig {
  _id: string                       // Unique ID: 'Qwen', 'ChatML'
  extends?: string                  // Inherit from parent config
  templateFormat?: string           // 'hf' | 'jinja2' | 'golang'
  type?: string                     // 'system' for base templates
  supports?: string[]               // Feature declarations

  version?: Record<string, {        // Per-variant overrides
    supports?: Record<string, any>[]
    shouldThink?: ThinkingConfig
    prompt?: Record<string, string>
  }>

  prompt?: Record<string, string>   // Template variables
  template?: string                 // Chat template (Jinja2)

  modelPattern?: Record<string, RegExp | string>
  // Maps variant name → regex
  // '@' = default fallback

  parameters?: Record<string, Record<string, any>>
  // Per-variant default parameters

  capability?: ModelCapability      // If not inferred
}
```

## Inheritance
<!-- id: model-config-inheritance -->

Configurations can extend a parent, inheriting all fields and selectively overriding:

```yaml
# ChatML.yaml — Base template
_id: ChatML
templateFormat: hf
type: system
prompt:
  bot_token: '<|im_start|>'
  eot_token: '<|im_end|>'
template: |-
  {% for message in messages %}
    ...standard ChatML format...
  {% endfor %}
modelPattern:
  '@': !re /(?:^|[-_.])(?:code)?(yi|MiniCPM|smollm)(?:\\d+)?(?:$|[-_.])/i

# Qwen.yaml — Extends ChatML
_id: Qwen
extends: ChatML           # ← Inherits template, prompt, templateFormat
supports:
  - 'tools'               # ← Adds tool support
version:                   # ← Adds version variants
  qwen3:
    supports:
      - thinkMode: ['deep', 'off']
    shouldThink:
      thinkTag: ["<think>", "</think>"]
template: |-              # ← Overrides template with tool-aware version
  ...Qwen-specific template with tool_call handling...
modelPattern:             # ← Own patterns (does NOT inherit parent patterns)
  qwen3: !re /(?:^|[-_.])(?:code)?(qwen3)(?:\\d+)?(?:$|[-_.])/i
  qwq: !re /(?:^|[-_.])(?:code)?(qwq)(?:\\d+)?(?:$|[-_.])/i
  '@': !re /(?:^|[-_.])(?:code)?(qwen|qwq)(?:\\d+)?(?:$|[-_.])/i
```

### Decisions
- extends creates a prototype chain — child inherits all parent fields
- Child fields override parent fields at the top level
- modelPattern is NOT merged — child completely replaces parent patterns
- version variants are NOT inherited — each config defines its own

## Model Matching Flow
<!-- id: model-config-matching -->

When a model file is loaded, the engine resolves its configuration through a multi-step process:

```typescript
Input: model filename "Qwen3-8B-Q4_K_M.gguf"

Step 0: Check for Sidecar Config
  → Check if `Qwen3-8B-Q4_K_M.config.yaml` exists
  → If present and contains a full definition, it takes precedence; if it only contains parameters, it will be merged with the resolved system config.

Step 1: Find matching config (System Config)
  → Iterate all built-in configs' modelPattern.'@' (default rules)
  → "Qwen" config matches via /(?:^|[-_.])(?:code)?(qwen)/i

Step 2: Resolve inheritance
  → Qwen extends ChatML
  → Merge: ChatML fields ← Qwen overrides

Step 3: Find version variant
  → Iterate Qwen's modelPattern (non-@ entries)
  → "qwen3" pattern matches: /(?:^|[-_.])(?:code)?(qwen3)/i
  → Selected variant: "qwen3"

Step 4: Apply variant config
  → version.qwen3.shouldThink → thinkTag: ["<think>", "</think>"]
  → version.qwen3.supports → thinkMode: ['deep', 'off']

Step 5: Resolve parameters
  → parameters.qwen3 → { temperature: 0.5, top_p: 0.9 }
  → These become defaults (overridden by request params)

Result:
  Config  = merged ChatML + Qwen base
  Variant = "qwen3"
  Think   = { thinkTag: ["<think>", "</think>"] }
  Params  = { temperature: 0.5, top_p: 0.9 }
```

## Thinking Configuration
<!-- id: model-config-thinking -->

The thinking (CoT) configuration varies significantly across model families. The config structure accommodates these variations:

```typescript
interface ThinkingConfig {
  mode?: string        // 'deep' | 'off' — default behavior
  thinkTag?:
    | string           // Single delimiter (e.g., "think\\n")
    | [string, string] // Start/end pair (e.g., ["<think>", "</think>"])
}

# Examples from real configs:

# Qwen3 — supports toggling thinking on/off
version:
  qwen3:
    supports:
      - thinkMode: ['deep', 'off']   # User can enable/disable
    shouldThink:
      thinkTag: ["<think>", "</think>"]
    prompt:
      blankThink: "\\n<think>\\n\\n</think>"  # Injected to suppress thinking

# Qwen-S1 — always-on thinking with different delimiters
version:
  s1:
    supports:
      - thinkMode: ['deep']          # Always thinks
    shouldThink:
      mode: deep
      thinkTag: "think\\n"           # Single delimiter style
      answerTag: "\\nanswer\\n"

# QwQ — always-on thinking
version:
  qwq:
    supports:
      - thinkMode: ['deep']
    shouldThink:
      mode: deep
      thinkTag: ["<think>", "</think>"]
```

### Notes
- The engine uses thinkTag to build a state machine for stream parsing
- blankThink is injected into the prompt to suppress thinking when mode=off
- assistant_suffix customization (e.g., "\\n<think>") forces thinking to start
- Remote providers (Claude, OpenAI) handle thinking internally — no config needed

# 🔧 Utilities
<!-- id: utilities -->

## Content Normalization
<!-- id: utilities-normalize -->

Helper functions for working with the \`string | ContentBlock[]\` union:

```typescript
/**
 * Normalize content to ContentBlock[].
 * Converts string shorthand to [{ type: 'text', text }].
 */
function normalizeContent(content: string | ContentBlock[]): ContentBlock[] {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }]
  }
  return content
}

/**
 * Extract plain text from content.
 */
function contentToText(content: string | ContentBlock[]): string {
  if (typeof content === 'string') return content
  return content
    .filter(b => b.type === 'text' || b.type === 'thinking')
    .map(b => b.text)
    .join('')
}

/**
 * Quick constructors for content blocks.
 */
function text(t: string): TextContent {
  return { type: 'text', text: t }
}

function image(url: string): ImageContent {
  return { type: 'image', url }
}

function audio(data: ArrayBuffer, mime?: string): AudioContent {
  return { type: 'audio', data, mimeType: mime }
}
```

## Alias Utilities
<!-- id: utilities-alias -->

Functions for working with model type aliases:

```typescript
/**
 * Create a ModelCapability from an alias name.
 */
function fromAlias(alias: string): ModelCapability | undefined

/**
 * Check if capability matches an alias.
 * Matching: model modalities ⊇ alias modalities.
 * Features are NOT checked unless requireFeatures is specified.
 */
function matchesAlias(
  capability: ModelCapability,
  alias: string,
  options?: { requireFeatures?: Feature[] }
): boolean

// Examples:
const gpt4o: ModelCapability = {
  input: ['text', 'image', 'audio'],
  output: ['text'],
  features: ['multi_turn', 'stream', 'tool_use', 'system_prompt', 'thinking']
}

matchesAlias(gpt4o, 'chat')    // true  — text⊇text, text⊇text
matchesAlias(gpt4o, 'vision')  // true  — text+image+audio⊇text+image
matchesAlias(gpt4o, 'stt')     // true  — audio⊇audio, text⊇text

matchesAlias(gpt4o, 'drawing') // false — text does NOT contain image
matchesAlias(gpt4o, 'chat', { requireFeatures: ['tool_use'] })  // true
```
