const BLOCK_HTML = /^<(p|ul|ol|div|blockquote|h[1-6])\b/i;

export const DESCRIPTION_NAME_MAX_LENGTH = 200;

/** Matches the description paragraph limit in crag-api. */
export const DESCRIPTION_HTML_MAX_LENGTH = 20_000;

function visibleText(html: string): string {
  const root = document.createElement('div');
  root.innerHTML = html;
  return (root.textContent ?? '').replace(/\u00a0/g, ' ').trim();
}

export function isEmptyHtml(html: string): boolean {
  return visibleText(html).length === 0;
}

/** Join stored paragraphs into one HTML document for the editor and the page. */
export function paragraphsToHtml(paragraphs: string[]): string {
  return paragraphs
    .map((paragraph) => {
      const trimmed = paragraph.trim();
      if (!trimmed) return '';
      if (BLOCK_HTML.test(trimmed)) return trimmed;
      return `<p>${trimmed}</p>`;
    })
    .filter((paragraph) => paragraph.length > 0)
    .join('');
}

/** Store one editor HTML string as the section's only paragraph. */
export function sectionHtmlToParagraphs(html: string): string[] {
  const trimmed = html.trim();
  if (isEmptyHtml(trimmed)) {
    throw new Error('Enter the section contents.');
  }
  if (trimmed.length > DESCRIPTION_HTML_MAX_LENGTH) {
    throw new Error(
      `Section contents must be ${DESCRIPTION_HTML_MAX_LENGTH} characters or fewer.`,
    );
  }
  return [trimmed];
}
