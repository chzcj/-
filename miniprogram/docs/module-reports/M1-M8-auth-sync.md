# 模块 M1 + M8：身份与数据同步

**状态**：P0/P1 已修复（2026-07-08）

## 范围

| Web | 小程序 |
|-----|--------|
| `postAuthRoute.ts` | `lib/postAuthRoute.ts` |
| `accountSync.ts` + `profileSync.ts` | `services/accountSync.ts` + `profileSync.ts` |
| `clearAllChildOSData` | `services/localStorageService.ts` |
| `profileHydrate.ts` | `services/profileHydrate.ts` |

## 审计发现（修复前）

| 维度 | 差距 |
|------|------|
| M1 登录 | 仅 `routeAfterAuth`，无 upload→clear→restore |
| M1 登出 | 只清 token，无 pre-sync、无本地 wipe |
| M8 换账号 | 上一用户 buildState/profile/daily 可泄漏 |
| M8 forceSync | 未上传 `/api/profile/built` 与 build-state |
| M8 冷启动 | 未 `hydrateProfileFromRemoteIfNeeded` |

## 已修复

| ID | 问题 | 文件 | 说明 |
|----|------|------|------|
| M1-01 | 登录无账号隔离 | `postAuthRoute.ts`, `login/index.tsx` | sync → clear → restore → hydrate → route |
| M1-02 | 登出无 pre-sync | `auth.ts`, `ProfileEditModals.tsx` | forceSync + logout + clearAll |
| M8-01 | clearAll 缺失 | `localStorageService.ts` | 清 childos* / yujian_*，保留 token |
| M8-02 | profileSync 缺失 | `profileSync.ts`, `accountSync.ts` | built + build-state 上传 |
| M8-03 | hydrate 不完整 | `profileHydrate.ts`, `app.ts` | 冷启动 + post-auth 回灌 |
| M8-04 | postAuth 未接 build-state | `postAuthRoute.ts` | hydrateBuildStateFromServer |

## 仍登记 P2

- account/state 全量 `childos.v1` 还原（MP 仍仅 child + dailyThread）
- `pagehide` 全局 sync（Web HiFiMainShell）
- entry_gate 换账号清理策略

## 回归

- [ ] 用户 A 建模 → 退出 → 用户 B 登录 → 不应看到 A 的 buildState/画像
- [ ] 用户 A 退出前应 sync 到服务端；B 登录后 restore 为 B 的数据
- [ ] 冷启动有 token → restore + hydrate → 正确 Tab/引导页
- [x] typecheck + build:weapp
