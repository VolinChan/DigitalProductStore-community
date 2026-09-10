# Plexoria Digital Store 社区版

面向智利实体商品经营的移动优先商城前端，源自 Plexoria 正式电子产品商城的真实购买体验。

Plexoria 帮助商家把商品目录变成清晰、本地化的购买链路：从商品发现、SKU 选择、实时价格与库存，到购物车和结算。这个公开 Community Edition 让开发者与商家可以评估前台体验、参与改进并查看真实项目，同时避免暴露生产凭证、客户数据、履约规则和私有后端服务。

[English](README.md) · [Español (Chile)](readme_es_cl.md)

## 在线体验

前往正式商城体验买家流程：

<https://www.plexoria.cl>

## 为什么 Plexoria 值得关注

- **围绕真实商品建模：** 商品变体、SKU 专属图片与媒体、价格、库存和购买状态在详情页中保持联动。
- **针对智利市场本地化：** 支持西班牙语（智利）路由、CLP 价格展示、语言上下文导航和当地买家熟悉的表达。
- **重视移动端购买：** 从 320px 开始适配，覆盖商品发现、Buy Now、购物车和结算流程。
- **可以从前台延伸到完整运营：** 私有 Pro 平台进一步提供服务端订单校验、后台管理、支付、库存、税务单据、配送、通知与可观测性能力。

如需了解面向智利实体卖家的经营价值、当地集成及真实的生产启用边界，请阅读[智利西班牙语卖家说明](readme_es_cl.md)。

## 工程案例

在[这份 RelBase 接入记录](case-studies/relbase-integration.zh-CN.md)里，我整理了销售单转换的排查过程、运费遗漏的修复，以及重复开单保护的设计取舍。已经完成的工作和仍待联调的部分，也分别记在文中。

## 仓库关系

- 开放社区仓库：`VolinChan/DigitalProductStore-community`
- 私有 Pro 仓库：`VolinChan/DigitalProductStore-Pro`

社区版用于展示、评估、学习、引流和社区协作。真实支付、订单履约、库存扣减、后台运营、生产部署配置、客户数据和任何密钥，都不属于公开仓库。

完整商用能力维护在私有 Pro 仓库里，VPS 正式环境也应该拉取 Pro 仓库，而不是公开社区仓库。

## 可以在社区版中评估什么

- 从 320px 移动端到桌面端的移动优先响应式商城
- English 与西班牙语（智利）本地化路由，并保留语言上下文的导航
- 将搜索、筛选、排序和分页状态保存在 URL 中、便于返回与分享的商品发现流程
- 商品详情页中 SKU 选择与价格、库存、图片媒体和购买状态的联动
- 购物车、迷你购物车、Buy Now、登录、注册和结算 UI
- 键盘可访问菜单、抽屉和对话框，焦点恢复、减少动画和本地化表单错误
- 覆盖商品发现、购买、无障碍和响应式布局的 Playwright 回归测试
- 面向演示的前端配置
- Next.js 店铺前端代码
- Docker 前端预览启动方式

## 清晰的生产边界

Community Edition 是一套真实的前台预览，不是生产密钥和商家运营规则的公开打包。以下内容属于私有商业边界，不进入公开仓库：

- 真实支付密钥、Webhook 凭证和结算规则
- 生产订单、库存、仓储、客户和分析数据
- 后台权限策略和内部运营流程
- 定价、会员、优惠券、推荐和风控规则
- 生产证书、备份、监控凭证和部署密钥
- Pro 后端服务代码

这种分离既让公开项目保持可评估、可贡献，也保护每个商家的凭证、客户、运营决策与部署配置。社区分支不得包含生产凭证、运营数据或部署配置。

## 启动社区版预览

环境要求：Docker Desktop 和 Git。

```powershell
git clone https://github.com/VolinChan/DigitalProductStore-community.git
cd DigitalProductStore-community
copy .env.community.example .env
docker compose -f docker-compose.community.yml up --build
```

打开 <http://localhost:3000>。

社区版 Compose 只启动前端预览，不启动生产 API、数据库、Nginx、Grafana、Prometheus，也不会接入真实支付。

## 可选的 Cloudflare 真实 IP 更新器

仓库提供一个无凭据、可复用的更新器，适合自行把 Nginx 容器部署在 Cloudflare 后方的用户。它通过 HTTPS 下载 Cloudflare 官方 IPv4/IPv6 代理网段，验证候选 Nginx 配置后再原子替换可信网段文件；只有完整验证通过才会 reload Nginx。配套 systemd timer 每日运行并加入随机延迟；下载、验证或 reload 失败时会保留最后一份可用配置。

相关文件：

```text
nginx/runtime/cloudflare-real-ip.conf                 当前公开基线
scripts/update-cloudflare-real-ip.sh                  带验证与回滚的更新脚本
scripts/systemd/plexoria-cloudflare-real-ip.service   systemd 单次服务
scripts/systemd/plexoria-cloudflare-real-ip.timer     每日定时器
```

前端 Community Compose 预览不会自动启用这项功能。若要用于自己的 Docker/Nginx 部署，需要把主机上保存 `cloudflare-real-ip.conf` 的目录挂载到 Nginx 容器的 `/etc/nginx/runtime`，在 Nginx `http` 上下文 include 该文件，并按实际安装修改 service 中的 `CLOUDFLARE_REAL_IP_TARGET` 与 `NGINX_CONTAINER`。只有来自这些 Cloudflare 官方网段的连接才应信任 `CF-Connecting-IP`，不要对任意直连来源设置全局信任。

## 许可证

社区版采用 [GNU AGPL v3.0](LICENSE)。私有部署、生产集成和商业支持不属于本公开仓库范围，需要单独的商业协议。

## 技术栈

| 层级 | 技术选型 |
|------|---------|
| **前端** | Next.js 16 · React 19 · TypeScript · Ant Design 6 · Tailwind CSS · Framer Motion · Zustand · Axios · Sonner（Toast） |
| **后端 API** | Go 1.25 · Gin · GORM · PostgreSQL · Redis · JWT 鉴权 · 支付渠道适配器 · 事务型邮件 |
| **基础设施** | Docker Compose · Nginx（反向代理、HTTPS/SSL、限流） · Prometheus · Grafana · Cloudflare Origin CA |
| **架构模式** | RESTful API · 微服务风格（Docker Compose） · 多子域名路由 · 后台任务（转账截止检查 & 提醒检查器） |

### 生产后端（私有）

生产后端的服务端结算校验、支付处理、订单管理、库存、配送、分析、管理面板和部署配置等完整商用能力维护在私有 Pro 仓库 (`VolinChan/DigitalProductStore-Pro`) 中。它会针对具体商家的环境进行配置与验证，不会连同真实密钥发布在 Community Edition 中。

### 商业授权

本项目采用**双重许可**。Community Edition 基于 AGPLv3 开源。如果你正在为实体商品业务评估 Plexoria，或需要不受 AGPL 义务约束的私有部署、商业支持、SLA、商品目录迁移、定制集成或白标授权，请通过 GitHub 联系 **[VolinChan](https://github.com/VolinChan)**。商业条款按具体项目协商。
