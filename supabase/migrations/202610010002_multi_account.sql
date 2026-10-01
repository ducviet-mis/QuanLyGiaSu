-- TutorSpace: one independent private workspace per authenticated account.
-- Existing installation: run only this file after migration 001.
-- New installation: run 001 first, then this file. This upgrade is rerunnable.
-- It preserves all existing rows and revision counters; it does not register or
-- trust user metadata. Signup/email confirmation is configured in Supabase Auth.
begin;

-- Keep the old singleton registration solely as an administrative history row.
-- It no longer grants access, and application clients cannot read or mutate it.
revoke all on public.workspace_owner from anon, authenticated;
create or replace function public.is_workspace_owner() returns boolean
language sql stable security definer set search_path = ''
as $$ select auth.uid() is not null; $$;
revoke all on function public.is_workspace_owner() from public, anon;
grant execute on function public.is_workspace_owner() to authenticated;

-- Backups may contain the same UUIDs in different accounts. Every domain key,
-- relationship, and uniqueness rule is local to its owner, including invoice
-- positions and billed lessons. Existing composite foreign keys remain intact.
do $$ declare t text; begin
  foreach t in array array['students','teaching_schedules','teaching_sessions','lesson_notes','invoices','invoice_items','payments'] loop
    execute format('alter table public.%I drop constraint if exists %I',t,t || '_pkey');
    execute format('alter table public.%I add constraint %I primary key(owner_id,id)',t,t || '_pkey');
  end loop;
end $$;
alter table public.lesson_notes drop constraint if exists lesson_notes_session_id_key;
alter table public.lesson_notes drop constraint if exists lesson_notes_owner_session_key;
alter table public.lesson_notes add constraint lesson_notes_owner_session_key unique(owner_id,session_id);
alter table public.teaching_sessions drop constraint if exists teaching_sessions_schedule_id_date_key;
alter table public.teaching_sessions drop constraint if exists teaching_sessions_owner_schedule_date_key;
alter table public.teaching_sessions add constraint teaching_sessions_owner_schedule_date_key unique(owner_id,schedule_id,date);
alter table public.invoice_items drop constraint if exists invoice_items_invoice_id_position_key;
alter table public.invoice_items drop constraint if exists invoice_items_owner_invoice_position_key;
alter table public.invoice_items add constraint invoice_items_owner_invoice_position_key unique(owner_id,invoice_id,position);
drop index if exists public.one_issued_invoice_per_month;
create unique index one_issued_invoice_per_month on public.invoices(owner_id,student_id,month) where status='issued';
drop index if exists public.session_billed_once;
create unique index session_billed_once on public.invoice_items(owner_id,session_id) where issued and session_id is not null;

drop policy if exists owner_sees_revision on public.workspace_revisions;
create policy owner_sees_revision on public.workspace_revisions for select to authenticated using(owner_id=(select auth.uid()));
do $$ declare t text; begin
  foreach t in array array['profiles','app_settings'] loop
    execute format('drop policy if exists private_owner_read on public.%I',t);
    execute format('create policy private_owner_read on public.%I for select to authenticated using(id=(select auth.uid()))',t);
  end loop;
  foreach t in array array['students','teaching_schedules','teaching_sessions','lesson_notes','invoices','invoice_items','payments','image_assets'] loop
    execute format('drop policy if exists private_owner_read on public.%I',t);
    execute format('create policy private_owner_read on public.%I for select to authenticated using(owner_id=(select auth.uid()))',t);
  end loop;
end $$;
-- Authenticated REST calls can only read their own rows. Mutations still use the
-- revision-locked RPC, which fixes the owner to auth.uid() on every write.
revoke all on public.workspace_revisions, public.profiles, public.app_settings, public.students, public.teaching_schedules, public.teaching_sessions, public.lesson_notes, public.invoices, public.invoice_items, public.payments, public.image_assets from anon, authenticated;
grant select on public.workspace_revisions, public.profiles, public.app_settings, public.students, public.teaching_schedules, public.teaching_sessions, public.lesson_notes, public.invoices, public.invoice_items, public.payments, public.image_assets to authenticated;

create or replace function public.workspace_load() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare owner uuid := auth.uid(); result jsonb; v bigint;
begin
  if owner is null then raise exception 'AUTH_REQUIRED'; end if;
  insert into public.workspace_revisions(owner_id) values(owner) on conflict do nothing;
  select revision into v from public.workspace_revisions where owner_id=owner for share;
  select jsonb_build_object(
    'schemaVersion',1,'demo',false,
    'profile',coalesce((select jsonb_build_object('name',name,'phone',phone,'email',email,'avatar',avatar,'brand',brand) from public.profiles where id=owner), '{"name":"","phone":"","email":"","avatar":"","brand":"TutorSpace"}'::jsonb),
    'settings',coalesce((select jsonb_build_object('theme',theme,'defaultRate',default_rate,'reminderMinutes',reminder_minutes,'bankName',bank_name,'bankAccount',bank_account,'bankHolder',bank_holder,'qrImage',qr_image,'notifications',notifications) from public.app_settings where id=owner), '{"theme":"light","defaultRate":150000,"reminderMinutes":15,"bankName":"","bankAccount":"","bankHolder":"","qrImage":"","notifications":false}'::jsonb),
    'students',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'grade',grade,'subject',subject,'parentName',parent_name,'parentPhone',parent_phone,'startDate',start_date,'mode',mode,'rateType',rate_type,'rate',rate,'color',color,'avatar',avatar,'status',status,'notes',notes,'goals',goals,'createdAt',created_at,'updatedAt',updated_at) order by created_at,id) from public.students where owner_id=owner),'[]'::jsonb),
    'schedules',coalesce((select jsonb_agg(jsonb_build_object('id',id,'studentId',student_id,'weekdays',weekdays,'startDate',start_date,'endDate',end_date,'startTime',to_char(start_time,'HH24:MI'),'endTime',to_char(end_time,'HH24:MI'),'subject',subject,'mode',mode,'location',location,'notes',notes,'createdAt',created_at,'updatedAt',updated_at) order by created_at,id) from public.teaching_schedules where owner_id=owner),'[]'::jsonb),
    'sessions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'studentId',s.student_id,'scheduleId',s.schedule_id,'date',s.date,'startTime',to_char(s.start_time,'HH24:MI'),'endTime',to_char(s.end_time,'HH24:MI'),'subject',s.subject,'mode',s.mode,'location',s.location,'notes',s.notes,'status',s.status,'actualMinutes',s.actual_minutes,'billable',s.billable,'rate',s.rate,'rateType',s.rate_type,'createdAt',s.created_at,'updatedAt',s.updated_at,'lessonNote',jsonb_build_object('content',coalesce(n.content,''),'attitude',coalesce(n.attitude,''),'understanding',coalesce(n.understanding,''),'homework',coalesce(n.homework,''),'nextPlan',coalesce(n.next_plan,''))) order by s.date,s.start_time,s.id) from public.teaching_sessions s left join public.lesson_notes n on n.session_id=s.id and n.owner_id=s.owner_id where s.owner_id=owner),'[]'::jsonb),
    'invoices',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'studentId',i.student_id,'code',i.code,'month',i.month,'status',i.status,'surcharge',i.surcharge,'discount',i.discount,'adjustmentNote',i.adjustment_note,'comment',i.comment,'snapshot',i.snapshot,'createdAt',i.created_at,'updatedAt',i.updated_at,'issuedAt',i.issued_at,'items',coalesce((select jsonb_agg(jsonb_build_object('id',j.id,'sessionId',j.session_id,'date',j.date,'minutes',j.minutes,'rate',j.rate,'rateType',j.rate_type,'amount',j.amount,'description',j.description) order by j.position) from public.invoice_items j where j.invoice_id=i.id and j.owner_id=i.owner_id),'[]'::jsonb)) order by i.created_at,i.id) from public.invoices i where i.owner_id=owner),'[]'::jsonb),
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
  if owner is null then raise exception 'AUTH_REQUIRED'; end if;
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
  if exists(select 1 from public.invoices i where i.owner_id=owner and (coalesce((select sum(j.amount) from public.invoice_items j where j.invoice_id=i.id and j.owner_id=i.owner_id),0)+i.surcharge-i.discount < 0 or coalesce((select sum(j.amount) from public.invoice_items j where j.invoice_id=i.id and j.owner_id=i.owner_id),0)+i.surcharge-i.discount > 9007199254740991)) then raise exception 'INVALID_INVOICE_TOTAL'; end if;
  if exists(select 1 from public.payments p join public.invoices i on i.id=p.invoice_id and i.owner_id=p.owner_id where p.owner_id=owner and i.status <> 'issued') then raise exception 'DRAFT_PAYMENT'; end if;
  if exists(select 1 from public.invoices i where i.owner_id=owner and coalesce((select sum(p.amount) from public.payments p where p.invoice_id=i.id and p.owner_id=i.owner_id),0) > coalesce((select sum(j.amount) from public.invoice_items j where j.invoice_id=i.id and j.owner_id=i.owner_id),0)+i.surcharge-i.discount) then raise exception 'OVERPAYMENT'; end if;
  -- Keep precisely the bytes still referenced by current rows/snapshots. Old
  -- snapshots remain referenced; confirmed restore can release unused images.
  delete from public.image_assets where owner_id=owner and not(asset_key = any(image_refs));
  update public.workspace_revisions set revision=revision+1,updated_at=now() where owner_id=owner returning revision into v;
  return v;
end $$;
revoke all on function public.workspace_load(), public.workspace_save(jsonb,bigint,boolean) from public, anon;
grant execute on function public.workspace_load(), public.workspace_save(jsonb,bigint,boolean) to authenticated;

-- Storage remains private and uses exactly the signed-in user's UUID folder.
-- No UPDATE policy is granted: replacing a file requires delete then insert.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('tutorspace-private','tutorspace-private',false,2097152,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=false,file_size_limit=2097152,allowed_mime_types=array['image/png','image/jpeg','image/webp'];
drop policy if exists owner_uploads_images on storage.objects;
drop policy if exists owner_reads_images on storage.objects;
drop policy if exists owner_removes_images on storage.objects;
create policy owner_uploads_images on storage.objects for insert to authenticated with check(bucket_id='tutorspace-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy owner_reads_images on storage.objects for select to authenticated using(bucket_id='tutorspace-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy owner_removes_images on storage.objects for delete to authenticated using(bucket_id='tutorspace-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;
