# 校园帮（Campus Helper）— 迁移资料包

> 本文档汇总「育见·校园帮」项目的完整产品设计、技术决策、数据库 Schema、API 接口规范和前端页面设计，供新项目重建时直接参照。

---

## 一、产品定位与核心机制

### 1.1 一句话定位
面向大学生宿舍场景的即时互助跑腿平台：代取快递、代送饭、复习资料交易、快递送货上楼、外卖捎上楼。

### 1.2 双角色
| 角色 | 职责 |
|------|------|
| 发单人 | 发布订单，填写需求、楼栋、跑腿费、是否匿名 |
| 接单人（跑腿者） | 浏览大厅，抢单并支付，线下执行后拍照留证 |

### 1.3 核心交易机制
- **先付款先得**：谁先支付谁获得订单，支付成功后订单立即对其他用户屏蔽（`status: open → locked`）
- **平台抽成 1%**：跑腿费中抽取 1% 归属平台（当前试用版未对接真实支付，接口预留）
- **发布超时自动关闭**：发布后 24 小时无人接单自动标记 `expired`（当前后端未实现定时任务，预留字段）
- **匿名模式**：每条订单可独立开启匿名。大厅列表显示「匿名用户」，付款后接单人通过私聊获取必要信息

### 1.4 其他功能
- **交易私聊**：文字、图片、订单卡片（当前为占位，下一步接入 WebSocket）
- **拍照留证**：接单人送达拍照 + 发单人取件拍照，缺一不可（当前为 UI 占位）
- **打赏**：交易完成后发单人可打赏接单人（当前为 UI 占位）
- **拉黑**：双向拉黑后互相看不到订单、无法私聊、无法抢单（当前为 UI 占位）
- **站内红点通知**：非实时推送，页面内红点提示（当前为 UI 占位）

---

## 二、产品决策汇总

| 决策项 | 最终选择 |
|--------|---------|
| 产品形态 | 微信小程序（当前试用版为 Flask H5 原型） |
| 前端框架 | Taro + React + TypeScript（当前试用版为原生 JS + Jinja2 模板） |
| 后端框架 | Next.js API Routes（当前试用版为 Flask + SQLite） |
| 数据库 | PostgreSQL（当前试用版为 SQLite） |
| 支付方案 | Mock 支付 + 微信真实支付双模式 |
| 实名认证 | 手机号 + 密码登录 |
| 内容审核 | 无需审核，靠举报 + 拉黑自治 |
| 信用系统 | 简单好评数（交易完成点赞 / 踩） |
| 消息推送 | 站内通知红点 |
| 图片存储 | 阿里云 OSS / 腾讯云 COS |
| UI 风格 | 极简效率风（Apple 白） |
| 订单类型 | 代取快递、送饭上楼、复习资料、快递送货 |
| 筛选维度 | 订单类型 + 宿舍楼号 + 同楼 / 跨楼 |
| 地理位置 | 不需要 |
| 订单超时 | 发布超时自动关闭 |

---

## 三、页面路由设计

| 路由 | 页面 | 功能描述 |
|------|------|---------|
| `/login` | 登录 / 注册 | 手机号 + 密码，支持登录 / 注册切换 |
| `/app` | 应用主页（需登录） | 底部导航切换五个子视图 |

### 3.1 五个子视图（data-screen）

| data-screen | 视图 | 功能 |
|-------------|------|------|
| `hall` | 订单大厅 | 显示全部可抢订单（`status=open`），支持筛选和抢单入口 |
| `publish` | 发布订单 | 填写订单类型、标题、楼栋、描述、跑腿费、匿名开关、同楼开关 |
| `detail` | 订单详情 | 查看某条订单的完整信息 + 交接凭证流程 + 支付 / 私聊入口 |
| `chat` | 交易私聊 | 订单内聊天界面（当前为占位） |
| `profile` | 我的 | 用户信息、发布 / 接单数量、退出登录 |

### 3.2 导航方式
- 底部固定导航栏（`bottom-nav`）：大厅 / 发布 / 消息 / 我的
- 页面内按钮跳转：大厅卡片 → 详情 → 私聊
- 登录页：顶部标签切换登录 / 注册

---

## 四、数据库 Schema（SQLite 实现 → 目标 PostgreSQL）

```sql
-- 用户表
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,   -- PG: UUID DEFAULT gen_random_uuid()
  phone         TEXT NOT NULL UNIQUE,                 -- 手机号
  password_hash TEXT NOT NULL,                        -- pbkdf2:sha256 哈希
  nickname      TEXT NOT NULL,                        -- 昵称
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 订单表
CREATE TABLE orders (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id    INTEGER NOT NULL REFERENCES users(id),
  type          TEXT NOT NULL,                        -- 代取快递 / 送饭上楼 / 复习资料 / 快递送货
  title         TEXT NOT NULL,                        -- 订单标题（≤60 字）
  description   TEXT NOT NULL,                        -- 订单描述
  building      TEXT NOT NULL,                        -- 宿舍楼号
  same_building INTEGER NOT NULL DEFAULT 0,           -- 0 跨楼 / 1 仅同楼
  is_anonymous  INTEGER NOT NULL DEFAULT 0,           -- 0 实名 / 1 匿名
  price         REAL NOT NULL,                        -- 跑腿费（元）
  status        TEXT NOT NULL DEFAULT 'open',         -- open / locked / completed / cancelled / expired
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES users(id)
);
```

---

## 五、API 接口清单

**Base URL**: `http://127.0.0.1:5001`

### 5.1 认证模块 `/api/auth`

| 方法 | 路径 | 功能 | 请求体 | 响应 |
|------|------|------|--------|------|
| `GET` | `/api/auth/me` | 获取当前会话用户 | — | `{ authenticated, user: { id, phone, nickname } }` |
| `POST` | `/api/auth/register` | 注册 | `{ phone, password, nickname? }` | `{ message }` |
| `POST` | `/api/auth/login` | 登录 | `{ phone, password }` | `{ message, user }` |
| `POST` | `/api/auth/logout` | 登出 | — | `{ message }` |

**认证方式**: Flask Session（Cookie-based），迁移到正式版时建议改为 JWT。

**校验规则**:
- `phone`: 必须 11 位数字
- `password`: 至少 6 位
- `nickname`: 不填则自动生成为 `用户{手机号后4位}`

### 5.2 订单模块 `/api/orders`

| 方法 | 路径 | 功能 | 请求体 | 响应 |
|------|------|------|--------|------|
| `GET` | `/api/orders` | 获取订单列表 | — | `{ orders: [...] }` |
| `POST` | `/api/orders` | 创建订单 | `{ type, title, description, building, price, isAnonymous, sameBuilding }` | `{ message }` |

**订单列表返回字段**:
```json
{
  "orders": [
    {
      "id": 1,
      "type": "代取快递",
      "title": "北 7 楼快递柜取件，送到 431 寝室门口",
      "description": "匿名发布，菜鸟柜 3-12 号门...",
      "building": "北区 7 号楼",
      "sameBuilding": true,
      "isAnonymous": true,
      "price": 6.0,
      "status": "open",
      "createdAt": "2026-06-10 ...",
      "creator": "匿名用户",   // 非匿名时显示真实昵称
      "mine": false             // 当前用户是否为发单人
    }
  ]
}
```

**匿名规则**：
- 当 `isAnonymous=true` 且 `viewer_id !== creator_id` 时，`creator` 字段返回 `"匿名用户"`
- 发单人自己看到自己的订单时始终显示真实昵称

**发布校验**：
- `type`、`title`、`description`、`building` 必填
- `price` 必须大于 0

**订单状态枚举**:
- `open` — 待接单
- `locked` — 已被抢
- `completed` — 已完成
- `cancelled` — 已取消
- `expired` — 已过期

---

## 六、前端页面设计规范

### 6.1 视图切换机制（纯前端 SPA）

页面结构：
```
.app-root
├── .screen[data-screen="hall"].active   ← 当前视图
├── .screen[data-screen="publish"]
├── .screen[data-screen="detail"]
├── .screen[data-screen="chat"]
└── .screen[data-screen="profile"]
└── .bottom-nav
    ├── .nav-item[data-jump="hall"]
    ├── .nav-item[data-jump="publish"]
    ├── .nav-item[data-jump="chat"]
    └── .nav-item[data-jump="profile"]
```

切换逻辑：
- `data-jump` 属性绑定到任意按钮，点击后调用 `switchView(view)`
- `switchView` 给对应 `.screen` 和 `.nav-item` 切换 `.active` 类
- 跳转到 `hall` 时会自动 `loadOrders()` 刷新

### 6.2 前端状态管理（内存对象）

```js
const state = {
  user: null,           // 当前用户 { id, phone, nickname }
  orders: [],           // 订单列表
  selectedOrderId: null  // 当前选中订单 ID
};
```

### 6.3 前端关键 DOM 元素 ID 列表

| ID | 所在视图 | 用途 |
|----|---------|------|
| `order-list` | hall | 订单卡片渲染容器 |
| `publish-form` | publish | 发布表单 |
| `publish-submit` | publish | 确认发布按钮 |
| `fill-demo` | publish | 填充示例数据按钮 |
| `detail-type` | detail | 详情页标题（订单类型） |
| `detail-building` | detail | 宿舍楼号 |
| `detail-price` | detail | 跑腿费 |
| `detail-title` | detail | 订单标题 |
| `detail-description` | detail | 订单描述 |
| `detail-owner` | detail | 发布者信息 |
| `detail-status` | detail | 订单状态 |
| `chat-title` | chat | 聊天页标题 |
| `chat-notice` | chat | 聊天占位提示 |
| `mine-nickname` | profile | 用户昵称 |
| `mine-avatar` | profile | 用户头像（昵称首2字） |
| `mine-summary` | profile | 用户统计摘要 |
| `mine-orders` | profile | 我发布的订单数 |
| `total-orders` | profile | 大厅订单总数 |
| `app-message` | profile | 状态消息文本 |
| `logout-button` | profile | 退出登录按钮 |
| `notice-count` | profile | 通知红点数字 |

### 6.4 发布表单字段

| 字段 name | 类型 | 说明 |
|-----------|------|------|
| `type` | `<select>` | 订单类型（4 选 1） |
| `title` | `<input>` | 订单标题，maxlength=60 |
| `building` | `<input>` | 宿舍楼号，maxlength=30 |
| `description` | `<textarea>` | 补充说明 |
| `price` | `<input type="number">` | 跑腿费（元），min=0.1，step=0.1 |
| `isAnonymous` | `<checkbox>` | 匿名发布开关，默认开启 |
| `sameBuilding` | `<checkbox>` | 仅同楼可见开关，默认关闭 |

### 6.5 订单卡片渲染函数 `createOrderCard(order)`

自动生成 DOM 结构：
```
article.order-card[.featured|.dimmed]
  div.card-top
    span.order-type     ← 订单类型标签
    span.price|.locked  ← 价格或「已被抢」
  h4                   ← 订单标题
  p                    ← 订单描述
  div.meta-row
    span              ← 同楼 / 跨楼
    span              ← 匿名 / 非匿名
    span              ← 我发布的 / 发布者 xxx
  div.card-actions
    button.secondary-button  ← 查看详情（→ detail）
    button.primary-button    ← 立即抢单 / 查看会话
```

---

## 七、配色系统（Apple 白主题）

```css
:root {
  --bg:       #FFFFFF;    /* 主背景：纯白 */
  --card-bg:  #F5F5F7;    /* 卡片背景：苹果浅灰 */
  --text:     #1D1D1F;    /* 主文字：深黑 */
  --muted:    #86868B;    /* 辅助文字：苹果灰 */
  --line:     rgba(60,60,67,0.10);  /* 分割线：极浅灰 */
  --accent:   #007AFF;    /* 强调色：苹果蓝 */
  --danger:   #FF3B30;    /* 危险色：苹果红 */
  --success:  #34C759;    /* 成功色：苹果绿 */
  --radius:   12px;       /* 统一圆角 */
  --font:     -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", "Helvetica Neue", sans-serif;
}
```

---

## 八、当前项目文件清单

```
campus-helper-preview/
├── app.py                    # Flask 后端（334 行）
├── requirements.txt          # Python 依赖（flask）
├── data/
│   └── campus_helper.db      # SQLite 数据库（自动生成）
├── templates/
│   ├── login.html            # 登录 / 注册页
│   └── app.html              # 应用主页面（五屏视图）
└── static/
    ├── styles.css            # 全局样式（Apple 白主题）
    └── script.js             # 前端逻辑（状态管理 + 视图切换 + API 调用）
```

### 启动命令
```bash
cd campus-helper-preview
python3 -m pip install --user flask
python3 app.py
# 打开 http://127.0.0.1:5001/login
# 演示账号: 13800138000 / 123456
```

---

## 九、迁移建议

### 9.1 后端迁移要点
1. 将 `app.py` 中的 6 个 API 路由（`/api/auth/me`、`register`、`login`、`logout`、`/api/orders GET`、`/api/orders POST`）迁移到新后端框架
2. 保持请求 / 响应 JSON 格式不变
3. 将 SQLite 表升级为 PostgreSQL（参考第四节 Schema）
4. 认证方式从 Flask Session 改为 JWT
5. 密码哈希保持 `pbkdf2:sha256`（Werkzeug 实现）

### 9.2 前端迁移要点
1. 参考第六节的 DOM 结构和 ID 命名，保证 JS 能正确读写
2. 登录页需处理登录 / 注册两个表单的切换
3. 应用页需实现底部导航 + 五屏视图切换 + 订单卡片动态渲染
4. 发布表单包含两个开关（匿名、同楼），每个开关是一个 `<label.switch>` + `<input hidden>`
5. 价格显示使用 `¥X.XX` 格式
6. 按钮状态管理：提交时 `disabled=true` + 文字变为 `"xxx中..."`，完成后恢复

### 9.3 风险提醒
- 当前没有并发控制（`先付款先得` 需要数据库行锁）
- 当前没有 WebSocket，聊天为纯占位
- 当前没有图片上传和对象存储
- 当前没有消息推送
- 当前密码登录没有风控（无限试错、弱密码等）
