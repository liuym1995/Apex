# Apex Desktop Shell (Tauri)

This directory contains the first-pass Tauri scaffold for the Apex desktop shell.

## Current Role

The scaffold exists to:

- turn the existing React desktop shell into a real desktop application shape
- preserve browser compatibility while the desktop shell evolves
- keep the local control plane as the operational backend

## Current Assumptions

- the local control plane continues to run at `http://127.0.0.1:3010` by default
- the frontend remains browser-compatible
- Tauri is used as the preferred desktop shell target
- desktop development assets should prefer `D:\apex-localdev` on Windows so Rust and Playwright do not consume the system drive

## Current Limits

This scaffold is intentionally minimal.
It does not yet:

- include production signing, packaging, or updater setup
- ship a portable Node runtime by default for packaged companion execution

It now does provide a small Rust-side command bridge for desktop development:

- desktop context discovery
- local control plane manager state inspection
- dev-only local control plane launch under desktop supervision
- dev-only local control plane stop and restart controls
- last desktop-managed lifecycle event reporting so the UI can explain why the control plane is idle or errored
- persisted stdout/stderr companion logs and tail inspection
- launch strategy discovery for development, explicit command mode, and built repo companion mode
- packaged companion resource discovery and launch target reporting
- bounded log rotation and companion auto-restart scheduling for node-based companion modes
- bundled portable Node runtime discovery for packaged execution

## Recommended Next Steps

1. install the Rust toolchain and Tauri prerequisites on the development machine
2. verify `tauri dev` against the supervised local control plane and desktop frontend
3. decide how the packaged app should launch the local control plane in production
4. add a richer desktop command bridge only where local shell APIs genuinely add value
5. decide whether the local control plane should be:
   - supervised by the desktop shell
   - embedded
   - or kept as a separately launched companion process

## Development Flow

The current intended development flow is:

1. `npm run dev:desktop-supervisor`
2. or `npm run tauri:dev` once Rust and Tauri prerequisites are installed
3. use `npm run tauri:info` to verify the local desktop environment before attempting a full build

Recommended Windows-local setup:

1. `npm run setup:rust:local`
2. `npm run setup:node:portable`
3. `npm run setup:playwright:local`
4. `npm run generate:desktop-icons`
5. `npm run tauri:fetch`
6. `npm run tauri:info`
7. `npm run tauri:dev`
8. `npm run tauri:release -- --unsigned` for unsigned local bundle validation
9. `npm run tauri:release` once signing credentials are configured

The scripted release path now defaults to a portable bundle so local validation does not block on NSIS or WiX downloads.
Use:

- `npm run tauri:release -- --installer nsis`
- `npm run tauri:release -- --installer msi`

only when you intentionally want installer artifacts on top of the portable release.

The local desktop scripts default to `D:\apex-localdev`, but you can still override that with `APEX_LOCAL_DEV_ROOT` if you need a different D-drive path.
They also use a slower-network-safe Cargo profile and support two mirror override modes:

- `APEX_CARGO_MIRROR=rsproxy`
- `APEX_CARGO_INDEX_URL=<your sparse registry url>`

These overrides are written only into the local desktop Cargo home and do not modify your global Rust toolchain configuration.
The current scaffold also ships with a reproducible placeholder icon generator so Windows builds can proceed before final product branding is ready.

Companion launch strategy order:

1. `APEX_LOCAL_CONTROL_PLANE_COMMAND`
2. development-supervised npm workflow
3. packaged companion resource via `APEX_LOCAL_CONTROL_PLANE_ENTRY` or the bundled `resources/local-control-plane/index.cjs`
4. built repo companion entry via `APEX_LOCAL_CONTROL_PLANE_ENTRY` or the default built `dist` path

When packaged deployments need an explicit Node runtime, set:

- `APEX_NODE_EXECUTABLE`

Otherwise the packaged desktop shell will try to use the bundled portable runtime under `resources/node/node.exe`.
Once that runtime has been prepared and checksum-verified, repeat builds prefer the local cached runtime instead of requiring a fresh network round-trip.

Windows signing options:

- `APEX_WINDOWS_SIGN_COMMAND`
- `APEX_WINDOWS_CERT_THUMBPRINT`
- `APEX_WINDOWS_CERT_FILE`
- `APEX_WINDOWS_CERT_PASSWORD`
- `APEX_WINDOWS_TIMESTAMP_URL`

Unsigned local validation remains available through `tauri build --no-sign`, and the repository wraps that as `npm run tauri:release -- --unsigned`.

Companion logs are written under the local desktop root, typically:

- `D:\apex-localdev\logs\local-control-plane.stdout.log`
- `D:\apex-localdev\logs\local-control-plane.stderr.log`

The supervisor path starts:

- the local control plane
- the desktop frontend dev server

This keeps the desktop shell and local runtime aligned during development.

Inside a Tauri development build, the desktop UI can now also inspect the desktop-managed local control plane state and request a launch if the control plane is unavailable.
That behavior is intentionally limited to development builds until packaging, logging, restart policy, and shutdown semantics are finalized.

The desktop shell also supports an initial deep-link target at startup:

- `apex-desktop-shell.exe --deep-link="#kind=task&taskId=task_..."`
- `apex-desktop-shell.exe --deep-link "#kind=policy_proposal&proposalId=..."`
- `apex-desktop-shell.exe "apex://open#kind=inbox&inboxId=..."`

These startup arguments are normalized into the same workspace deep-link protocol used by copied links, inbox focus actions, and future native notification callbacks.

The Rust bridge also keeps a pending deep-link slot for the running shell, so future single-instance activation and native notification click handlers can queue a target and let the frontend consume it without reopening a separate window.

The shell now also registers a single-instance handoff path. When a second desktop launch includes a deep-link argument, the running instance receives that target through the same pending deep-link bridge and focuses the main window instead of creating a second desktop shell.

The desktop shell also keeps a lightweight system navigation event feed for those entry points, so startup deep links and single-instance handoff events can be surfaced in the workspace alongside browser-side navigation events.

Desktop notifications now use a hybrid model:

- browser notifications remain the preferred path when click-through handling is available
- the Tauri shell provides a native notification fallback for runtimes where the browser notification API is unavailable

That keeps priority alerts visible on desktop without pretending native notification clicks already participate in the deep-link handoff path.

For Windows-local protocol validation, the repository also ships current-user-only helper scripts:

- `npm run register:desktop-protocol`
- `npm run unregister:desktop-protocol`
- `npm run launch:desktop-link -- -DeepLink "#kind=task&taskId=task_..."`

These helpers only touch the current user's `HKCU\\Software\\Classes\\apex` registration, which makes them safe for local testing and easy to roll back.
If you only want to preview the registry operations, run the PowerShell scripts directly with `-WhatIf`.
