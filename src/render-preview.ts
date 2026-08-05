import { createServer, type Server } from "node:http";
import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import { parseAtlasPages } from "./atlas.js";
import { browserPageHtml } from "./browser-page.js";
import {
  inspectAnimations,
  type AnimationInspection,
  type Bounds,
} from "./inspect-animations.js";
import type { LocalSpinePackage } from "./local-package.js";

export interface PreviewOptions {
  animation: string;
  frames: number;
  width: number;
  height: number;
  padding: number;
  outputDirectory: string;
  fitBounds?: Bounds;
  baselineY?: number;
}

export interface PreviewResult {
  animation: string;
  duration: number;
  width: number;
  height: number;
  framePaths: string[];
  contactSheetPath: string;
}

const require = createRequire(import.meta.url);

function packageDistFile(moduleName: string, relativePath: string): string {
  const entry = require.resolve(moduleName);
  return path.resolve(path.dirname(entry), "..", relativePath);
}

const vendorFiles = new Map([
  ["/vendor/pixi.js", packageDistFile("pixi.js", "dist/pixi.min.js")],
  [
    "/vendor/pixi-spine.js",
    packageDistFile("@pixi-spine/all-3.8", "dist/pixi-spine-3.8.js"),
  ],
]);

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".atlas": "text/plain; charset=utf-8",
  ".skel": "application/octet-stream",
  ".png": "image/png",
};

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Preview server failed");
  return address.port;
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function createPreviewServer(spinePackage: LocalSpinePackage): Promise<Server> {
  const assets = new Map<string, string>();
  for (const file of [
    spinePackage.skeletonPath,
    spinePackage.atlasPath,
    ...spinePackage.texturePaths,
  ]) {
    assets.set(`/assets/${encodeURIComponent(path.basename(file))}`, file);
  }
  const atlasText = await readFile(spinePackage.atlasPath, "utf8");
  const expectedTextureSizes = new Map(
    parseAtlasPages(atlasText)
      .filter((page) => page.width !== null && page.height !== null)
      .map((page) => [page.name, { width: page.width!, height: page.height! }]),
  );
  const normalizedTextures = new Map<string, Promise<Buffer>>();

  return createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
      if (pathname === "/" || pathname === "/index.html") {
        response.writeHead(200, { "content-type": contentTypes[".html"]! });
        response.end(browserPageHtml);
        return;
      }

      const file = vendorFiles.get(pathname) ?? assets.get(pathname);
      if (!file) {
        response.writeHead(404).end("Not found");
        return;
      }
      let body: Buffer;
      const expected = expectedTextureSizes.get(path.basename(file));
      if (expected && path.extname(file).toLowerCase() === ".png") {
        let normalized = normalizedTextures.get(file);
        if (!normalized) {
          normalized = (async () => {
            const image = sharp(file);
            const metadata = await image.metadata();
            if (metadata.width === expected.width && metadata.height === expected.height) {
              return readFile(file);
            }
            return image.resize(expected.width, expected.height).png().toBuffer();
          })();
          normalizedTextures.set(file, normalized);
        }
        body = await normalized;
      } else {
        body = await readFile(file);
      }
      response.writeHead(200, {
        "content-type": contentTypes[path.extname(file)] ?? "application/octet-stream",
        "cache-control": "no-store",
      });
      response.end(body);
    } catch (error) {
      response.writeHead(500).end(error instanceof Error ? error.message : String(error));
    }
  });
}

export function transformForBounds(
  bounds: Bounds,
  width: number,
  height: number,
  padding: number,
): { scale: number; x: number; y: number } {
  const availableWidth = width - padding * 2;
  const availableHeight = height - padding * 2;
  if (availableWidth <= 0 || availableHeight <= 0) {
    throw new Error("Preview padding leaves no drawable area");
  }
  if (bounds.width <= 0 || bounds.height <= 0) {
    throw new Error("Preview bounds must have positive dimensions");
  }
  const scale = Math.min(availableWidth / bounds.width, availableHeight / bounds.height);
  return {
    scale,
    x: padding - bounds.x * scale + (availableWidth - bounds.width * scale) / 2,
    y: padding - bounds.y * scale + (availableHeight - bounds.height * scale) / 2,
  };
}

export function transformForBaseline(
  bounds: Bounds,
  width: number,
  baselineY: number,
  padding: number,
): { scale: number; x: number; y: number } {
  const availableWidth = width - padding * 2;
  const availableHeight = baselineY - padding;
  if (availableWidth <= 0 || availableHeight <= 0) {
    throw new Error("Baseline and padding leave no drawable area");
  }
  if (bounds.width <= 0 || bounds.height <= 0) {
    throw new Error("Preview bounds must have positive dimensions");
  }
  const scale = Math.min(availableWidth / bounds.width, availableHeight / bounds.height);
  return {
    scale,
    x: width / 2 - (bounds.x + bounds.width / 2) * scale,
    y: baselineY - (bounds.y + bounds.height) * scale,
  };
}

function selectAnimation(
  animations: AnimationInspection[],
  name: string,
): AnimationInspection {
  const animation = animations.find((candidate) => candidate.name === name);
  if (!animation) {
    throw new Error(
      `Animation not found: ${name}. Available: ${animations.map((item) => item.name).join(", ")}`,
    );
  }
  if (!animation.sampledBounds) throw new Error(`Animation has no visible bounds: ${name}`);
  return animation;
}

async function makeContactSheet(
  framePaths: string[],
  width: number,
  height: number,
  destination: string,
): Promise<void> {
  const columns = Math.min(4, framePaths.length);
  const rows = Math.ceil(framePaths.length / columns);
  const inputs = await Promise.all(framePaths.map((file) => readFile(file)));
  await sharp({
    create: {
      width: columns * width,
      height: rows * height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(
      inputs.map((input, index) => ({
        input,
        left: (index % columns) * width,
        top: Math.floor(index / columns) * height,
      })),
    )
    .png()
    .toFile(destination);
}

export async function renderAnimationPreview(
  spinePackage: LocalSpinePackage,
  options: PreviewOptions,
): Promise<PreviewResult> {
  if (spinePackage.manifest.spine.recommendedRuntime !== "spine-3.8") {
    throw new Error("The browser renderer currently supports Spine 3.8 only");
  }
  if (!Number.isInteger(options.frames) || options.frames < 1 || options.frames > 120) {
    throw new Error("frames must be an integer between 1 and 120");
  }

  const report = await inspectAnimations(spinePackage, Math.max(24, options.frames * 3));
  const animation = selectAnimation(report.animations, options.animation);
  const fitBounds = options.fitBounds ?? animation.sampledBounds!;
  const transform =
    options.baselineY === undefined
      ? transformForBounds(fitBounds, options.width, options.height, options.padding)
      : transformForBaseline(fitBounds, options.width, options.baselineY, options.padding);
  const outputDirectory = path.resolve(options.outputDirectory);
  await mkdir(outputDirectory, { recursive: true });

  const server = await createPreviewServer(spinePackage);
  const port = await listen(server);
  const launchOptions: { headless: boolean; channel?: string } = { headless: true };
  if (process.env.ARK_PET_BROWSER === "chrome") {
    launchOptions.channel = "chrome";
  }
  const browser = await chromium.launch(launchOptions);
  const framePaths: string[] = [];

  try {
    const page = await browser.newPage({
      viewport: { width: options.width, height: options.height },
      deviceScaleFactor: 1,
    });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
    try {
      await page.evaluate(
        async (value) => {
          const renderer = (window as unknown as { arkRenderer: { init(options: unknown): Promise<unknown> } }).arkRenderer;
          await Promise.race([
            renderer.init(value),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Browser renderer initialization timed out")), 20_000),
            ),
          ]);
        },
        {
          width: options.width,
          height: options.height,
          atlasUrl: `/assets/${encodeURIComponent(path.basename(spinePackage.atlasPath))}`,
          skeletonUrl: `/assets/${encodeURIComponent(path.basename(spinePackage.skeletonPath))}`,
          ...transform,
        },
      );
    } catch (error) {
      const details = pageErrors.length > 0 ? ` Page errors: ${pageErrors.join("; ")}` : "";
      throw new Error(`${error instanceof Error ? error.message : String(error)}${details}`);
    }

    const canvas = page.locator("canvas");
    for (let index = 0; index < options.frames; index += 1) {
      const time = animation.duration === 0 ? 0 : (animation.duration * index) / options.frames;
      await page.evaluate(
        ({ animationName, animationTime }) => {
          const renderer = (window as unknown as { arkRenderer: { render(name: string, time: number): void } }).arkRenderer;
          renderer.render(animationName, animationTime);
        },
        { animationName: animation.name, animationTime: time },
      );
      const framePath = path.join(outputDirectory, `frame-${String(index).padStart(2, "0")}.png`);
      await canvas.screenshot({ path: framePath, omitBackground: true });
      framePaths.push(framePath);
    }
  } finally {
    await browser.close();
    await close(server);
  }

  const contactSheetPath = path.join(outputDirectory, "contact-sheet.png");
  await makeContactSheet(framePaths, options.width, options.height, contactSheetPath);
  return {
    animation: animation.name,
    duration: animation.duration,
    width: options.width,
    height: options.height,
    framePaths,
    contactSheetPath,
  };
}
