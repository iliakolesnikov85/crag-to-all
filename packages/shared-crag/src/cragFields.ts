import { isCountryCode } from './countries';

const CRAG_ID_MAX_LENGTH = 64;
const CRAG_NAME_MAX_LENGTH = 200;
const CRAG_EXTERNAL_ID_MAX_LENGTH = 128;
const CRAG_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const RESERVED_CRAG_IDS = new Set(['crag-manage']);

const CRAG_ID_REQUIRED_MESSAGE = 'id is required';
const CRAG_ID_INVALID_MESSAGE = 'id must be a lowercase slug (letters, digits, hyphens)';
const CRAG_ID_RESERVED_MESSAGE = 'id is reserved';
const CRAG_NAME_REQUIRED_MESSAGE = 'Name is required';
const CRAG_NAME_TOO_LONG_MESSAGE = `Name must be ${CRAG_NAME_MAX_LENGTH} characters or fewer.`;
const CRAG_EXTERNAL_ID_REQUIRED_MESSAGE = 'externalId is required when source is external';
const CRAG_EXTERNAL_ID_FORBIDDEN_MESSAGE = 'externalId is only allowed when source is external';
const CRAG_EXTERNAL_ID_TOO_LONG_MESSAGE =
  `externalId must be ${CRAG_EXTERNAL_ID_MAX_LENGTH} characters or fewer.`;
const CRAG_COUNTRY_REQUIRED_MESSAGE = 'Country is required';
const CRAG_COUNTRY_INVALID_MESSAGE = 'Country must be an ISO 3166-1 alpha-2 code';

type CragFieldCheck =
  | { ok: true; value: string }
  | { ok: false; error: string };

function validateCragId(value: string): CragFieldCheck {
  const id = value.trim();
  if (!id) return { ok: false, error: CRAG_ID_REQUIRED_MESSAGE };
  if (RESERVED_CRAG_IDS.has(id)) return { ok: false, error: CRAG_ID_RESERVED_MESSAGE };
  if (id.length > CRAG_ID_MAX_LENGTH || !CRAG_ID_PATTERN.test(id)) {
    return { ok: false, error: CRAG_ID_INVALID_MESSAGE };
  }
  return { ok: true, value: id };
}

function validateCragName(value: string): CragFieldCheck {
  const name = value.trim();
  if (!name) return { ok: false, error: CRAG_NAME_REQUIRED_MESSAGE };
  if (name.length > CRAG_NAME_MAX_LENGTH) {
    return { ok: false, error: CRAG_NAME_TOO_LONG_MESSAGE };
  }
  return { ok: true, value: name };
}

/** Checked only when the caller is creating an external crag. */
function validateCragExternalId(value: string): CragFieldCheck {
  const externalId = value.trim();
  if (!externalId) return { ok: false, error: CRAG_EXTERNAL_ID_REQUIRED_MESSAGE };
  if (externalId.length > CRAG_EXTERNAL_ID_MAX_LENGTH) {
    return { ok: false, error: CRAG_EXTERNAL_ID_TOO_LONG_MESSAGE };
  }
  return { ok: true, value: externalId };
}

function validateCragCountry(value: string): CragFieldCheck {
  const country = value.trim().toUpperCase();
  if (!country) return { ok: false, error: CRAG_COUNTRY_REQUIRED_MESSAGE };
  if (!isCountryCode(country)) return { ok: false, error: CRAG_COUNTRY_INVALID_MESSAGE };
  return { ok: true, value: country };
}

export {
  CRAG_EXTERNAL_ID_FORBIDDEN_MESSAGE,
  CRAG_EXTERNAL_ID_MAX_LENGTH,
  CRAG_EXTERNAL_ID_REQUIRED_MESSAGE,
  CRAG_ID_MAX_LENGTH,
  CRAG_NAME_MAX_LENGTH,
};

export type { CragFieldCheck };

export { validateCragCountry, validateCragExternalId, validateCragId, validateCragName };
