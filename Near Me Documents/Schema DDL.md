# Schema DDL

```sql
-- Users, Places, Tasks, Geofences, Notifications, Preferences
-- See full DDL in engineering repo; excerpt:
create table users(
  id uuid primary key,
  device_id text unique not null,
  email text,
  created_at timestamptz default now()
);
```