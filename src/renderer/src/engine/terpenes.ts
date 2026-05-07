/**
 * Terpene boiling point data for the Cannabis Chemistry Calculator.
 * Pure data -- zero UI imports.
 *
 * All boiling points verified against Eyal et al. (2023):
 * Eyal, B., et al. "Terpenes in Cannabis: Chemistry, Biosynthesis, and Volatility."
 * Cannabis and Cannabinoid Research, 2023.
 * DOI: 10.1089/can.2021.0173
 */

export interface TerpeneData {
  /** Terpene name (text-only, no symbols) */
  name: string
  /** Boiling point in degrees Celsius */
  boilingPointC: number
  /** Short descriptive note */
  notes?: string
  /** Primary citation */
  citation: string
}

/**
 * Major cannabis terpenes with verified boiling points.
 *
 * Sources:
 * - Eyal et al. (2023). Cannabis and Cannabinoid Research.
 *   DOI: 10.1089/can.2021.0173
 */
export const TERPENES: readonly TerpeneData[] = [
  {
    name: 'Myrcene',
    boilingPointC: 168,
    notes:
      'Earthy, musky aroma; one of the most abundant terpenes in cannabis.',
    citation: 'Eyal et al. (2023)',
  },
  {
    name: 'Limonene',
    boilingPointC: 176,
    notes: 'Citrus aroma; associated with mood elevation and stress relief.',
    citation: 'Eyal et al. (2023)',
  },
  {
    name: 'alpha-Pinene',
    boilingPointC: 156,
    notes:
      'Pine-like aroma; one of the most widely distributed terpenes in nature.',
    citation: 'Eyal et al. (2023)',
  },
  {
    name: 'Linalool',
    boilingPointC: 198,
    notes: 'Floral, lavender-like aroma; known for calming properties.',
    citation: 'Eyal et al. (2023)',
  },
  {
    name: 'beta-Caryophyllene',
    boilingPointC: 262,
    notes:
      'Spicy, peppery aroma; unique among terpenes for binding to CB2 receptors.',
    citation: 'Eyal et al. (2023)',
  },
] as const
