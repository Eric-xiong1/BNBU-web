-- P0 task availability windows. Run this migration once in the target database.
-- The checks are idempotent and preserve all existing task rows.

DROP PROCEDURE IF EXISTS add_task_time_window_columns;
DELIMITER //
CREATE PROCEDURE add_task_time_window_columns()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'start_at') THEN
    ALTER TABLE tasks ADD COLUMN start_at DATETIME NULL COMMENT 'UTC task availability start' AFTER deadline;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'end_at') THEN
    ALTER TABLE tasks ADD COLUMN end_at DATETIME NULL COMMENT 'UTC task availability end' AFTER start_at;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'timezone') THEN
    ALTER TABLE tasks ADD COLUMN timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Shanghai' AFTER end_at;
  END IF;
END //
DELIMITER ;
CALL add_task_time_window_columns();
DROP PROCEDURE IF EXISTS add_task_time_window_columns;

-- Rollback (run only after confirming no task requires a time window):
-- ALTER TABLE tasks DROP COLUMN timezone, DROP COLUMN end_at, DROP COLUMN start_at;
