import type { WidgetPreset } from "@/lib/widget-types";
import { alertBoxPreset } from "./alert-box";
import { clockPreset } from "./clock";
import { followerGoalPreset } from "./follower-goal";
import { musicPlayerPreset } from "./music-player";
import { chatOverlayPreset } from "./chat-overlay";
import { vtubeStudioBridgePreset } from "./vtube-studio-bridge";

export const WIDGET_PRESETS: WidgetPreset[] = [
  alertBoxPreset,
  clockPreset,
  followerGoalPreset,
  musicPlayerPreset,
  chatOverlayPreset,
  vtubeStudioBridgePreset,
];

export function getPresetById(id: string): WidgetPreset | undefined {
  return WIDGET_PRESETS.find((preset) => preset.id === id);
}
