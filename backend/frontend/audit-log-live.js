(() => {
  const TABLE_ID = "adminAuditTable";
  const ENDPOINT = "/api/audit-logs?limit=5";

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const getAuthToken = () => {
    try {
      const user = JSON.parse(sessionStorage.getItem("oxyguardUser") || "null");
      return user?.accessToken || user?.token || "";
    } catch {
      return "";
    }
  };

  const formatTime = (value) => {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return "Now";
    return date.toLocaleString([], {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const renderRows = (rows) => {
    const target = document.getElementById(TABLE_ID);
    if (!target || !Array.isArray(rows) || !rows.length) return;

    const html = `
      <table class="admin-table audit-log-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>User</th>
            <th>Action</th>
            <th>Target</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .slice(0, 5)
            .map(
              (row) => `
                <tr>
                  <td>${escapeHtml(formatTime(row.performed_at || row.created_at))}</td>
                  <td>${escapeHtml(row.username || `User ${row.user_id || "-"}`)}</td>
                  <td>${escapeHtml(row.action || "Activity")}</td>
                  <td>${escapeHtml(row.target_resource || row.target || "System")}</td>
                </tr>`
            )
            .join("")}
        </tbody>
      </table>`;
    if (target.innerHTML !== html) target.innerHTML = html;
  };

  const refreshAuditLogs = async () => {
    const target = document.getElementById(TABLE_ID);
    if (!target) return;

    const token = getAuthToken();
    if (!token) return;

    try {
      const response = await fetch(ENDPOINT, {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!response.ok) return;
      const data = await response.json();
      renderRows(data.audit_logs || data.auditLogs || []);
    } catch {
      // Keep the existing fallback table visible if the live endpoint is unavailable.
    }
  };

  window.addEventListener("DOMContentLoaded", () => {
    refreshAuditLogs();
    window.setInterval(() => {
      if (!document.hidden && !document.getElementById("auditLogDialog")?.open) refreshAuditLogs();
    }, 30000);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) refreshAuditLogs();
    });
  });
})();
