#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Command;
use tauri::{AppHandle, Manager};
use tray_icon::{
    menu::{Menu, MenuItem},
    TrayIconBuilder,
};

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Step 1: Check and install Ollama if missing
            install_ollama_if_missing();
            
            // Step 2: Start FastAPI backend
            start_backend();
            
            // Step 3: Setup tray UI
            create_tray(app.handle().clone());
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                window.hide().unwrap();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn start_backend() {
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
                        .arg("backend/app.py")
                        .current_dir(repo)
                        .spawn()
                    {
                        Ok(_) => eprintln!("[PrivCode] FastAPI backend started"),
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

fn create_tray(app: AppHandle) {
    let show_item = MenuItem::new("Show PrivCode", true, None);
    let quit_item = MenuItem::new("Quit", true, None);

    let tray_menu = Menu::new();
    tray_menu.append(&show_item).unwrap();
    tray_menu.append(&quit_item).unwrap();

    let icon = load_icon();

    let show_id = show_item.id().clone();
    let quit_id = quit_item.id().clone();

    let tray = TrayIconBuilder::new()
        .with_menu(Box::new(tray_menu))
        .with_tooltip("PrivCode AI Agent")
        .with_icon(icon)
        .build()
        .unwrap();

    // Handle tray menu events via global MenuEvent receiver
    let app_handle = app.clone();
    std::thread::spawn(move || {
        let rx = tray_icon::menu::MenuEvent::receiver();
        while let Ok(event) = rx.recv() {
            if event.id == show_id {
                if let Some(window) = app_handle.get_webview_window("main") {
                    window.show().unwrap();
                    window.set_focus().unwrap();
                }
            } else if event.id == quit_id {
                std::process::exit(0);
            }
        }
    });

    std::mem::forget(tray); // keep tray alive
}

fn load_icon() -> tray_icon::Icon {
    tray_icon::Icon::from_path("icons/icon.ico", None).unwrap()
}