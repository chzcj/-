# 归档脚本（legacy）

这些是**过时**的测试脚本，已归档保留以备查阅，不再随主流程维护。

## 为什么归档

- **`test_*.py`（8 个）**：针对**旧 problem / 深度复盘流程**的端到端/时延/质量测试，调用 `/api/conversations/start`、`/api/problem/answer/stream` 等。该流程已不再是主入口（日常对话主入口已切到 `/api/daily/stream`，见 `app/daily/page.tsx`）。`test_timing2.py` 还含硬编码服务器路径 `/home/ubuntu/...`。
- **`test-xiaoyin-v2/v3.mjs` + `xiaoyin-test-data.{mjs,ts}`**：早期"小荫"测试数据与跑批脚本，对应旧链路口径。

## 仍在用的脚本（在 `scripts/` 顶层，未归档）

- `build-prompts.mjs` —— prompt 构建期生成器（npm `predev`/`prebuild` 钩子调用，**勿删**）。
- `verify-pgvector.mjs` —— 三层语义检索 / pgvector 端到端验证。
- `test-vector-retrieval.mjs` —— 向量检索召回质量对比。
- `test-input-strategy.mjs` / `test-profile-rehearsal.mjs` —— 仍调当前画像/预演端点的测试。

如需彻底删除本目录，可在确认无引用后 `git rm -r scripts/legacy`。
