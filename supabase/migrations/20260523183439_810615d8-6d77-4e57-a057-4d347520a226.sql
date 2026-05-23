-- Restrict realtime.messages so authenticated users can only receive postgres_changes events.
-- The app uses postgres_changes on ta_notifications, which is already protected by RLS on
-- the source table. Broadcast/Presence are not used and could allow cross-org topic snooping.

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated postgres_changes only" ON realtime.messages;
CREATE POLICY "Authenticated postgres_changes only"
ON realtime.messages
FOR SELECT
TO authenticated
USING (extension = 'postgres_changes');

DROP POLICY IF EXISTS "No broadcast or presence inserts" ON realtime.messages;
CREATE POLICY "No broadcast or presence inserts"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (false);
