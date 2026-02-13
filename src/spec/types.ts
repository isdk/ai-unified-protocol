// ============================================================================
// AI Unified Protocol Specification v1.0
// Complete TypeScript Type Definitions
// ============================================================================

// ─── Modality & Capability ──────────────────────────────────────────────────

/**
 * Content modalities that AI models can consume or produce.
 * Extensible: providers may introduce custom modalities via string.
 */
export type Modality = 'text' | 'image' | 'audio' | 'video' | 'embedding'

/**
 * Feature flags describing additional capabilities beyond I/O modalities.
 * Extensible: providers may introduce custom features via string.
 */
export type Feature =
  | 'stream'          // Supports streaming output
  | 'multi_turn'      // Supports multi-turn conversation
  | 'tool_use'        // Supports function/tool calling
  | 'infill'          // Supports fill-in-the-middle text completion
  | 'system_prompt'   // Supports system role messages
  | 'thinking'        // Supports chain-of-thought reasoning output
  | 'json_mode'       // Supports structured JSON output
  | (string & {})     // Provider-extensible

/**
 * Declares what a model can accept and produce.
 */
export interface ModelCapability {
  /** Modalities the model accepts as input */
  input: Modality[]
  /** Modalities the model produces as output */
  output: Modality[]
  /** Additional feature flags */
  features: Feature[]
}

// ─── Model Type Aliases ─────────────────────────────────────────────────────

/**
 * Predefined aliases mapping common model types to their modality signatures.
 * Aliases only constrain modalities (input/output).
 * `typicalFeatures` are informational and NOT used for matching.
 */
export interface ModelTypeAliasDefinition {
  input: Modality[]
  output: Modality[]
  typicalFeatures: Feature[]
}

export const ModelTypeAliases: Record<string, ModelTypeAliasDefinition> = {
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
} as const

/**
 * Check if a model's capability matches an alias.
 * Matching rule: model's modalities must be a superset of alias modalities.
 * Features are NOT checked.
 */
export function matchesAlias(
  capability: ModelCapability,
  alias: string,
  options?: { requireFeatures?: Feature[] }
): boolean {
  const def = ModelTypeAliases[alias]
  if (!def) return false
  const inputMatch = def.input.every(m => capability.input.includes(m))
  const outputMatch = def.output.every(m => capability.output.includes(m))
  if (!inputMatch || !outputMatch) return false
  if (options?.requireFeatures) {
    return options.requireFeatures.every(f => capability.features.includes(f))
  }
  return true
}

/**
 * Create a ModelCapability from an alias name.
 */
export function fromAlias(alias: string): ModelCapability | undefined {
  const def = ModelTypeAliases[alias]
  if (!def) return undefined
  return {
    input: [...def.input],
    output: [...def.output],
    features: [...def.typicalFeatures],
  }
}

// ─── Content Blocks ─────────────────────────────────────────────────────────

/**
 * Standard content block types defined by the protocol.
 * Providers may extend with custom types.
 */
export type StandardContentBlockType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'embedding'
  | 'thinking'

/**
 * Base interface for all content blocks.
 * `type` is string to allow provider extensions.
 */
export interface ContentBlockBase {
  type: string
  [key: string]: any
}

export interface TextContent extends ContentBlockBase {
  type: 'text'
  text: string
}

export interface ThinkingContent extends ContentBlockBase {
  type: 'thinking'
  text: string
}

export interface ImageContent extends ContentBlockBase {
  type: 'image'
  /** Base64-encoded data or ArrayBuffer */
  data?: string | ArrayBuffer
  /** URL reference (alternative to inline data) */
  url?: string
  /** MIME type, e.g. 'image/png' */
  mimeType?: string
  width?: number
  height?: number
}

export interface AudioContent extends ContentBlockBase {
  type: 'audio'
  data?: string | ArrayBuffer
  url?: string
  mimeType?: string
  /** Duration in seconds */
  duration?: number
}

export interface VideoContent extends ContentBlockBase {
  type: 'video'
  data?: string | ArrayBuffer
  url?: string
  mimeType?: string
  duration?: number
}

export interface EmbeddingContent extends ContentBlockBase {
  type: 'embedding'
  /** The embedding vector */
  vector: number[]
  dimensions?: number
}

/**
 * Union of all standard content blocks.
 * Providers may produce blocks with custom `type` values.
 */
export type ContentBlock =
  | TextContent
  | ThinkingContent
  | ImageContent
  | AudioContent
  | VideoContent
  | EmbeddingContent
  | ContentBlockBase   // catch-all for provider extensions

// ─── Messages ───────────────────────────────────────────────────────────────

/**
 * Standard chat roles.
 * Extended with `(string & {})` to allow provider-defined roles.
 */
export type ChatRole = 'user' | 'assistant' | 'system' | 'tool' | (string & {})

/**
 * A single message in a conversation.
 *
 * Protocol-layer only: no application-layer fields
 * (toRole, replies, private, charId, from, etc.)
 */
export interface Message {
  /** The role of the message author */
  role: ChatRole

  /**
   * Message content. String is shorthand for a single TextContent block.
   * Receivers should normalize to ContentBlock[] internally.
   */
  content: string | ContentBlock[]

  /** Display name for the message author (optional) */
  name?: string

  /** Tool calls made by assistant (only when role='assistant') */
  toolCalls?: ToolCall[]

  /** ID of the tool call this message responds to (only when role='tool') */
  toolCallId?: string

  /** Template format for content interpolation. Default: 'jinja2' */
  templateFormat?: string

  /**
   * Opaque metadata bucket for non-protocol concerns.
   * Used by application layer (createdAt, charId, etc.), persistence,
   * and UI. Protocol layer does not interpret this.
   */
  metadata?: Record<string, any>
}

// ─── Tool Calling ───────────────────────────────────────────────────────────

/**
 * Definition of a tool that a model can call.
 */
export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description?: string
    /** JSON Schema describing the function parameters */
    parameters?: Record<string, any>
    strict?: boolean
  }
}

/**
 * A tool call made by the assistant.
 */
export interface ToolCall {
  type: 'function'
  /** Unique identifier for this call (used to match tool responses) */
  id?: string
  function: {
    name: string
    /** Arguments as JSON string or parsed object */
    arguments?: string | Record<string, any>
  }
}

/**
 * Controls how the model selects tools.
 */
export type ToolChoice =
  | 'auto'      // Model decides whether to call tools
  | 'none'      // Model must not call tools
  | 'required'  // Model must call at least one tool
  | { type: 'function'; function: { name: string } }  // Force a specific tool

// ─── Request ────────────────────────────────────────────────────────────────

/**
 * Unified AI request.
 *
 * Use `messages` for conversational scenarios (chat, multi-turn).
 * Use `input` for non-conversational scenarios (TTS, STT, embedding, drawing).
 * These two fields are mutually exclusive: provide one or the other, never both.
 */
export interface AIRequest {
  /**
   * Model identifier.
   * Format: "provider://model-name" (e.g., "openai://gpt-4o", "local://qwen-7b")
   * If no provider prefix, the router resolves via registered providers.
   */
  model: string

  // ── Input (mutually exclusive) ──

  /** Conversation messages (for chat/multi-turn scenarios) */
  messages?: Message[]
  /** Direct input (for non-conversational scenarios) */
  input?: string | ContentBlock[]

  // ── Tool calling (only meaningful with messages) ──

  tools?: ToolDefinition[]
  toolChoice?: ToolChoice

  // ── Output control ──

  /**
   * Whether to stream the response.
   * If true but provider doesn't support streaming, provider MUST throw
   * UNSUPPORTED_FEATURE error (no silent degradation).
   */
  stream?: boolean

  /**
   * Provider-specific options. Passed through transparently.
   * The protocol layer does not interpret these.
   * Examples: temperature, top_p, max_tokens, steps, voice, seed, etc.
   */
  options?: Record<string, any>

  /** Template format for message rendering. Default: 'jinja2' */
  templateFormat?: string

  /** Abort signal for cancellation */
  signal?: AbortSignal
}

// ─── Response ───────────────────────────────────────────────────────────────

/**
 * Reason why model generation stopped.
 * Standard reasons are listed; providers may extend with custom strings.
 */
export type FinishReason =
  | 'stop'            // Model generated natural stop sequence
  | 'length'          // Reached max_tokens limit
  | 'content_filter'  // Content filter triggered
  | 'tool_calls'      // Model is requesting tool calls
  | 'abort'           // User cancelled via AbortSignal
  | 'error'           // Generation error
  | (string & {})     // Provider extension

/**
 * Token/resource usage information.
 */
export interface UsageInfo {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  [key: string]: any  // Provider-specific usage metrics
}

/**
 * Non-streaming response.
 */
export interface AIResponse {
  /**
   * Generated content. String shorthand for single TextContent.
   * Receivers should normalize internally.
   */
  content: string | ContentBlock[]

  finishReason?: FinishReason
  usage?: UsageInfo

  /** Tool calls from assistant (chat mode) */
  toolCalls?: ToolCall[]

  /** Provider-specific response metadata */
  metadata?: Record<string, any>
}

/**
 * A single chunk in a streaming response.
 */
export interface AIResponseChunk {
  /** Content type of this chunk */
  type: string  // 'text' | 'thinking' | 'image' | 'audio' | ...

  // ── Text/thinking delta ──
  /** Incremental text content */
  delta?: string

  // ── Binary delta ──
  /** Incremental binary data (image/audio/video) */
  data?: ArrayBuffer

  // ── Image progressive rendering ──
  /** Current rendering step (e.g., diffusion step) */
  step?: number
  /** Total rendering steps */
  totalSteps?: number

  // ── Multi-output indexing ──
  /** Index for parallel outputs (e.g., n=3 generates 3 images) */
  index?: number

  // ── Final chunk carries summary ──
  /** Present only on the final chunk */
  finishReason?: FinishReason
  /** Present only on the final chunk */
  usage?: UsageInfo

  /** Tool calls (streamed incrementally in chat mode) */
  toolCalls?: ToolCall[]

  /** Provider extensions */
  [key: string]: any
}

// ─── Provider Interface ─────────────────────────────────────────────────────

/**
 * Model info returned by provider's listModels().
 */
export interface ModelInfo {
  /** Model identifier (used in AIRequest.model) */
  id: string
  name?: string
  description?: string
  capability: ModelCapability
  /** Provider-specific metadata */
  metadata?: Record<string, any>
}

/**
 * Unified AI Provider interface.
 *
 * Every provider (local or remote) implements this interface.
 * The single `invoke` method handles both streaming and non-streaming
 * via TypeScript overloads.
 */
export interface AIProvider {
  /** Unique provider identifier (used in URI scheme) */
  id: string
  /** Human-readable name */
  name: string

  /** Declare what this provider can do */
  capabilities(): ModelCapability[]

  /** List available models */
  listModels(): Promise<ModelInfo[]>

  /**
   * Invoke the model.
   *
   * When stream=true, returns AsyncIterable<AIResponseChunk>.
   * When stream=false (default), returns AIResponse.
   *
   * If stream=true but provider doesn't support it, MUST throw
   * AIError with code UNSUPPORTED_FEATURE (604).
   */
  invoke(request: AIRequest & { stream: true }): Promise<AsyncIterable<AIResponseChunk>>
  invoke(request: AIRequest & { stream?: false }): Promise<AIResponse>
  invoke(request: AIRequest): Promise<AIResponse | AsyncIterable<AIResponseChunk>>

  /** Optional lifecycle hooks */
  initialize?(config: ProviderConfig): Promise<void>
  dispose?(): Promise<void>
}

// ─── Provider Configuration ─────────────────────────────────────────────────

export type ProviderConfig = LocalProviderConfig | RemoteProviderConfig

export interface RemoteProviderConfig {
  type: 'remote'

  /**
   * Final service provider API URL.
   * This is the endpoint of the actual AI service (e.g., OpenAI API).
   */
  apiUrl: string

  /** Authentication key for the provider */
  apiKey?: string

  /** Custom HTTP headers or transport-level metadata */
  headers?: Record<string, string>

  /**
   * Transport-level URL for the provider connection.
   * Format: protocol://endpoint
   * Example: 'rpc+http://api.example.com/v1'
   * The protocol part (e.g., 'rpc+http') represents the transport implementation.
   */
  transport?: string | {
    protocol: string
    host: string
    port?: string
    username?: string
    password?: string
    pathname?: string
    search?: string
    hash?: string
    [key: string]: any
  }
}

export interface LocalProviderConfig {
  type: 'local'
  /** Which engine handles this provider */
  engine: string  // 'llama.cpp' | 'whisper.cpp' | 'stable-diffusion.cpp' | ...
  /** Path to model files */
  modelPath?: string
  /** Engine-specific options (gpuLayers, threads, etc.) */
  engineOptions?: Record<string, any>
}

// ─── Routing ────────────────────────────────────────────────────────────────

/**
 * Model name matching rule for local provider routing.
 * Supports string (glob), RegExp, or predicate function.
 */
export type ModelNameRule = string | RegExp | ((name: string) => boolean)

/**
 * Router resolves "provider://model" URIs to concrete providers.
 * For local providers, uses rules-based matching to select the correct engine.
 */
export interface AIRouter {
  /** Register a provider */
  register(provider: AIProvider, priority?: number): void

  /** Resolve a model identifier to a provider */
  resolve(model: string, requirement?: Partial<ModelCapability>): AIProvider

  /** Unified invoke (auto-routes to correct provider) */
  invoke(request: AIRequest): Promise<AIResponse | AsyncIterable<AIResponseChunk>>
}

// ─── Error Handling ─────────────────────────────────────────────────────────

/**
 * Standard error codes.
 * Codes 400-503 align with HTTP status codes.
 * Codes 600+ are AI-domain extensions.
 * Providers may define custom codes.
 */
export const AIErrorCodes = {
  // ── Aligned with HTTP ──
  BAD_REQUEST:                400,
  AUTH_FAILED:                401,
  PERMISSION_DENIED:          403,
  MODEL_NOT_FOUND:            404,
  TIMEOUT:                    408,
  CONFLICT:                   409,
  RATE_LIMITED:               429,
  CONTENT_FILTERED:           451,
  INTERNAL_ERROR:             500,
  NOT_IMPLEMENTED:            501,
  SERVICE_UNAVAILABLE:        503,

  // ── AI domain extensions (600+) ──
  MODEL_NOT_LOADED:           601,
  CONTEXT_LENGTH_EXCEEDED:    602,
  OUT_OF_MEMORY:              603,
  UNSUPPORTED_FEATURE:        604,
  UNSUPPORTED_MODALITY:       605,
  ENGINE_ERROR:               610,
  ABORTED:                    620,
} as const

export type AIErrorCode = typeof AIErrorCodes[keyof typeof AIErrorCodes] | number

/**
 * Standard AI error type.
 */
export interface AIError extends Error {
  /** Numeric error code (see AIErrorCodes) */
  code: AIErrorCode
  /** Original HTTP status (for remote providers) */
  status?: number
  /** Which provider threw this error */
  provider?: string
  /** Provider-specific error details */
  details?: any
  /** Whether the caller can retry this request */
  retryable?: boolean
}

// ─── Local Model Configuration ──────────────────────────────────────────────

/**
 * Thinking (CoT) configuration for a model variant.
 * The provider/engine parses raw model output using these patterns.
 */
export interface ThinkingConfig {
  /** Thinking mode: 'deep' = always think, 'off' = disabled */
  mode?: string
  /**
   * Tag pattern for identifying thinking content.
   * - string: single delimiter (e.g., "think\n")
   * - [string, string]: start/end tags (e.g., ["<think>", "</think>"])
   */
  thinkTag?: string | [string, string]
}

/**
 * A model version variant within a model family configuration.
 */
export interface ModelVersionConfig {
  /** Additional feature support for this variant */
  supports?: Record<string, any>[]
  /** Thinking configuration */
  shouldThink?: ThinkingConfig
  /** Prompt customizations */
  prompt?: Record<string, string>
}

/**
 * Model configuration file structure.
 *
 * Describes how a local engine should handle a model family.
 * Supports inheritance (extends), version variants, pattern-based
 * model file matching, per-variant parameters, and chat templates.
 *
 * Reference: Qwen.yaml, ChatML.yaml
 */
export interface LocalModelConfig {
  /** Unique identifier (e.g., 'Qwen', 'ChatML') */
  _id: string

  /** Parent config to inherit from (e.g., 'ChatML') */
  extends?: string

  /** Template format: 'hf' (HuggingFace/Jinja2), 'golang', etc. Default: 'jinja2' */
  templateFormat?: string

  /** Config type (e.g., 'system' for base templates) */
  type?: string

  /** Additional feature support declarations */
  supports?: string[]

  /**
   * Version variants keyed by variant name.
   * Each variant can override supports, thinking config, and prompts.
   */
  version?: Record<string, ModelVersionConfig>

  /** Prompt template variables */
  prompt?: Record<string, string>

  /** The chat template (Jinja2 or other format per templateFormat) */
  template?: string

  /**
   * Model file name matching patterns.
   * Maps variant name → RegExp pattern.
   * '@' key is the default/fallback pattern.
   * Patterns are evaluated in order; first match determines the variant.
   */
  modelPattern?: Record<string, RegExp | string>

  /**
   * Default parameters per variant.
   * Priority chain: request params > variant params > base params > engine defaults.
   */
  parameters?: Record<string, Record<string, any>>

  /** Capability declaration (if not inferred) */
  capability?: ModelCapability
}

// ─── Utility Functions ──────────────────────────────────────────────────────

/**
 * Normalize content to ContentBlock[].
 * Converts string shorthand to [{ type: 'text', text }].
 */
export function normalizeContent(content: string | ContentBlock[]): ContentBlock[] {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content } as TextContent]
  }
  return content
}

/**
 * Extract plain text from content.
 */
export function contentToText(content: string | ContentBlock[]): string {
  if (typeof content === 'string') return content
  return content
    .filter(b => b.type === 'text' || b.type === 'thinking')
    .map(b => (b as TextContent).text)
    .join('')
}
