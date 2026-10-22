# 构建、验收与发布

发布对象为 [ReLuckyLucy/RhinePersonalArchive](https://github.com/ReLuckyLucy/RhinePersonalArchive)，当前版本 `0.1.0`。源码 ZIP、Windows x64 便携 ZIP 和容器均来自同一代码。个人资料、运行配置、数据库、备份和日志不得混入源树、容器上下文、公开 Git 历史或发布包。

## 准备环境

使用 Node `>=24.10.0 <25` 和锁文件，Windows 便携版必须用 Node 24.10.0 x64 在 Windows 上组装（随包保留该版本的 Node 许可）。使用全新或明确隔离的合成库，OCR/浏览器目录由配置或默认 `runtime` 提供。

```sh
npm ci
npm run setup
npm test
npm run test:e2e
npm run build
```

浏览器测试使用本机配套 Chromium。修改后若测试失败，区分应用失败、操作系统/浏览器依赖缺失和测试环境问题；不能把未执行的检查写成通过。Word 内容测试不等于办公软件视觉检查。

## 生成发行包

```sh
npm run package:source
npm run package:windows
```

输出位于 `release/`：

- `RhinePersonalArchive-v0.1.0-source.zip`：允许发布的源码、锁文件、说明、许可、合成示例和测试代码；不包含安装后的依赖及私人运行数据。
- `RhinePersonalArchive-v0.1.0-windows-x64.zip`：包含源码运行所需文件、`node.exe`、`dist/`、生产依赖、OCR、配套 Chromium 与启动/停止入口，可在没有系统 Node 的 Windows 上运行。
- 每个 ZIP 的 `.sha256` 校验文件；包内 `RELEASE-MANIFEST.json` 记录版本、类型、生成时间与内容检查结果。汇总校验文件由发行流程一并提供。

打包脚本使用文件允许列表和内容检查，不能用把整个工作目录压缩的方式替代。Windows 生产依赖从锁文件重新安装，不复制开发用 `node_modules`。打包从当前 Node 可执行文件取运行时，所以应先确认其版本与架构。输出暂存目录已存在时脚本会拒绝，防止旧文件混入；保留需归档结果后，对明确的旧暂存目录作清理或移动，再重新打包。

检查暂存目录：

```sh
npm run check:release -- release/RhinePersonalArchive-v0.1.0-source
npm run check:release -- release/RhinePersonalArchive-v0.1.0-windows-x64 --portable
```

注意 `check:release` 需要目录参数。校验下载后 ZIP，PowerShell 示例：

```powershell
Get-FileHash ./RhinePersonalArchive-v0.1.0-source.zip -Algorithm SHA256
```

将结果与发布页提供的校验文件逐字比较。校验可以发现传输或内容变化，不替代对下载来源的判断。

## 从干净解压目录验收

源码 ZIP 解压到新目录，按 README 执行 `npm ci`、`setup`、`build`、`start`。便携 ZIP 在新目录直接启动，确保实际使用包内 Node、OCR 和浏览器。不要依赖开发电脑上已有的私有配置、默认浏览器缓存或另一个正在运行的实例。

每种发行方式至少检查：

1. 首次空库可新建并保存档案；返回、选卡片、读取正常。
2. 上传合成文本/DOCX/PDF/扫描件，提取与搜索可用；人工修订在重新提取后保留。
3. 建立事实、关联证据并人工确认；参考档案不能绕过归属限制。
4. 保存简历草稿、冻结版本，导出 PDF 和 DOCX；核对内容，单独记录视觉检查结果。
5. 备份完整，恢复到新目录、验证和切换成功，原库保留。
6. 停止、重启后数据和版本保留，未完成任务可恢复，端口身份检查有效。

另外回归导入后改名/合并/归档再导入，以及提取 Worker 与人工文字修订并发的情况。自动测试使用合成材料，不接入日常个人库。

## 容器验收

```sh
docker compose build
docker compose up -d
docker compose ps
docker compose logs archive
```

确认健康检查通过，在宿主浏览器完成上面的材料→事实→简历→备份流程。停止重建后沿用命名卷，核对已保存资料。检查只有回环端口发布、容器用户权限可写、备份有容器外副本。`docker compose down -v` 不能作为普通重启步骤。Compose 路径和卷说明见[运行指南](LOCAL-RUN.md#docker-运行)。

Windows 如果由某些打包应用的代理环境启动 Docker 后出现 `sailor-ingest.sock` 错误，可先从开始菜单正常启动 Docker Desktop，再检查引擎状态；不要因此清空 Docker 数据。相关环境问题见 [Codex issue 52698](https://github.com/openai/codex/issues/52698)。

## 隐私与来源检查

公开 Git 应只含批准的公共文件与干净公开历史。检查暂存文件、包内文件、解压结果与 Git 对象，不能只依靠 `.gitignore`。不得包含真实个人库、姓名/证件/联系方式、私人绝对路径、日志、密钥、备份包、数据库或旧私有历史；测试与截图只用合成材料。

保留 MIT、字体与资源许可，来源指纹及上游署名见 [SOURCE-ATTRIBUTION.md](SOURCE-ATTRIBUTION.md)。核对 npm 锁定依赖与当前安全公告，记录未解决风险，不强制切换到不兼容或更旧的版本来消除审计数字。

## 发布记录

同步版本号、CHANGELOG、镜像标签、README 链接和文件名。发布 `v0.1.0` 标签及 ZIP/校验文件后，重新读取远程仓库与 Release，确认可见性、提交、文件名和下载内容。不要推送旧私有分支或本地全部标签。

将实际测试命令、结果、未完成验收与环境限制写入 [PROJECT_STATE.md](../PROJECT_STATE.md) 和 [DEVELOPMENT_LOG.md](../DEVELOPMENT_LOG.md)。这些状态记录是验收依据；构建脚本、此清单和 CI 配置本身不构成运行成功证明。
