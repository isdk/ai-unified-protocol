
export const ui = {
  en: {
    sidebarTitle: "AI Unified Protocol",
    sidebarSubtitle: "Specification v1.0",
    sidebarFooter: "Protocol specification for unified AI model interaction across all modalities",
    copy: "Copy",
    copied: "✓ Copied",
    designDecisions: "Design Decisions",
    notes: "Notes",
    typeRefTitle: "Type Quick Reference",
    aliasMatrixTitle: "Model Type Alias Matrix",
    requestFlowTitle: "Visual: Request Routing Flow",
    errorTableTitle: "Complete Error Code Reference",
    footerTitle: "AI Unified Protocol Specification v1.0 — Draft",
    footerSubtitle: "All decisions confirmed through iterative design review",
    searchPlaceholder: "Search specification... (⌘K)",
    draftLabel: "Specification Draft",
    heroTitle: "AI Unified Protocol",
    heroDesc: "A comprehensive protocol for interacting with AI models across all modalities — text, image, audio, video, and embeddings — with a single, consistent interface for both local and remote providers.",
    heroTags: ['Text ↔ Text', 'Text → Image', 'Audio → Text', 'Text → Audio', 'Text → Video', 'Text → Embedding'],

    // Matrix
    matrixHeaders: { alias: "Alias", input: "Input", output: "Output", typicalFeatures: "Typical Features" },

    // Errors
    errorHeaders: { code: "Code", name: "Name", desc: "Description", origin: "Origin" },
    errorOrigin: { http: "HTTP", ai: "AI Extension" },

    // Diagram
    diagram: {
      requestFlow: "Request Flow",
      globalRouter: "Global Router",
      parseUri: "Parse URI scheme → resolve provider",
      remote: "Remote Provider",
      local: "Local Provider",
      rulesEngine: "Rules Engine",
      modelConfig: "Model Config Resolution",
      baseTemplate: "base template",
      extends: "extends",
      matchedBy: "matched by",
      invoke: "Invoke Engine with merged config + params"
    }
  },
  zh: {
    sidebarTitle: "AI 统一协议",
    sidebarSubtitle: "规范 v1.0",
    sidebarFooter: "用于跨所有模态统一 AI 模型交互的协议规范",
    copy: "复制",
    copied: "✓ 已复制",
    designDecisions: "设计决策",
    notes: "备注",
    typeRefTitle: "类型快速参考",
    aliasMatrixTitle: "模型类型别名矩阵",
    requestFlowTitle: "可视化：请求路由流程",
    errorTableTitle: "完整错误代码参考",
    footerTitle: "AI 统一协议规范 v1.0 — 草案",
    footerSubtitle: "所有决定均通过迭代设计审查确认",
    searchPlaceholder: "搜索规范... (⌘K)",
    draftLabel: "规范草案",
    heroTitle: "AI 统一协议",
    heroDesc: "一个用于跨所有模态（文本、图像、音频、视频和嵌入）与 AI 模型交互的综合协议——为本地和远程提供者提供单一、一致的接口。",
    heroTags: ['文本 ↔ 文本', '文本 → 图像', '音频 → 文本', '文本 → 音频', '文本 → 视频', '文本 → 嵌入'],

    // Matrix
    matrixHeaders: { alias: "别名", input: "输入", output: "输出", typicalFeatures: "典型特性" },

    // Errors
    errorHeaders: { code: "代码", name: "名称", desc: "描述", origin: "来源" },
    errorOrigin: { http: "HTTP", ai: "AI 扩展" },

    // Diagram
    diagram: {
      requestFlow: "请求流程",
      globalRouter: "全局路由器",
      parseUri: "解析 URI 方案 → 解析提供者",
      remote: "远程提供者",
      local: "本地提供者",
      rulesEngine: "规则引擎",
      modelConfig: "模型配置解析",
      baseTemplate: "基础模板",
      extends: "继承自",
      matchedBy: "匹配于",
      invoke: "使用合并后的配置+参数调用引擎"
    }
  }
}

export const typeIndexData = {
  en: [
    { name: 'Modality', section: 'modality-types', desc: 'Content type enumeration' },
    { name: 'Feature', section: 'modality-features', desc: 'Capability flags' },
    { name: 'ModelCapability', section: 'modality-capability', desc: 'Input/output/features declaration' },
    { name: 'ContentBlock', section: 'content-design', desc: 'Universal content container' },
    { name: 'Message', section: 'message-structure', desc: 'Conversation turn' },
    { name: 'ToolDefinition', section: 'message-tools', desc: 'Function schema for tool calling' },
    { name: 'ToolCall', section: 'message-tools', desc: 'Assistant tool invocation' },
    { name: 'AIRequest', section: 'request-structure', desc: 'Unified request type' },
    { name: 'AIResponse', section: 'response-structure', desc: 'Non-streaming response' },
    { name: 'AIResponseChunk', section: 'response-streaming', desc: 'Streaming chunk' },
    { name: 'AIProvider', section: 'provider-interface', desc: 'Provider interface' },
    { name: 'ProviderConfig', section: 'provider-config', desc: 'Provider configuration' },
    { name: 'AIRouter', section: 'routing-router', desc: 'Model routing interface' },
    { name: 'AIError', section: 'errors-type', desc: 'Standard error type' },
    { name: 'LocalModelConfig', section: 'model-config-structure', desc: 'Model configuration file' },
  ],
  zh: [
    { name: 'Modality', section: 'modality-types', desc: '模型内容类型枚举' },
    { name: 'Feature', section: 'modality-features', desc: '模型能力标志' },
    { name: 'ModelCapability', section: 'modality-capability', desc: '模型输入/输出/特性声明' },
    { name: 'ContentBlock', section: 'content-design', desc: '通用消息内容容器' },
    { name: 'Message', section: 'message-structure', desc: '消息' },
    { name: 'ToolDefinition', section: 'message-tools', desc: '工具调用的函数模式' },
    { name: 'ToolCall', section: 'message-tools', desc: '助手工具调用' },
    { name: 'AIRequest', section: 'request-structure', desc: '统一请求类型' },
    { name: 'AIResponse', section: 'response-structure', desc: '非流式响应' },
    { name: 'AIResponseChunk', section: 'response-streaming', desc: '流式块' },
    { name: 'AIProvider', section: 'provider-interface', desc: '提供者接口' },
    { name: 'ProviderConfig', section: 'provider-config', desc: '提供者配置' },
    { name: 'AIRouter', section: 'routing-router', desc: '模型路由接口' },
    { name: 'AIError', section: 'errors-type', desc: '标准错误类型' },
    { name: 'LocalModelConfig', section: 'model-config-structure', desc: '模型配置文件' },
  ]
}

export const errorCodesData = {
  en: [
    { code: 400, name: 'BAD_REQUEST', desc: 'Malformed request', http: true },
    { code: 401, name: 'AUTH_FAILED', desc: 'Authentication failure', http: true },
    { code: 403, name: 'PERMISSION_DENIED', desc: 'Insufficient permissions', http: true },
    { code: 404, name: 'MODEL_NOT_FOUND', desc: 'Model does not exist', http: true },
    { code: 408, name: 'TIMEOUT', desc: 'Request timed out', http: true },
    { code: 409, name: 'CONFLICT', desc: 'Resource conflict', http: true },
    { code: 429, name: 'RATE_LIMITED', desc: 'Too many requests', http: true },
    { code: 451, name: 'CONTENT_FILTERED', desc: 'Content moderation', http: true },
    { code: 500, name: 'INTERNAL_ERROR', desc: 'Provider internal error', http: true },
    { code: 501, name: 'NOT_IMPLEMENTED', desc: 'Feature not implemented', http: true },
    { code: 503, name: 'SERVICE_UNAVAILABLE', desc: 'Temporarily unavailable', http: true },
    { code: 601, name: 'MODEL_NOT_LOADED', desc: 'Model not in memory', http: false },
    { code: 602, name: 'CONTEXT_LENGTH_EXCEEDED', desc: 'Input exceeds context window', http: false },
    { code: 603, name: 'OUT_OF_MEMORY', desc: 'GPU/RAM exhausted', http: false },
    { code: 604, name: 'UNSUPPORTED_FEATURE', desc: 'Feature not supported', http: false },
    { code: 605, name: 'UNSUPPORTED_MODALITY', desc: 'Modality not supported', http: false },
    { code: 610, name: 'ENGINE_ERROR', desc: 'Inference engine failure', http: false },
    { code: 620, name: 'ABORTED', desc: 'User cancelled', http: false },
  ],
  zh: [
    { code: 400, name: 'BAD_REQUEST', desc: '请求格式错误', http: true },
    { code: 401, name: 'AUTH_FAILED', desc: '认证失败', http: true },
    { code: 403, name: 'PERMISSION_DENIED', desc: '权限不足', http: true },
    { code: 404, name: 'MODEL_NOT_FOUND', desc: '模型不存在', http: true },
    { code: 408, name: 'TIMEOUT', desc: '请求超时', http: true },
    { code: 409, name: 'CONFLICT', desc: '资源冲突', http: true },
    { code: 429, name: 'RATE_LIMITED', desc: '请求过多', http: true },
    { code: 451, name: 'CONTENT_FILTERED', desc: '内容审核', http: true },
    { code: 500, name: 'INTERNAL_ERROR', desc: '提供者内部错误', http: true },
    { code: 501, name: 'NOT_IMPLEMENTED', desc: '特性未实现', http: true },
    { code: 503, name: 'SERVICE_UNAVAILABLE', desc: '服务暂时不可用', http: true },
    { code: 601, name: 'MODEL_NOT_LOADED', desc: '模型未加载', http: false },
    { code: 602, name: 'CONTEXT_LENGTH_EXCEEDED', desc: '输入超过上下文窗口', http: false },
    { code: 603, name: 'OUT_OF_MEMORY', desc: '显存/内存耗尽', http: false },
    { code: 604, name: 'UNSUPPORTED_FEATURE', desc: '不支持的特性', http: false },
    { code: 605, name: 'UNSUPPORTED_MODALITY', desc: '不支持的模态', http: false },
    { code: 610, name: 'ENGINE_ERROR', desc: '推理引擎故障', http: false },
    { code: 620, name: 'ABORTED', desc: '用户取消', http: false },
  ]
}
