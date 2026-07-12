# Screenshot UI Audit — 2026-07-11

基于用户 8 张真机/模拟器截图，对照已锁定产品决策与 Impeccable 审查流程。

## 摘要

| ID | 现象 | 严重度 | 根因 | 修复状态 |
|----|------|--------|------|----------|
| A1 | 追问页空绿色 pill | P0 | `directions` 含空串仍渲染 | fixed |
| A2 | 整理页「清北学霸」「系统整理」「系统抓到」 | P0 | 文案遗漏 | fixed |
| A3 | 采集页 ASR「资源包耗尽」 | P0 | 线上 BFF `16k_zh` | fixed（2026-07-11 部署验证） |
| A4 | Hub「已完成」换行 | P1 | entry-row flex 挤压 | fixed |
| A5 | 任务 Tab「已完成」换行 | P1 | status-tag 无 nowrap | fixed |
| A6 | 录音页「文件转写正在接入」 | P0 | dialogue-transcribe 501 | fixed（2026-07-11 部署验证） |
| A7 | 采集底栏双层胶囊 | P1 | `.bottom-actions` 样式重复 | fixed |
| A8 | 整理底栏三按钮溢出 | P1 | dense grid + shadow 溢出 | fixed |

## Impeccable detect

- 路径：`miniprogram/src/packageOnboarding`、`pages/rehearsal`、`pages/tasks`、`components/profile`、`styles`
- 结果：无 P0/P1 静态反模式

## 验收路径（人工）

1. `packageOnboarding/pages/follow-up` — 方向 chip 有文案或整块隐藏
2. `packageOnboarding/pages/summary` — 无清北 badge；hero 中性文案
3. `packageOnboarding/pages/capture` — 按住说话无 4004（部署后）
4. `packageOnboarding/pages/hub` — 已完成单行
5. `pages/tasks` — 已完成单行
6. `pages/rehearsal/dialogue` — 上传非 501（部署后）
7. capture 底栏 — 单层玻璃底栏
8. summary 底栏 — 主按钮全宽 + 双副按钮不重叠

## 部署状态

- 2026-07-11 17:13 `npm run deploy` 成功；PM2 yujian/yujian-jobs reload；asr-proxy reload
- `/api/asr/token` 线上 `engine_model_type=16k_zh` ✓
- `/api/rehearsal/dialogue-transcribe` 返回业务校验（非 501）✓
- readiness：`ready: false`（`jobHealthy=false`，历史 failed jobs，与 ASR 无关）
- **小程序前端**：`deploy.sh` 排除 `miniprogram/`，需在开发者工具重新编译本地 `build:weapp` 产物
