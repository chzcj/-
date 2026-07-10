# E2E 测试清单（Phase 4）

在微信开发者工具导入 `miniprogram/`（先 `npm run build:weapp`），AppID `wx85cc99d660b0c0ac`。

## 1. 登录与门禁

- [ ] 未登录打开小程序 → 停留登录页（hi-fi 绿色皮肤）
- [ ] 微信一键登录成功 → 未 onboarding 进入 `packageOnboarding/pages/intro`
- [ ] 已 onboarding 账号 → `switchTab` 到交流页（不报「页面不存在」）

## 2. Onboarding 全路径

- [ ] intro → basic（孩子昵称/年级）→ capture(daily)
- [ ] capture → follow-up（或跳过）→ summary → capture(homework) … → family summary
- [ ] hub 显示四模块状态；全部完成后 → final-follow-up → generating → result
- [ ] result「进入育见」→ 四 Tab 可用
- [ ] 中途杀进程重开，build-state 与服务器一致

## 3. 四 Tab 主流程

- [ ] **交流**：starter chip、文字发送、NDJSON 流式、thinking 面板、section 卡片
- [ ] **交流**：按住说话 → ASR（需真机 + 合法域名 + `/api/asr/token`）
- [ ] **任务**：列表、添加、展开反馈面板、PUT feedback
- [ ] **预演**：entry → confirm → active 对话 → end
- [ ] **画像**：完整度条、hub 卡片、设置/编辑孩子信息 modal、二级 card 页

## 4. 跨端数据一致性

- [ ] 同一账号 Web 登录与小程序登录，孩子基本信息一致（`/api/account/state`）
- [ ] Onboarding 进度 Web/小程序互相同步（`/api/profile/build-state`）
- [ ] Daily 历史服务器拉取后本地展示一致

## 5. 异常路径

- [ ] Token 过期 401 → 重新登录
- [ ] 弱网发送 daily → toast 错误，不白屏
- [ ] Tab 间切换使用 `switchTab`，自定义 tabBar 选中态正确

## 自动化说明

当前为手工清单；后续可加 miniprogram-automator 脚本覆盖登录与 Tab 跳转。
