import { isCountryCode } from '@crag-to-all/shared-crag';

/** SVG flags from flag-icons (MIT). Files live in public/flags and are not precached. */
function countryFlagUrl(code: string): string | undefined {
  if (!isCountryCode(code)) return undefined;
  const file = `flags/${code.trim().toLowerCase()}.svg`;
  return `${import.meta.env.BASE_URL}${file}`.replace(/\/{2,}/g, '/');
}

export { countryFlagUrl };
