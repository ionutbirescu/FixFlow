// The same keyword rules as MockAiReportService in contracts/, so the mock API and S2's `mock` profile agree.
import type { AiReportResult, Severity } from '../api/types'

export const FAIL_TRIGGER = '#fail'

interface Rule {
  severity: Severity
  daysToService: number
  keywords: string[]
  summary: string
  recommendations: string[]
}

const RULES: Rule[] = [
  {
    severity: 'CRITICAL',
    daysToService: 1,
    keywords: ['fire', 'smoke', 'spark', 'burn'],
    summary: 'Signs of fire or electrical damage. Stop the machine immediately.',
    recommendations: [
      'Stop the machine and isolate power',
      'Inspect wiring and motor windings',
      'Do not restart before an electrician signs off',
    ],
  },
  {
    severity: 'HIGH',
    daysToService: 7,
    keywords: ['leak', 'overheat', 'crack', 'broken'],
    summary: 'Component failure likely soon.',
    recommendations: ['Schedule repair within the week', 'Check fluid levels and seals', 'Reduce load until repaired'],
  },
  {
    severity: 'MEDIUM',
    daysToService: 30,
    keywords: ['noise', 'vibration', 'wear', 'loose'],
    summary: 'Early signs of mechanical wear.',
    recommendations: ['Tighten fasteners and check alignment', 'Lubricate moving parts'],
  },
]

const LOW: Rule = {
  severity: 'LOW',
  daysToService: 90,
  keywords: [],
  summary: 'No significant issue visible.',
  recommendations: ['Continue regular maintenance'],
}

export type AiOutcome = { status: 'DONE'; aiReport: AiReportResult } | { status: 'FAILED'; error: string }

/** What the fake AI says about a report finished at `at`. */
export function mockAi(description: string, imageId: string, at: Date): AiOutcome {
  const original = description.trim()
  const text = original.toLowerCase()
  if (text.includes(FAIL_TRIGGER)) {
    return { status: 'FAILED', error: `Mock AI failure requested with ${FAIL_TRIGGER} in the description` }
  }
  const rule = RULES.find((candidate) => candidate.keywords.some((keyword) => text.includes(keyword))) ?? LOW
  const next = new Date(at)
  next.setUTCDate(next.getUTCDate() + rule.daysToService)
  return {
    status: 'DONE',
    aiReport: {
      id_image: imageId,
      report: `[mock] ${rule.summary} Reported: "${original}"`,
      severity: rule.severity,
      recommendations: [...rule.recommendations],
      nextServiceDate: next.toISOString().slice(0, 10),
    },
  }
}
