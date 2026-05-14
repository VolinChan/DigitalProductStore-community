# Digital Store 数码产品商城

一个现代化的全栈数码产品电商平台，采用前后端分离架构，支持游客下单、多种支付方式、SKU 变体管理和数据分析。

![Go](https://img.shields.io/badge/Go-1.25-00ADD8?style=flat-square&logo=go)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14-336791?style=flat-square&logo=postgresql)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker)

## ✨ 功能特性

### 用户端
- 🛒 **购物车** - 支持游客和登录用户，登录后自动合并购物车
- 📦 **订单管理** - 完整的订单流程，支持订单追踪
- 💳 **多种支付** - 在线支付（Stripe）和转账支付
- 🔍 **商品搜索** - 按分类、关键词搜索商品
- 📱 **响应式设计** - 适配桌面、平板和移动设备

### 管理端
- 📊 **数据分析** - 销售报表、热门商品、转化率分析
- 🏷️ **SKU 管理** - 支持多属性变体（颜色、容量、尺寸等）
- 📦 **库存管理** - 库存预警、变更日志
- 🎨 **内容管理** - 轮播图、公告管理
- 👥 **用户管理** - 多角色权限控制

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Nginx (反向代理)                       │
├─────────────────────────────┬───────────────────────────────┤
│      Next.js 前端 (:3000)    │       Go API 后端 (:8080)      │
├─────────────────────────────┴───────────────────────────────┤
│                    PostgreSQL + Redis                        │
└─────────────────────────────────────────────────────────────┘
```

| 层级 | 技术栈 |
|------|--------|
| 前端 | Next.js 14, React 18, Ant Design 5, Zustand, Tailwind CSS |
| 后端 | Go, Gin, GORM, JWT |
| 数据库 | PostgreSQL 14, Redis 7 |
| 监控 | Prometheus, Grafana |
| 部署 | Docker, Docker Compose, Nginx |

## 🚀 快速开始

### 环境要求

- Docker & Docker Compose
- Git

### 一键启动

```bash
# 克隆项目
git clone https://github.com/vigoordi/DigitalProductStore.git
cd digital-store

# 复制环境变量配置
cp .env.example .env

# 启动所有服务
docker-compose up -d
```

启动完成后访问：
- 🌐 商城前端: http://localhost
- 📡 API 文档: http://localhost/api/swagger/index.html
- 📊 Grafana: http://localhost:3001 (admin/admin)
- 📈 Prometheus: http://localhost:9090

### 默认管理员账号

启用 `SEED_DEMO_DATA=true`（默认）后会创建演示数据：

| 邮箱 | 密码 | 角色 |
|------|------|------|
| admin@demo.local | Admin@1234 | super_admin |

## 📁 项目结构

```
digital-store/
├── backend/                 # Go 后端服务
│   ├── cmd/api/            # 应用入口
│   ├── internal/
│   │   ├── config/         # 配置管理
│   │   ├── database/       # 数据库连接和迁移
│   │   ├── handlers/       # HTTP 处理器
│   │   ├── middleware/     # 中间件（认证、日志等）
│   │   ├── models/         # 数据模型
│   │   ├── repositories/   # 数据访问层
│   │   └── services/       # 业务逻辑层
│   └── api/openapi/        # Swagger 文档
├── frontend/               # Next.js 前端应用
│   ├── src/
│   │   ├── app/           # App Router 页面
│   │   ├── components/    # React 组件
│   │   ├── lib/           # 工具函数和 API 客户端
│   │   └── stores/        # Zustand 状态管理
│   └── public/            # 静态资源
├── nginx/                  # Nginx 配置
├── monitoring/             # Prometheus & Grafana 配置
├── scripts/                # 部署和维护脚本
└── docker-compose.yml      # Docker 编排配置
```

## ⚙️ 环境变量

主要配置项（完整配置见 `.env.example`）：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `APP_ENV` | 运行环境 | development |
| `DB_USER` | 数据库用户 | postgres |
| `DB_PASSWORD` | 数据库密码 | postgres |
| `JWT_SECRET` | JWT 密钥 | change-me-in-production |
| `STRIPE_SECRET_KEY` | Stripe 密钥 | - |
| `SEED_DEMO_DATA` | 是否创建演示数据 | true |

## 🔌 API 概览

### 公开接口
```
GET    /api/v1/products          # 商品列表
GET    /api/v1/products/:id      # 商品详情
GET    /api/v1/categories        # 分类列表
POST   /api/v1/cart/items        # 添加购物车
POST   /api/v1/orders            # 创建订单
POST   /api/v1/auth/register     # 用户注册
POST   /api/v1/auth/login        # 用户登录
```

### 管理接口 (需认证)
```
POST   /api/v1/admin/products    # 创建商品
PUT    /api/v1/admin/orders/:id  # 更新订单状态
GET    /api/v1/admin/analytics   # 数据分析
```

完整 API 文档请访问 `/api/swagger/index.html`

## 🧪 开发指南

### 本地开发（不使用 Docker）

**后端：**
```bash
cd backend
cp .env.example .env
# 编辑 .env 配置数据库连接
go run ./cmd/api
```

**前端：**
```bash
cd frontend
npm install
npm run dev
```

### 运行测试

```bash
# 后端测试
cd backend
go test ./...

# 前端 lint
cd frontend
npm run lint
```

## 📊 监控

项目集成了 Prometheus + Grafana 监控：

- **Prometheus** 收集 API 性能指标
- **Grafana** 提供可视化仪表板

预配置的监控指标：
- HTTP 请求延迟和吞吐量
- 数据库连接池状态
- Redis 缓存命中率
- 订单和支付成功率

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 提交 Pull Request

## 📄 许可证

[MIT License](LICENSE)

---

如有问题或建议，欢迎 [提交 Issue](https://github.com/vigoordi/DigitalProductStore/issues)。
