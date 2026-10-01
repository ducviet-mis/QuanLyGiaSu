-- TutorSpace: one private owner; no signup or multi-teacher membership model.
-- Run once in the Supabase SQL editor. The final owner registration is manual.
begin;

create table public.workspace_owner (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table public.workspace_revisions (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now()
);
create or replace function public.is_workspace_owner() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.workspace_owner where user_id = auth.uid()); $$;
revoke all on function public.is_workspace_owner() from public, anon;
grant execute on function public.is_workspace_owner() to authenticated;

-- Immutable image bytes are interned once per owner. Application rows and
-- issued snapshots contain only asset:<sha256> references, never remote URLs.
create table public.image_assets (
  owner_id uuid not null references auth.users(id) on delete cascade,
  asset_key text not null check(asset_key ~ '^[a-f0-9]{64}$'),
  data_uri text not null,
  mime_type text generated always as (split_part(split_part(data_uri,';',1),':',2)) stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key(owner_id,asset_key),
  check(length(data_uri) <= 2800000),
  check(data_uri ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$'),
  check(length(split_part(data_uri,',',2)) % 4 = 0),
  check(octet_length(decode(split_part(data_uri,',',2),'base64')) between 1 and 2097152),
  check(asset_key = encode(sha256(convert_to(data_uri,'UTF8')),'hex'))
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '', phone text not null default '', email text not null default '',
  avatar text not null default '', brand text not null default 'TutorSpace',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(avatar = '' or avatar ~ '^asset:[a-f0-9]{64}$')
);
create table public.app_settings (
  id uuid primary key references public.profiles(id) on delete cascade,
  theme text not null default 'light' check(theme in ('light','dark','system')),
  default_rate bigint not null default 150000 check(default_rate between 0 and 1000000000000),
  reminder_minutes integer not null default 15 check(reminder_minutes between 0 and 1440),
  bank_name text not null default '', bank_account text not null default '', bank_holder text not null default '',
  qr_image text not null default '', notifications boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(qr_image = '' or qr_image ~ '^asset:[a-f0-9]{64}$')
);
create table public.students (
  id uuid primary key, owner_id uuid not null references public.profiles(id),
  name text not null check(length(trim(name)) between 1 and 200), grade text not null, subject text not null,
  parent_name text not null, parent_phone text not null, start_date date not null,
  mode text not null check(mode in ('online','offline')), rate_type text not null check(rate_type in ('hour','session')),
  rate bigint not null check(rate between 0 and 1000000000000), color text not null check(color ~ '^#[0-9a-fA-F]{6}$'),
  avatar text not null default '', status text not null check(status in ('active','paused','ended')),
  notes text not null, goals text not null, created_at timestamptz not null, updated_at timestamptz not null,
  unique(id, owner_id),
  check(avatar = '' or avatar ~ '^asset:[a-f0-9]{64}$')
);
create table public.teaching_schedules (
  id uuid primary key, owner_id uuid not null references public.profiles(id),
  student_id uuid not null, weekdays integer[] not null,
  start_date date not null, end_date date not null, start_time time not null, end_time time not null,
  subject text not null, mode text not null check(mode in ('online','offline')), location text not null, notes text not null,
  created_at timestamptz not null, updated_at timestamptz not null,
  foreign key(student_id, owner_id) references public.students(id, owner_id),
  unique(id, student_id, owner_id),
  check(end_date >= start_date), check(end_time > start_time),
  check(cardinality(weekdays) between 1 and 7 and weekdays <@ array[0,1,2,3,4,5,6])
);
create table public.teaching_sessions (
  id uuid primary key, owner_id uuid not null references public.profiles(id), student_id uuid not null,
  schedule_id uuid, date date not null, start_time time not null, end_time time not null,
  subject text not null, mode text not null check(mode in ('online','offline')), location text not null, notes text not null,
  status text not null check(status in ('scheduled','completed','student_absent','teacher_absent','cancelled','rescheduled')),
  actual_minutes integer check(actual_minutes between 0 and 1440), billable boolean,
  rate bigint not null check(rate between 0 and 1000000000000), rate_type text not null check(rate_type in ('hour','session')),
  created_at timestamptz not null, updated_at timestamptz not null,
  foreign key(student_id, owner_id) references public.students(id, owner_id),
  foreign key(schedule_id, student_id, owner_id) references public.teaching_schedules(id, student_id, owner_id),
  unique(id, student_id, owner_id), unique(id, owner_id), unique(schedule_id, date), check(end_time > start_time)
);
create table public.lesson_notes (
  id uuid primary key, owner_id uuid not null references public.profiles(id), session_id uuid not null unique,
  content text not null default '', attitude text not null default '', understanding text not null default '',
  homework text not null default '', next_plan text not null default '',
  created_at timestamptz not null, updated_at timestamptz not null,
  foreign key(session_id, owner_id) references public.teaching_sessions(id, owner_id) on delete cascade
);
create table public.invoices (
  id uuid primary key, owner_id uuid not null references public.profiles(id), student_id uuid not null,
  code text not null check(length(code) between 1 and 100), month text not null check(month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  status text not null check(status in ('draft','issued')),
  surcharge bigint not null check(surcharge between 0 and 1000000000000), discount bigint not null check(discount between 0 and 1000000000000),
  adjustment_note text not null, comment text not null,
  snapshot jsonb not null check(jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null, updated_at timestamptz not null, issued_at timestamptz,
  foreign key(student_id, owner_id) references public.students(id, owner_id),
  unique(id, student_id, owner_id), unique(id, owner_id),
  check((status = 'issued') = (issued_at is not null)),
  check(coalesce(snapshot->>'qrImage','') = '' or snapshot->>'qrImage' ~ '^asset:[a-f0-9]{64}$')
);
create unique index one_issued_invoice_per_month on public.invoices(student_id, month) where status = 'issued';
create table public.invoice_items (
  id uuid primary key, owner_id uuid not null references public.profiles(id), invoice_id uuid not null,
  student_id uuid not null, session_id uuid, position integer not null check(position >= 0),
  date date not null, minutes integer not null check(minutes between 0 and 1440),
  rate bigint not null check(rate between 0 and 1000000000000), rate_type text not null check(rate_type in ('hour','session')),
  amount bigint not null check(amount between 0 and 1000000000000), description text not null,
  issued boolean not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(invoice_id, student_id, owner_id) references public.invoices(id, student_id, owner_id) on delete cascade,
  foreign key(session_id, student_id, owner_id) references public.teaching_sessions(id, student_id, owner_id),
  unique(invoice_id, position)
);
create unique index session_billed_once on public.invoice_items(session_id) where issued and session_id is not null;
create table public.payments (
  id uuid primary key, owner_id uuid not null references public.profiles(id), invoice_id uuid not null,
  amount bigint not null check(amount between 1 and 1000000000000), date date not null, note text not null,
  created_at timestamptz not null, updated_at timestamptz not null default now(),
  foreign key(invoice_id, owner_id) references public.invoices(id, owner_id) on delete cascade
);
create index sessions_by_date on public.teaching_sessions(owner_id,date);
create index sessions_by_student on public.teaching_sessions(student_id,date);
create index payments_by_date on public.payments(owner_id,date);

alter table public.workspace_owner enable row level security;
create policy owner_sees_registration on public.workspace_owner for select to authenticated using(user_id = (select auth.uid()));
alter table public.workspace_revisions enable row level security;
create policy owner_sees_revision on public.workspace_revisions for select to authenticated using(owner_id = (select auth.uid()) and (select public.is_workspace_owner()));
do $$ declare t text; begin
  foreach t in array array['profiles','app_settings'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy private_owner_read on public.%I for select to authenticated using (id = (select auth.uid()) and (select public.is_workspace_owner()))',t);
  end loop;
  foreach t in array array['students','teaching_schedules','teaching_sessions','lesson_notes','invoices','invoice_items','payments','image_assets'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy private_owner_read on public.%I for select to authenticated using (owner_id = (select auth.uid()) and (select public.is_workspace_owner()))',t);
  end loop;
end $$;
-- Only the transactional RPC can mutate data, protecting snapshots even from
-- direct authenticated REST table calls. RLS also denies all non-owner reads.
revoke all on public.workspace_owner, public.workspace_revisions, public.profiles, public.app_settings, public.students, public.teaching_schedules, public.teaching_sessions, public.lesson_notes, public.invoices, public.invoice_items, public.payments, public.image_assets from anon, authenticated;
grant select on public.workspace_owner, public.workspace_revisions, public.profiles, public.app_settings, public.students, public.teaching_schedules, public.teaching_sessions, public.lesson_notes, public.invoices, public.invoice_items, public.payments, public.image_assets to authenticated;

create or replace function public.workspace_load() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare owner uuid := auth.uid(); result jsonb; v bigint;
begin
  if owner is null or not exists(select 1 from public.workspace_owner where user_id=owner) then raise exception 'OWNER_ONLY'; end if;
  insert into public.workspace_revisions(owner_id) values(owner) on conflict do nothing;
  select revision into v from public.workspace_revisions where owner_id=owner for share;
  select jsonb_build_object(
    'schemaVersion',1,'demo',false,
    'profile',coalesce((select jsonb_build_object('name',name,'phone',phone,'email',email,'avatar',avatar,'brand',brand) from public.profiles where id=owner), '{"name":"","phone":"","email":"","avatar":"","brand":"TutorSpace"}'::jsonb),
    'settings',coalesce((select jsonb_build_object('theme',theme,'defaultRate',default_rate,'reminderMinutes',reminder_minutes,'bankName',bank_name,'bankAccount',bank_account,'bankHolder',bank_holder,'qrImage',qr_image,'notifications',notifications) from public.app_settings where id=owner), '{"theme":"light","defaultRate":150000,"reminderMinutes":15,"bankName":"","bankAccount":"","bankHolder":"","qrImage":"","notifications":false}'::jsonb),
    'students',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'grade',grade,'subject',subject,'parentName',parent_name,'parentPhone',parent_phone,'startDate',start_date,'mode',mode,'rateType',rate_type,'rate',rate,'color',color,'avatar',avatar,'status',status,'notes',notes,'goals',goals,'createdAt',created_at,'updatedAt',updated_at) order by created_at,id) from public.students where owner_id=owner),'[]'::jsonb),
    'schedules',coalesce((select jsonb_agg(jsonb_build_object('id',id,'studentId',student_id,'weekdays',weekdays,'startDate',start_date,'endDate',end_date,'startTime',to_char(start_time,'HH24:MI'),'endTime',to_char(end_time,'HH24:MI'),'subject',subject,'mode',mode,'location',location,'notes',notes,'createdAt',created_at,'updatedAt',updated_at) order by created_at,id) from public.teaching_schedules where owner_id=owner),'[]'::jsonb),
    'sessions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'studentId',s.student_id,'scheduleId',s.schedule_id,'date',s.date,'startTime',to_char(s.start_time,'HH24:MI'),'endTime',to_char(s.end_time,'HH24:MI'),'subject',s.subject,'mode',s.mode,'location',s.location,'notes',s.notes,'status',s.status,'actualMinutes',s.actual_minutes,'billable',s.billable,'rate',s.rate,'rateType',s.rate_type,'createdAt',s.created_at,'updatedAt',s.updated_at,'lessonNote',jsonb_build_object('content',coalesce(n.content,''),'attitude',coalesce(n.attitude,''),'understanding',coalesce(n.understanding,''),'homework',coalesce(n.homework,''),'nextPlan',coalesce(n.next_plan,''))) order by s.date,s.start_time,s.id) from public.teaching_sessions s left join public.lesson_notes n on n.session_id=s.id where s.owner_id=owner),'[]'::jsonb),
    'invoices',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'studentId',i.student_id,'code',i.code,'month',i.month,'status',i.status,'surcharge',i.surcharge,'discount',i.discount,'adjustmentNote',i.adjustment_note,'comment',i.comment,'snapshot',i.snapshot,'createdAt',i.created_at,'updatedAt',i.updated_at,'issuedAt',i.issued_at,'items',coalesce((select jsonb_agg(jsonb_build_object('id',j.id,'sessionId',j.session_id,'date',j.date,'minutes',j.minutes,'rate',j.rate,'rateType',j.rate_type,'amount',j.amount,'description',j.description) order by j.position) from public.invoice_items j where j.invoice_id=i.id),'[]'::jsonb)) order by i.created_at,i.id) from public.invoices i where i.owner_id=owner),'[]'::jsonb),
    'payments',coalesce((select jsonb_agg(jsonb_build_object('id',id,'invoiceId',invoice_id,'amount',amount,'date',date,'note',note,'createdAt',created_at) order by created_at,id) from public.payments where owner_id=owner),'[]'::jsonb),
    'assets',coalesce((select jsonb_object_agg(a.asset_key,a.data_uri) from public.image_assets a where a.owner_id=owner and a.asset_key in (
      select substring(avatar from 7) from public.profiles where id=owner and avatar <> ''
      union select substring(qr_image from 7) from public.app_settings where id=owner and qr_image <> ''
      union select substring(avatar from 7) from public.students where owner_id=owner and avatar <> ''
      union select substring(snapshot->>'qrImage' from 7) from public.invoices where owner_id=owner and coalesce(snapshot->>'qrImage','') <> ''
    )),'{}'::jsonb)
  ) into result;
  return jsonb_build_object('revision',v,'data',result);
end $$;

create or replace function public.workspace_save(workspace jsonb, expected_revision bigint, allow_issued_changes boolean default false) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare owner uuid := auth.uid(); v bigint; previous jsonb; row jsonb; note jsonb; item jsonb; settings jsonb; profile jsonb; candidate jsonb; idx integer; asset record; image_uri text; image_reference text; image_bytes bytea; image_refs text[] := array[]::text[];
begin
  if owner is null or not exists(select 1 from public.workspace_owner where user_id=owner) then raise exception 'OWNER_ONLY'; end if;
  if workspace->>'schemaVersion' is distinct from '1' or coalesce((workspace->>'demo')::boolean,true) then raise exception 'INVALID_WORKSPACE'; end if;
  if octet_length(workspace::text) > 52428800 then raise exception 'WORKSPACE_TOO_LARGE'; end if;
  if jsonb_typeof(coalesce(workspace->'assets','{}'::jsonb)) is distinct from 'object' then raise exception 'ASSET_DICTIONARY_INVALID'; end if;
  foreach row in array array[workspace->'students',workspace->'schedules',workspace->'sessions',workspace->'invoices',workspace->'payments'] loop
    if jsonb_typeof(row) is distinct from 'array' then raise exception 'INVALID_COLLECTION'; end if;
  end loop;
  if jsonb_array_length(workspace->'students') > 5000 or jsonb_array_length(workspace->'schedules') > 5000 or jsonb_array_length(workspace->'sessions') > 100000 or jsonb_array_length(workspace->'invoices') > 20000 or jsonb_array_length(workspace->'payments') > 100000 then raise exception 'COLLECTION_TOO_LARGE'; end if;
  insert into public.workspace_revisions(owner_id) values(owner) on conflict do nothing;
  -- All writes acquire this lock. The version check prevents a stale tab from
  -- overwriting updates completed on another device, even when requests overlap.
  select revision into v from public.workspace_revisions where owner_id=owner for update;
  if v is distinct from expected_revision then raise exception 'VERSION_CONFLICT'; end if;
  previous := public.workspace_load()->'data';
  if not coalesce(allow_issued_changes,false) then
    for row in select value from jsonb_array_elements(previous->'invoices') where value->>'status'='issued' loop
      select value into candidate from jsonb_array_elements(workspace->'invoices') where value->>'id'=row->>'id';
      -- Timestamp formatting may differ across JSON encoders; compare immutable
      -- content after normalizing timestamps to instants.
      if candidate is null or (candidate - 'updatedAt' - 'createdAt' - 'issuedAt') <> (row - 'updatedAt' - 'createdAt' - 'issuedAt') or (candidate->>'createdAt')::timestamptz <> (row->>'createdAt')::timestamptz or (candidate->>'issuedAt')::timestamptz is distinct from (row->>'issuedAt')::timestamptz then raise exception 'ISSUED_IMMUTABLE'; end if;
    end loop;
  end if;
  -- Validate each supplied byte sequence and immutable hash before accepting any
  -- reference. A guessed key never resolves another owner's private image.
  for asset in select key,value from jsonb_each(coalesce(workspace->'assets','{}'::jsonb)) loop
    if asset.key !~ '^[a-f0-9]{64}$' or jsonb_typeof(asset.value) <> 'string' then raise exception 'ASSET_INVALID'; end if;
    image_uri := asset.value #>> '{}';
    if exists(select 1 from public.image_assets where owner_id=owner and asset_key=asset.key and data_uri is distinct from image_uri) then raise exception 'ASSET_IMMUTABLE'; end if;
    if length(image_uri) > 2800000 or image_uri !~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$' or length(split_part(image_uri,',',2)) % 4 <> 0 then raise exception 'ASSET_INVALID'; end if;
    image_bytes := decode(split_part(image_uri,',',2),'base64');
    if octet_length(image_bytes) not between 1 and 2097152 then raise exception 'ASSET_TOO_LARGE'; end if;
    if (image_uri like 'data:image/png;%' and substring(image_bytes from 1 for 8) <> decode('89504e470d0a1a0a','hex')) or (image_uri like 'data:image/jpeg;%' and substring(image_bytes from 1 for 3) <> decode('ffd8ff','hex')) or (image_uri like 'data:image/webp;%' and (substring(image_bytes from 1 for 4) <> convert_to('RIFF','UTF8') or substring(image_bytes from 9 for 4) <> convert_to('WEBP','UTF8'))) then raise exception 'ASSET_INVALID'; end if;
    if asset.key <> encode(sha256(convert_to(image_uri,'UTF8')),'hex') then raise exception 'ASSET_HASH_MISMATCH'; end if;
    insert into public.image_assets(owner_id,asset_key,data_uri) values(owner,asset.key,image_uri) on conflict(owner_id,asset_key) do nothing;
  end loop;
  for row in
    select workspace->'profile'->'avatar'
    union all select workspace->'settings'->'qrImage'
    union all select value->'avatar' from jsonb_array_elements(workspace->'students')
    union all select value->'snapshot'->'qrImage' from jsonb_array_elements(workspace->'invoices')
  loop
    if jsonb_typeof(row) is distinct from 'string' then raise exception 'ASSET_REFERENCE_INVALID'; end if;
    image_reference := row #>> '{}';
    if image_reference = '' then continue; end if;
    if image_reference !~ '^asset:[a-f0-9]{64}$' then raise exception 'ASSET_REFERENCE_INVALID'; end if;
    if not exists(select 1 from public.image_assets where owner_id=owner and asset_key=substring(image_reference from 7)) then raise exception 'ASSET_REFERENCE_MISSING'; end if;
    image_refs := array_append(image_refs,substring(image_reference from 7));
  end loop;
  -- Replacing normalized rows in a single transaction simplifies confirmed
  -- backups/restores while retaining constraints, snapshots and rollback.
  delete from public.payments where owner_id=owner;
  delete from public.invoice_items where owner_id=owner;
  delete from public.invoices where owner_id=owner;
  delete from public.lesson_notes where owner_id=owner;
  delete from public.teaching_sessions where owner_id=owner;
  delete from public.teaching_schedules where owner_id=owner;
  delete from public.students where owner_id=owner;
  profile := workspace->'profile'; settings := workspace->'settings';
  insert into public.profiles(id,name,phone,email,avatar,brand) values(owner,profile->>'name',profile->>'phone',profile->>'email',profile->>'avatar',profile->>'brand')
    on conflict(id) do update set name=excluded.name,phone=excluded.phone,email=excluded.email,avatar=excluded.avatar,brand=excluded.brand,updated_at=now();
  insert into public.app_settings(id,theme,default_rate,reminder_minutes,bank_name,bank_account,bank_holder,qr_image,notifications)
    values(owner,settings->>'theme',(settings->>'defaultRate')::bigint,(settings->>'reminderMinutes')::integer,settings->>'bankName',settings->>'bankAccount',settings->>'bankHolder',settings->>'qrImage',(settings->>'notifications')::boolean)
    on conflict(id) do update set theme=excluded.theme,default_rate=excluded.default_rate,reminder_minutes=excluded.reminder_minutes,bank_name=excluded.bank_name,bank_account=excluded.bank_account,bank_holder=excluded.bank_holder,qr_image=excluded.qr_image,notifications=excluded.notifications,updated_at=now();
  for row in select value from jsonb_array_elements(workspace->'students') loop
    insert into public.students(id,owner_id,name,grade,subject,parent_name,parent_phone,start_date,mode,rate_type,rate,color,avatar,status,notes,goals,created_at,updated_at)
      values((row->>'id')::uuid,owner,row->>'name',row->>'grade',row->>'subject',row->>'parentName',row->>'parentPhone',(row->>'startDate')::date,row->>'mode',row->>'rateType',(row->>'rate')::bigint,row->>'color',row->>'avatar',row->>'status',row->>'notes',row->>'goals',(row->>'createdAt')::timestamptz,(row->>'updatedAt')::timestamptz);
  end loop;
  for row in select value from jsonb_array_elements(workspace->'schedules') loop
    insert into public.teaching_schedules(id,owner_id,student_id,weekdays,start_date,end_date,start_time,end_time,subject,mode,location,notes,created_at,updated_at)
      values((row->>'id')::uuid,owner,(row->>'studentId')::uuid,array(select value::integer from jsonb_array_elements_text(row->'weekdays')),(row->>'startDate')::date,(row->>'endDate')::date,(row->>'startTime')::time,(row->>'endTime')::time,row->>'subject',row->>'mode',row->>'location',row->>'notes',(row->>'createdAt')::timestamptz,(row->>'updatedAt')::timestamptz);
  end loop;
  for row in select value from jsonb_array_elements(workspace->'sessions') loop
    insert into public.teaching_sessions(id,owner_id,student_id,schedule_id,date,start_time,end_time,subject,mode,location,notes,status,actual_minutes,billable,rate,rate_type,created_at,updated_at)
      values((row->>'id')::uuid,owner,(row->>'studentId')::uuid,(row->>'scheduleId')::uuid,(row->>'date')::date,(row->>'startTime')::time,(row->>'endTime')::time,row->>'subject',row->>'mode',row->>'location',row->>'notes',row->>'status',(row->>'actualMinutes')::integer,(row->>'billable')::boolean,(row->>'rate')::bigint,row->>'rateType',(row->>'createdAt')::timestamptz,(row->>'updatedAt')::timestamptz);
    note := row->'lessonNote';
    insert into public.lesson_notes(id,owner_id,session_id,content,attitude,understanding,homework,next_plan,created_at,updated_at)
      values((row->>'id')::uuid,owner,(row->>'id')::uuid,note->>'content',note->>'attitude',note->>'understanding',note->>'homework',note->>'nextPlan',(row->>'createdAt')::timestamptz,(row->>'updatedAt')::timestamptz);
  end loop;
  for row in select value from jsonb_array_elements(workspace->'invoices') loop
    if jsonb_typeof(row->'items') is distinct from 'array' or jsonb_array_length(row->'items') > 1000 then raise exception 'INVALID_INVOICE_ITEMS'; end if;
    insert into public.invoices(id,owner_id,student_id,code,month,status,surcharge,discount,adjustment_note,comment,snapshot,created_at,updated_at,issued_at)
      values((row->>'id')::uuid,owner,(row->>'studentId')::uuid,row->>'code',row->>'month',row->>'status',(row->>'surcharge')::bigint,(row->>'discount')::bigint,row->>'adjustmentNote',row->>'comment',row->'snapshot',(row->>'createdAt')::timestamptz,(row->>'updatedAt')::timestamptz,(row->>'issuedAt')::timestamptz);
    idx := 0;
    for item in select value from jsonb_array_elements(row->'items') loop
      insert into public.invoice_items(id,owner_id,invoice_id,student_id,session_id,position,date,minutes,rate,rate_type,amount,description,issued)
        values((item->>'id')::uuid,owner,(row->>'id')::uuid,(row->>'studentId')::uuid,(item->>'sessionId')::uuid,idx,(item->>'date')::date,(item->>'minutes')::integer,(item->>'rate')::bigint,item->>'rateType',(item->>'amount')::bigint,item->>'description',row->>'status'='issued');
      idx := idx+1;
    end loop;
  end loop;
  for row in select value from jsonb_array_elements(workspace->'payments') loop
    insert into public.payments(id,owner_id,invoice_id,amount,date,note,created_at)
      values((row->>'id')::uuid,owner,(row->>'invoiceId')::uuid,(row->>'amount')::bigint,(row->>'date')::date,row->>'note',(row->>'createdAt')::timestamptz);
  end loop;
  if exists(select 1 from public.invoices i where i.owner_id=owner and (coalesce((select sum(j.amount) from public.invoice_items j where j.invoice_id=i.id),0)+i.surcharge-i.discount < 0 or coalesce((select sum(j.amount) from public.invoice_items j where j.invoice_id=i.id),0)+i.surcharge-i.discount > 9007199254740991)) then raise exception 'INVALID_INVOICE_TOTAL'; end if;
  if exists(select 1 from public.payments p join public.invoices i on i.id=p.invoice_id where p.owner_id=owner and i.status <> 'issued') then raise exception 'DRAFT_PAYMENT'; end if;
  if exists(select 1 from public.invoices i where i.owner_id=owner and coalesce((select sum(p.amount) from public.payments p where p.invoice_id=i.id),0) > coalesce((select sum(j.amount) from public.invoice_items j where j.invoice_id=i.id),0)+i.surcharge-i.discount) then raise exception 'OVERPAYMENT'; end if;
  -- Keep precisely the bytes still referenced by current rows/snapshots. Old
  -- snapshots remain referenced; confirmed restore can release unused images.
  delete from public.image_assets where owner_id=owner and not(asset_key = any(image_refs));
  update public.workspace_revisions set revision=revision+1,updated_at=now() where owner_id=owner returning revision into v;
  return v;
end $$;
revoke all on function public.workspace_load(), public.workspace_save(jsonb,bigint,boolean) from public, anon;
grant execute on function public.workspace_load(), public.workspace_save(jsonb,bigint,boolean) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('tutorspace-private','tutorspace-private',false,2097152,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=false,file_size_limit=2097152,allowed_mime_types=array['image/png','image/jpeg','image/webp'];
create policy owner_uploads_images on storage.objects for insert to authenticated with check(bucket_id='tutorspace-private' and (select public.is_workspace_owner()) and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy owner_reads_images on storage.objects for select to authenticated using(bucket_id='tutorspace-private' and (select public.is_workspace_owner()) and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy owner_removes_images on storage.objects for delete to authenticated using(bucket_id='tutorspace-private' and (select public.is_workspace_owner()) and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;
