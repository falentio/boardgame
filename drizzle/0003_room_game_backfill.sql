-- A room's game kind moved inside its setup value. Every row written before
-- this migration is a bare `{"roles":[...]}`; tag those as g54. The guard makes
-- the statement idempotent and leaves already-tagged rows alone.
UPDATE `room` SET `setup` = json_set(`setup`, '$.game', 'g54')
WHERE json_extract(`setup`, '$.game') IS NULL;
