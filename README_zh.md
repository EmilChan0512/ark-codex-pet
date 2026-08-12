# ark-codex-pet

![ark-codex-pet 像素风新手引导图](./docs/readme-onboarding-banner.png)

## 快速开始

```bash
pnpm sync-db
```

```bash
pnpm find 佩佩
```

```bash
pnpm generate:chrome 佩佩 --skin 默认 --view 基建
```

需要 Node.js 20+ 和 pnpm 9+。

> 若本机没有 Chrome，请改用 `pnpm generate`。
> 🔎 查角色可直接用 `pnpm find 佩佩`。
> 🎨 查皮肤名优先用 `pnpm find 角色名`，结果里会直接列出可用的 `skin` / `view` 和可复制的生成命令。
> 🧾 若需要 JSON 输出，可改用 `pnpm find 佩佩 --json`。
> 📦 默认产物目录是 `dist/pepe`，将其中的 `pet.json` 和 `spritesheet.webp` 复制到 `~/.codex/pets/pepe`。

将 PRTS 元数据描述的《明日方舟》Spine 资源转换为可用于 Codex 自定义宠物的确定性精灵图集。

> 已可用于按角色名检索、自动拉取 PRTS 资源、生成 Codex 宠物配置，并输出最终可用的宠物产物。
> `generate` 成功后会额外写出一份可读配置到 `examples/auto/<角色名>.codex.json`，方便后续手改。

## 处理流程

```text
PRTS meta.json
  -> 解析 .skel/.atlas/纹理 的 URL
  -> 检测 Spine 导出器版本
  -> 选择匹配的运行时适配器
  -> 检查动画并将其映射到 Codex 状态
  -> 确定性采样透明帧
  -> 标准化缩放比例与基线
  -> 合成 spritesheet.webp + pet.json
```

## 当前里程碑

- 获取并验证 PRTS 的 `meta.json`
- 列出可用的皮肤和视图
- 解析 `.skel` 和 `.atlas` 文件的 URL
- 从 Spine 图集中解析一个或多个纹理页
- 从二进制 `.skel` 文件头读取哈希值和导出器版本
- 推荐一个带版本的运行时键，例如 `spine-3.8`
- 下载确定的本地 Spine 资源包
- 检查 Spine 3.8 的动画名称、持续时间、设置姿态边界和采样边界
- 在 GitHub Actions 中运行类型检查和单元测试

## 使用方法

需要 Node.js 20+ 和 pnpm 9+。

### 如何找到皮肤名称

很多用户真正想生成的不是默认皮肤，而是某个时装或特殊视图。现在最直接的查找方式如下：

1. 先查角色，`pnpm find` 的结果里会直接列出该角色可用的 `variants`，以及每个变体对应的可复制 `generate` / `generate:chrome` 命令：

```bash
pnpm find 白金
```

2. 结果里的每一项都会包含：

- `skin`
- `view`
- `file`

直接把 `skin` 和 `view` 原样复制到生成命令里即可：

```bash
pnpm generate:chrome 白金 --skin 灿阳朝露 SD05 --view 正面
```

3. 如果你还想手动核对，再打开本地数据库文件：

```text
database/prts-characters.json
```

4. 在该文件里搜索角色名或 `characterId`，查看该角色条目下的 `variants` 数组：

```json
{
  "skin": "灿阳朝露 SD05",
  "view": "正面",
  "file": "char_204_platnm_summer_3/front/char_204_platnm_summer_3"
}
```

其中：

- `skin` 就是你传给 `--skin` 的值
- `view` 就是你传给 `--view` 的值

```bash
pnpm install
pnpm sync-db
pnpm characters --query 佩佩
pnpm generate:chrome 佩佩 --skin 默认 --view 基建
pnpm inspect -- char_4058_pepe --list
pnpm inspect -- char_4058_pepe --skin 默认 --view 基建
pnpm inspect -- char_4058_pepe --skin 默认 --view 基建 \
  --output .cache/pepe.manifest.json
pnpm download -- .cache/pepe.manifest.json --output .cache/pepe
pnpm inspect-animations -- .cache/pepe \
  --output .cache/pepe.animations.json
pnpm exec playwright install chromium
pnpm preview -- .cache/pepe --animation Move --frames 8 \
  --width 512 --height 512 --output .cache/preview-move
pnpm bake -- .cache/pepe \
  --config examples/char_4058_pepe.codex.json \
  --output dist/pepe
```

如果本地已安装 Google Chrome，可以跳过 `playwright install`，改用 `:chrome` 变体命令直接驱动系统 Chrome：

```bash
pnpm preview:chrome -- .cache/pepe --animation Move --frames 8 \
  --width 512 --height 512 --output .cache/preview-move
pnpm bake:chrome -- .cache/pepe \
  --config examples/char_4058_pepe.codex.json \
  --output dist/pepe
```

### 角色数据库与一键生成

新增的本地数据库会把 PRTS 干员页面中的角色名、`char_xxx` 标识，以及对应 `meta.json` 里可用的 `skin/view/file` 映射保存到本地 `database/prts-characters.json`。它只抓取元信息，不会下载整套 Spine 包。

```bash
pnpm sync-db
pnpm characters --query 伊芙利特
pnpm generate:chrome 伊芙利特 --skin 默认 --view 基建
pnpm generate:chrome 佩佩 --skin 默认 --view 基建 --output dist/pepe
```

`generate` 是新的聚合命令，会自动串起以下步骤：

```text
角色名 -> 本地数据库匹配 -> resolve manifest -> download
       -> inspect-animations -> 自动生成 bake config -> bake
```

默认生成行为：

- `generate` / `characters` 只读取本地 `database/prts-characters.json`
- 数据库不会在每次执行时自动更新；需要更新时手动执行一次 `pnpm sync-db`
- 如果数据库文件不存在，命令会直接提示先运行 `pnpm sync-db`
- `skin` 默认值为 `默认`
- `view` 默认值为 `基建`
- `codexVersion` 默认值为 `2`
- `generate` 默认强制走本地 Google Chrome 通道，不要求用户下载 Playwright 自带浏览器
- 自动生成的 bake 配置会写入 `.cache/generated/<characterId>/<skin-view>/auto.codex.json`
- 最终输出目录默认是 `dist/<pet-id>`

自动 bake 配置目前优先匹配一组常见动画名：

- `idle`: `Relax`, `Idle`, `Default`, `Stand`
- `running-right` / `running`: `Move`, `Run`, `Walk`
- `waving` / `review`: `Interact`, `Hello`, `Wave`, `Special`
- `failed`: `Sleep`, `Fail`, `Down`
- `waiting`: `Sit`, `Wait`, `Rest`

如果 `waving`、`failed` 或 `waiting` 找不到，命令会回退到 `idle` 动画并在 JSON 输出里给出 warning；如果 `idle` 或 `running` 缺失，则会直接报错。

为了方便非命令行用户，仓库同时提供了两个一键脚本：

```bash
./scripts/generate-codex.sh 佩佩 默认 基建
```

```bat
scripts\generate-codex.bat 佩佩 默认 基建
```

解析后的清单现在包含：

```json
{
  "spine": {
    "hash": "...",
    "version": "3.8.xx",
    "majorMinor": "3.8",
    "recommendedRuntime": "spine-3.8"
  }
}
```

以上具体版本仅为示例说明；命令会从选定的模型中读取版本信息，而非预设版本。首个安装的适配器针对 Spine 3.8，这是佩佩基础模型使用的导出器系列。

`inspect-animations` 默认以 16 个确定性时间戳对每个动画进行采样。可使用 `--samples` 参数在速度和更密集的联合边界估算之间权衡。该命令会明确报告不支持的导出器系列，而非尝试用不兼容的运行时去解析。

`preview` 启动一个受控的无头 Chromium 实例，将选定的 Spine 动画寻址至确定的时间戳，并输出透明 PNG 帧及 `contact-sheet.png`。某些 PRTS 资源包声明的图集页面尺寸大于 CDN 当前提供的 PNG 尺寸（例如佩佩声明了 624×624 但收到的却是 416×416）；预览服务器会检测到这种不匹配，并在内存中将纹理标准化至图集声明尺寸，而不修改已下载的源文件包。

`bake` 仅渲染唯一映射的动画，应用统一的缩放比例和底部中心基线，衍生出变换后的状态（如镜像的向左奔跑动作和合成的跳跃动作），并生成 Codex V1 格式的资源包：

```text
dist/pepe/
├── pet.json
├── spritesheet.webp       # 1536×1872，透明，无损
├── mapping.json
└── qa/
    ├── contact-sheet.png
    ├── validation.json
    ├── animations/
    └── states/
```

## 为什么版本检测是首要步骤

Spine 二进制数据对运行时版本敏感。浏览器渲染器必须使用与模型导出器版本兼容的运行时。因此，本项目在尝试加载动画之前，会先通过带版本标识的适配器来路由模型。

此转换过程被视为一个离线动画烘焙管线，而非 PixiJS 到图像的转换。PixiJS/Spine 运行时稍后会将确定性时间戳渲染为透明帧。一个独立的合成器将标准化联合边界和脚部基线，然后创建最终的 Codex 精灵图集。

纹理文件名从 `.atlas` 文件中读取；工具不假定文件名为 `${base}.png`，因为一个图集可能包含多个纹理页。

## Codex 版本支持与切换

本项目支持两个版本的 Codex 宠物规范，通过 bake 配置 JSON 中的 `codexVersion` 字段一键切换：

| 版本                   | 状态行数 | Spritesheet 尺寸             | 状态列表                                                                             |
| ---------------------- | -------- | ---------------------------- | ------------------------------------------------------------------------------------ |
| V1 (`codexVersion: 1`) | 9 行     | 1536 × 1872 (192×8 × 208×9)  | idle, running-right, running-left, waving, jumping, failed, waiting, running, review |
| V2 (`codexVersion: 2`) | 11 行    | 1536 × 2288 (192×8 × 208×11) | V1 全部 + look-directions-a, look-directions-b                                       |

**切换方式**：直接修改配置 JSON 中的 `codexVersion` 值为 `1` 或 `2`，bake 管线会自动：

1. 根据版本校验 `states` 是否覆盖了全部必填状态（缺一个都会报错）
2. 生成对应行数的 spritesheet（每行固定 8 帧，192×208 px）
3. 在输出的 `pet.json` 中将 `spriteVersionNumber` 设置为对应版本号

> V2 是 V1 的严格超集：V2 配置可以 bake 为 V1 输出（删去最后两行），但 V1 配置无法 bake 为 V2 输出（缺少新增的两个状态）。

---

## Bake 配置 JSON 完整说明

bake 命令需要一个「Codex 状态映射配置 JSON」作为 `--config` 参数。该配置使用 Zod schema 在 [`src/bake.ts` L58–L85](src/bake.ts#L58-L85) 中进行严格校验。以下是每个字段的详细含义：

### 顶层字段

| 字段            | 类型     | 必填 | 说明                                                                                                         |
| --------------- | -------- | ---- | ------------------------------------------------------------------------------------------------------------ |
| `schemaVersion` | `1`      | ✅   | 配置文件 schema 版本，目前固定为字面量 `1`。用于未来向前兼容。                                               |
| `characterId`   | string   | ✅   | PRTS 角色 ID，例如 `char_4058_pepe`。**必须与本地 Spine 资源包的 manifest 完全一致**，否则 bake 会报错拒绝。 |
| `skin`          | string   | ✅   | 皮肤名称，例如 `默认`。同上，必须与 manifest 匹配。                                                          |
| `view`          | string   | ✅   | 视图名称，例如 `基建`。同上，必须与 manifest 匹配。                                                          |
| `codexVersion`  | `1 \| 2` | ✅   | Codex 宠物规范版本。决定需要覆盖哪些状态以及输出 spritesheet 的行数。                                        |
| `pet`           | object   | ✅   | 生成的宠物元数据对象，会原样写入最终 `pet.json`。                                                            |
| `normalization` | object   | ✅   | 帧标准化参数，控制单帧尺寸、基线位置等。                                                                     |
| `states`        | object   | ✅   | 核心映射：每个 Codex 状态 → 对应源动画或派生规则。                                                           |

### `pet` 对象

| 字段          | 类型   | 说明                                                                                      |
| ------------- | ------ | ----------------------------------------------------------------------------------------- |
| `id`          | string | 宠物唯一 ID，正则约束：`^[a-z0-9][a-z0-9_-]*$`（小写字母/数字开头，可含下划线和短横线）。 |
| `displayName` | string | 宠物展示名称，任意非空字符串。                                                            |
| `description` | string | 宠物描述文本，任意非空字符串。                                                            |

### `normalization` 对象（帧标准化）

所有字段均为固定字面量或受严格范围约束：

| 字段         | 类型              | 约束        | 说明                                                                                                                               |
| ------------ | ----------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `cellWidth`  | `192`             | 固定字面量  | 单帧宽度（px）。目前 Codex 规范固定为 192。                                                                                        |
| `cellHeight` | `208`             | 固定字面量  | 单帧高度（px）。目前 Codex 规范固定为 208。                                                                                        |
| `anchor`     | `"bottom-center"` | 固定字面量  | 锚点位置，仅支持「底部居中」。                                                                                                     |
| `baselineY`  | integer           | 1 ≤ x ≤ 207 | 脚基线的 Y 坐标（px，从帧顶部算起）。角色脚底与这一水平线对齐，保证不同动画的角色不会上下漂浮。需要通过 preview 目测调整到合适值。 |
| `padding`    | integer           | 0 ≤ x ≤ 95  | 四周透明内边距（px）。防止动画幅度大时角色被边缘裁切。                                                                             |

### `states` 对象（核心映射）

键名必须是对应 `codexVersion` 要求的全部状态（不能少，顺序不限）。每个值有两种形式：「直接动画映射」或「派生状态」。

#### 形式 A：直接动画映射（源动画渲染）

```json
{
  "animation": "Relax",
  "frames": 8
}
```

| 字段        | 类型   | 约束       | 说明                                                                                   |
| ----------- | ------ | ---------- | -------------------------------------------------------------------------------------- |
| `animation` | string | 非空       | Spine 源动画的名称。必须存在于 `inspect-animations` 输出的动画列表中，否则 bake 报错。 |
| `frames`    | `8`    | 固定字面量 | 采样帧数。Codex 规范固定每状态 8 帧。                                                  |

> bake 会对所有「直接映射」的动画取一个 **共享联合边界（sharedBounds）**，然后用相同的缩放比例渲染，保证不同动画的角色大小一致。

#### 形式 B：派生状态（从已有状态变换得到）

无需重新渲染，对源帧进行图像变换得到。有两种变换手段，可以单独使用也可以组合使用（但至少用一个）：

```json
{
  "deriveFrom": "running-right",
  "flipX": true
}
```

```json
{
  "deriveFrom": "idle",
  "offsetY": [0, -6, -12, -18, -18, -12, -6, 0]
}
```

| 字段         | 类型        | 约束                        | 说明                                                                                                                                        |
| ------------ | ----------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `deriveFrom` | string      | 必须是已定义的 Codex 状态名 | 派生的源状态。**该状态必须在配置中比当前状态先定义好**（因为派生处理是按序的）。                                                            |
| `flipX`      | `true`      | 可选，字面量                | 水平翻转（镜像）。用于例如「向左奔跑」从「向右奔跑」派生。                                                                                  |
| `offsetY`    | `number[8]` | 可选，长度为 8 的整数数组   | 逐帧的垂直偏移（px，正值向下，负值向上）。用于合成没有源动画的动作，例如跳跃：向上弧线路径由负偏移模拟。8 个元素分别对应第 0~7 帧的偏移量。 |

> ⚠️ 派生状态的校验约束：至少包含 `flipX` **或** `offsetY` 其中之一（可以都有），两者都没有会被 Zod 拒绝。

### 完整配置示例 + 逐行注释

```jsonc
{
  // 固定：schema 版本号
  "schemaVersion": 1,
  // 角色标识，必须与下载的 Spine 包 manifest 完全匹配
  "characterId": "char_4058_pepe",
  "skin": "默认",
  "view": "基建",

  // Codex 版本：切到 1 就只需要前 9 个状态
  "codexVersion": 2,

  // 生成的宠物元数据
  "pet": {
    "id": "pepe",
    "displayName": "佩佩",
    "description": "Arknights operator Pepe",
  },

  // 帧标准化参数
  "normalization": {
    "cellWidth": 192,
    "cellHeight": 208,
    "anchor": "bottom-center",
    "baselineY": 198, // 脚基线位置，根据角色调整
    "padding": 10, // 防裁切边距
  },

  // 状态映射：顺序无所谓，但必须覆盖 codexVersion 的全部状态
  "states": {
    // === 以下 9 个是 V1/V2 通用 ===
    "idle": { "animation": "Relax", "frames": 8 },
    "running-right": { "animation": "Move", "frames": 8 },

    // 派生：镜像右奔跑 → 左奔跑（不需要重新渲染）
    "running-left": { "deriveFrom": "running-right", "flipX": true },

    "waving": { "animation": "Interact", "frames": 8 },

    // 派生：待机帧 + 垂直偏移弧线 → 跳跃动画
    "jumping": {
      "deriveFrom": "idle",
      "offsetY": [0, -6, -12, -18, -18, -12, -6, 0],
    },

    "failed": { "animation": "Sleep", "frames": 8 },
    "waiting": { "animation": "Sit", "frames": 8 },
    "running": { "animation": "Move", "frames": 8 },
    "review": { "animation": "Interact", "frames": 8 },

    // === 以下 2 个是 V2 新增 ===
    "look-directions-a": { "animation": "Relax", "frames": 8 },
    "look-directions-b": { "animation": "Relax", "frames": 8 },
  },
}
```

### 编写配置的推荐步骤

1. **运行 `inspect-animations`** 获取源动画列表，记下可用的动画名称。
2. **运行 `preview`** 逐个预览候选动画，目测哪个动画对应哪个 Codex 语义（例如 Relax→idle）。
3. **确定共用动画**：多个 Codex 状态可以复用同一个源动画（如示例中 `review` 和 `waving` 都用 `Interact`），bake 只会渲染一次，节省时间。
4. **填充派生状态**：
   - 左右奔跑通常写一个 + 镜像另一个
   - 没有 Jump 动画就用 idle + `offsetY` 合成
5. **调整 `baselineY` 和 `padding`**：先写一个经验值（如 `baselineY: 198`, `padding: 10`），bake 后打开 `qa/contact-sheet.png` 检查是否被裁切或上下漂浮，再微调。
6. **试运行 bake**：如果缺少状态或字段名写错，Zod 会报精确的错误信息（如 `states must cover all required rows`）。

---

生成的 QA 报告会验证尺寸、Alpha 通道支持、行顺序、映射关系、共享源边界以及最终 WebP 文件的 SHA-256 摘要。

首个适配器将根据 PRTS 模型清单报告的导出器版本来选择，而非硬编码为最新的 Pixi 运行时。

## 法律声明

可公开访问的资源并不自动获得再分发的授权。在打包或发布生成的宠物资源之前，请确认游戏资源及 Spine 运行时的相关权利。
