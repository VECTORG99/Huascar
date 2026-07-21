# Deepwork: Waybar double fix + project audit — DONE

## Phase 1 — Waybar fix 
- **Root cause**: systemd `waybar.service` (packaged, auto-enabled) + `autostart.lua` both spawned waybar
- **Fix**: `systemctl --user disable waybar.service` + stop (PID 2391 killed)
- **Keep**: autostart.lua-managed instance (PID 2205) — correct cgroup, toggles/restarts work
- **Validation**: `hyprctl monitors` shows 38px reserved on both outputs (was 76px on DP-3)

## Phase 2 — Install.sh fixes 
- **Dead code**: removed lines 63-73 (SDDM theme — `config/sddm/Main.qml` doesn't exist)
- **Waybar spawn**: replaced `waybar &>/dev/null & disown` with `omarchy-restart-waybar` — prevents duplicate on reinstall, uses correct uwsm cgroup

## Phase 3 — Cleanup 
- **ADEV.md**: deleted (methodology doc in a theme repo — YAGNI)
- **eww.scss**: deleted (442L incomplete base, never loaded — install.sh symlinks eww-dark.scss over it)
- **`.github/ISSUE_TEMPLATE/`**: deleted (4 files — YAGNI for a theme repo)

## What was SKIPPED (ponytail)
| Skip | Why |
|------|-----|
| EWW SCSS variable refactor (eww-dark 680L ≈ eww-light 679L) | Skin-deep color duplication in a theme repo. Works, no functional issue. |
| SECURITY.md | 12 lines, harmless. |
| Waybar config triplication | Intentional layered theming architecture. |
| looknfeel.lua animation comments | Self-documenting names. |
