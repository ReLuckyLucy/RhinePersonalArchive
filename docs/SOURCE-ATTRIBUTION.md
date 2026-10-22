# 来源记录

本项目界面基于 RhineLabUI，来源提交 `12cc5e4`（LBEILC，MIT，原许可见项目 LICENSE）。保留共享标志、字体、色彩、搜索窗口和档案详情构图；导航与档案业务按私人资料系统重新组织。

直接保留：`src/brand.ts` → `src/ui/brand.ts`；`src/ui-transitions.ts` → `src/ui/transitions.ts`；`src/html.ts` → `src/ui/html.ts`；`src/fonts.css` 与 `public/fonts`；rolling-number 的本地坐标测量修补脚本。文件均通过 Git 提交对象提取，没有复制原工作目录的未提交修改。

MiSans：小米，使用上游项目固定的 misans-webfont 4.3.1 分包，来源和许可保留在 public/fonts。Novecento 未在当前提取资产中发现，本版本不另行从网络恢复。

line 当前仅作为流程与数据概念参考，未复制其 React/vinext 应用或未提交实现。后续实际提取时补充具体来源记录。

原 Git 对象与当前提取文件的 SHA-256 记录见 source-fingerprints.json，逐个注明来源提交与新位置。

2026-10-20 按用户澄清接回原版玻璃档案阵列。`src/rhine/` 的场景、光照、材质、波浪、惯性输入、循环、视口和渲染优化来自同一提交；原始 GLB 为 `public/assets/archive-cassette.glb`，字节保持不变。上游指纹与本地适配指纹见 `rhine-scene-fingerprints.json`。沿用上游美术成果，未新制模型；生成源工程与脚本保留于上游该提交的 `art/`。

本地适配：`data.ts` 替换为真实档案；场景按实际非空分类数和每列数量重定位、支持取消模型载入、移除独立拆解模型接口，并在标签显示档案标题。`wave.ts` 接入本地界面与搜索。原独立查看器及 assembly GLB 不包含在本项目；上游工作区未修改。
