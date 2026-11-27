import { renderHomepageHeadTags } from '@crag-to-all/shared-crag';
import { fireEvent, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { createAppQueryClient } from '../api/queryClient';
import { ConfirmProvider } from '../context/ConfirmContext';

export function withQueryClient(children: ReactNode, client: QueryClient = createAppQueryClient()): ReactNode {
  return createElement(
    QueryClientProvider,
    { client },
    createElement(ConfirmProvider, null, children),
  );
}

export function chooseConfirm(title: string, action: string): void {
  const dialog = screen.getByRole('dialog', { name: title });
  fireEvent.click(within(dialog).getByRole('button', { name: action }));
}

export function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function okResponse(body: BodyInit = '', init: ResponseInit = {}): Response {
  return new Response(body, { status: 200, ...init });
}

interface PatchedHeadValues {
  title: string;
  description: string;
}

/**
 * Adds the head tags the deploy script writes into the live index.html, built
 * by the same renderer. Returns a cleanup that restores the head.
 */
export function insertPatchedHead({ title, description }: PatchedHeadValues): () => void {
  const originalHead = document.head.innerHTML;
  const originalTitle = document.title;
  const tags = renderHomepageHeadTags({
    title,
    description,
    heading: title,
    image: 'http://localhost/header-bg.png',
    jsonLd: [],
  });
  document.head.insertAdjacentHTML('beforeend', tags.join(' '));
  document.title = title;
  return () => {
    document.head.innerHTML = originalHead;
    document.title = originalTitle;
  };
}

export function headContent(selector: string): string | null | undefined {
  return document.head.querySelector(selector)?.getAttribute('content');
}

export function setNavigatorOnLine(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value,
  });
}
