import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { HEAD_DESCRIPTION_SELECTORS, HEAD_TITLE_SELECTORS } from '@crag-to-all/shared-crag';
import { siteOrigin } from '../utils/siteUrl';

export interface PageHead {
  title: string;
  description: string;
}

function setContent(selectors: readonly string[], value: string): void {
  for (const selector of selectors) {
    document.head.querySelector(selector)?.setAttribute('content', value);
  }
}

/** The shell has no canonical link, because it is served for every path. */
function setCanonical(url: string): void {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = url;
}

/**
 * Writes the page title and description into the head, and points the
 * canonical link at the current path. Share-preview tags are rewritten only
 * where the patched shell already has them: the plain dev shell has the title
 * and description.
 */
export function usePageHead({ title, description }: PageHead): void {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = title;
    setContent(HEAD_TITLE_SELECTORS, title);
    setContent(HEAD_DESCRIPTION_SELECTORS, description);
    setCanonical(`${siteOrigin()}${pathname}`);
  }, [title, description, pathname]);
}
