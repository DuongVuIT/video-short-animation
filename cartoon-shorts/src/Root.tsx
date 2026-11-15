import React from "react";
import { Composition } from "remotion";
import { BridgeShort, BRIDGE_FRAMES } from "./videos/bridge/Bridge";

// New episodes: copy src/videos/bridge/ to src/videos/<name>/ and register another <Composition> here.
// Short: 1080x1920 (rendered at scale 1.3333 = 1440x2560). Long cut: 1920x1080 (scale 1.3333 = 2560x1440).
// The shared code is in src/engine/ (see src/engine/README.md and API.md).
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="BridgeShort" component={BridgeShort} durationInFrames={BRIDGE_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
