# 📋 概览
<!-- id: overview -->

## 设计原则
<!-- id: overview-principles -->

本规范定义了一个统一的协议，用于通过所有模态（文本、图像、音频、视频和嵌入向量）与 AI 模型进行交互，无论模型是在本地运行还是通过远程 API 运行。

**核心洞察**：每个 AI 模型本质上都是一个 `输入 → 输出` 函数。模型类型（聊天、视觉、TTS、绘画等）之间的所有差异都可以归结为：
- 模型接受什么输入模态
- 模型产生什么输出模态
- 它支持什么额外特性（流式传输、多轮对话、工具调用等）

通过显式地对这三个维度进行建模，该协议消除了对每种类型单独接口的需求。

### 决策
- 所有模型类型共享相同的请求/响应协议
- 差异通过能力声明表达，而不是单独的接口
- 提供者特定的参数透明地传递——协议不解析它们
- 应用层关注点（角色扮演路由、UI 状态）被排除在协议层之外

## 架构分层
<!-- id: overview-layers -->

系统被组织成具有严格边界的清晰层级：

```text
┌──────────────────────────────────────────────┐
│             应用层 (Application)              │  角色扮演，对话管理
│    (toRole, replies, charId, private, etc.)  │  UI 状态
├──────────────────────────────────────────────┤
│             模板引擎 (Template)               │  ChatML 渲染，
│      (chat templates, caps detection)        │  Jinja2 模板
├──────────────────────────────────────────────┤
│             模型注册表 (Registry)              │  模型目录，技能，
│      (search, ratings, metadata)             │  评分，发现
├──────────────────────────────────────────────┤
│             模型管理器 (Manager)               │  文件下载，量化
│      (download, storage, sharding)           │  选择，分片管理
├──────────────────────────────────────────────┤
│           路由器 / 编排器 (Router)             │  URI 解析，提供者
│      (provider://model routing)              │  匹配，优先级
├──────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────────────┐    │
│  │   Local     │  │      Remote         │    │  提供者适配器
│  │  Provider   │  │     Provider        │    │
│  └──────┬──────┘  └─────────────────────┘    │
│     ┌───┴───┬──────────┐                     │
│     │llama  │whisper   │sd.cpp               │  本地引擎
│     │.cpp   │.cpp      │                     │
│     └───────┴──────────┘                     │
├──────────────────────────────────────────────┤
│          协议层 (Protocol Layer)              │  ContentBlock, Request,
│   Modality, Capability, Message, Error, ...  │  Response, Provider interface
└──────────────────────────────────────────────┘
```

# 🧩 模态与能力
<!-- id: modality -->

## 模态
<!-- id: modality-types -->

**模态 (Modality)** 代表可以流入或流出模型的内容类型。该协议定义了五种标准模态：

```typescript
type Modality = 'text' | 'image' | 'audio' | 'video' | 'embedding'
```

### 备注
- 模态描述数据的性质，而不是格式（例如，“image” 涵盖 PNG, JPEG, WebP 等）
- 随着生态系统的发展，可以添加新的模态（例如，“3d_model”, “midi”）

## 特性
<!-- id: modality-features -->

**特性 (Features)** 描述了除基本 I/O 之外的额外能力。它们声明为字符串标志：

```typescript
type Feature =
  | 'stream'          // 支持流式输出
  | 'multi_turn'      // 支持多轮对话
  | 'tool_use'        // 支持函数/工具调用
  | 'infill'          // 支持中间填充 (fill-in-the-middle)
  | 'system_prompt'   // 支持系统角色消息
  | 'thinking'        // 支持 CoT (思维链) 推理输出
  | 'json_mode'       // 支持结构化 JSON 输出
  | (string & {})     // 提供者可扩展
```

### 备注
- 特性是可扩展的——提供者可以引入自定义特性
- 特性描述模型**能**做什么，而不是它**必须**做什么

## 模型能力
<!-- id: modality-capability -->

模型的能力是其输入模态、输出模态和特性的组合：

```typescript
interface ModelCapability {
  input:    Modality[]   // 模型接受什么
  output:   Modality[]   // 模型产生什么
  features: Feature[]    // 额外能力
}
```

## 类型别名
<!-- id: modality-aliases -->

预定义的别名为常见模型类型提供了快捷方式。**别名仅约束模态**（输入/输出）。`typicalFeatures` 是信息性的默认值，**不**用于匹配。

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

// 匹配：模型能力必须是别名模态的超集
matchesAlias(gpt4o, 'chat')   // → true (text⊇text, text⊇text)
matchesAlias(gpt4o, 'vision') // → true (text+image⊇text+image)

// 特定特性的查询
matchesAlias(model, 'chat', { requireFeatures: ['multi_turn'] })
```

### 决策
- 仅支持补全的 text→text 模型 **是** "chat" 类型（匹配模态），但缺少 multi_turn 特性
- GPT-4o 同时匹配 "chat" 和 "vision" 别名（超集匹配）
- 应用层分别检查特性以确定 UI 展示

# 📦 内容块
<!-- id: content -->

## 设计
<!-- id: content-design -->

所有输入和输出数据都流经 **ContentBlock** —— 一个带有 `type` 判别式的标记联合体。`type` 字段是 `string`（不是枚举），以允许提供者扩展。

内容可以以两种形式出现：

- **字符串简写**: `"Hello world"` —— 视为 `[{ type: 'text', text: 'Hello world' }]`
- **ContentBlock 数组**: `[{ type: 'text', text: '...' }, { type: 'image', url: '...' }]`

接收者通过 `normalizeContent()` 在内部规范化字符串简写。

```typescript
type ContentBlock =
  | TextContent         // { type: 'text', text: string }
  | ThinkingContent     // { type: 'thinking', text: string }
  | ImageContent        // { type: 'image', data?: ..., url?: ... }
  | AudioContent        // { type: 'audio', data?: ..., url?: ... }
  | VideoContent        // { type: 'video', data?: ..., url?: ... }
  | EmbeddingContent    // { type: 'embedding', vector: number[] }
  | ContentBlockBase    // { type: string, ... } — 提供者扩展
```

### 决策
- type 是字符串，不是枚举——提供者可以自由扩展
- 数据可以是内联的 (base64/ArrayBuffer) 或引用的 (URL)
- 未知块类型应优雅处理（JSON 显示或跳过）

## 标准类型
<!-- id: content-standard -->

每种标准内容块类型都有定义的结构：

```typescript
// 文本 — 最常见的类型
interface TextContent {
  type: 'text'
  text: string
}

// 思考 — CoT 推理 (由提供者从原始输出中解析)
interface ThinkingContent {
  type: 'thinking'
  text: string
}

// 图像 — 内联数据或 URL 引用
interface ImageContent {
  type: 'image'
  data?: string | ArrayBuffer    // Base64 或二进制
  url?: string                   // URL 引用
  mimeType?: string              // 例如 'image/png'
  width?: number
  height?: number
}

// 音频
interface AudioContent {
  type: 'audio'
  data?: string | ArrayBuffer
  url?: string
  mimeType?: string
  duration?: number              // 秒
}

// 视频
interface VideoContent {
  type: 'video'
  data?: string | ArrayBuffer
  url?: string
  mimeType?: string
  duration?: number
}

// 嵌入向量
interface EmbeddingContent {
  type: 'embedding'
  vector: number[]
  dimensions?: number
}
```

## 思考内容
<!-- id: content-thinking -->

`thinking` 内容类型代表思维链 (CoT) 推理输出。不同的模型在原始输出中使用不同的标记模式。

**协议层**: 仅将 `thinking` 定义为标准 ContentBlock 类型。

**提供者/引擎层**: 负责解析原始模型输出并将思考与内容分离。思考标记模式在模型配置文件中配置：

```yaml
# 模型配置示例 (Qwen3)
shouldThink:
  thinkTag: ["<think>", "</think>"]

# DeepSeek-R1 使用相同的标签
shouldThink:
  thinkTag: ["<think>", "</think>"]

# Qwen-S1 使用不同的分隔符
shouldThink:
  mode: deep
  thinkTag: "think\\n"
  answerTag: "\\nanswer\\n"
```

### 备注
- 提供者使用状态机解析原始流：NORMAL → 遇到开始标签 → THINKING → 遇到结束标签 → NORMAL
- 在流式模式下，思考块使用 { type: "thinking", delta: "..." }，内容块使用 { type: "text", delta: "..." }
- 应用层只看到干净、分离的块——无需解析

# 💬 消息
<!-- id: message -->

## 消息结构
<!-- id: message-structure -->

**消息 (Message)** 代表对话中的单轮交互。协议层保持消息最小化——仅包含与模型交互和模板渲染相关的字段。

应用层字段 (`toRole`, `replies`, `private`, `charId`, `from`) 属于 `metadata` 桶。

```typescript
interface Message {
  // ── 模型交互 (顶层) ──
  role: ChatRole                   // 'user' | 'assistant' | 'system' | 'tool' | string
  content: string | ContentBlock[] // 字符串简写或结构化块
  name?: string                    // 显示名称 / 工具函数名称
  toolCalls?: ToolCall[]           // 助手的工具调用
  toolCallId?: string              // 将工具响应链接到其调用

  // ── 渲染控制 (顶层) ──
  templateFormat?: string          // 默认: 'jinja2'

  // ── 其他所有内容 (嵌套) ──
  metadata?: Record<string, any>   // 应用/UI/持久化的不透明桶
}

type ChatRole = 'user' | 'assistant' | 'system' | 'tool' | (string & {})
```

### 决策
- 模型交互字段位于顶层——每个提供者适配器直接读取它们
- metadata 是 Record<string, any> —— 不同层在不协调的情况下添加自己的键
- 在针对远程 API 调用进行序列化时，完全剥离 metadata
- templateFormat 属于协议层，因为模板渲染是一个横切关注点

## 工具调用
<!-- id: message-tools -->

工具调用遵循 OpenAI 约定，并进行了一些泛化：

```typescript
// 工具定义 (在请求中传递)
interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters?: Record<string, any>  // JSON Schema
    strict?: boolean
  }
}

// 工具调用 (在助手消息中)
interface ToolCall {
  type: 'function'
  id?: string                    // 唯一 ID 以匹配响应
  function: {
    name: string
    arguments?: string | Record<string, any>
  }
}

// 工具选择 (在请求中)
type ToolChoice =
  | 'auto'       // 模型决定
  | 'none'       // 禁用
  | 'required'   // 必须调用至少一个
  | { type: 'function', function: { name: string } }  // 强制特定
```

# 🔄 请求与响应
<!-- id: request -->

## AIRequest
<!-- id: request-structure -->

统一的请求类型服务于所有模型类型。它有两种互斥的输入模式：

- **`messages`**: 用于对话场景（聊天、多轮对话）
- **`input`**: 用于非对话场景（TTS, STT, 嵌入, 图像生成）

提供其中之一，绝不能同时提供。都不提供或都提供是验证错误。

```typescript
interface AIRequest {
  /**
   * 模型标识符。
   * 格式: "provider://model-name"
   * 示例: "openai://gpt-4o", "local://qwen-7b"
   */
  model: string

  // ── 输入 (互斥) ──
  messages?: Message[]                // 对话式
  input?: string | ContentBlock[]     // 非对话式

  // ── 工具调用 (仅对 messages 有意义) ──
  tools?: ToolDefinition[]
  toolChoice?: ToolChoice

  // ── 输出控制 ──
  stream?: boolean                    // 请求流式传输
  options?: Record<string, any>       // 提供者特定 (透明)
  templateFormat?: string             // 默认: 'jinja2'
  signal?: AbortSignal                // 取消
}
```

### 备注
- tools/toolChoice 在非对话 (input) 模式下被忽略
- options 是完全透明的——temperature, top_p, steps, voice, seed 等
- 如果 stream=true 但不支持，提供者**必须**抛出错误 (没有静默降级)

## 请求示例
<!-- id: request-examples -->

每种模型类型的具体示例：

```typescript
// ① 聊天 (多轮)
{
  model: 'openai://gpt-4o',
  messages: [
    { role: 'system', content: 'You are helpful.' },
    { role: 'user', content: 'Explain quantum entanglement.' }
  ],
  stream: true,
  options: { temperature: 0.7, max_tokens: 2048 }
}

// ② 视觉 (图像 + 文本 → 文本)
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

// ③ 嵌入 (文本 → 向量)
{
  model: 'local://bge-m3',
  input: 'Text to embed'
}

// ④ TTS (文本 → 音频)
{
  model: 'local://kokoro',
  input: 'Hello world, how are you today?',
  options: { voice: 'alloy', speed: 1.0 }
}

// ⑤ STT (音频 → 文本)
{
  model: 'local://whisper',
  input: [{ type: 'audio', data: audioBuffer }]
}

// ⑥ 图像生成 (文本 → 图像)
{
  model: 'local://stable-diffusion',
  input: 'A cat sitting on the moon, watercolor style',
  stream: true,  // 渐进式渲染
  options: { width: 1024, height: 1024, steps: 20, seed: 42 }
}

// ⑦ 图生图 (Image-to-Image)
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

非流式响应包含生成的内容、完成原因、使用统计和可选的工具调用：

```typescript
interface AIResponse {
  content: string | ContentBlock[]    // 生成的输出
  finishReason?: FinishReason         // 为什么生成停止
  usage?: UsageInfo                   // Token/资源使用
  toolCalls?: ToolCall[]              // 工具调用 (聊天模式)
  metadata?: Record<string, any>      // 提供者特定
}

type FinishReason =
  | 'stop'            // 自然停止
  | 'length'          // 达到 max_tokens
  | 'content_filter'  // 内容过滤
  | 'tool_calls'      // 请求工具调用
  | 'abort'           // 用户取消
  | 'error'           // 生成错误
  | (string & {})     // 提供者扩展

interface UsageInfo {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  [key: string]: any   // 提供者特定指标
}
```

## 流式传输
<!-- id: response-streaming -->

流式传输是一个**传输层关注点**。协议层仅声明意图 (`stream: true`) 和块格式。流式传输如何实现 (SSE, WebSocket, gRPC, 本地回调) 是提供者的决定。

**最后一个块**携带摘要信息 (finishReason, usage) —— 遵循 OpenAI 约定。

如果请求设置 `stream: true` 但提供者不支持流式传输，提供者**必须**抛出 `UNSUPPORTED_FEATURE` 错误 (代码 604)。不允许静默降级——调用者的代码是为流式传输构建的，在非流式响应上会中断。

```typescript
interface AIResponseChunk {
  type: string            // 'text' | 'thinking' | 'image' | 'audio' | ...

  // ── 文本/思考增量 ──
  delta?: string          // 增量文本

  // ── 二进制增量 ──
  data?: ArrayBuffer      // 二进制块 (图像/音频/视频)

  // ── 图像渐进式渲染 ──
  step?: number           // 当前扩散步数
  totalSteps?: number     // 总步数 (来自请求选项或模型默认)

  // ── 多输出 ──
  index?: number          // 并行输出索引 (n=3 → 0,1,2)

  // ── 仅最后一个块 ──
  finishReason?: FinishReason
  usage?: UsageInfo

  // ── 提供者扩展 ──
  toolCalls?: ToolCall[]
  [key: string]: any
}
```

# 🔌 提供者
<!-- id: provider -->

## 提供者接口
<!-- id: provider-interface -->

每个提供者——本地或远程——实现相同的接口。`invoke` 方法使用 TypeScript 重载来提供类型安全的流式传输：

```typescript
interface AIProvider {
  id: string       // 唯一 ID (用于 URI 方案)
  name: string     // 人类可读名称

  // 能力声明
  capabilities(): ModelCapability[]

  // 模型发现
  listModels(): Promise<ModelInfo[]>

  // 统一调用 — 单一入口点
  invoke(req: AIRequest & { stream: true }): Promise<AsyncIterable<AIResponseChunk>>
  invoke(req: AIRequest & { stream?: false }): Promise<AIResponse>
  invoke(req: AIRequest): Promise<AIResponse | AsyncIterable<AIResponseChunk>>

  // 可选生命周期
  initialize?(config: ProviderConfig): Promise<void>
  dispose?(): Promise<void>
}

interface ModelInfo {
  id: string                       // 模型标识符
  name?: string
  description?: string
  capability: ModelCapability      // 该模型能做什么
  metadata?: Record<string, any>   // 提供者特定
}
```

## 提供者配置
<!-- id: provider-config -->

本地和远程提供者的配置不同。两者共享相同的联合类型：

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
  engineOptions?: Record<string, any>  // 对协议透明
}
```

### 决策
- engineOptions 中的提供者特定选项是透明的——协议不解释它们
- 未知参数被提供者静默忽略
- 协议层没有白名单/黑名单强制执行

## 参数优先级
<!-- id: provider-params -->

对于本地提供者，参数通过优先级链解析。高优先级来源覆盖低优先级来源：

```typescript
请求参数 (Request params)          (最高优先级 — 用户的显式意图)
    ↓
模型配置: 变体 (Model config: variant)   (例如, parameters.qwen3.temperature)
    ↓
模型配置: 基础 (Model config: base)      (例如, parameters.qwen.temperature)
    ↓
引擎默认值 (Engine defaults)          (最低优先级)
```

### 备注
- 协议层不执行此合并——这是提供者/引擎的责任
- 此链确保用户意图始终获胜，在未指定时使用合理的默认值

# 🗺️ 路由
<!-- id: routing -->

## 基于 URI 的路由
<!-- id: routing-uri -->

模型标识符使用 URI 格式: `provider://model-name`。路由器解析方案以找到正确的提供者。

```typescript
// URI 格式
"openai://gpt-4o"           → OpenAI 提供者, 模型 "gpt-4o"
"anthropic://claude-3.5"    → Anthropic 提供者
"local://qwen-7b"           → 本地提供者, 然后是内部路由

// 如果没有方案，路由器通过注册的提供者解析
"gpt-4o"                    → 路由器搜索所有提供者
```

## 本地提供者路由
<!-- id: routing-local -->

本地提供者在内部执行二级路由。当请求到达本地提供者时，它将模型名称与注册的引擎规则匹配以选择正确的引擎：

```text
Global Router
  │
  ├── "openai://gpt-4o"  → OpenAI Provider (直接 API 调用)
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

## 模型名称规则
<!-- id: routing-rules -->

模型名称规则支持三种匹配模式：

```typescript
type ModelNameRule = string | RegExp | ((name: string) => boolean)

// 字符串 (精确或 glob)
"qwen-7b"

// RegExp (实践中最常见)
/(?:^|[-_.])(?:code)?(qwen|qwq)(?:\\d+(?:[.]\\d+)?)?(?:$|[-_.])/i

// 谓词函数
(name) => name.includes('stable-diffusion')
```

### 备注
- 在模型配置文件中，模式使用 !re YAML 标记表示 RegExp: !re /pattern/flags
- modelPattern 中的 "@" 键用作默认/回退规则
- 模式按顺序评估；第一个匹配获胜

## 路由器接口
<!-- id: routing-router -->

路由器提供集中的模型解析和调用：

```typescript
interface AIRouter {
  // 注册具有可选优先级的提供者
  register(provider: AIProvider, priority?: number): void

  // 将模型标识符解析为提供者
  resolve(model: string, requirement?: Partial<ModelCapability>): AIProvider

  // 统一调用 (自动路由到正确的提供者)
  invoke(request: AIRequest): Promise<AIResponse | AsyncIterable<AIResponseChunk>>
}
```

# ⚠️ 错误处理
<!-- id: errors -->

## 错误代码
<!-- id: errors-codes -->

错误代码在适用时与 HTTP 状态代码对齐。AI 领域扩展从 600+ 开始，以避免冲突。

```typescript
const AIErrorCodes = {
  // ── 与 HTTP 状态代码对齐 ──
  BAD_REQUEST:              400,  // 格式错误的请求
  AUTH_FAILED:              401,  // 认证失败
  PERMISSION_DENIED:        403,  // 权限不足
  MODEL_NOT_FOUND:          404,  // 模型不存在
  TIMEOUT:                  408,  // 请求超时
  CONFLICT:                 409,  // 资源冲突 (例如, 模型加载)
  RATE_LIMITED:              429,  // 请求过多
  CONTENT_FILTERED:         451,  // 触发内容审核
  INTERNAL_ERROR:           500,  // 提供者内部错误
  NOT_IMPLEMENTED:          501,  // 特性未实现
  SERVICE_UNAVAILABLE:      503,  // 服务暂时不可用

  // ── AI 领域扩展 (600+) ──
  MODEL_NOT_LOADED:         601,  // 模型不在内存中
  CONTEXT_LENGTH_EXCEEDED:  602,  // 输入超过上下文窗口
  OUT_OF_MEMORY:            603,  // GPU/RAM 耗尽
  UNSUPPORTED_FEATURE:      604,  // 请求的特性不支持
  UNSUPPORTED_MODALITY:     605,  // 请求的模态不支持
  ENGINE_ERROR:             610,  // 推理引擎故障
  ABORTED:                  620,  // 用户通过 AbortSignal 取消
}
```

### 决策
- 代码 400-503 重用 HTTP 语义——开发人员可以立即识别它们
- 代码 600+ 是 AI 特定的扩展
- 远程提供者将原始 HTTP 状态映射到 status 字段，将统一代码映射到 code 字段
- 提供者可以使用自定义代码 (700+); 未知代码被调用者视为 INTERNAL_ERROR

## AIError 类型
<!-- id: errors-type -->

标准错误类型扩展了 JavaScript Error：

```typescript
interface AIError extends Error {
  code: number           // AIErrorCodes 值或自定义
  status?: number        // 原始 HTTP 状态 (远程提供者)
  provider?: string      // 哪个提供者抛出了此错误
  details?: any          // 提供者特定的错误详情
  retryable?: boolean    // 调用者是否可以重试
}

// 用法:
try {
  const response = await provider.invoke(request)
} catch (err) {
  const aiErr = err as AIError
  if (aiErr.retryable) {
    // 带退避重试
  }
  switch (aiErr.code) {
    case 429: // 速率限制
      await delay(aiErr.details?.retryAfter ?? 1000)
      break
    case 604: // 不支持的特性
      // 回退到非流式
      break
    case 603: // 内存不足
      // 建议更小的模型
      break
  }
}
```

# ⚙️ 模型配置
<!-- id: model-config -->

## 配置结构
<!-- id: model-config-structure -->

本地模型使用 YAML 配置文件，描述引擎应如何处理模型系列。配置支持继承、版本变体、基于正则表达式的模型文件匹配、版本变体参数和聊天模板。

```typescript
interface LocalModelConfig {
  _id: string                       // 唯一 ID: 'Qwen', 'ChatML'
  extends?: string                  // 继承自父配置
  templateFormat?: string           // 'hf' | 'jinja2' | 'golang'
  type?: string                     // 'system' 用于基础模板
  supports?: string[]               // 特性声明

  version?: Record<string, {        // 版本变体覆盖
    supports?: Record<string, any>[]
    shouldThink?: ThinkingConfig
    prompt?: Record<string, string>
  }>

  prompt?: Record<string, string>   // 模板变量
  template?: string                 // 聊天模板 (Jinja2)

  modelPattern?: Record<string, RegExp | string>
  // 映射变体名称 → regex
  // '@' = 默认回退

  parameters?: Record<string, Record<string, any>>
  // 每变体默认参数

  capability?: ModelCapability      // 如果未推断出
}
```

## 继承
<!-- id: model-config-inheritance -->

配置可以扩展父级，继承所有字段并选择性覆盖：

```yaml
# ChatML.yaml — 基础模板
_id: ChatML
templateFormat: hf
type: system
prompt:
  bot_token: '<|im_start|>'
  eot_token: '<|im_end|>'
template: |-
  {% for message in messages %}
    ...标准 ChatML 格式...
  {% endfor %}
modelPattern:
  '@': !re /(?:^|[-_.])(?:code)?(yi|MiniCPM|smollm)(?:\\d+)?(?:$|[-_.])/i

# Qwen.yaml — 扩展 ChatML
_id: Qwen
extends: ChatML           # ← 继承模板, prompt, templateFormat
supports:
  - 'tools'               # ← 添加工具支持
version:                   # ← 添加版本变体
  qwen3:
    supports:
      - thinkMode: ['deep', 'off']
    shouldThink:
      thinkTag: ["<think>", "</think>"]
template: |-              # ← 使用工具感知版本覆盖模板
  ...Qwen 特定模板与 tool_call 处理...
modelPattern:             # ← 自己的模式 (不继承父模式)
  qwen3: !re /(?:^|[-_.])(?:code)?(qwen3)(?:\\d+)?(?:$|[-_.])/i
  qwq: !re /(?:^|[-_.])(?:code)?(qwq)(?:\\d+)?(?:$|[-_.])/i
  '@': !re /(?:^|[-_.])(?:code)?(qwen|qwq)(?:\\d+)?(?:$|[-_.])/i
```

### 决策
- extends 创建原型链——子级继承所有父级字段
- 子级字段在顶层覆盖父级字段
- modelPattern **不**合并——子级完全替换父级模式
- 版本变体**不**继承——每个配置定义自己的

## 模型匹配流程
<!-- id: model-config-matching -->

加载模型文件时，引擎通过多步过程解析其配置：

```text
输入: 模型文件名 "Qwen3-8B-Q4_K_M.gguf"

步骤 1: 查找匹配配置
  → 迭代所有配置的 modelPattern.'@' (默认规则)
  → "Qwen" 配置匹配，通过 /(?:^|[-_.])(?:code)?(qwen)/i

步骤 2: 解析继承
  → Qwen 扩展 ChatML
  → 合并: ChatML 字段 ← Qwen 覆盖

步骤 3: 查找版本变体
  → 迭代 Qwen 的 modelPattern (非 @ 条目)
  → "qwen3" 模式匹配: /(?:^|[-_.])(?:code)?(qwen3)/i
  → 选定变体: "qwen3"

步骤 4: 应用变体配置
  → version.qwen3.shouldThink → thinkTag: ["<think>", "</think>"]
  → version.qwen3.supports → thinkMode: ['deep', 'off']

步骤 5: 解析参数
  → parameters.qwen3 → { temperature: 0.5, top_p: 0.9 }
  → 这些成为默认值 (被请求参数覆盖)

结果:
  Config  = 合并的 ChatML + Qwen 基础
  Variant = "qwen3"
  Think   = { thinkTag: ["<think>", "</think>"] }
  Params  = { temperature: 0.5, top_p: 0.9 }
```

## 思考配置
<!-- id: model-config-thinking -->

思考 (CoT) 配置在模型系列之间差异很大。配置结构适应这些变化：

```typescript
interface ThinkingConfig {
  mode?: string        // 'deep' | 'off' — 默认行为
  thinkTag?:
    | string           // 单个分隔符 (例如, "think\\n")
    | [string, string] // 开始/结束对 (例如, ["<think>", "</think>"])
}

# 来自真实配置的示例:

# Qwen3 — 支持开启/关闭思考
version:
  qwen3:
    supports:
      - thinkMode: ['deep', 'off']   # 用户可以启用/禁用
    shouldThink:
      thinkTag: ["<think>", "</think>"]
    prompt:
      blankThink: "\\n<think>\\n\\n</think>"  # 注入以抑制思考

# Qwen-S1 — 始终开启思考，使用不同分隔符
version:
  s1:
    supports:
      - thinkMode: ['deep']          # 始终思考
    shouldThink:
      mode: deep
      thinkTag: "think\\n"           # 单一分隔符风格
      answerTag: "\\nanswer\\n"

# QwQ — 始终开启思考
version:
  qwq:
    supports:
      - thinkMode: ['deep']
    shouldThink:
      mode: deep
      thinkTag: ["<think>", "</think>"]
```

### 备注
- 引擎使用 thinkTag 构建用于流解析的状态机
- 当 mode=off 时，blankThink 被注入到 prompt 中以抑制思考
- assistant_suffix 自定义 (例如, "\\n<think>") 强制开始思考
- 远程提供者 (Claude, OpenAI) 在内部处理思考——无需配置

# 🔧 工具集
<!-- id: utilities -->

## 内容标准化
<!-- id: utilities-normalize -->

用于处理 `string | ContentBlock[]` 联合体的辅助函数：

```typescript
/**
 * 将内容规范化为 ContentBlock[]。
 * 将字符串简写转换为 [{ type: 'text', text }]。
 */
function normalizeContent(content: string | ContentBlock[]): ContentBlock[] {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }]
  }
  return content
}

/**
 * 从内容中提取纯文本。
 */
function contentToText(content: string | ContentBlock[]): string {
  if (typeof content === 'string') return content
  return content
    .filter(b => b.type === 'text' || b.type === 'thinking')
    .map(b => b.text)
    .join('')
}

/**
 * 内容块的快速构造函数。
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

## 别名工具
<!-- id: utilities-alias -->

用于处理模型类型别名的函数：

```typescript
/**
 * 从别名名称创建 ModelCapability。
 */
function fromAlias(alias: string): ModelCapability | undefined

/**
 * 检查能力是否匹配别名。
 * 匹配：模型模态 ⊇ 别名模态。
 * 除非指定了 requireFeatures，否则不检查特性。
 */
function matchesAlias(
  capability: ModelCapability,
  alias: string,
  options?: { requireFeatures?: Feature[] }
): boolean

// 示例:
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
