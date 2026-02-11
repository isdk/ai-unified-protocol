
export interface SpecSubsection {
  id: string
  title: string
  content: string
  code?: string
  notes?: string[]
  decisions?: string[]
}

export interface SpecSection {
  id: string
  title: string
  icon: string
  subsections: SpecSubsection[]
}
