import type { SpecSection, SpecSubsection } from './doc-types'

export function parseMarkdownDocs(markdown: string): SpecSection[] {
  const lines = markdown.split('\n')
  const sections: SpecSection[] = []

  let currentSection: SpecSection | null = null
  let currentSubsectionTitle = ''
  let currentSubsectionLines: string[] = []

  let inCodeBlock = false

  const finalizeSubsection = () => {
    if (currentSubsectionTitle) {
      // Create empty section if none
      if (!currentSection) {
        // This handles H2 before H1 (shouldn't happen but defensive)
        // Or we ignore? Let's just create a dummy one if needed or skip.
        // Actually, we should probably just accumulate H2 under previous H1.
        // If no H1 yet, then maybe skip?
        // But let's assume valid markdown structure.
      }

      const subsection = parseSubsection(currentSubsectionTitle, currentSubsectionLines)
      if (currentSection) {
        currentSection.subsections.push(subsection)
      }
    }
    // Reset
    currentSubsectionTitle = ''
    currentSubsectionLines = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Toggle code block
    // Opening fence: starts with ```
    // Closing fence: starts with ``` AND has no following text (except whitespace)
    if (trimmed.startsWith('```')) {
      if (!inCodeBlock) {
        // Opening fence
        inCodeBlock = true
      } else {
        // Closing fence: strictly ```
        // Regex: ^`{3,}\s*$
        if (/^`{3,}\s*$/.test(trimmed)) {
          inCodeBlock = false
        }
      }
    }

    // Process H1
    if (!inCodeBlock && line.startsWith('# ')) {
      finalizeSubsection()

      const headerContent = line.substring(2).trim()

      // Match Icon + Title
      const headerMatch = headerContent.match(/^([\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}])?\s*(.*)$/u)
      const icon = headerMatch ? (headerMatch[1] || '') : ''
      const title = headerMatch ? (headerMatch[2] || headerContent) : headerContent

      let id = title.toLowerCase().replace(/\s+/g, '-')

      // Lookahead for ID
      for (let j = 1; j <= 5 && i + j < lines.length; j++) {
        const nextLine = lines[i + j]
        // Stop if we hit structure
        if (nextLine.startsWith('# ') || nextLine.startsWith('## ') || nextLine.trim().startsWith('```')) break

        const idMatch = nextLine.match(/<!--\s*id:\s*([a-zA-Z0-9-_]+)\s*-->/)
        if (idMatch) {
          id = idMatch[1]
          break
        }
      }

      currentSection = {
        id,
        title,
        icon,
        subsections: []
      }
      sections.push(currentSection)

      // Reset subsection
      currentSubsectionTitle = ''
      currentSubsectionLines = []
      continue
    }

    // Process H2
    if (!inCodeBlock && line.startsWith('## ')) {
      finalizeSubsection()

      currentSubsectionTitle = line.substring(3).trim()
      currentSubsectionLines = []
      continue
    }

    // Subsection Content (or Section Content if top-level text)
    // We only collect if we have a subsection title?
    // The original logic collected everything under a subsection.
    if (currentSubsectionTitle) {
      currentSubsectionLines.push(line)
    }
  }

  finalizeSubsection()

  return sections
}

function parseSubsection(title: string, lines: string[]): SpecSubsection {
  let id = title.toLowerCase().replace(/\s+/g, '-')

  // Extract ID from lines
  let idLineIndex = -1
  for (let j = 0; j < Math.min(lines.length, 5); j++) {
    const match = lines[j].match(/<!--\s*id:\s*([a-zA-Z0-9-_]+)\s*-->/)
    if (match) {
      id = match[1]
      idLineIndex = j
      break
    }
  }

  const subLines = [...lines]
  if (idLineIndex !== -1) subLines.splice(idLineIndex, 1)

  const decisions: string[] = []
  const notes: string[] = []
  let code: string | undefined = undefined

  // Identify separators
  let decisionIdx = -1
  let noteIdx = -1

  const decisionRegex = /###\s*(决策|Decision)/i
  const noteRegex = /###\s*(备注|Notes?)/i

  decisionIdx = subLines.findIndex(l => decisionRegex.test(l.trim()))
  noteIdx = subLines.findIndex(l => noteRegex.test(l.trim()))

  const extractBlock = (raw: string[]) => {
    if (raw.length === 0) return []
    // Just join the lines to maintain full markdown structure
    // We return as a single index array to maintain compatibility with the UI mapper,
    // but the UI will render it as a single markdown block.
    const content = raw.join('\n').trim()
    return content ? [content] : []
  }

  // Extract Notes
  if (noteIdx !== -1) {
    let end = subLines.length
    if (decisionIdx > noteIdx) end = decisionIdx // Notes before Decisions

    notes.push(...extractBlock(subLines.slice(noteIdx + 1, end)))
    for (let k = noteIdx; k < end; k++) subLines[k] = ''
  }

  // Extract Decisions
  if (decisionIdx !== -1) {
    let end = subLines.length
    if (noteIdx > decisionIdx) end = noteIdx // Decisions before Notes

    decisions.push(...extractBlock(subLines.slice(decisionIdx + 1, end)))
    for (let k = decisionIdx; k < end; k++) subLines[k] = ''
  }

  let contentText = subLines.join('\n').trim()

  // Extract trailing code block
  // Note: This relies on the convention that the code block is at the end
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)\n```\s*$/
  const codeMatch = contentText.match(codeBlockRegex)

  if (codeMatch) {
    code = codeMatch[2] // content
    contentText = contentText.substring(0, codeMatch.index).trim()
  }

  return {
    id,
    title,
    content: contentText,
    code,
    decisions: decisions.length > 0 ? decisions : undefined,
    notes: notes.length > 0 ? notes : undefined
  }
}
