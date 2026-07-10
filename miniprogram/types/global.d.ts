export {}

declare global {
  const defineAppConfig: (config: Record<string, unknown>) => Record<string, unknown>
  const definePageConfig: (config: Record<string, unknown>) => Record<string, unknown>
}

declare module '*.png' {
  const src: string
  export default src
}

declare module '*.jpg' {
  const src: string
  export default src
}
