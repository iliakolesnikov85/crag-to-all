import { GoogleAuth } from 'google-auth-library';
import { publishIndexHtml } from './hosting';
import { patchHomepageSeo } from './patch';

const SITE_ID = 'crags-for-all';
const DEFAULT_ORIGIN = 'https://crags-for-all.web.app';
const HOSTING_SCOPE = 'https://www.googleapis.com/auth/firebase.hosting';

function requireEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  if (value) return value;
  console.error(`Set ${name}.`);
  process.exitCode = 1;
  return undefined;
}

async function accessToken(): Promise<string> {
  const auth = new GoogleAuth({ scopes: [HOSTING_SCOPE] });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error('Hosting auth did not return an access token');
  return token.token;
}

async function main(): Promise<void> {
  const apiBaseUrl = requireEnv('API_BASE_URL');
  const credentials = requireEnv('GOOGLE_APPLICATION_CREDENTIALS');
  if (!apiBaseUrl || !credentials) return;
  const siteOrigin = process.env.SITE_ORIGIN?.trim() || DEFAULT_ORIGIN;

  try {
    const result = await patchHomepageSeo({
      siteOrigin,
      apiBaseUrl,
      publish: (html) => publishIndexHtml({
        siteId: SITE_ID,
        html,
        getAccessToken: accessToken,
      }),
    });
    if (result.published) {
      console.log('Published homepage SEO.');
      return;
    }
    console.log('Homepage SEO is unchanged. Skipped the upload.');
  } catch (error) {
    console.error('Homepage SEO patch failed:', error);
    process.exitCode = 1;
  }
}

void main();
