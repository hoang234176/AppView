import './AppLayout.css';

/**
 * AppLayout — Tahoe UI Top-Level Frame Shell
 * Organizes the application into distinct visual areas:
 * 1. sidebar (Left column: Tree, Drives, Settings)
 * 2. header (Top bar: Search, Filters, Downloads, Select mode)
 * 3. content (Main canvas: Breadcrumbs, Grids, Empty/Loading states)
 * 4. fab (Floating '+' Action button)
 * 5. settings (SettingsModal & Server Connection management)
 * Plus background modals, context menus & snackbars.
 */
export function AppLayout({ sidebar, header, content, fab, modals, settings }) {
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

      {/* Popups, Dialogs & Modals */}
      {modals}
    </div>
  );
}
