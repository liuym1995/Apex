use serde::Serialize;
use std::env;
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;
use tauri_plugin_notification::NotificationExt;

const LOG_ROTATE_MAX_BYTES: u64 = 512 * 1024;
const LOG_ROTATE_KEEP_BYTES: u64 = 64 * 1024;
const AUTO_RESTART_MAX_ATTEMPTS: u32 = 3;
const AUTO_RESTART_BASE_DELAY_MS: u128 = 3_000;
const AUTO_RESTART_MAX_DELAY_MS: u128 = 20_000;
const DESKTOP_NAVIGATION_EVENT_MAX_RETAINED: usize = 50;

#[derive(Serialize)]
struct DesktopContext {
    runtime: &'static str,
    local_control_plane_required: bool,
    default_api_base: &'static str,
    can_manage_local_control_plane: bool,
}

#[derive(Clone, Serialize)]
struct LocalControlPlaneManagerState {
    supported: bool,
    status: &'static str,
    pid: Option<u32>,
    message: Option<String>,
    mode: &'static str,
    launch_target: Option<String>,
    stdout_log_path: Option<String>,
    stderr_log_path: Option<String>,
    last_exit: Option<String>,
    auto_restart_enabled: bool,
    restart_attempts: u32,
    next_restart_at: Option<String>,
}

#[derive(Clone, Serialize)]
struct LocalControlPlaneManagerEvent {
    sequence: u64,
    level: &'static str,
    message: String,
    recorded_at: String,
}

#[derive(Clone, Serialize)]
struct LocalControlPlaneManagerLogs {
    stdout_path: Option<String>,
    stderr_path: Option<String>,
    stdout_tail: Vec<String>,
    stderr_tail: Vec<String>,
}

#[derive(Clone, Serialize)]
struct DesktopNavigationEvent {
    event_id: String,
    sequence: u64,
    source: String,
    deep_link: String,
    recorded_at: String,
}

#[derive(Clone)]
struct LaunchPlan {
    mode: &'static str,
    launch_target: String,
    program: String,
    args: Vec<String>,
    cwd: PathBuf,
}

struct LocalControlPlaneManager {
    child: Mutex<Option<Child>>,
    last_event: Mutex<Option<String>>,
    events: Mutex<Vec<LocalControlPlaneManagerEvent>>,
    next_sequence: Mutex<u64>,
    stdout_log_path: PathBuf,
    stderr_log_path: PathBuf,
    last_exit: Mutex<Option<String>>,
    restart_attempts: Mutex<u32>,
    next_restart_at_ms: Mutex<Option<u128>>,
}

#[derive(Default)]
struct DesktopLaunchContext {
    initial_deep_link: Option<String>,
    pending_deep_link: Mutex<Option<String>>,
}

struct DesktopNavigationEventLog {
    events: Mutex<Vec<DesktopNavigationEvent>>,
    next_sequence: Mutex<u64>,
}

#[derive(Serialize)]
struct DesktopNavigationEventPolicy {
    max_retained: usize,
    storage_mode: &'static str,
}

#[derive(Serialize)]
struct DesktopNotificationCapability {
    native_supported: bool,
    click_through_supported: bool,
    mode: &'static str,
}

#[tauri::command]
fn get_desktop_context() -> DesktopContext {
    DesktopContext {
        runtime: "tauri",
        local_control_plane_required: true,
        default_api_base: option_env!("APEX_API_BASE").unwrap_or("http://127.0.0.1:3010"),
        can_manage_local_control_plane: resolve_launch_plan().is_ok(),
    }
}

#[tauri::command]
fn get_local_control_plane_manager_state(
    manager: tauri::State<'_, LocalControlPlaneManager>,
) -> LocalControlPlaneManagerState {
    current_local_control_plane_manager_state(manager.inner())
}

#[tauri::command]
fn get_local_control_plane_manager_events(
    manager: tauri::State<'_, LocalControlPlaneManager>,
) -> Vec<LocalControlPlaneManagerEvent> {
    let guard = manager
        .events
        .lock()
        .expect("local control plane events mutex poisoned");
    guard.iter().rev().cloned().collect()
}

#[tauri::command]
fn get_local_control_plane_manager_logs(
    manager: tauri::State<'_, LocalControlPlaneManager>,
) -> LocalControlPlaneManagerLogs {
    LocalControlPlaneManagerLogs {
        stdout_path: Some(path_to_string(&manager.stdout_log_path)),
        stderr_path: Some(path_to_string(&manager.stderr_log_path)),
        stdout_tail: read_tail_lines(&manager.stdout_log_path, 30),
        stderr_tail: read_tail_lines(&manager.stderr_log_path, 30),
    }
}

#[tauri::command]
fn get_initial_desktop_deep_link(
    launch_context: tauri::State<'_, DesktopLaunchContext>,
) -> Option<String> {
    launch_context.initial_deep_link.clone()
}

#[tauri::command]
fn consume_pending_desktop_deep_link(
    launch_context: tauri::State<'_, DesktopLaunchContext>,
) -> Option<String> {
    let mut guard = launch_context
        .pending_deep_link
        .lock()
        .expect("desktop launch context pending deep link mutex poisoned");
    guard.take()
}

#[tauri::command]
fn queue_desktop_deep_link(
    app: tauri::AppHandle,
    launch_context: tauri::State<'_, DesktopLaunchContext>,
    desktop_navigation_log: tauri::State<'_, DesktopNavigationEventLog>,
    deep_link: String,
    source: Option<String>,
) -> Result<Option<String>, String> {
    let normalized = normalize_deep_link(&deep_link);
    if normalized.is_none() {
        return Ok(None);
    }
    queue_pending_deep_link(
        &app,
        launch_context.inner(),
        desktop_navigation_log.inner(),
        normalized.clone(),
        source.as_deref().unwrap_or("queue_command"),
    );
    Ok(normalized)
}

#[tauri::command]
fn get_desktop_navigation_events(
    desktop_navigation_log: tauri::State<'_, DesktopNavigationEventLog>,
) -> Vec<DesktopNavigationEvent> {
    let guard = desktop_navigation_log
        .events
        .lock()
        .expect("desktop navigation event log mutex poisoned");
    guard.iter().rev().cloned().collect()
}

#[tauri::command]
fn get_desktop_navigation_event_policy() -> DesktopNavigationEventPolicy {
    DesktopNavigationEventPolicy {
        max_retained: DESKTOP_NAVIGATION_EVENT_MAX_RETAINED,
        storage_mode: "in_memory_ring_buffer",
    }
}

#[tauri::command]
fn start_local_control_plane(
    manager: tauri::State<'_, LocalControlPlaneManager>,
) -> LocalControlPlaneManagerState {
    let plan = match resolve_launch_plan() {
        Ok(plan) => plan,
        Err(error) => {
            return LocalControlPlaneManagerState {
                supported: false,
                status: "unsupported",
                pid: None,
                message: Some(error),
                mode: "unsupported",
                launch_target: None,
                stdout_log_path: Some(path_to_string(&manager.stdout_log_path)),
                stderr_log_path: Some(path_to_string(&manager.stderr_log_path)),
                last_exit: latest_exit(manager.inner()),
                auto_restart_enabled: false,
                restart_attempts: current_restart_attempts(manager.inner()),
                next_restart_at: next_restart_at_iso_like(manager.inner()),
            };
        }
    };

    let mut guard = manager
        .child
        .lock()
        .expect("local control plane manager mutex poisoned");

    if let Some(child) = guard.as_mut() {
        match child.try_wait() {
            Ok(None) => {
                return LocalControlPlaneManagerState {
                    supported: true,
                    status: "running",
                    pid: Some(child.id()),
                    message: Some("Local control plane is already running.".into()),
                    mode: plan.mode,
                    launch_target: Some(plan.launch_target),
                    stdout_log_path: Some(path_to_string(&manager.stdout_log_path)),
                    stderr_log_path: Some(path_to_string(&manager.stderr_log_path)),
                    last_exit: latest_exit(manager.inner()),
                    auto_restart_enabled: auto_restart_enabled(plan.mode),
                    restart_attempts: current_restart_attempts(manager.inner()),
                    next_restart_at: next_restart_at_iso_like(manager.inner()),
                };
            }
            Ok(Some(status)) => {
                let message = format!("Previous local control plane process exited with status {status}.");
                record_manager_event(manager.inner(), "info", message.clone());
                update_last_exit(manager.inner(), message);
                *guard = None;
            }
            Err(error) => {
                let message = format!("Failed to inspect the previous local control plane process: {error}");
                record_manager_event(manager.inner(), "error", message.clone());
                update_last_exit(manager.inner(), message);
                *guard = None;
            }
        }
    }

    match spawn_local_control_plane(&plan, manager.inner()) {
        Ok(child) => {
            let pid = child.id();
            *guard = Some(child);
            update_last_exit(manager.inner(), String::new());
            clear_restart_schedule(manager.inner());
            record_manager_event(
                manager.inner(),
                "info",
                format!(
                    "Started the local control plane using {} with pid {pid}.",
                    plan.mode
                ),
            );
            LocalControlPlaneManagerState {
                supported: true,
                status: "running",
                pid: Some(pid),
                message: Some(format!("Started local control plane via {}.", plan.mode)),
                mode: plan.mode,
                launch_target: Some(plan.launch_target),
                stdout_log_path: Some(path_to_string(&manager.stdout_log_path)),
                stderr_log_path: Some(path_to_string(&manager.stderr_log_path)),
                last_exit: latest_exit(manager.inner()),
                auto_restart_enabled: auto_restart_enabled(plan.mode),
                restart_attempts: current_restart_attempts(manager.inner()),
                next_restart_at: next_restart_at_iso_like(manager.inner()),
            }
        }
        Err(error) => {
            record_manager_event(manager.inner(), "error", error.clone());
            update_last_exit(manager.inner(), error.clone());
            LocalControlPlaneManagerState {
                supported: true,
                status: "errored",
                pid: None,
                message: Some(error),
                mode: plan.mode,
                launch_target: Some(plan.launch_target),
                stdout_log_path: Some(path_to_string(&manager.stdout_log_path)),
                stderr_log_path: Some(path_to_string(&manager.stderr_log_path)),
                last_exit: latest_exit(manager.inner()),
                auto_restart_enabled: auto_restart_enabled(plan.mode),
                restart_attempts: current_restart_attempts(manager.inner()),
                next_restart_at: next_restart_at_iso_like(manager.inner()),
            }
        }
    }
}

#[tauri::command]
fn stop_local_control_plane(
    manager: tauri::State<'_, LocalControlPlaneManager>,
) -> LocalControlPlaneManagerState {
    stop_local_control_plane_inner(manager.inner())
}

#[tauri::command]
fn restart_local_control_plane(
    manager: tauri::State<'_, LocalControlPlaneManager>,
) -> LocalControlPlaneManagerState {
    let stopped = stop_local_control_plane_inner(manager.inner());
    if stopped.status == "errored" {
        return stopped;
    }
    start_local_control_plane(manager)
}

#[tauri::command]
fn focus_main_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window is not available.".to_string())?;
    window
        .show()
        .map_err(|error| format!("Failed to show main window: {error}"))?;
    window
        .set_focus()
        .map_err(|error| format!("Failed to focus main window: {error}"))?;
    Ok(())
}

#[tauri::command]
fn get_desktop_notification_capability() -> DesktopNotificationCapability {
    DesktopNotificationCapability {
        native_supported: true,
        click_through_supported: false,
        mode: "tauri_native_fallback",
    }
}

#[tauri::command]
fn send_native_desktop_notification(
    app: tauri::AppHandle,
    title: String,
    body: String,
) -> Result<(), String> {
    let notification_body = if body.trim().is_empty() {
        "Open Apex to review the latest item.".to_string()
    } else {
        format!("{body}\n\nOpen Apex to review.")
    };

    app.notification()
        .builder()
        .title(title)
        .body(notification_body)
        .show()
        .map_err(|error| format!("Failed to show native desktop notification: {error}"))?;

    Ok(())
}

fn resolve_initial_deep_link() -> Option<String> {
    let mut args = env::args().skip(1).peekable();
    while let Some(argument) = args.next() {
        let value = argument.trim();
        if value.is_empty() {
            continue;
        }
        if let Some(explicit) = value.strip_prefix("--deep-link=") {
            return normalize_deep_link(explicit);
        }
        if value == "--deep-link" {
            if let Some(next) = args.next() {
                return normalize_deep_link(&next);
            }
            continue;
        }
        if value.starts_with("#kind=") || value.starts_with("kind=") || value.starts_with("apex://") {
            return normalize_deep_link(value);
        }
    }
    None
}

fn normalize_deep_link(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }
    if trimmed.starts_with("#kind=") {
        return Some(trimmed.to_string());
    }
    if let Some(stripped) = trimmed.strip_prefix("kind=") {
        return Some(format!("#kind={stripped}"));
    }
    if let Some(index) = trimmed.find("#kind=") {
        return Some(trimmed[index..].to_string());
    }
    None
}

fn queue_pending_deep_link(
    app: &tauri::AppHandle,
    launch_context: &DesktopLaunchContext,
    desktop_navigation_log: &DesktopNavigationEventLog,
    deep_link: Option<String>,
    source: &str,
) {
    if let Some(value) = deep_link.as_ref() {
        record_desktop_navigation_event(desktop_navigation_log, source, value.clone());
    }
    {
        let mut guard = launch_context
            .pending_deep_link
            .lock()
            .expect("desktop launch context pending deep link mutex poisoned");
        *guard = deep_link;
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn record_desktop_navigation_event(
    desktop_navigation_log: &DesktopNavigationEventLog,
    source: &str,
    deep_link: String,
) {
    let mut events = desktop_navigation_log
        .events
        .lock()
        .expect("desktop navigation event log mutex poisoned");
    let mut sequence = desktop_navigation_log
        .next_sequence
        .lock()
        .expect("desktop navigation event sequence mutex poisoned");
    let event = DesktopNavigationEvent {
        event_id: format!("desktop_nav_{}", *sequence),
        sequence: *sequence,
        source: source.to_string(),
        deep_link,
        recorded_at: unix_timestamp_iso_like(),
    };
    *sequence += 1;
    events.push(event);
    if events.len() > DESKTOP_NAVIGATION_EVENT_MAX_RETAINED {
        let drain_count = events.len() - DESKTOP_NAVIGATION_EVENT_MAX_RETAINED;
        events.drain(0..drain_count);
    }
}

fn stop_local_control_plane_inner(manager: &LocalControlPlaneManager) -> LocalControlPlaneManagerState {
    let plan = resolve_launch_plan().ok();
    let mut guard = manager
        .child
        .lock()
        .expect("local control plane manager mutex poisoned");
    clear_restart_schedule(manager);

    if let Some(child) = guard.as_mut() {
        let pid = child.id();
        if let Err(error) = child.kill() {
            let message = format!("Failed to stop local control plane process {pid}: {error}");
            record_manager_event(manager, "error", message.clone());
            update_last_exit(manager, message.clone());
            return LocalControlPlaneManagerState {
                supported: true,
                status: "errored",
                pid: Some(pid),
                message: Some(message),
                mode: plan.as_ref().map(|item| item.mode).unwrap_or("unsupported"),
                launch_target: plan.as_ref().map(|item| item.launch_target.clone()),
                stdout_log_path: Some(path_to_string(&manager.stdout_log_path)),
                stderr_log_path: Some(path_to_string(&manager.stderr_log_path)),
                last_exit: latest_exit(manager),
                auto_restart_enabled: plan
                    .as_ref()
                    .map(|item| auto_restart_enabled(item.mode))
                    .unwrap_or(false),
                restart_attempts: current_restart_attempts(manager),
                next_restart_at: next_restart_at_iso_like(manager),
            };
        }
        if let Err(error) = child.wait() {
            let message = format!(
                "Stopped local control plane process {pid}, but waiting for exit failed: {error}"
            );
            *guard = None;
            record_manager_event(manager, "error", message.clone());
            update_last_exit(manager, message.clone());
            return LocalControlPlaneManagerState {
                supported: true,
                status: "idle",
                pid: None,
                message: Some(message),
                mode: plan.as_ref().map(|item| item.mode).unwrap_or("unsupported"),
                launch_target: plan.as_ref().map(|item| item.launch_target.clone()),
                stdout_log_path: Some(path_to_string(&manager.stdout_log_path)),
                stderr_log_path: Some(path_to_string(&manager.stderr_log_path)),
                last_exit: latest_exit(manager),
                auto_restart_enabled: plan
                    .as_ref()
                    .map(|item| auto_restart_enabled(item.mode))
                    .unwrap_or(false),
                restart_attempts: current_restart_attempts(manager),
                next_restart_at: next_restart_at_iso_like(manager),
            };
        }
        *guard = None;
        let message = format!("Stopped local control plane process {pid}.");
        record_manager_event(manager, "info", message.clone());
        update_last_exit(manager, message.clone());
        return LocalControlPlaneManagerState {
            supported: true,
            status: "idle",
            pid: None,
            message: Some(message),
            mode: plan.as_ref().map(|item| item.mode).unwrap_or("unsupported"),
            launch_target: plan.as_ref().map(|item| item.launch_target.clone()),
            stdout_log_path: Some(path_to_string(&manager.stdout_log_path)),
            stderr_log_path: Some(path_to_string(&manager.stderr_log_path)),
            last_exit: latest_exit(manager),
            auto_restart_enabled: plan
                .as_ref()
                .map(|item| auto_restart_enabled(item.mode))
                .unwrap_or(false),
            restart_attempts: current_restart_attempts(manager),
            next_restart_at: next_restart_at_iso_like(manager),
        };
    }

    let message = "Local control plane is not currently running under desktop supervision.".to_string();
    record_manager_event(manager, "info", message.clone());
    LocalControlPlaneManagerState {
        supported: plan.is_some(),
        status: if plan.is_some() { "idle" } else { "unsupported" },
        pid: None,
        message: Some(message),
        mode: plan.as_ref().map(|item| item.mode).unwrap_or("unsupported"),
        launch_target: plan.as_ref().map(|item| item.launch_target.clone()),
        stdout_log_path: Some(path_to_string(&manager.stdout_log_path)),
        stderr_log_path: Some(path_to_string(&manager.stderr_log_path)),
        last_exit: latest_exit(manager),
        auto_restart_enabled: plan
            .as_ref()
            .map(|item| auto_restart_enabled(item.mode))
            .unwrap_or(false),
        restart_attempts: current_restart_attempts(manager),
        next_restart_at: next_restart_at_iso_like(manager),
    }
}

fn current_local_control_plane_manager_state(
    manager: &LocalControlPlaneManager,
) -> LocalControlPlaneManagerState {
    let plan = resolve_launch_plan().ok();
    let mut guard = manager
        .child
        .lock()
        .expect("local control plane manager mutex poisoned");

    if let Some(child) = guard.as_mut() {
        match child.try_wait() {
            Ok(None) => LocalControlPlaneManagerState {
                supported: true,
                status: "running",
                pid: Some(child.id()),
                message: latest_manager_event(manager)
                    .or_else(|| Some("Local control plane process is running.".into())),
                mode: plan.as_ref().map(|item| item.mode).unwrap_or("unsupported"),
                launch_target: plan.as_ref().map(|item| item.launch_target.clone()),
                stdout_log_path: Some(path_to_string(&manager.stdout_log_path)),
                stderr_log_path: Some(path_to_string(&manager.stderr_log_path)),
                last_exit: latest_exit(manager),
                auto_restart_enabled: plan
                    .as_ref()
                    .map(|item| auto_restart_enabled(item.mode))
                    .unwrap_or(false),
                restart_attempts: current_restart_attempts(manager),
                next_restart_at: next_restart_at_iso_like(manager),
            },
            Ok(Some(status)) => {
                let message = format!("Local control plane exited with status {status}.");
                *guard = None;
                record_manager_event(manager, "info", message.clone());
                update_last_exit(manager, message.clone());
                schedule_auto_restart_if_allowed(manager, plan.as_ref());
                if restart_due(manager) {
                    if let Some(plan) = plan.as_ref() {
                        return try_auto_restart(manager, plan);
                    }
                }
                LocalControlPlaneManagerState {
                    supported: plan.is_some(),
                    status: "errored",
                    pid: None,
                    message: Some(message),
                    mode: plan.as_ref().map(|item| item.mode).unwrap_or("unsupported"),
                    launch_target: plan.as_ref().map(|item| item.launch_target.clone()),
                    stdout_log_path: Some(path_to_string(&manager.stdout_log_path)),
                    stderr_log_path: Some(path_to_string(&manager.stderr_log_path)),
                    last_exit: latest_exit(manager),
                    auto_restart_enabled: plan
                        .as_ref()
                        .map(|item| auto_restart_enabled(item.mode))
                        .unwrap_or(false),
                    restart_attempts: current_restart_attempts(manager),
                    next_restart_at: next_restart_at_iso_like(manager),
                }
            }
            Err(error) => {
                let message = format!("Failed to inspect the local control plane process: {error}");
                *guard = None;
                record_manager_event(manager, "error", message.clone());
                update_last_exit(manager, message.clone());
                schedule_auto_restart_if_allowed(manager, plan.as_ref());
                if restart_due(manager) {
                    if let Some(plan) = plan.as_ref() {
                        return try_auto_restart(manager, plan);
                    }
                }
                LocalControlPlaneManagerState {
                    supported: plan.is_some(),
                    status: "errored",
                    pid: None,
                    message: Some(message),
                    mode: plan.as_ref().map(|item| item.mode).unwrap_or("unsupported"),
                    launch_target: plan.as_ref().map(|item| item.launch_target.clone()),
                    stdout_log_path: Some(path_to_string(&manager.stdout_log_path)),
                    stderr_log_path: Some(path_to_string(&manager.stderr_log_path)),
                    last_exit: latest_exit(manager),
                    auto_restart_enabled: plan
                        .as_ref()
                        .map(|item| auto_restart_enabled(item.mode))
                        .unwrap_or(false),
                    restart_attempts: current_restart_attempts(manager),
                    next_restart_at: next_restart_at_iso_like(manager),
                }
            }
        }
    } else {
        let supported = plan.is_some();
        if supported && restart_due(manager) {
            if let Some(plan) = plan.as_ref() {
                return try_auto_restart(manager, plan);
            }
        }
        LocalControlPlaneManagerState {
            supported,
            status: if supported { "idle" } else { "unsupported" },
            pid: None,
            message: latest_manager_event(manager).or_else(|| {
                Some(
                    plan.as_ref()
                        .map(|item| format!("Local control plane is idle and ready to launch via {}.", item.mode))
                        .unwrap_or_else(|| {
                            "No local control plane launch strategy is configured for this desktop runtime.".into()
                        }),
                )
            }),
            mode: plan.as_ref().map(|item| item.mode).unwrap_or("unsupported"),
            launch_target: plan.as_ref().map(|item| item.launch_target.clone()),
            stdout_log_path: Some(path_to_string(&manager.stdout_log_path)),
            stderr_log_path: Some(path_to_string(&manager.stderr_log_path)),
            last_exit: latest_exit(manager),
            auto_restart_enabled: plan
                .as_ref()
                .map(|item| auto_restart_enabled(item.mode))
                .unwrap_or(false),
            restart_attempts: current_restart_attempts(manager),
            next_restart_at: next_restart_at_iso_like(manager),
        }
    }
}

fn resolve_launch_plan() -> Result<LaunchPlan, String> {
    if let Some(command) = env::var("APEX_LOCAL_CONTROL_PLANE_COMMAND")
        .ok()
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
    {
        let cwd = env::var("APEX_LOCAL_CONTROL_PLANE_CWD")
            .ok()
            .map(PathBuf::from)
            .or_else(repo_root)
            .unwrap_or_else(|| env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));

        #[cfg(target_os = "windows")]
        let (program, args) = ("cmd".to_string(), vec!["/C".into(), command.clone()]);
        #[cfg(not(target_os = "windows"))]
        let (program, args) = ("sh".to_string(), vec!["-lc".into(), command.clone()]);

        return Ok(LaunchPlan {
            mode: "external_command",
            launch_target: command,
            program,
            args,
            cwd,
        });
    }

    if cfg!(debug_assertions) {
        if let Some(repo) = repo_root().filter(|path| path.exists()) {
            #[cfg(target_os = "windows")]
            let (program, args) = (
                "cmd".to_string(),
                vec!["/C".into(), "npm run dev -w @apex/local-control-plane".into()],
            );
            #[cfg(not(target_os = "windows"))]
            let (program, args) = (
                "sh".to_string(),
                vec!["-lc".into(), "npm run dev -w @apex/local-control-plane".into()],
            );

            return Ok(LaunchPlan {
                mode: "development_supervised",
                launch_target: "npm run dev -w @apex/local-control-plane".into(),
                program,
                args,
                cwd: repo,
            });
        }
    }

    let entry_path = env::var("APEX_LOCAL_CONTROL_PLANE_ENTRY")
        .ok()
        .map(PathBuf::from)
        .or_else(default_packaged_local_control_plane_entry)
        .or_else(default_repo_local_control_plane_entry);

    if let Some(entry_path) = entry_path.filter(|path| path.exists()) {
        let mode = if is_packaged_companion_path(&entry_path) {
            "packaged_node_companion"
        } else {
            "repo_node_companion"
        };
        let cwd = entry_path
            .parent()
            .map(Path::to_path_buf)
            .unwrap_or_else(|| env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));
        return Ok(LaunchPlan {
            mode,
            launch_target: path_to_string(&entry_path),
            program: resolve_node_executable(),
            args: vec![path_to_string(&entry_path)],
            cwd,
        });
    }

    Err(
        "No local control plane companion launch strategy is configured. Set APEX_LOCAL_CONTROL_PLANE_COMMAND or build the local-control-plane companion first."
            .into(),
    )
}

fn spawn_local_control_plane(
    plan: &LaunchPlan,
    manager: &LocalControlPlaneManager,
) -> Result<Child, String> {
    rotate_log_if_needed(&manager.stdout_log_path).map_err(|error| {
        format!(
            "Failed to rotate stdout log file {:?}: {error}",
            manager.stdout_log_path
        )
    })?;
    rotate_log_if_needed(&manager.stderr_log_path).map_err(|error| {
        format!(
            "Failed to rotate stderr log file {:?}: {error}",
            manager.stderr_log_path
        )
    })?;
    ensure_parent_dir(&manager.stdout_log_path)
        .map_err(|error| format!("Failed to prepare stdout log directory: {error}"))?;
    ensure_parent_dir(&manager.stderr_log_path)
        .map_err(|error| format!("Failed to prepare stderr log directory: {error}"))?;

    let stdout_log = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&manager.stdout_log_path)
        .map_err(|error| format!("Failed to open stdout log file {:?}: {error}", manager.stdout_log_path))?;
    let stderr_log = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&manager.stderr_log_path)
        .map_err(|error| format!("Failed to open stderr log file {:?}: {error}", manager.stderr_log_path))?;

    let mut command = Command::new(&plan.program);
    command
        .args(&plan.args)
        .current_dir(&plan.cwd)
        .stdout(Stdio::from(stdout_log))
        .stderr(Stdio::from(stderr_log));

    command.spawn().map_err(|error| {
        format!(
            "Failed to start the local control plane using {} in {:?}: {error}",
            plan.launch_target, plan.cwd
        )
    })
}

fn default_repo_local_control_plane_entry() -> Option<PathBuf> {
    let repo = repo_root()?;
    let candidate = repo
        .join("apps")
        .join("local-control-plane")
        .join("dist")
        .join("apps")
        .join("local-control-plane")
        .join("src")
        .join("index.js");
    candidate.exists().then_some(candidate)
}

fn default_packaged_local_control_plane_entry() -> Option<PathBuf> {
    let current_exe = env::current_exe().ok()?;
    let exe_dir = current_exe.parent()?;
    let candidates = [
        exe_dir
            .join("resources")
            .join("local-control-plane")
            .join("index.cjs"),
        exe_dir
            .join("resources")
            .join("local-control-plane")
            .join("index.js"),
        exe_dir.join("local-control-plane").join("index.js"),
        exe_dir.join("local-control-plane").join("index.cjs"),
        exe_dir
            .join("resources")
            .join("app")
            .join("local-control-plane")
            .join("index.js"),
    ];

    candidates.into_iter().find(|candidate| candidate.exists())
}

fn is_packaged_companion_path(path: &Path) -> bool {
    path.to_string_lossy().contains("resources")
}

fn resolve_node_executable() -> String {
    if let Some(configured) = env::var("APEX_NODE_EXECUTABLE")
        .ok()
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
    {
        return configured;
    }

    if let Some(packaged) = default_packaged_node_executable().filter(|path| path.exists()) {
        return path_to_string(&packaged);
    }

    "node".into()
}

fn default_packaged_node_executable() -> Option<PathBuf> {
    let current_exe = env::current_exe().ok()?;
    let exe_dir = current_exe.parent()?;

    #[cfg(target_os = "windows")]
    let candidates = [
        exe_dir.join("resources").join("node").join("node.exe"),
        exe_dir.join("resources").join("resources").join("node").join("node.exe"),
        exe_dir.join("node").join("node.exe"),
    ];

    #[cfg(not(target_os = "windows"))]
    let candidates = [
        exe_dir.join("resources").join("node").join("bin").join("node"),
        exe_dir.join("node").join("bin").join("node"),
    ];

    candidates.into_iter().find(|candidate| candidate.exists())
}

fn repo_root() -> Option<PathBuf> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    Some(manifest_dir.parent()?.parent()?.parent()?.to_path_buf())
}

fn ensure_parent_dir(path: &Path) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    Ok(())
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

fn auto_restart_enabled(mode: &str) -> bool {
    mode == "external_command" || mode == "repo_node_companion" || mode == "packaged_node_companion"
}

fn current_restart_attempts(manager: &LocalControlPlaneManager) -> u32 {
    *manager
        .restart_attempts
        .lock()
        .expect("local control plane restart attempts mutex poisoned")
}

fn clear_restart_schedule(manager: &LocalControlPlaneManager) {
    let mut attempts = manager
        .restart_attempts
        .lock()
        .expect("local control plane restart attempts mutex poisoned");
    *attempts = 0;
    drop(attempts);

    let mut next = manager
        .next_restart_at_ms
        .lock()
        .expect("local control plane next restart mutex poisoned");
    *next = None;
}

fn next_restart_at_iso_like(manager: &LocalControlPlaneManager) -> Option<String> {
    manager
        .next_restart_at_ms
        .lock()
        .expect("local control plane next restart mutex poisoned")
        .map(|value| value.to_string())
}

fn restart_due(manager: &LocalControlPlaneManager) -> bool {
    let next = manager
        .next_restart_at_ms
        .lock()
        .expect("local control plane next restart mutex poisoned");
    match *next {
        Some(timestamp) => now_millis() >= timestamp,
        None => false,
    }
}

fn schedule_auto_restart_if_allowed(
    manager: &LocalControlPlaneManager,
    plan: Option<&LaunchPlan>,
) {
    let Some(plan) = plan else {
        clear_restart_schedule(manager);
        return;
    };

    if !auto_restart_enabled(plan.mode) {
        clear_restart_schedule(manager);
        return;
    }

    let mut attempts = manager
        .restart_attempts
        .lock()
        .expect("local control plane restart attempts mutex poisoned");

    if *attempts >= AUTO_RESTART_MAX_ATTEMPTS {
        return;
    }

    *attempts += 1;
    let delay = (AUTO_RESTART_BASE_DELAY_MS * (*attempts as u128)).min(AUTO_RESTART_MAX_DELAY_MS);
    let when = now_millis() + delay;
    drop(attempts);

    let mut next = manager
        .next_restart_at_ms
        .lock()
        .expect("local control plane next restart mutex poisoned");
    *next = Some(when);
    drop(next);

    record_manager_event(
        manager,
        "info",
        format!(
            "Scheduled local control plane auto-restart attempt {} in {} ms.",
            current_restart_attempts(manager),
            delay
        ),
    );
}

fn try_auto_restart(
    manager: &LocalControlPlaneManager,
    plan: &LaunchPlan,
) -> LocalControlPlaneManagerState {
    match spawn_local_control_plane(plan, manager) {
        Ok(child) => {
            let pid = child.id();
            {
                let mut guard = manager
                    .child
                    .lock()
                    .expect("local control plane manager mutex poisoned");
                *guard = Some(child);
            }
            let successful_attempt = current_restart_attempts(manager);
            {
                let mut next = manager
                    .next_restart_at_ms
                    .lock()
                    .expect("local control plane next restart mutex poisoned");
                *next = None;
            }
            record_manager_event(
                manager,
                "info",
                format!(
                    "Automatically restarted the local control plane using {} with pid {pid}.",
                    plan.mode
                ),
            );
            LocalControlPlaneManagerState {
                supported: true,
                status: "running",
                pid: Some(pid),
                message: Some(format!(
                    "Auto-restarted local control plane via {}.",
                    plan.mode
                )),
                mode: plan.mode,
                launch_target: Some(plan.launch_target.clone()),
                stdout_log_path: Some(path_to_string(&manager.stdout_log_path)),
                stderr_log_path: Some(path_to_string(&manager.stderr_log_path)),
                last_exit: latest_exit(manager),
                auto_restart_enabled: true,
                restart_attempts: successful_attempt,
                next_restart_at: None,
            }
        }
        Err(error) => {
            record_manager_event(
                manager,
                "error",
                format!("Automatic restart failed: {error}"),
            );
            LocalControlPlaneManagerState {
                supported: true,
                status: "errored",
                pid: None,
                message: Some(error),
                mode: plan.mode,
                launch_target: Some(plan.launch_target.clone()),
                stdout_log_path: Some(path_to_string(&manager.stdout_log_path)),
                stderr_log_path: Some(path_to_string(&manager.stderr_log_path)),
                last_exit: latest_exit(manager),
                auto_restart_enabled: true,
                restart_attempts: current_restart_attempts(manager),
                next_restart_at: next_restart_at_iso_like(manager),
            }
        }
    }
}

fn latest_manager_event(manager: &LocalControlPlaneManager) -> Option<String> {
    let guard = manager
        .last_event
        .lock()
        .expect("local control plane event mutex poisoned");
    guard.clone()
}

fn update_last_exit(manager: &LocalControlPlaneManager, value: String) {
    let mut guard = manager
        .last_exit
        .lock()
        .expect("local control plane last exit mutex poisoned");
    if value.trim().is_empty() {
        *guard = None;
    } else {
        *guard = Some(value);
    }
}

fn latest_exit(manager: &LocalControlPlaneManager) -> Option<String> {
    let guard = manager
        .last_exit
        .lock()
        .expect("local control plane last exit mutex poisoned");
    guard.clone()
}

fn record_manager_event(manager: &LocalControlPlaneManager, level: &'static str, message: String) {
    let mut guard = manager
        .last_event
        .lock()
        .expect("local control plane event mutex poisoned");
    *guard = Some(message.clone());
    drop(guard);

    let mut events = manager
        .events
        .lock()
        .expect("local control plane events mutex poisoned");
    let mut sequence = manager
        .next_sequence
        .lock()
        .expect("local control plane sequence mutex poisoned");
    let event = LocalControlPlaneManagerEvent {
        sequence: *sequence,
        level,
        message,
        recorded_at: unix_timestamp_iso_like(),
    };
    *sequence += 1;
    events.push(event);
    if events.len() > 50 {
        let drain_count = events.len() - 50;
        events.drain(0..drain_count);
    }
}

fn rotate_log_if_needed(path: &Path) -> std::io::Result<()> {
    let metadata = match fs::metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(error),
    };

    if metadata.len() <= LOG_ROTATE_MAX_BYTES {
        return Ok(());
    }

    let backup_path = path.with_extension(match path.extension().and_then(|ext| ext.to_str()) {
        Some(ext) => format!("{ext}.previous"),
        None => "previous".into(),
    });

    if backup_path.exists() {
        let _ = fs::remove_file(&backup_path);
    }

    fs::copy(path, &backup_path)?;
    trim_file_to_tail(path, LOG_ROTATE_KEEP_BYTES)?;
    Ok(())
}

fn trim_file_to_tail(path: &Path, keep_bytes: u64) -> std::io::Result<()> {
    let bytes = fs::read(path)?;
    let start = bytes.len().saturating_sub(keep_bytes as usize);
    fs::write(path, &bytes[start..])?;
    Ok(())
}

fn unix_timestamp_iso_like() -> String {
    format!("{}", now_millis())
}

fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

fn default_log_root() -> PathBuf {
    if let Ok(root) = env::var("APEX_LOCAL_DEV_ROOT") {
        return PathBuf::from(root).join("logs");
    }
    #[cfg(target_os = "windows")]
    {
        return PathBuf::from(r"D:\apex-localdev").join("logs");
    }
    #[cfg(not(target_os = "windows"))]
    {
        return env::temp_dir().join("apex-localdev").join("logs");
    }
}

fn read_tail_lines(path: &Path, max_lines: usize) -> Vec<String> {
    let file = match fs::File::open(path) {
        Ok(file) => file,
        Err(_) => return Vec::new(),
    };

    let reader = BufReader::new(file);
    let mut lines = reader
        .lines()
        .filter_map(Result::ok)
        .collect::<Vec<String>>();

    if lines.len() > max_lines {
        lines.drain(0..(lines.len() - max_lines));
    }

    lines
}

fn main() {
    let log_root = default_log_root();
    let stdout_log_path = log_root.join("local-control-plane.stdout.log");
    let stderr_log_path = log_root.join("local-control-plane.stderr.log");
    let initial_deep_link = resolve_initial_deep_link();
    let initial_navigation_events = initial_deep_link
        .clone()
        .map(|deep_link| DesktopNavigationEvent {
            event_id: "desktop_nav_1".to_string(),
            sequence: 1,
            source: "startup_deep_link".to_string(),
            deep_link,
            recorded_at: unix_timestamp_iso_like(),
        })
        .into_iter()
        .collect::<Vec<_>>();
    let initial_navigation_sequence = if initial_navigation_events.is_empty() { 1 } else { 2 };

    let _ = ensure_parent_dir(&stdout_log_path);
    let _ = ensure_parent_dir(&stderr_log_path);

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            let resolved = args
                .into_iter()
                .find_map(|argument| normalize_deep_link(&argument));
            let launch_context = app.state::<DesktopLaunchContext>();
            let desktop_navigation_log = app.state::<DesktopNavigationEventLog>();
            queue_pending_deep_link(
                app,
                launch_context.inner(),
                desktop_navigation_log.inner(),
                resolved,
                "single_instance_handoff",
            );
        }))
        .manage(DesktopLaunchContext {
            initial_deep_link,
            pending_deep_link: Mutex::new(None),
        })
        .manage(DesktopNavigationEventLog {
            events: Mutex::new(initial_navigation_events),
            next_sequence: Mutex::new(initial_navigation_sequence),
        })
        .manage(LocalControlPlaneManager {
            child: Mutex::new(None),
            last_event: Mutex::new(None),
            events: Mutex::new(Vec::new()),
            next_sequence: Mutex::new(1),
            stdout_log_path,
            stderr_log_path,
            last_exit: Mutex::new(None),
            restart_attempts: Mutex::new(0),
            next_restart_at_ms: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            get_desktop_context,
            get_local_control_plane_manager_state,
            get_local_control_plane_manager_events,
            get_local_control_plane_manager_logs,
            get_initial_desktop_deep_link,
            consume_pending_desktop_deep_link,
            get_desktop_navigation_events,
            get_desktop_navigation_event_policy,
            queue_desktop_deep_link,
            start_local_control_plane,
            stop_local_control_plane,
            restart_local_control_plane,
            focus_main_window,
            get_desktop_notification_capability,
            send_native_desktop_notification
        ])
        .run(tauri::generate_context!())
        .expect("error while running apex desktop shell");
}
