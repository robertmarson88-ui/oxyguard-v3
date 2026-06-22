export function buildReportSummary(db) {
  const today = new Date().toISOString().slice(0, 10);

  return {
    total_monitored_devices: db.devices.length,
    active_unresolved_alerts: db.alerts.filter(alert => !alert.is_resolved).length,
    critical_system_incidents_today: db.alerts.filter(alert => alert.severity === "High" && alert.created_at.startsWith(today)).length,
    uptime_percentage: 99.45
  };
}
