/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_S1_URL?: string
  readonly VITE_S2_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
