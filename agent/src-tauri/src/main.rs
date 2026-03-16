#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Command;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Step 1: Check and install Ollama if missing
            install_ollama_if_missing();

            // Step 2: Start FastAPI backend only when agent runs standalone.
            // If launched by python main.py, backend is already managed there.
            let managed_backend = std::env::var("PRIVCODE_MANAGED_BACKEND")
                .map(|v| v == "1")
                .unwrap_or(false);
            if managed_backend {
                eprintln!("[PrivCode] Backend managed by main.py — skipping internal backend start");
            } else {
                start_backend();
            }

            // Step 3: Setup system tray icon
            create_tray(app)?;

            // Step 4: Watch the backend — exit tray when backend stops
            start_backend_watcher();

            Ok(())
        })
        .on_window_event(|window, event| {
            // Hide to tray instead of closing
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn is_backend_running() -> bool {
    // Quick health-check: if backend is already up, skip starting it again.
    match std::net::TcpStream::connect_timeout(
        &"127.0.0.1:8000".parse().unwrap(),
        std::time::Duration::from_secs(2),
    ) {
        Ok(_) => {
            eprintln!("[PrivCode] Backend already running on port 8000 — skipping start");
            true
        }
        Err(_) => false,
    }
}

fn start_backend() {
    // If the backend is already running (started via python main.py), skip.
    if is_backend_running() {
        return;
    }

    // Spawn FastAPI backend in background
    std::thread::spawn(|| {
        // Navigate to repo root from executable location
        // executable: F:\...\agent\src-tauri\target\debug\app.exe
        // We need: F:\...\PrivCode\venv\Scripts\python.exe
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                // Go up to agent/src-tauri, then to agent, then to repo root
                let repo_root = exe_dir.parent()
                    .and_then(|p| p.parent())
                    .and_then(|p| p.parent())
                    .and_then(|p| p.parent());

                if let Some(repo) = repo_root {
                    let python_exe = repo.join("venv").join("Scripts").join("python.exe");
                    match Command::new(&python_exe)
                        .arg("main.py")
                        .current_dir(repo)
                        .spawn()
                    {
                        Ok(_) => eprintln!("[PrivCode] FastAPI backend started via main.py"),
                        Err(e) => eprintln!("[PrivCode] Failed to start backend: {}", e),
                    }
                } else {
                    eprintln!("[PrivCode] Could not determine repo root path");
                }
            }
        } else {
            eprintln!("[PrivCode] Could not determine executable path");
        }
    });
}

fn install_ollama_if_missing() {
    // Check if ollama is available
    let check = Command::new("ollama")
        .arg("--version")
        .output();

    match check {
        Ok(_) => {
            eprintln!("[PrivCode] Ollama is already installed");
        }
        Err(_) => {
            eprintln!("[PrivCode] Ollama not found, installing...");
            // Silent install via PowerShell
            let install_result = Command::new("powershell")
                .args(&[
                    "-Command",
                    "Start-Process ollama-windows.exe -ArgumentList '/S' -Wait",
                ])
                .spawn();

            match install_result {
                Ok(mut child) => {
                    if let Ok(status) = child.wait() {
                        if status.success() {
                            eprintln!("[PrivCode] Ollama installed successfully");
                        } else {
                            eprintln!("[PrivCode] Ollama installation may have failed");
                        }
                    }
                }
                Err(e) => eprintln!("[PrivCode] Failed to start Ollama installer: {}", e),
            }
        }
    }
}

/// Spawn a background thread that polls localhost:8000 every 3 seconds.
/// When the backend stops responding (python main.py was stopped),
/// the agent exits cleanly so the tray icon disappears automatically.
fn start_backend_watcher() {
    std::thread::spawn(|| {
        let backend_port = std::env::var("PRIVCODE_BACKEND_PORT")
            .ok()
            .and_then(|v| v.parse::<u16>().ok())
            .unwrap_or(8000);

        // Give the backend a few seconds to fully start before we begin watching.
        std::thread::sleep(std::time::Duration::from_secs(8));

        let mut seen_backend_once = false;
        let mut consecutive_failures: u32 = 0;

        loop {
            std::thread::sleep(std::time::Duration::from_secs(3));

            let address = format!("127.0.0.1:{}", backend_port);
            let alive = std::net::TcpStream::connect_timeout(
                &address.parse().unwrap(),
                std::time::Duration::from_secs(2),
            )
            .is_ok();

            if alive {
                seen_backend_once = true;
                consecutive_failures = 0;
            } else {
                // During startup we may not have a listening server yet.
                // Don't count failures until we have seen backend alive once.
                if !seen_backend_once {
                    continue;
                }

                consecutive_failures += 1;
                eprintln!(
                    "[PrivCode] Backend not reachable (attempt {}/3)",
                    consecutive_failures
                );
                // Require 3 consecutive failures before exiting
                // to avoid a false-positive during a brief restart.
                if consecutive_failures >= 3 {
                    eprintln!("[PrivCode] Backend stopped — exiting tray agent");
                    std::process::exit(0);
                }
            }
        }
    });
}

fn create_tray(app: &tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show PrivCode", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit PrivCode", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip("PrivCode AI Agent")
        // Left-click toggles the window; right-click shows the menu
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            "quit" => std::process::exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            // Single left-click: toggle window visibility
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(w) = app.get_webview_window("main") {
                    if w.is_visible().unwrap_or(false) {
                        let _ = w.hide();
                    } else {
                        let _ = w.show();
                        let _ = w.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}