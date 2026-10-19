export const DEFAULT_EXPRESS_TAGS: string[] = [
  'Chef-d’œuvre',
  'Twist marquant',
  'Excellente stratégie',
  'Très touchant',
  'Bande-son mémorable',
  'Jeu d’acteurs',
  'Bonne ambiance',
  'Un peu long',
  'Fin frustrante',
  'Absurde / Excessif',
  'Peu d’attache émotionnelle'
];

/**
 * Retrieves the custom tags from localStorage, with fallback to default tags.
 */
export function getExpressTags(): string[] {
  const saved = localStorage.getItem('bq_watch_express_tags');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {}
  }
  return [...DEFAULT_EXPRESS_TAGS];
}

/**
 * Saves the custom tags array to localStorage.
 */
export function setExpressTags(tags: string[]): void {
  localStorage.setItem('bq_watch_express_tags', JSON.stringify(tags));
}
