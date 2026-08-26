export type EmbedKind = 'instagram' | 'youtube' | 'default';

/** Classify a video URL so iframe sizing can match the host. */
export function getEmbedKind(url: string): EmbedKind {
  const lower = url.toLowerCase();
  if (lower.includes('instagram')) return 'instagram';
  if (lower.includes('youtube')) return 'youtube';
  return 'default';
}
