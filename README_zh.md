# ark-codex-pet

将 PRTS 元数据描述的《明日方舟》Spine 资源转换为可用于 Codex 自定义宠物的确定性精灵图集。

> 早期原型：在进行确定性 Spine 帧烘焙之前，先构建一个稳定且能识别版本的资源清单。

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

```bash
pnpm install
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

## 当前 Codex 映射

佩佩的示例现已将六个可用的源动画映射到全部九行 Codex 状态。`running-left`（向左奔跑）由 `running-right`（向右奔跑）镜像得到；由于源资源包中没有跳跃动画，`jumping`（跳跃）由待机帧通过一个确定性的垂直弧线轨迹派生而来。映射文件保持可编辑状态，以便其他皮肤或角色可以选择不同的语义。

生成的 QA 报告会验证尺寸、Alpha 通道支持、行顺序、映射关系、共享源边界以及最终 WebP 文件的 SHA-256 摘要。

首个适配器将根据 PRTS 模型清单报告的导出器版本来选择，而非硬编码为最新的 Pixi 运行时。

## 法律声明

可公开访问的资源并不自动获得再分发的授权。在打包或发布生成的宠物资源之前，请确认游戏资源及 Spine 运行时的相关权利。