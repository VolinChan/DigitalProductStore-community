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

- 响应式首页、商品列表、搜索、筛选和商品详情 UI
- 购物车、收藏、登录、注册和结算相关 UI
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

准备公开发布前，请先执行 [`docs/PUBLIC_RELEASE_CHECKLIST.md`](docs/PUBLIC_RELEASE_CHECKLIST.md) 中的检查。

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
