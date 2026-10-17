import './AppLayout.css';

/**
 * AppLayout — Tahoe UI Top-Level Frame Shell
 * Organizes the application into distinct visual areas:
 * 1. sidebar (Left column: Tree, Drives, Settings)
 * 2. header (Top bar: Search, Filters, Downloads, Select mode)
 * 3. content (Main canvas: Breadcrumbs, Grids, Empty/Loading states)
 * 4. fab (Floating '+' Action button)
 * 5. settings (SettingsModal & Server Connection management)
 * 6. downloads (Download modals, panel, & progress snackbar)
 * 7. contextMenu (Right-click context flyout menu)
 * 8. notifications (Global alerts, system overlays, delete confirmation & toasts)
 * Plus background modals.
 */
export function AppLayout({ sidebar, header, content, fab, modals, settings, downloads, contextMenu, notifications }) {
  return (
    <div className="tahoe-app-wrapper app-layout-wrapper overflow-hidden">
      {/* Area 1: Left Column Sidebar */}
      {sidebar}

      {/* Right Container: Header + Content Canvas */}
      <div className="app-main-column">
        {/* Area 2: Top Header Bar */}
        {header}

        {/* Area 3: Main Content Canvas */}
        {content}
      </div>

      {/* Area 4: Floating Action Button */}
      {fab}

      {/* Area 5: Settings & Connection Management */}
      {settings}

      {/* Area 6: Downloads & Notification */}
      {downloads}

      {/* Area 7: Context Menus */}
      {contextMenu}

      {/* Area 8: Notifications, System Alerts & Feedback */}
      {notifications}

      {/* Popups, Dialogs & Modals */}
      {modals}
    </div>
  );
}
