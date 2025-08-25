// Content parsing helpers extracted from library page.
// Converts concatenated markdown with section delimiters into structured sections.

export type ParsedSection = {
  title: string;
  url: string;
  content: string;
};

/**
 * Split full document content into sections.
 * Sections are separated by "\n\n---\n\n" and each section begins with lines:
 * ## <Title>\nURL: <original url>\n(blank line) ...content
 */
export function parseContentToSections(content: string): ParsedSection[] {
  if (!content) return [];
  return content.split('\n\n---\n\n').map(sectionText => {
    const lines = sectionText.split('\n');
    const titleMatch = lines[0]?.match(/^## (.*)/);
    const title = titleMatch ? titleMatch[1] : 'Content';
    const urlMatch = lines[1]?.match(/^URL: (.*)/);
    const url = urlMatch ? urlMatch[1] : '';
    const sectionContent = lines.slice(3).join('\n');
    return { title, url, content: sectionContent } as ParsedSection;
  });
}
