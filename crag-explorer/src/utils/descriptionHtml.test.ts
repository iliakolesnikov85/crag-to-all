import { describe, expect, it } from 'vitest';
import {
  DESCRIPTION_HTML_MAX_LENGTH,
  isEmptyHtml,
  paragraphsToHtml,
  sectionHtmlToParagraphs,
} from './descriptionHtml';

describe('descriptionHtml', () => {
  it('wraps legacy fragments and keeps existing blocks', () => {
    expect(paragraphsToHtml(['<strong>Park</strong> at the lot.', 'Walk ten minutes.'])).toBe(
      '<p><strong>Park</strong> at the lot.</p><p>Walk ten minutes.</p>',
    );
    expect(paragraphsToHtml(['<p>Keep</p>', '<ul><li>Item</li></ul>'])).toBe(
      '<p>Keep</p><ul><li>Item</li></ul>',
    );
    expect(paragraphsToHtml(['  ', 'Left'])).toBe('<p>Left</p>');
  });

  it('stores the editor document as one paragraph', () => {
    expect(sectionHtmlToParagraphs('<p>One</p><ul><li>Two</li></ul>')).toEqual([
      '<p>One</p><ul><li>Two</li></ul>',
    ]);
    expect(isEmptyHtml('<br>')).toBe(true);
    expect(isEmptyHtml('<p></p>')).toBe(true);
    expect(isEmptyHtml('<p>Hi</p>')).toBe(false);
  });

  it('rejects empty contents and documents over the API limit', () => {
    expect(() => sectionHtmlToParagraphs('<p><br></p>')).toThrow(/Enter the section contents/);

    const exact = 'a'.repeat(DESCRIPTION_HTML_MAX_LENGTH);
    expect(sectionHtmlToParagraphs(exact)).toEqual([exact]);
    expect(() => sectionHtmlToParagraphs(`${exact}a`)).toThrow(/20000 characters or fewer/);
  });
});
