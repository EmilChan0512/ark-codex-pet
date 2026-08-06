# 安装项目依赖（Node.js 20+ / pnpm 9+）
pnpm install

# 【查列表】拉取 PRTS 上 char_4058_pepe 的元数据，列出所有可用皮肤/视图组合
# 不解析具体资源 URL，仅用于查看有哪些可选 variant
pnpm inspect -- char_4058_pepe --list

# 【查详情】指定皮肤「默认」+ 视图「基建」，解析出 .skel/.atlas/纹理 的 URL
# 同时读取 Spine 导出器版本（如 3.8.xx），输出到终端
pnpm inspect -- char_4058_pepe --skin 默认 --view 基建

# 【存清单】同上，但把解析出的 manifest JSON 写入文件，供后续 download 使用
pnpm inspect -- char_4058_pepe --skin 默认 --view 基建 \
  --output .cache/pepe.manifest.json

# 【下载】根据 manifest 中解析出的 URL，把 .skel/.atlas/纹理 下载到本地目录
# 形成一个本地 Spine 资源包
pnpm download -- .cache/pepe.manifest.json --output .cache/pepe

# 【查动画】检查本地包里所有动画的名称、时长、设置姿态边界、采样边界
# 默认每动画采样 16 个时间戳，输出 JSON 报告
# 用于决定哪些动画能映射到 Codex 状态
pnpm inspect-animations -- .cache/pepe \
  --output .cache/pepe.animations.json

# 【装浏览器】为 preview/bake 步骤安装 Playwright 的 Chromium
# 烘焙需要无头浏览器驱动 Spine 运行时来渲染确定性帧
pnpm exec playwright install chromium

# 【预览】单动画试渲染：把 Move 动画采 8 帧，输出 512×512 透明 PNG + contact-sheet.png
# 用于在正式 bake 前目检动画效果和边界是否合适
pnpm preview -- .cache/pepe --animation Move --frames 8 \
  --width 512 --height 512 --output .cache/preview-move

# 【烘焙】核心步骤：按配置 JSON 把源动画映射到 Codex 状态
# 仅渲染唯一映射的动画，应用统一缩放 + 底部中心基线
# 派生状态（如 running-left 镜像、jumping 垂直弧线）在此步变换生成
# 最终输出 Codex 资源包到 dist/pepe：
#   pet.json + spritesheet.webp + mapping.json + qa/
pnpm bake -- .cache/pepe \
  --config examples/char_4058_pepe.codex.json \
  --output dist/pepe

# ========================================================================
# 附：Bake 配置 JSON 书写速查
# ========================================================================

# ---- Codex 版本切换 ----
# 配置文件中的 codexVersion 字段控制版本：
#   "codexVersion": 1   → 只需 9 个状态（idle…review）
#   "codexVersion": 2   → 需要 11 个状态（多 look-directions-a/b）
# 同一套配置改一个数字即可切换版本，无需改其他字段（V2 是 V1 超集）。

# ---- 配置文件的两类核心映射 ----
# states 里的每个状态有两种写法：
#
# ① 直接动画映射（渲染源 Spine 动画）：
#    "idle": { "animation": "Relax", "frames": 8 }
#    - animation：Spine 动画名，必须是 inspect-animations 里列出的那些
#    - frames：固定写 8
#
# ② 派生状态（从已有的状态变换，不用重新渲染）：
#    "running-left": { "deriveFrom": "running-right", "flipX": true }
#    "jumping": {
#      "deriveFrom": "idle",
#      "offsetY": [0, -6, -12, -18, -18, -12, -6, 0]
#    }
#    - deriveFrom：从哪个已有状态派生（那个状态必须在派生之前就写好）
#    - flipX: true：水平镜像
#    - offsetY: [8 个整数]：每帧垂直偏移，正=向下，负=向上
#    注意：flipX 和 offsetY 至少写一个

# ---- 编写配置的最短流程 ----
# 1. pnpm inspect-animations → 拿到可用的 Spine 动画名
# 2. pnpm preview --animation Relax → 目测动画语义匹配哪个 Codex 状态
# 3. 先填直接映射（idle、running-right 等），再派生 running-left 和 jumping
# 4. normalization.baselineY 经验值 198、padding 经验值 10，bake 后看
#    dist/<pet>/qa/contact-sheet.png 有没有被裁切或上下漂移，再微调

# ---- 详细字段说明 ----
# 每个字段的类型/约束/取值范围请见 README_zh.md 的
# 「Bake 配置 JSON 完整说明」一节。
