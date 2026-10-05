import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { avatarKey, type AvatarConfig } from "@shadow/shared";
import { buildAvatar, characterUrl, GLASSES_URL, SUNGLASSES_URL, type BuiltAvatar } from "./build";

/** Loads (suspending) and builds an avatar. A new object per config; parts are cached. */
export function useAvatarModel(config: AvatarConfig): BuiltAvatar {
  const [body, head, glasses, sunglasses] = useGLTF([characterUrl(config.body), characterUrl(config.head), GLASSES_URL, SUNGLASSES_URL]);
  const key = avatarKey(config);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => buildAvatar(config, body, head, { glasses: glasses.scene, sunglasses: sunglasses.scene }), [key, body, head, glasses, sunglasses]);
}

export function preloadAvatar(config: AvatarConfig) {
  for (const url of [characterUrl(config.body), characterUrl(config.head), GLASSES_URL, SUNGLASSES_URL]) useGLTF.preload(url);
}
