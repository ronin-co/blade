declare module 'bun' {
  interface Env {
    BLADE_ENV: 'production' | 'development';
  }
}
