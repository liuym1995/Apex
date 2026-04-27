type ApexWindowConfig = {
  apiBase?: string;
  runtimeLabel?: string;
};

export type DesktopContext = {
  runtime: "browser" | "tauri";
  local_control_plane_required: boolean;
  default_api_base: string;
  can_manage_local_control_plane: boolean;
};

export type LocalControlPlaneManagerState = {
  supported: boolean;
  status: "unsupported" | "idle" | "running" | "errored";
  pid?: number | null;
  message?: string | null;
  mode:
    | "unsupported"
    | "development_supervised"
    | "external_command"
    | "repo_node_companion"
    | "packaged_node_companion";
  launch_target?: string | null;
  stdout_log_path?: string | null;
  stderr_log_path?: string | null;
  last_exit?: string | null;
  auto_restart_enabled: boolean;
  restart_attempts: number;
  next_restart_at?: string | null;
};

export type LocalControlPlaneManagerEvent = {
  sequence: number;
  level: "info" | "error";
  message: string;
  recorded_at: string;
};

export type LocalControlPlaneManagerLogs = {
  stdout_path?: string | null;
  stderr_path?: string | null;
  stdout_tail: string[];
  stderr_tail: string[];
};

export type DesktopNotificationCapability = {
  native_supported: boolean;
  click_through_supported: boolean;
  mode: "browser_web" | "tauri_native_fallback";
};

export type DesktopNavigationEvent = {
  event_id: string;
  sequence: number;
  source: string;
  deep_link: string;
  recorded_at: string;
};

export type DesktopNavigationEventPolicy = {
  max_retained: number;
  storage_mode: "in_memory_ring_buffer";
};

declare global {
  interface Window {
    __APEX_CONFIG__?: ApexWindowConfig;
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: {
      invoke?: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
    };
  }
}

const DEFAULT_API_BASE = "http://127.0.0.1:3010";

export type DesktopRuntimeInfo = {
  mode: "browser" | "tauri";
  label: string;
  apiBase: string;
};

function readWindowConfig(): ApexWindowConfig | undefined {
  if (typeof window === "undefined") return undefined;
  return window.__APEX_CONFIG__;
}

export function isTauriRuntime(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.__TAURI__ || window.__TAURI_INTERNALS__);
}

export function getApiBase(): string {
  const fromWindow = readWindowConfig()?.apiBase?.trim();
  const fromEnv = (import.meta.env.VITE_APEX_API_BASE ?? "").trim();
  return fromWindow || fromEnv || DEFAULT_API_BASE;
}

export function getDesktopRuntimeInfo(): DesktopRuntimeInfo {
  const mode = isTauriRuntime() ? "tauri" : "browser";
  const configuredLabel = readWindowConfig()?.runtimeLabel?.trim();
  return {
    mode,
    label: configuredLabel || (mode === "tauri" ? "Tauri Desktop Shell" : "Browser Preview"),
    apiBase: getApiBase()
  };
}

async function invokeTauri<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauriRuntime()) {
    throw new Error("Tauri runtime is not available.");
  }
  const invoke = window.__TAURI_INTERNALS__?.invoke;
  if (typeof invoke !== "function") {
    throw new Error("Tauri invoke bridge is not available.");
  }
  return invoke(command, args) as Promise<T>;
}

export async function getDesktopContext(): Promise<DesktopContext> {
  if (!isTauriRuntime()) {
    return {
      runtime: "browser",
      local_control_plane_required: true,
      default_api_base: getApiBase(),
      can_manage_local_control_plane: false
    };
  }
  return invokeTauri<DesktopContext>("get_desktop_context");
}

export async function getLocalControlPlaneManagerState(): Promise<LocalControlPlaneManagerState> {
  if (!isTauriRuntime()) {
    return {
      supported: false,
      status: "unsupported",
      message: "Desktop control plane management is only available inside the Tauri shell.",
      mode: "unsupported",
      auto_restart_enabled: false,
      restart_attempts: 0
    };
  }
  return invokeTauri<LocalControlPlaneManagerState>("get_local_control_plane_manager_state");
}

export async function startLocalControlPlane(): Promise<LocalControlPlaneManagerState> {
  if (!isTauriRuntime()) {
    return {
      supported: false,
      status: "unsupported",
      message: "Desktop control plane management is only available inside the Tauri shell.",
      mode: "unsupported",
      auto_restart_enabled: false,
      restart_attempts: 0
    };
  }
  return invokeTauri<LocalControlPlaneManagerState>("start_local_control_plane");
}

export async function stopLocalControlPlane(): Promise<LocalControlPlaneManagerState> {
  if (!isTauriRuntime()) {
    return {
      supported: false,
      status: "unsupported",
      message: "Desktop control plane management is only available inside the Tauri shell.",
      mode: "unsupported",
      auto_restart_enabled: false,
      restart_attempts: 0
    };
  }
  return invokeTauri<LocalControlPlaneManagerState>("stop_local_control_plane");
}

export async function restartLocalControlPlane(): Promise<LocalControlPlaneManagerState> {
  if (!isTauriRuntime()) {
    return {
      supported: false,
      status: "unsupported",
      message: "Desktop control plane management is only available inside the Tauri shell.",
      mode: "unsupported",
      auto_restart_enabled: false,
      restart_attempts: 0
    };
  }
  return invokeTauri<LocalControlPlaneManagerState>("restart_local_control_plane");
}

export async function getLocalControlPlaneManagerEvents(): Promise<LocalControlPlaneManagerEvent[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  return invokeTauri<LocalControlPlaneManagerEvent[]>("get_local_control_plane_manager_events");
}

export async function getLocalControlPlaneManagerLogs(): Promise<LocalControlPlaneManagerLogs> {
  if (!isTauriRuntime()) {
    return {
      stdout_tail: [],
      stderr_tail: []
    };
  }
  return invokeTauri<LocalControlPlaneManagerLogs>("get_local_control_plane_manager_logs");
}

export async function getInitialDesktopDeepLink(): Promise<string | null> {
  if (!isTauriRuntime()) {
    if (typeof window === "undefined") {
      return null;
    }
    return window.location.hash || null;
  }
  return invokeTauri<string | null>("get_initial_desktop_deep_link");
}

export async function consumePendingDesktopDeepLink(): Promise<string | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invokeTauri<string | null>("consume_pending_desktop_deep_link");
}

export async function getDesktopNavigationEvents(): Promise<DesktopNavigationEvent[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  return invokeTauri<DesktopNavigationEvent[]>("get_desktop_navigation_events");
}

export async function getDesktopNavigationEventPolicy(): Promise<DesktopNavigationEventPolicy> {
  if (!isTauriRuntime()) {
    return {
      max_retained: 12,
      storage_mode: "in_memory_ring_buffer"
    };
  }
  return invokeTauri<DesktopNavigationEventPolicy>("get_desktop_navigation_event_policy");
}

export async function queueDesktopDeepLink(deepLink: string, source?: string): Promise<string | null> {
  if (!isTauriRuntime()) {
    if (typeof window !== "undefined") {
      window.location.hash = deepLink;
      return deepLink;
    }
    return null;
  }
  return invokeTauri<string | null>("queue_desktop_deep_link", { deepLink, source });
}

export async function focusDesktopWindow(): Promise<void> {
  if (!isTauriRuntime()) {
    if (typeof window !== "undefined") {
      window.focus();
    }
    return;
  }
  await invokeTauri<void>("focus_main_window");
}

export async function getDesktopNotificationCapability(): Promise<DesktopNotificationCapability> {
  if (typeof Notification !== "undefined") {
    return {
      native_supported: !isTauriRuntime(),
      click_through_supported: true,
      mode: "browser_web"
    };
  }
  if (!isTauriRuntime()) {
    return {
      native_supported: false,
      click_through_supported: false,
      mode: "browser_web"
    };
  }
  return invokeTauri<DesktopNotificationCapability>("get_desktop_notification_capability");
}

export async function sendNativeDesktopNotification(title: string, body: string): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error("Native desktop notifications are only available inside the Tauri shell.");
  }
  await invokeTauri<void>("send_native_desktop_notification", { title, body });
}
