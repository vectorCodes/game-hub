// /games/bumper-arena/play: the menu (bots playing behind it), Practice, the Daily Gauntlet,
// and party rooms with friends (?room=K7MPQ joins one; ?friends=1 opens the make-or-join
// card). Computers and tablets only. See Bumper-arena-plan.md.
import { lazy, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { BUMPER_EMOTES, normalizeRoomCode, shortName } from "@shadow/shared";
import { useAuth } from "../../auth/store";
import { useAvatar } from "../../avatar/store";
import { emote } from "./emotes";
import { useKeyboard } from "./input";
import "./net";
import { useBumperProgress } from "./progress";
import { joinBumperRoom, leaveBumperRoom, sendBumper, useBumperRoom } from "./room";
import { game, useBumper } from "./store";
import { Hud } from "./ui/Hud";
import { Menu } from "./ui/Menu";
import { isPhone, NoPhonesScreen } from "./ui/NoPhones";
import { FriendsCard, Lobby, RoundCard } from "./ui/Party";
import { TuningPanel } from "./ui/Tuning";

const Game = lazy(() => import("./scene/Game"));

function BumperGame() {
  const [touch] = useState(() => window.matchMedia("(pointer: coarse)").matches);
  const showTuning = useBumper((s) => s.showTuning);
  const mode = useBumper((s) => s.mode);
  const [params, setParams] = useSearchParams();
  const roomParam = normalizeRoomCode(params.get("room") ?? "");
  const friends = params.get("friends") === "1";
  const synced = useAuth((s) => s.synced);
  const fullName = useAuth((s) => s.user?.user_metadata?.full_name as string | undefined);
  const { code, room, error, you, xp } = useBumperRoom();
  const progress = useBumperProgress((s) => s.progress);
  const userId = useAuth((s) => s.user?.id);
  const inRoom = code !== null;
  const between = !room || room.status === "lobby" || room.status === "results";
  // Driving keys only while there's a ring to drive: not under the menu or a lobby card.
  useKeyboard(mode === "practice" || mode === "gauntlet" || (inRoom && !between));

  // The menu on arriving; leaving drops the round, and the room.
  useEffect(() => {
    useBumper.getState().openMenu();
    return () => {
      leaveBumperRoom();
      game.sim = null;
      game.brains = [];
    };
  }, []);

  // ?room=K7MPQ (a shared link, or the friends card) joins that room once signed-in state is
  // known, so the room sees who we are.
  useEffect(() => {
    if (!roomParam || !synced) return;
    joinBumperRoom(roomParam, { name: fullName ? shortName(fullName) : "Guest", avatar: useAvatar.getState().config });
  }, [roomParam, synced, fullName]);
  // Couldn't join (or were put out): back to the friends card, which says why.
  useEffect(() => {
    if (error) setParams({ friends: "1" }, { replace: true });
  }, [error, setParams]);
  // Your level: loaded on sign-in and after each match's XP, and told to the room you're in.
  useEffect(() => {
    if (synced) void useBumperProgress.getState().load();
  }, [synced, userId, xp]);
  useEffect(() => {
    if (you) sendBumper({ type: "loadout", level: progress?.level ?? null });
  }, [you, code, progress]);
  // Out of the room: back to the menu.
  useEffect(() => {
    if (!inRoom && useBumper.getState().mode === "party") useBumper.getState().openMenu();
  }, [inRoom]);

  // Enter: the next Practice round once this one is over. 1–4: emotes. T (dev builds): the tuning panel.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const { mode, phase, next, toggleTuning } = useBumper.getState();
      if (e.code === "Enter" && mode === "practice" && phase === "over") next();
      if (e.code === "KeyT" && import.meta.env.DEV) toggleTuning();
      const n = ["Digit1", "Digit2", "Digit3", "Digit4"].indexOf(e.code);
      if (n >= 0 && !e.repeat) emote(BUMPER_EMOTES[n]);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  return (
    <div className="relative h-dvh touch-none overflow-hidden bg-[#cfe6ee] select-none">
      <Suspense fallback={null}>
        <Game />
      </Suspense>
      <Hud touch={touch} />
      {mode === "menu" && !inRoom && !friends && <Menu touch={touch} onFriends={() => setParams({ friends: "1" }, { replace: true })} />}
      {friends && !inRoom && <FriendsCard onBack={() => setParams({}, { replace: true })} />}
      {inRoom && between && <Lobby />}
      <RoundCard />
      {showTuning && <TuningPanel />}
    </div>
  );
}

export default function BumperArenaPage() {
  const [phone] = useState(isPhone);
  return phone ? <NoPhonesScreen /> : <BumperGame />;
}
