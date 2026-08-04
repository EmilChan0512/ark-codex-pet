import { readFile } from "node:fs/promises";
import { MixBlend, MixDirection, type TextureRegion } from "@pixi-spine/base";
import {
  BoundingBoxAttachment,
  ClippingAttachment,
  MeshAttachment,
  PathAttachment,
  PointAttachment,
  RegionAttachment,
  Skeleton,
  SkeletonBinary,
  type AttachmentLoader,
  type Skin,
} from "@pixi-spine/runtime-3.8";
import type { LocalSpinePackage } from "./local-package.js";

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AnimationInspection {
  name: string;
  duration: number;
  sampledBounds: Bounds | null;
}

export interface AnimationInspectionReport {
  schemaVersion: 1;
  runtime: string;
  exporterVersion: string | null;
  samplesPerAnimation: number;
  setupPoseBounds: Bounds | null;
  animations: AnimationInspection[];
}

const unitRegion = {
  originalWidth: 1,
  originalHeight: 1,
  width: 1,
  height: 1,
  offsetX: 0,
  offsetY: 0,
  u: 0,
  v: 0,
  u2: 1,
  v2: 1,
  rotate: false,
} as TextureRegion;

class GeometryAttachmentLoader implements AttachmentLoader {
  newRegionAttachment(_skin: Skin, name: string, path: string): RegionAttachment {
    const attachment = new RegionAttachment(name);
    attachment.path = path;
    attachment.setRegion(unitRegion);
    return attachment;
  }

  newMeshAttachment(_skin: Skin, name: string, path: string): MeshAttachment {
    const attachment = new MeshAttachment(name);
    attachment.path = path;
    attachment.region = unitRegion;
    return attachment;
  }

  newBoundingBoxAttachment(_skin: Skin, name: string): BoundingBoxAttachment {
    return new BoundingBoxAttachment(name);
  }

  newPathAttachment(_skin: Skin, name: string): PathAttachment {
    return new PathAttachment(name);
  }

  newPointAttachment(_skin: Skin, name: string): PointAttachment {
    return new PointAttachment(name);
  }

  newClippingAttachment(_skin: Skin, name: string): ClippingAttachment {
    return new ClippingAttachment(name);
  }
}

function extendBounds(
  current: Bounds | null,
  vertices: ArrayLike<number>,
): Bounds | null {
  let minX = current?.x ?? Number.POSITIVE_INFINITY;
  let minY = current?.y ?? Number.POSITIVE_INFINITY;
  let maxX = current ? current.x + current.width : Number.NEGATIVE_INFINITY;
  let maxY = current ? current.y + current.height : Number.NEGATIVE_INFINITY;

  for (let index = 0; index + 1 < vertices.length; index += 2) {
    const x = vertices[index];
    const y = vertices[index + 1];
    if (x === undefined || y === undefined || !Number.isFinite(x) || !Number.isFinite(y)) {
      continue;
    }
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  if (!Number.isFinite(minX)) return current;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function getVisibleBounds(skeleton: Skeleton): Bounds | null {
  let bounds: Bounds | null = null;

  for (const slot of skeleton.drawOrder) {
    if (slot.color.a <= 0 || !slot.bone.active) continue;
    const attachment = slot.getAttachment();

    if (attachment instanceof RegionAttachment) {
      const vertices = new Float32Array(8);
      attachment.computeWorldVertices(slot, vertices, 0, 2);
      bounds = extendBounds(bounds, vertices);
    } else if (attachment instanceof MeshAttachment) {
      const vertices = new Float32Array(attachment.worldVerticesLength);
      attachment.computeWorldVertices(
        slot,
        0,
        attachment.worldVerticesLength,
        vertices,
        0,
        2,
      );
      bounds = extendBounds(bounds, vertices);
    }
  }

  return bounds;
}

function sampleAnimationBounds(
  skeleton: Skeleton,
  animation: Skeleton["data"]["animations"][number],
  sampleCount: number,
): Bounds | null {
  let bounds: Bounds | null = null;
  const count = Math.max(2, sampleCount);

  for (let index = 0; index < count; index += 1) {
    const time = animation.duration === 0 ? 0 : (animation.duration * index) / count;
    skeleton.setToSetupPose();
    animation.apply(
      skeleton,
      0,
      time,
      false,
      [],
      1,
      MixBlend.setup,
      MixDirection.mixIn,
    );
    skeleton.updateWorldTransform();
    const sampled = getVisibleBounds(skeleton);
    if (sampled) {
      bounds = extendBounds(bounds, [
        sampled.x,
        sampled.y,
        sampled.x + sampled.width,
        sampled.y + sampled.height,
      ]);
    }
  }

  return bounds;
}

export async function inspectAnimations(
  spinePackage: LocalSpinePackage,
  sampleCount = 16,
): Promise<AnimationInspectionReport> {
  const runtime = spinePackage.manifest.spine.recommendedRuntime;
  if (runtime !== "spine-3.8") {
    throw new Error(
      `No animation inspector is installed for ${runtime}; available: spine-3.8`,
    );
  }

  const bytes = new Uint8Array(await readFile(spinePackage.skeletonPath));
  const binary = new SkeletonBinary(new GeometryAttachmentLoader());
  const data = binary.readSkeletonData(bytes);
  const skeleton = new Skeleton(data);
  skeleton.setToSetupPose();
  skeleton.updateWorldTransform();
  const setupPoseBounds = getVisibleBounds(skeleton);

  return {
    schemaVersion: 1,
    runtime,
    exporterVersion: data.version ?? spinePackage.manifest.spine.version,
    samplesPerAnimation: sampleCount,
    setupPoseBounds,
    animations: data.animations.map((animation) => ({
      name: animation.name,
      duration: animation.duration,
      sampledBounds: sampleAnimationBounds(skeleton, animation, sampleCount),
    })),
  };
}
