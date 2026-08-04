export const browserPageHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="color-scheme" content="light">
    <style>
      html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
      canvas { display: block; }
    </style>
    <script src="/vendor/pixi.js"></script>
    <script src="/vendor/pixi-spine.js"></script>
  </head>
  <body>
    <script>
      (() => {
        let app;
        let spine;

        function loadAtlas(atlasText) {
          return new Promise((resolve, reject) => {
            try {
              new PIXI.spine.TextureAtlas(
                atlasText,
                (texturePath, done) => {
                  const url = "/assets/" + encodeURIComponent(texturePath);
                  PIXI.Assets.load(url)
                    .then((texture) => done(texture.baseTexture || texture))
                    .catch(reject);
                },
                resolve,
              );
            } catch (error) {
              reject(error);
            }
          });
        }

        window.arkRenderer = {
          async init(options) {
            app = new PIXI.Application({
              width: options.width,
              height: options.height,
              backgroundAlpha: 0,
              antialias: true,
              autoStart: false,
              preserveDrawingBuffer: true,
              resolution: 1,
            });
            app.ticker.stop();
            document.body.appendChild(app.view);

            const [atlasText, skeletonBuffer] = await Promise.all([
              fetch(options.atlasUrl).then((response) => {
                if (!response.ok) throw new Error("Atlas request failed: " + response.status);
                return response.text();
              }),
              fetch(options.skeletonUrl).then((response) => {
                if (!response.ok) throw new Error("Skeleton request failed: " + response.status);
                return response.arrayBuffer();
              }),
            ]);
            const atlas = await loadAtlas(atlasText);
            const attachmentLoader = new PIXI.spine.AtlasAttachmentLoader(atlas);
            const binary = new PIXI.spine.SkeletonBinary(attachmentLoader);
            const skeletonData = binary.readSkeletonData(new Uint8Array(skeletonBuffer));
            spine = new PIXI.spine.Spine(skeletonData);
            spine.autoUpdate = false;
            spine.scale.set(options.scale);
            spine.position.set(options.x, options.y);
            app.stage.addChild(spine);
            app.renderer.render(app.stage);

            return skeletonData.animations.map((animation) => ({
              name: animation.name,
              duration: animation.duration,
            }));
          },

          render(animationName, time) {
            spine.state.clearTracks();
            spine.skeleton.setToSetupPose();
            spine.state.setAnimation(0, animationName, false);
            spine.update(time);
            app.renderer.render(app.stage);
          },
        };
      })();
    </script>
  </body>
</html>`;
