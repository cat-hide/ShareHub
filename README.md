# ShareHub - 局域网合同共享平台

面向中小团队的合同台账管理系统，支持合同、开票、收款、发货全流程跟踪，运行在局域网环境。

## 功能概览

| 模块 | 说明 |
|------|------|
| 用户管理 | admin / sales 双角色，JWT 认证 |
| 合同管理 | 合同 CRUD、多条件筛选排序分页、合同物料明细 |
| 开票管理 | 发票记录增删改查、多附件上传、逾期提醒 |
| 收款管理 | 独立收款记录、回款状态跟踪 |
| 发货管理 | 发货记录、物料关联、多附件上传 |
| 数据导出 | Excel 五页台账（合同/物料/发货/开票/收款） |
| 附件预览 | PDF 和图片在线预览，Token 安全认证 |

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS + Ant Design |
| 后端 | Express + TypeScript + sql.js (SQLite) |
| 认证 | JWT (jsonwebtoken) |
| 文件上传 | multer (最大 50MB) |
| Excel 导出 | exceljs |

## 快速开始

### 环境要求

- Node.js 18+
- npm 9+

### 安装

```bash
# 克隆仓库
git clone https://github.com/cat-hide/ShareHub.git
cd ShareHub/contract-tracker

# 安装依赖
cd server && npm install && cd ..
cd client && npm install && cd ..
```

### 配置

复制并编辑环境变量文件：

```bash
cd server
# .env 已存在于仓库中为示例，生产环境请务必修改 JWT_SECRET
```

关键配置项：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | 3001 |
| `JWT_SECRET` | JWT 签名密钥（**必改**） | - |
| `OVERDUE_DAYS` | 开票逾期天数阈值 | 60 |
| `CORS_ORIGIN` | 允许的来源域名 | 允许所有 |

### 开发模式

```bash
# 后端（端口 3001）
cd server
npm run dev

# 前端（端口 5173 + 代理到 3001）
cd client
npm run dev
```

### 生产部署

```bash
# 编译后端 TypeScript
cd server
npm run build

# 编译前端
cd client
npm run build

# 启动
cd server
node dist/index.js
```

访问 `http://localhost:3001`，前端页面由 Express 直接托管。

### Windows 开机自启

```bash
cd server

# 方式一：PM2（推荐，支持崩溃自动重启）
npm install -g pm2 pm2-windows-startup
pm2 start ecosystem.config.js
pm2 save
pm2-startup install

# 方式二：启动文件夹（已内置脚本）
# 双击 start-server.bat 即可，开机自动运行
```

> 启动文件夹中已自动放入 `start-silent.vbs`，登录 Windows 时静默启动服务。

## 项目结构

```
ShareHub/
├── contract-tracker/
│   ├── server/                 # 后端 Express + TypeScript
│   │   ├── src/
│   │   │   ├── routes/         # API 路由
│   │   │   ├── middleware/     # 认证 & 错误处理
│   │   │   ├── utils/         # 工具函数 (导出、文件处理)
│   │   │   ├── app.ts         # Express 应用配置
│   │   │   ├── database.ts    # SQLite 数据库管理
│   │   │   ├── config.ts      # 环境变量集中管理
│   │   │   └── index.ts       # 入口
│   │   ├── ecosystem.config.js # PM2 配置
│   │   ├── start-server.bat   # 启动脚本
│   │   └── .env               # 环境变量
│   ├── client/                 # 前端 React + Vite
│   │   └── src/
│   │       ├── api/            # API 调用封装
│   │       ├── components/     # 可复用组件
│   │       ├── pages/          # 页面组件
│   │       ├── types/          # TypeScript 类型定义
│   │       └── hooks/          # 自定义 Hook
│   └── docs/                   # 需求 & 架构文档
└── README.md
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/login | 用户登录 |
| GET | /api/auth/me | 获取当前用户 |
| GET | /api/users | 用户列表 (admin) |
| POST | /api/users | 创建用户 (admin) |
| GET | /api/contracts | 合同列表（分页/筛选/排序） |
| POST | /api/contracts | 创建合同 |
| PUT | /api/contracts/:id | 更新合同 |
| DELETE | /api/contracts/:id | 删除合同 |
| GET | /api/contracts/export | 导出 Excel 台账 |
| GET | /api/contracts/:id/invoices | 合同开票列表 |
| POST | /api/contracts/:id/invoices | 新增开票 |
| GET | /api/contracts/:id/payments | 合同收款列表 |
| POST | /api/contracts/:id/payments | 新增收款 |
| GET | /api/contracts/:id/shipments | 合同发货列表 |
| POST | /api/contracts/:id/shipments | 新增发货 |
| GET | /api/contracts/attachments/:id/preview | 附件预览 |
| GET | /api/contracts/attachments/:id/download | 附件下载 |

所有业务接口（除登录和附件预览）需要 `Authorization: Bearer <token>` 请求头。

## 安全特性

- JWT 密钥强制环境变量配置，无硬编码回退
- 附件预览/下载使用临时 `access_token` 验证
- 路径遍历防护（禁止 `..` 和绝对路径）
- 登录频率限制（15 分钟窗口，最多 10 次）
- CORS 白名单可配置
- 参数化 SQL 查询防止注入
- 数据库写入防抖批量保存

## License

MIT
