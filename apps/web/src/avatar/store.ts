import { useEffect } from "react";
import { create } from "zustand";
import { DEFAULT_AVATAR, AvatarConfig as AvatarSchema, fixAvatar, type AvatarConfig, type AvatarView, type ClimbProfileView } from "@shadow/shared";
import { ApiError, api } from "../api/client";
import { useAuth } from "../auth/store";
import { guestProfile } from "../games/sky-climb/guest";

const LOCAL_KEY = "avatar:config";

function readLocal(): AvatarConfig | null {
  try {
    const parsed = AvatarSchema.safeParse(JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "null"));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function writeLocal(config: AvatarConfig) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(config));
  } catch {
    // Storage unavailable: the avatar lasts for this page view.
  }
}

const signedIn = () => useAuth.getState().user !== null;

interface State {
  /** The saved avatar (the default until the player makes one). */
  config: AvatarConfig;
  /** Whether the player has saved an avatar of their own. */
  custom: boolean;
  owned: string[];
  coins: number;
  loaded: boolean;
  load: () => Promise<void>;
  /** Resolves to an error code, or null when saved. */
  save: (config: AvatarConfig) => Promise<string | null>;
  /** Buys an item with Sky Climb coins. Resolves to an error code, or null. */
  buy: (itemId: string) => Promise<string | null>;
}

const startOwned = guestProfile().owned;
const startLocal = readLocal();

export const useAvatar = create<State>((set, get) => ({
  config: startLocal ? fixAvatar(startLocal, startOwned) : DEFAULT_AVATAR,
  custom: startLocal !== null,
  owned: startOwned,
  coins: guestProfile().coins.balance,
  loaded: false,

  load: async () => {
    if (!signedIn()) {
      const guest = guestProfile();
      const local = readLocal();
      set({
        owned: guest.owned,
        coins: guest.coins.balance,
        config: local ? fixAvatar(local, guest.owned) : DEFAULT_AVATAR,
        custom: local !== null,
        loaded: true,
      });
      return;
    }
    try {
      let view = await api<AvatarView>("/api/avatar");
      // First sign-in: the avatar made as a guest becomes the account's.
      const local = readLocal();
      if (!view.config && local) {
        view = await api<AvatarView>("/api/avatar", { body: { config: fixAvatar(local, view.owned) } }).catch(() => view);
      }
      set({ owned: view.owned, coins: view.coins, config: view.config ?? DEFAULT_AVATAR, custom: view.config !== null, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  save: async (config) => {
    if (!signedIn()) {
      writeLocal(config);
      set({ config, custom: true });
      return null;
    }
    try {
      const view = await api<AvatarView>("/api/avatar", { body: { config } });
      writeLocal(config);
      set({ owned: view.owned, coins: view.coins, config: view.config ?? config, custom: true });
      return null;
    } catch (e) {
      return e instanceof ApiError ? e.code : "request_failed";
    }
  },

  buy: async (itemId) => {
    if (!signedIn()) return "sign_in_required";
    try {
      const profile = await api<ClimbProfileView>("/api/sky-climb/buy", { body: { item: itemId } });
      set({ owned: profile.owned, coins: profile.coins.balance });
      return null;
    } catch (e) {
      return e instanceof ApiError ? e.code : "request_failed";
    }
  },
}));

/** Keeps the avatar in step with sign-in. Call once from the app shell. */
export function useAvatarSync() {
  const synced = useAuth((s) => s.synced);
  const userId = useAuth((s) => s.user?.id);
  const load = useAvatar((s) => s.load);
  useEffect(() => {
    if (synced) void load();
  }, [synced, userId, load]);
}
