
import enMd from './docs/en.md?raw'
import zhMd from './docs/zh.md?raw'
import { parseMarkdownDocs } from './md-parser'
import type { SpecSection, SpecSubsection } from './doc-types'

export type { SpecSection, SpecSubsection }

export const specSectionsEn = parseMarkdownDocs(enMd)
export const specSectionsZh = parseMarkdownDocs(zhMd)

// Default export can be dynamic potentially, but for now strict export
export const specSections = specSectionsEn
