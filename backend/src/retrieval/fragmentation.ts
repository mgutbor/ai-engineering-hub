export interface TextFragment {
  readonly text: string;
  readonly paragraphIndex: number;
  readonly startOffset: number;
  readonly endOffset: number;
}

export function fragmentContent(content: string): TextFragment[] {
  const fragments: TextFragment[] = [];
  const paragraphPattern = /[^\n]+/g;
  let match: RegExpExecArray | null;
  let paragraphIndex = 0;

  while ((match = paragraphPattern.exec(content)) !== null) {
    const text = match[0];
    fragments.push({
      text,
      paragraphIndex,
      startOffset: match.index,
      endOffset: match.index + text.length,
    });
    paragraphIndex += 1;
  }

  return fragments;
}
