# ark-codex-pet 使用指南

> 前置条件：Node.js 20+ / pnpm 9+

---

## 一、安装依赖

```bash
pnpm install
```

如需按角色名直接生成，先准备本地角色数据库：

```bash
pnpm sync-db
```

数据库只会读取本地 `database/prts-characters.json`，不会在 `characters` / `generate` 时自动联网更新。

---

## 二、按角色名一键生成

`generate` 会自动完成数据库匹配、manifest 解析、资源下载、动画检查、自动配置生成与 bake。

```bash
pnpm generate:chrome 佩佩 --skin 默认 --view 基建
pnpm generate:chrome 伊芙利特 --skin 默认 --view 基建 --output dist/ifrit
```

如果本地还没有数据库文件，命令会直接报错并提示先执行 `pnpm sync-db`。

### 2.1 怎么找 skin / view 名称

如果你想生成的不是默认皮肤，而是某个时装，请按下面方式查：

1. 先查角色，`pnpm find` 的结果里会直接列出该角色可用的 `variants`，以及每个变体对应的可复制命令：

```bash
pnpm find 白金
```

如果你需要机器可读的 JSON 结果，可以使用：

```bash
pnpm find 白金 --json
```

2. 直接从结果里复制：

- `skin`
- `view`

例如：

```bash
pnpm generate:chrome 白金 --skin 灿阳朝露 SD05 --view 正面
```

3. 如果你还想手动核对，再打开本地数据库文件：

```text
database/prts-characters.json
```

4. 搜索角色名或 `characterId`，在对应条目的 `variants` 数组里查看：

```json
{
  "skin": "灿阳朝露 SD05",
  "view": "正面",
  "file": "char_204_platnm_summer_3/front/char_204_platnm_summer_3"
}
```

也可以直接使用一键脚本：

```bash
./scripts/generate-codex.sh 佩佩 默认 基建
```

```bat
scripts\generate-codex.bat 佩佩 默认 基建
```

常用辅助命令：

```bash
pnpm characters --query 佩佩
pnpm characters --query Ifrit
```

---

## 三、完整工作流（八步走）

### 第 1 步 · 查列表

拉取 PRTS 上指定角色的元数据，**列出所有可用的皮肤/视图组合**。
不解析具体资源 URL，仅用于快速查看有哪些可选 variant。

```bash
pnpm inspect -- char_4058_pepe --list
```

---

### 第 2 步 · 查详情

指定皮肤「默认」+ 视图「基建」，解析出 `.skel` / `.atlas` / 纹理的 URL。
同时会读取 Spine 导出器版本（如 `3.8.xx`）并输出到终端。

```bash
pnpm inspect -- char_4058_pepe --skin 默认 --view 基建
```

---

### 第 3 步 · 存清单

与上一步相同，但把解析出的 manifest JSON **写入文件**，供后续 `download` 命令使用。

```bash
pnpm inspect -- char_4058_pepe --skin 默认 --view 基建 \
  --output .cache/pepe.manifest.json
```

---

### 第 4 步 · 下载资源包

根据 manifest 中解析出的 URL，把 `.skel` / `.atlas` / 纹理下载到本地目录，
形成一个**本地 Spine 资源包**。

```bash
pnpm download -- .cache/pepe.manifest.json --output .cache/pepe
```

---

### 第 5 步 · 检查动画

检查本地包里所有动画的**名称、时长、设置姿态边界、采样边界**。
默认每动画采样 16 个时间戳，输出 JSON 报告。
用于决定哪些动画能映射到哪些 Codex 状态。

```bash
pnpm inspect-animations -- .cache/pepe \
  --output .cache/pepe.animations.json
```

---

### 第 6 步 · 安装浏览器

为 `preview` / `bake` 步骤安装 Playwright 的 Chromium。
烘焙需要无头浏览器驱动 Spine 运行时来渲染确定性帧。

```bash
pnpm exec playwright install chromium
```

> 如果本地已安装 Google Chrome，可跳过此步，改用 `pnpm preview:chrome` 和 `pnpm bake:chrome` 命令。

---

### 第 7 步 · 单动画预览

**试渲染单个动画**：把 `Move` 动画采 8 帧，输出 512×512 透明 PNG + `contact-sheet.png`。
用于在正式 bake 前目检动画效果和边界是否合适。

```bash
pnpm preview -- .cache/pepe --animation Move --frames 8 \
  --width 512 --height 512 --output .cache/preview-move
```

---

### 第 8 步 · 烘焙（核心步骤）

按配置 JSON 把源动画映射到 Codex 状态：
- 仅渲染唯一映射的动画，应用统一缩放 + 底部中心基线
- 派生状态（如 `running-left` 镜像、`jumping` 垂直弧线）在此步变换生成

最终输出 Codex 资源包到 `dist/pepe`：

```text
dist/pepe/
├── pet.json
├── spritesheet.webp
├── mapping.json
└── qa/
    ├── contact-sheet.png
    ├── validation.json
    ├── animations/
    └── states/
```

执行命令：

```bash
pnpm bake -- .cache/pepe \
  --config examples/char_4058_pepe.codex.json \
  --output dist/pepe
```

> 本地 Chrome 版本：`pnpm bake:chrome -- ...`（无需安装 Playwright Chromium）

---

## 四、Bake 配置 JSON 书写速查

### 4.1 Codex 版本切换

配置文件中的 `codexVersion` 字段控制产物版本：

| codexVersion | 状态行数 | 所需状态 |
|:---:|:---:|:---|
| `1` | 9 行 | `idle` … `review`（共 9 个） |
| `2` | 11 行 | 上述 9 个 + `look-directions-a`、`look-directions-b` |

> 同一套配置**只改一个数字**即可切换版本。V2 是 V1 超集，所以 V2 配置改 `codexVersion: 1` 可直接生成 V1 产物（多出的状态配置被忽略）。

---

### 4.2 states 的两类核心映射

`states` 对象里的每个状态有两种写法：

#### ① 直接动画映射（渲染源 Spine 动画）

```json
"idle": { "animation": "Relax", "frames": 8 }
```

| 字段 | 说明 |
|:---|:---|
| `animation` | Spine 动画名，**必须**是 `inspect-animations` 输出里列出的那些 |
| `frames` | 固定写 `8`（Codex 规范每状态 8 帧） |

#### ② 派生状态（从已有状态变换，无需重新渲染）

**水平镜像示例**：

```json
"running-left": { "deriveFrom": "running-right", "flipX": true }
```

**垂直位移弧线示例（合成跳跃）**：

```json
"jumping": {
  "deriveFrom": "idle",
  "offsetY": [0, -6, -12, -18, -18, -12, -6, 0]
}
```

| 字段 | 说明 |
|:---|:---|
| `deriveFrom` | 从哪个已有状态派生 —— **那个状态必须在派生之前就写好**（按 JSON key 顺序处理） |
| `flipX: true` | 水平翻转（镜像），常用于「向左跑」← 镜像「向右跑」 |
| `offsetY: number[8]` | 每帧垂直偏移（px），**正值向下，负值向上**。8 个元素分别对应第 0…7 帧 |

> ⚠️ `flipX` 和 `offsetY` **至少写一个**，两个都写也可以，一个都不写会被 Zod 校验拒绝。

---

### 4.3 编写配置的最短流程

1. 运行 `pnpm inspect-animations` → 拿到可用的 Spine 动画名列表
2. 运行 `pnpm preview --animation Relax` → 目测动画语义匹配哪个 Codex 状态
3. 先填**直接映射**的状态（`idle`、`running-right` 等），再**派生**出 `running-left` 和 `jumping`
4. `normalization.baselineY` 经验值 **198**、`padding` 经验值 **10**；bake 后打开 `dist/<pet>/qa/contact-sheet.png`，看有没有被裁切或上下漂移，再微调

---

### 4.4 详细字段说明

每个字段的完整类型 / 约束 / 取值范围，请见
[README_zh.md · Bake 配置 JSON 完整说明](README_zh.md#L123-L275) 一节。
