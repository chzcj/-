/** PORTRAIT_V3 feature flag — 默认关，双路径对称验收 */

export function isPortraitV3Enabled(): boolean {
  const v = (process.env.PORTRAIT_V3 || '0').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'on'
}
