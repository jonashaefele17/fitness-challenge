-- Realtime: stream changes of the social tables to open apps.
-- Row Level Security applies to every subscriber (INSERT/UPDATE events are only delivered
-- to users whose SELECT policy allows the row). DELETE events carry only the primary key.
alter publication supabase_realtime
  add table public.feed_events, public.comments, public.reactions, public.notifications;
