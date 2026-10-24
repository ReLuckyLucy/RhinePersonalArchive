# 文件用途地图

本页按职责列出应用自身维护的模块。第三方字体分包和依赖不逐个展开；资源许可与来源见 [SOURCE-ATTRIBUTION.md](SOURCE-ATTRIBUTION.md)。完整数据流见[架构](ARCHITECTURE.md)。

## 根目录、运行与发布

| 路径 | 用途 |
| --- | --- |
| `package.json` | 版本、Node 范围、锁定依赖和开发/测试/打包命令 |
| `package-lock.json` | 可复现的 npm 依赖树 |
| `tsconfig.json` | 前后端及共享 TypeScript 检查配置 |
| `vite.config.ts` | 浏览器构建、资源分包和开发配置 |
| `index.html` | 浏览器应用入口文档 |
| `启动档案.cmd`、`停止档案.cmd` | Windows 双击运行入口，便携包使用包内 Node |
| `Dockerfile` | 同一应用的容器构建、资源准备、用户与健康检查 |
| `compose.yaml` | 回环端口、持久化卷和容器运行配置 |
| `.dockerignore` | 排除资料、构建产物和其他不应进入镜像上下文的内容 |
| `.gitignore` | 排除本机配置、依赖和生成内容；不代替发布隐私检查 |
| `.github/workflows/` | 公共持续集成检查配置 |
| `LICENSE`、`NOTICE` | 代码许可和第三方来源提示 |
| `README.md` | 安装、使用、配置与开发总入口 |
| `CHANGELOG.md`、`SECURITY.md` | 版本变化及安全/隐私边界 |
| `TODO.md`、`PROJECT_STATE.md`、`DEVELOPMENT_LOG.md` | 后续任务、实际验收状态和开发连续记录 |

## 浏览器应用

| 路径 | 用途 |
| --- | --- |
| `src/main.ts` | 应用装配、导航、页面切换、设置与全局交互 |
| `src/app/state.ts` | 页面状态、分类名称与初始选择 |
| `src/app/router.ts` | 保存上次浏览页面 |
| `src/api/client.ts` | 本机会话、CSRF 和 API 请求/错误处理 |
| `src/fonts.css` | 本地 MiSans 字体声明 |
| `src/styles/base.css` | 基础排版、控件和通用元素 |
| `src/styles/layout.css` | 页面、表单、详情、检索和简历布局 |
| `src/styles/theme.css` | 明暗主题及视觉变量 |
| `src/styles/wave.css` | 档案阵列与正文层的界面布局 |
| `src/styles/resume.css` | 简历阶段定位、固定操作栏、预览与窄屏布局 |
| `src/ui/brand.ts` | DOM 使用的共享品牌图形和文字 |
| `src/ui/html.ts` | HTML 文本转义 |
| `src/ui/modal.ts` | 弹窗生命周期、输入隔离和焦点返回 |
| `src/ui/transitions.ts` | 可打断的界面/正文过渡 |
| `src/ui/preferences.ts` | 主题、动效和声音偏好持久化 |
| `src/ui/audio.ts` | 遵循偏好的本地交互提示音 |

## 档案、核对、简历与设置界面

| 路径 | 用途 |
| --- | --- |
| `src/features/archives/wave.ts` | 业务档案与三维场景连接、选择/读取、详情进出及资源生命周期 |
| `src/features/archives/editor.ts` | 新建/编辑档案、日期精度、类型专属字段和页面会话草稿 |
| `src/features/archives/detail.ts` | 类型对应的详情内容、展开阅读、贡献/原件对照及当前阅读状态保留 |
| `src/features/archives/import.ts` | 可选 JSON 清单路径输入和导入结果 |
| `src/features/archives/add-material.ts` | 首页添加材料、明确归属、失败保留选择及成功后进入档案 |
| `src/features/archives/navigation.ts` | 档案页签定位及待整理动作的界面契约 |
| `src/features/archives/organize.ts` | 归档、恢复和合并的操作界面 |
| `src/features/archives/preview.ts` | 固定材料版本的原件/文字切换、定位、过期响应隔离与展示清理 |
| `src/features/archives/text-editor.ts` | 原始提取结果与人工校对的修订提交，保存后通知当前文字预览 |
| `src/features/review/page.ts` | 待整理列表及批量文字提取入口 |
| `src/features/extraction/progress.ts` | 全库统计/单档案紧凑摘要、可见时刷新、失败原因与手动重试 |
| `src/features/review/editor.ts` | 事实、成果归属、证明字段、证据位置/摘录/等级表单 |
| `src/features/search/modal.ts` | 搜索弹窗、筛选、键盘结果导航和读取定位 |
| `src/features/resume/page.ts` | 简历工作台初始说明与空态 |
| `src/features/resume/workspace.ts` | 草稿列表、按简历保存的会话输入、等待在途保存后恢复编辑 |
| `src/features/resume/editor.ts` | 阶段定位、选材/表述、预览状态、版本导出对象与串行操作 |
| `src/features/settings/page.ts` | 本机资料库和备份路径设置 |
| `src/features/library/indicator.ts` | 当前资料库名称、只读位置/数量弹窗、重试及设置入口 |
| `src/features/settings/backup.ts` | 加密备份、恢复验证和切换库的表单 |

## 三维场景

`src/rhine/` 保留上游的原生场景实现。部分模块含通用或上游保留能力，文件存在不代表所有能力都已在本产品界面开放。

| 路径 | 用途 |
| --- | --- |
| `src/rhine/scene.ts` | 主场景、相机、模型、实例阵列、选择/抽取/归位与每帧更新 |
| `src/rhine/data.ts` | 实际档案到非空分类、列、行和场景记录的映射 |
| `src/rhine/asset-url.ts` | 资源 URL 统一处理 |
| `src/rhine/brand.ts` | 三维标签共享品牌轮廓与文字 |
| `src/rhine/appearance.ts` | 卡片材质与磨砂/清晰状态 |
| `src/rhine/archive-lighting.ts` | 场景光照和环境配置 |
| `src/rhine/archive-loop.ts` | 阵列循环、逻辑位置与邻近副本换算 |
| `src/rhine/archive-drag.ts` | 屏幕投影轨道、自由拖动与连续惯性 |
| `src/rhine/archive-visibility.ts` | 镜头和视口决定的阵列候选范围与可见性 |
| `src/rhine/archive-draw-coverage.ts` | 可见实例及阴影覆盖的紧凑提交 |
| `src/rhine/archive-play-motion.ts` | 上游节奏包络、位移和接力运动辅助；不是团队任务功能 |
| `src/rhine/motion.ts` | 波浪、抬起、归位、阻尼和运动常量 |
| `src/rhine/motion-preferences.ts` | 完整/减少/自定义动效状态与辅助方法 |
| `src/rhine/decryption.ts` | 玻璃解密扫描线的非线性轨迹与状态 |
| `src/rhine/glass-reveal.ts` | 磨砂折射与自上而下清晰的着色器片段 |
| `src/rhine/internal-optics.ts` | 内构光学材质与着色器适配 |
| `src/rhine/theme-material.ts` | 明暗材质和环境变化 |
| `src/rhine/theme-motion.ts` | 沿阵列传播的主题过渡 |
| `src/rhine/render-quality.ts` | 画质配置、规范化与有效渲染尺寸 |
| `src/rhine/quality-renderer.ts` | 纹理质量、渲染尺寸及通用后处理装配 |
| `src/rhine/shared-depth.ts` | AO 和景深复用深度资源的扩展 |
| `src/rhine/render-state.ts` | 静止画面复用及失效状态 |
| `src/rhine/instance-updates.ts` | 实例属性变化区间上传 |
| `src/rhine/three-resources.ts` | 几何、材质、纹理等三维资源释放 |
| `src/rhine/viewport-layout.ts` | 视口尺寸、响应布局与相机取景计算 |
| `public/assets/archive-cassette.glb` | 上游玻璃档案模型，来源与指纹单独记录 |
| `public/fonts/` | 同源字体、分包、许可证和来源元数据 |

## 本机服务与共享契约

| 路径 | 用途 |
| --- | --- |
| `server/main.ts` | 载入配置、开库、监听、实例记录、停止和重启 |
| `server/config.ts` | 默认路径、环境变量覆盖、配置验证和保存 |
| `server/app.ts` | HTTP/API 路由、静态文件/开发模式、上传和任务装配 |
| `server/session.ts` | Host/Origin、本机会话和 CSRF 检查 |
| `server/db/database.ts` | 资料库目录、SQLite 连接、写队列和关闭 |
| `server/db/migrations.ts` | 业务表增量迁移及迁移前保护 |
| `server/db/search-migration.ts` | 检索结构迁移 |
| `server/db/transaction.ts` | 同步事务和异步写入串行队列 |
| `shared/schemas.ts` | 档案、日期、事实、证据、个人信息和草稿输入验证 |
| `shared/domain.ts` | 前后端共用领域和配置类型 |
| `shared/api.ts` | 应用身份、会话、资料库身份与提取进度契约 |
| `shared/errors.ts` | 有编码、状态和字段信息的业务错误 |
| `shared/resume-document.ts` | 简历文档结构、检查项与共享 HTML/打印模板 |

## 资料、事实与搜索服务

| 路径 | 用途 |
| --- | --- |
| `server/archive/repository.ts` | 档案和个人信息的查询、保存、修订及字段核对 |
| `server/archive/organize.ts` | 归档、恢复和合并，迁移来源与事实归属 |
| `server/archive/facts.ts` | 事实历史、确认/撤回、证据验证和待整理理由 |
| `server/sources/paths.ts` | 库内路径限制、稳定读文件与 SHA-256 |
| `server/sources/repository.ts` | 材料/版本查询、文件可用性与指纹核对 |
| `server/sources/import.ts` | JSON 清单、来源去重/版本、稳定主题归属、上传和重新定位 |
| `server/sources/http.ts` | 原件流式返回、下载、Range 和系统打开操作 |
| `server/sources/jobs.ts` | 提取排队、恢复、Worker 生命周期、超时与状态更新 |
| `server/sources/progress.ts` | 当前材料版本及最新任务的只读统计，按档案筛选且不重复计数 |
| `server/sources/extract-worker.ts` | 隔离调用提取并返回结果/错误 |
| `server/sources/extract.ts` | 文本、DOCX、PDF、OCR 提取及修订号保护的人工校订 |
| `server/search/service.ts` | 档案、事实、材料及正文的搜索、筛选、摘要和定位 |

## 简历与备份服务

| 路径 | 用途 |
| --- | --- |
| `server/resume/service.ts` | 草稿、证明字段检查、文档构建、不可变版本与历史读取 |
| `server/resume/wording.ts` | 投递表述新增未确认数字、角色或技术词的基础检查 |
| `server/resume/match.ts` | 本地岗位关键词命中与缺口提示 |
| `server/resume/pdf.ts` | 本地字体服务、受限 Chromium 渲染和页数读取 |
| `server/resume/docx.ts` | 从共享文档结构生成可编辑 Word |
| `server/resume/export.ts` | 导出临时文件、结果校验、指纹和记录 |
| `server/backup/manifest.ts` | 数据库逻辑清单，用于恢复一致性比较 |
| `server/backup/crypto.ts` | 备份格式、scrypt、AES-GCM 和安全条目路径 |
| `server/backup/service.ts` | 快照、原件/导出核验、打包、恢复与显式切换 |

## 工具脚本

| 路径 | 用途 |
| --- | --- |
| `scripts/setup.mjs` | 首次 OCR 与配套浏览器准备入口 |
| `scripts/prepare-local-assets.mjs` | 复制 OCR、记录资源哈希和可选安装 Chromium/系统依赖 |
| `scripts/patch-rolling-number.mjs` | 对固定版本滚动文字依赖应用已记录的测量修补 |
| `scripts/start-local.mjs` | 检查端口身份，后台启动并等待本机服务 |
| `scripts/stop-local.mjs` | 核对实例后请求有序停止 |
| `scripts/open-browser.mjs`、`scripts/open-browser.ps1` | 跨平台/Windows 浏览器打开辅助 |
| `scripts/open-source.mjs`、`scripts/open-source.ps1`、`scripts/open-source.d.mts` | 系统原件打开、容器限制与 TypeScript 类型声明 |
| `scripts/create-test-materials.mjs` | 生成合成 DOCX、PDF、扫描件和图片测试夹具 |
| `scripts/test-browser.mjs` | 创建隔离合成库，逐个执行浏览器测试并限制外部请求 |
| `scripts/verify-library.mjs` | 显式指定库的原件指纹与清单导入验证；会写入测试库 |
| `scripts/smoke-app.mjs` | 对指定空库服务执行发布业务验收，可检查重启持久化；不要对日常库执行 |
| `scripts/release-files.mjs` | 公共文件允许列表、遍历和隐私/密钥/运行数据检查 |
| `scripts/package-release.mjs` | 源码/Windows 暂存、生产依赖与资源组装、清单和 ZIP 校验 |
| `scripts/check-release.mjs` | 对指定发行暂存目录执行内容检查 |
| `scripts/zip.mjs` | ZIP 输出辅助 |

## 测试与合成示例

| 路径 | 责任 |
| --- | --- |
| `tests/helpers/library.ts`、`seed.ts` | 临时库生命周期和合成领域数据 |
| `tests/fixtures/materials/` | 合成正常/损坏 PDF、DOCX、扫描件和图片 |
| `tests/integration/library.test.ts`、`lifecycle.test.ts` | 开库、迁移、服务和资源生命周期 |
| `tests/integration/runtime.test.ts` | 默认配置、环境覆盖、启动/停止及容器边界 |
| `tests/integration/import.test.ts`、`import-integrity.test.ts`、`private-import.test.ts` | 合成导入、指纹、重复关系和组织后重导入；文件名不代表内含私人材料 |
| `tests/integration/extraction.test.ts` | 支持格式、OCR、提取修订及并发保护 |
| `tests/integration/extraction-progress.test.ts` | 进度去重/版本/认证/只读及按状态安全排队 |
| `tests/integration/facts.test.ts` | 证据、确认、撤回和参考档案规则 |
| `tests/integration/search.test.ts` | 文字、筛选、中文与特殊字符检索 |
| `tests/integration/resume.test.ts`、`export.test.ts` | 事实约束、版本冻结、表述与 PDF/DOCX 内容 |
| `tests/integration/backup.test.ts` | 完整备份、错误口令、不安全条目和新目录恢复 |
| `tests/integration/wave-data.test.ts` | 非空分类与实际档案到阵列的数据映射 |
| `tests/browser/onboarding.test.mjs`、`journey.test.mjs` | 空库入口及贯穿材料、事实、简历的用户流程 |
| `tests/browser/extraction-progress.test.mjs` | 自动进度、失败重试、读取恢复、窄屏及退出后的轮询清理 |
| `tests/browser/actions.test.mjs` | 入口、按原因跳转、返回焦点、指定归属上传和失败恢复 |
| `tests/browser/reading.test.mjs` | 阅读空间、贡献/原件对照、文字校对刷新、异步切换、收藏草稿保留与参考类型 |
| `tests/browser/resume-flow.test.mjs` | 实际版本导出、编辑与历史对象、在途保存、会话恢复、检查提示和固定操作栏 |
| `tests/browser/shell.test.mjs`、`search.test.mjs`、`detail.test.mjs` | 导航、检索、详情和键盘交互 |
| `tests/browser/review.test.mjs`、`revisions.test.mjs`、`resume.test.mjs` | 待整理、修订、证据与简历编辑操作 |
| `tests/browser/wave.test.mjs`、`wave-lifecycle.test.mjs` | 实际三维界面、选择、过渡与资源生命周期 |
| `examples/catalog.json`、`project-proof.txt` | 可复制到空库试用的导入清单与合成材料 |

## 文档与生成目录

`docs/LOCAL-RUN.md` 解释使用和配置，`DATA-RECOVERY.md` 解释备份恢复，`ARCHITECTURE.md` 解释数据流，`RELEASING.md` 解释打包与验收。`SOURCE-ATTRIBUTION.md` 及两份 `*-fingerprints.json` 保存来源证据。

`docs/UX-REVIEW.md` 保留产品操作走查、问题优先级与分批实施状态。
`docs/RESUME-USABILITY-PLAN.md` 记录简历操作改进的范围、实现与验收结果。

`dist/`、`node_modules/`、`runtime/` 和 `release/` 是构建、依赖、运行和发布生成目录。它们不能作为业务源码修改位置。`runtime/library` 中的内容是用户数据，不应在测试、清理或发布时递归打包。

发行辅助文件：`scripts/zip.mjs` 以流式方式创建 UTF-8 ZIP；`scripts/smoke-app.mjs` 以合成资料验证运行包和容器全流程及重启持久化；`licenses/NODE-v24.10.0.txt` 是 Windows 包内 Node 的固定版本原始许可；`docs/media/archive-demo.png` 是合成资料界面截图。
