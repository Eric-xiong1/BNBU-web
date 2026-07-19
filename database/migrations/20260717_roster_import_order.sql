-- Persist the source batch and row order of roster imports.
DROP PROCEDURE IF EXISTS add_roster_import_order_columns;
DELIMITER //
CREATE PROCEDURE add_roster_import_order_columns()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_progress' AND COLUMN_NAME = 'import_batch') THEN
    ALTER TABLE student_progress ADD COLUMN import_batch VARCHAR(36) DEFAULT NULL AFTER status;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_progress' AND COLUMN_NAME = 'import_order') THEN
    ALTER TABLE student_progress ADD COLUMN import_order INT DEFAULT NULL AFTER import_batch;
  END IF;
END //
DELIMITER ;
CALL add_roster_import_order_columns();
DROP PROCEDURE IF EXISTS add_roster_import_order_columns;

DROP PROCEDURE IF EXISTS add_roster_import_order_index;
DELIMITER //
CREATE PROCEDURE add_roster_import_order_index()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'student_progress' AND INDEX_NAME = 'idx_student_progress_course_import_order') THEN
    CREATE INDEX idx_student_progress_course_import_order ON student_progress (course_id, import_batch, import_order);
  END IF;
END //
DELIMITER ;
CALL add_roster_import_order_index();
DROP PROCEDURE IF EXISTS add_roster_import_order_index;

-- Rollback: DROP INDEX idx_student_progress_course_import_order ON student_progress;
--           ALTER TABLE student_progress DROP COLUMN import_order, DROP COLUMN import_batch;
