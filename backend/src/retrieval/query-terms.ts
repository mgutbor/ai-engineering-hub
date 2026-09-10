const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'be', 'been', 'being', 'but', 'by', 'can', 'could', 'did', 'do', 'does',
  'for', 'from', 'how', 'in', 'into', 'is', 'it', 'its', 'of', 'on', 'or', 'should', 'that', 'the',
  'their', 'there', 'these', 'this', 'to', 'was', 'what', 'when', 'which', 'why', 'with', 'would',
  'all', 'every', 'most', 'more', 'than', 'after', 'before', 'about', 'over', 'under', 'using',
  'application', 'platform', 'selected', 'selection', 'question', 'decision', 'related', 'parts',
  'appear', 'seems', 'seem', 'used', 'use', 'using', 'into', 'must', 'need', 'needs', 'many',
]);

export function extractSearchTerms(value: string): string[] {
  return [...new Set(value.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter((term) => term.length > 1 && !STOP_WORDS.has(term)))];
}

export function toFtsQuery(query: string): string {
  return extractSearchTerms(query)
    .map((term) => `"${term.replaceAll('"', '""')}"`)
    .join(' OR ');
}
