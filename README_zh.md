# Plexoria Digital Store 社区版

这是 Plexoria 数码商城前端的开源社区版，主要目的很明确：展示项目、获得社区反馈，并把感兴趣的访问者引导到正式商城。

正式商城地址：

<https://www.plexoria.cl>

[English](README.md)

## 仓库关系

- 开放社区仓库：`vigoordi/DigitalProductStore`
- 私有 Pro 仓库：`vigoordi/DigitalProductStore-Pro`

社区版用于展示、学习、引流和社区协作。真实支付、订单履约、库存扣减、后台运营、生产部署配置、客户数据和任何密钥，都不属于公开仓库。

完整商用能力维护在私有 Pro 仓库里，VPS 正式环境也应该拉取 Pro 仓库，而不是公开社区仓库。

## 社区版包含什么

- 从 320px 移动端到桌面端的移动优先响应式商城
- English 与西班牙语（智利）本地化路由，并保留语言上下文的导航
- 将搜索、筛选、排序和分页状态保存在 URL 中的商品发现流程
- 商品详情页 SKU 选择、价格、库存、媒体和购买状态联动
- 购物车、迷你购物车、Buy Now、登录、注册和结算 UI
- 键盘可访问菜单、抽屉和对话框，焦点恢复、减少动画和本地化表单错误
- 覆盖商品发现、购买、无障碍和响应式布局的 Playwright 回归测试
- 面向演示的前端配置
- Next.js 店铺前端代码
- Docker 前端预览启动方式

## 明确不包含什么

以下内容属于私有商业边界，不进入公开仓库：

- 真实支付密钥、Webhook 凭证和结算规则
- 生产订单、库存、仓储、客户和分析数据
- 后台权限策略和内部运营流程
- 定价、会员、优惠券、推荐和风控规则
- 生产证书、备份、监控凭证和部署密钥
- Pro 后端服务代码

社区分支不得包含生产凭证、运营数据或部署配置。

## 启动社区版预览

环境要求：Docker Desktop 和 Git。

```powershell
git clone https://github.com/vigoordi/DigitalProductStore.git
cd DigitalProductStore
copy .env.community.example .env
docker compose -f docker-compose.community.yml up --build
```

打开 <http://localhost:3000>。

社区版 Compose 只启动前端预览，不启动生产 API、数据库、Nginx、Grafana、Prometheus，也不会接入真实支付。

## 许可证

社区版采用 [GNU AGPL v3.0](LICENSE)。私有部署、生产集成和商业支持不属于本公开仓库范围，需要单独的商业协议。

## 技术栈

| 层级 | 技术选型 |
|------|---------|
| **前端** | Next.js 16 · React 19 · TypeScript · Ant Design 6 · Tailwind CSS · Framer Motion · Zustand · Axios · Sonner（Toast） |
| **后端 API** | Go 1.25 · Gin · GORM · PostgreSQL · Redis · JWT 鉴权 · Stripe 支付 · SMTP 邮件 |
| **基础设施** | Docker Compose · Nginx（反向代理、HTTPS/SSL、限流） · Prometheus · Grafana · Cloudflare Origin CA |
| **架构模式** | RESTful API · 微服务风格（Docker Compose） · 多子域名路由 · 后台任务（转账截止检查 & 提醒检查器） |

### 生产后端（私有）

生产后端的支付处理、订单管理、库存、分析、管理面板和部署配置等完整商用能力维护在私有 Pro 仓库 (`vigoordi/DigitalProductStore-Pro`) 中，社区版不包含这些内容。

### 商业授权

本项目采用**双重许可**。社区版基于 AGPLv3 开源。如需在不遵守 AGPL 义务的前提下部署私有分支，或需要商业支持、SLA、定制集成、白标授权，请通过 GitHub 联系 **vigoordi**。商业授权条款可按项目个案协商。
