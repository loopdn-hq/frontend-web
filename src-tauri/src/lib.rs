// The Tauri host process.
//
// Deliberately thin: everything the user sees is the same Next.js bundle the
// web app serves. What lives here is the behaviour a web page cannot provide -
// window lifecycle, and the plugins the webview calls into.
//
// NOTE ON THE MENU: none is set here on purpose. Tauri installs a default menu
// that already carries the predefined Edit items, and on macOS those items are
// what make Cmd+C / Cmd+V / Cmd+A work inside text fields - WKWebView routes
// those keystrokes through the menu, not the webview. Replacing the menu
// without re-adding the predefined items silently breaks typing in the message
// composer, which is the one interaction this app is for. If a custom menu is
// added later, keep PredefinedMenuItem::{copy, paste, cut, select_all, undo,
// redo} in an Edit submenu.

use tauri::{Manager, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the window must not quit the app.
            //
            // On macOS the red button closes the WINDOW; the app stays in the
            // Dock. Tauri's default is to quit once the last window closes,
            // which for a chat client means the user closes the window, stops
            // receiving messages, and never learns why. Hide instead, and let
            // Cmd+Q and the menu item be the ways to actually quit.
            if let WindowEvent::CloseRequested { api, .. } = event {
                #[cfg(target_os = "macos")]
                {
                    api.prevent_close();
                    let _ = window.hide();
                }
                // Windows and Linux follow their own conventions, where
                // closing the last window ending the app is expected. Left
                // alone until there is a tray icon to minimise into.
                #[cfg(not(target_os = "macos"))]
                {
                    let _ = (api, window);
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // Clicking the Dock icon after the window was hidden must bring it
            // back. Without this the app is running, reachable only by Cmd+Tab,
            // and looks broken.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = event {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            #[cfg(not(target_os = "macos"))]
            let _ = (app, event);
        });
}
