# Web → 小程序组件对照表

状态说明：`done` 仅结构映射 · `parity-audit` 待感知验收 · `parity-verified` 已通过 PORTING-SELF-CHECK P0

| Web 组件 | 小程序路径 | 状态 |
|----------|-----------|------|
| `hifi-app.css` tokens | `src/styles/tokens.scss` + `hifi-base.scss` | parity-verified |
| `hifi-build.css` | `src/styles/hifi-build.scss` | parity-audit |
| `HiFiMainShell` | `src/components/hifi/HiFiMainShell` | parity-verified |
| `HiFiBottomNav` | `src/custom-tab-bar/` | parity-audit |
| `HiFiInputZone` | `src/components/hifi/HiFiInputZone` | parity-audit |
| `HiFiMascot` | `src/components/hifi/HiFiMascot` | done |
| Button/Card/Input/Tag/Modal/Loading | `src/components/ui/index.tsx` | done |
| `DailyParentBubble` | `src/components/daily/DailyParentBubble.tsx` | parity-verified |
| `DailyAiMessage` | `src/components/daily/DailyAiMessage.tsx` | parity-verified |
| `DailyThinkingPanel` | `src/components/daily/DailyThinkingPanel.tsx` | done |
| `DailySectionView` | `src/components/daily/DailySectionView.tsx` | parity-verified |
| `DailyDeepExpandCard` | `src/components/daily/DailyDeepExpandCard.tsx` | parity-verified |
| `VoiceOverlay` | `src/components/voice/VoiceOverlay.tsx` | parity-verified |
| `HiFiBuildShell` | `src/components/profile/HiFiBuildShell` | parity-verified |
| `BuildRecordBox` | `src/components/profile/BuildRecordBox.tsx` | parity-audit |
| `FollowUpCard` | `src/components/profile/FollowUpCard.tsx` | parity-audit |
| `EntryCapturePage` | `packageOnboarding/pages/capture` | parity-verified |
| `EntryFollowUpPage` | `packageOnboarding/pages/follow-up` | parity-verified |
| `EntrySummaryPage` | `packageOnboarding/pages/summary` | parity-verified |
| Build hub | `packageOnboarding/pages/hub` | parity-verified |
| intro / basic / generating / result | `packageOnboarding/pages/*` | parity-verified |
| Final follow-up | `packageOnboarding/pages/final-follow-up` | parity-audit |
| Evidence / Verify | `pages/profile/evidence` · `verify` | parity-verified |
| `TaskFeedbackPanel` | `src/components/tasks/TaskFeedbackPanel.tsx` | done |
| `Simulation*Bubble` | `src/components/rehearsal/SimulationBubbles.tsx` | done |
| `ProfileEditModals` | `src/components/profile/ProfileEditModals.tsx` | done |
| `useTencentAsrInput` | `src/hooks/useTencentAsrInput.ts` | done |
| `motion.scss` / `usePageEntering` | `src/styles/motion.scss` · `hooks/usePageEntering` | parity-verified |

## 路由对照

| Web | 小程序 |
|-----|--------|
| `/daily` | `pages/daily` |
| `/tasks` | `pages/tasks` |
| `/rehearsal` | `pages/rehearsal` |
| `/family-profile` | `pages/profile` |
| `/profile/evidence` | `pages/profile/evidence` |
| `/profile/verify` | `pages/profile/verify` |
| `/profile/build/intro` | `packageOnboarding/pages/intro` |
| `/profile/build/basic` | `packageOnboarding/pages/basic` |
| `/profile/build/{module}` | `packageOnboarding/pages/capture?entryType=` |
| `/profile/build/{module}/follow-up` | `packageOnboarding/pages/follow-up?entryType=` |
| `/profile/build/{module}/summary` | `packageOnboarding/pages/summary?entryType=` |
| `/profile/build` hub | `packageOnboarding/pages/hub` |
| `/profile/build/final-follow-up` | `packageOnboarding/pages/final-follow-up` |
| `/profile/generating` | `packageOnboarding/pages/generating` |
| `/profile/build/result` | `packageOnboarding/pages/result` |
