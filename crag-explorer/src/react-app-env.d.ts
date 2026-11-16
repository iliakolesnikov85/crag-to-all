/// <reference types="react-scripts" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_DEV_LOCAL?: string
  readonly VITE_FIREBASE_STORAGE_BUCKET_v2?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
