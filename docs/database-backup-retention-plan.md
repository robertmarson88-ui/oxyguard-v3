# OxyGuard Database Backup, Retention, and Recovery Plan

## Document status

- **Owner:** OxyGuard System Administrator / Facilities IT
- **Approval required from:** Hospital Information Security, Clinical Governance, and Records Management
- **Current implementation status:** Planned; not yet configured or restore-tested
- **Systems in scope:** Supabase PostgreSQL database used by the Render-hosted OxyGuard services
- **Data in scope:** Telemetry logs, alert logs, audit logs, users, roles, devices, wards, and configuration

## Policy decisions

### Backup retention

Encrypted database backups will be retained for **90 days**. This is acceptable as a backup-recovery window, provided the controls and restore tests in this document are implemented.

### Record retention

Backup retention and business-record retention are separate requirements.

| Data category | Primary database | Archive recommendation | Decision |
| --- | ---: | ---: | --- |
| Telemetry logs | 90 days | Retain monthly aggregates longer when needed for trends | 90 days is acceptable for detailed operational telemetry |
| Alert logs | 90 days | At least 12 months, subject to Clinical Governance requirements | 90 days is acceptable as hot retention, but not yet approved as final record retention |
| Audit logs | 90 days | At least 12 months in tamper-resistant storage, or longer if policy/law requires | 90 days alone is not recommended for security and compliance evidence |

No deletion job may be enabled until the hospital's authorized policy owner approves the final alert-log and audit-log retention periods.

## Backup design

1. Enable the database provider's managed backups and point-in-time recovery when supported by the selected service plan.
2. Create an independent, encrypted PostgreSQL logical backup every day and store it outside the production database account.
3. Retain daily backups for 90 days using an object-storage lifecycle policy.
4. Encrypt backups in transit and at rest. Restrict access to named administrators using least privilege and MFA.
5. Never place database credentials or backup files in GitHub, Render build output, application logs, or source code.
6. Monitor every scheduled backup. A missed or failed backup must generate an operational alert.

## Schedule and recovery objectives

| Control | Target |
| --- | --- |
| Logical database backup | Daily |
| Managed/PITR backup | Continuous where available |
| Backup integrity check | After every backup |
| Test restore to isolated database | Monthly |
| Disaster-recovery exercise | Quarterly |
| Backup retention | 90 days |
| Recovery Point Objective (RPO) | 24 hours with daily backups; 15 minutes when PITR is enabled |
| Recovery Time Objective (RTO) | 4 hours |

## Backup procedure

1. The scheduler starts the backup using a dedicated read-only backup account.
2. Export the database in PostgreSQL custom format, including schema and data.
3. Encrypt the backup before or during upload to the off-platform backup location.
4. Record the backup timestamp, database identifier, file size, checksum, job result, and expiry date.
5. Verify the checksum and confirm the backup can be listed and read by the recovery role.
6. Notify the administrator immediately if the export, upload, encryption, or verification step fails.
7. Allow the storage lifecycle policy to delete backup objects only after 90 days.

## Restore procedure

1. Open an incident or change ticket and identify the required recovery point.
2. Create an isolated recovery database; do not overwrite production during the initial restore.
3. Restore the selected backup and apply later transaction recovery where PITR is available.
4. Validate row counts and recent records for `telemetry_logs`, `alerts`, `audit_logs`, `users`, `devices`, and configuration tables.
5. Validate application login, dashboard queries, alert history, and audit-log access against the recovery database.
6. Obtain approval before switching production to the recovered database.
7. Record actual recovery time, recovered timestamp, data loss (if any), validation evidence, and approver.
8. Delete the isolated recovery environment securely after the test or incident is closed.

## Data retention and deletion controls

1. A scheduled retention job may remove detailed telemetry older than 90 days only after the corresponding backup is verified.
2. Alert and audit records older than 90 days must be exported to the approved archive before removal from the primary database.
3. Archive exports must preserve timestamps, identifiers, users, roles, actions, details, alert status, and recommended actions.
4. Deletion must run in controlled batches and create an audit record containing the cutoff date and number of rows removed.
5. Legal holds, investigations, open incidents, and unresolved alerts suspend deletion of affected records.
6. The retention process must be tested in a non-production database before production activation.

## Evidence and review

Retain the following evidence: backup job logs, checksums, failure notifications, restore-test results, access reviews, deletion reports, and policy approvals. Review this plan annually and after every failed restore, major database change, or security incident.

## Implementation checklist

- [ ] Hospital policy owner approves record-retention periods
- [ ] Managed backups/PITR enabled and verified
- [ ] Independent encrypted daily backup job configured
- [ ] Off-platform storage configured with a 90-day lifecycle
- [ ] Backup service account and recovery role created
- [ ] Failure monitoring and notification configured
- [ ] First isolated restore completed successfully
- [ ] Monthly restore-test calendar assigned to an owner
- [ ] Retention/archive jobs implemented and tested
- [ ] Recovery evidence and approvals stored securely

