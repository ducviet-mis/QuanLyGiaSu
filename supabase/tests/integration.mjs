// Embedded Postgres integration checks. Auth/Storage schemas below are explicit
// test stubs; this does not deploy or verify a live Supabase project.
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const db = new PGlite();
const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const STUDENT = '33333333-3333-4333-8333-333333333333';
const SESSION = '44444444-4444-4444-8444-444444444444';
const INVOICE = '55555555-5555-4555-8555-555555555555';
const ITEM = '66666666-6666-4666-8666-666666666666';
const PAYMENT = '77777777-7777-4777-8777-777777777777';
const now = '2026-10-01T10:00:00Z';
const stubSql = `
  create role anon; create role authenticated;
  create schema auth; create schema storage;
  grant usage on schema auth, storage, public to authenticated, anon;
  create table auth.users(id uuid primary key);
  insert into auth.users values('${OWNER}'),('${OTHER}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid primary key,bucket_id text,name text);
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(regexp_replace(name,'/[^/]+$',''),'/') $$;
  alter table storage.objects enable row level security;
  grant all on storage.objects to authenticated,anon;
`;
const baseMigration = await readFile(new URL('../migrations/202610010001_tutorspace.sql', import.meta.url), 'utf8');
const accountMigration = await readFile(new URL('../migrations/202610010002_multi_account.sql', import.meta.url), 'utf8');
await db.exec(stubSql);
await db.exec(baseMigration);
console.log('PASS SQL migration compiled and ran with Supabase auth/storage stubs');
await db.query('insert into public.workspace_owner(singleton,user_id) values(true,$1)',[OWNER]);
async function asUser(user, role = 'authenticated') { await db.exec(`reset role; set role ${role};`); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]); }
async function load() { return (await db.query('select public.workspace_load() as result')).rows[0].result; }
async function save(data, revision, allow = false) { return (await db.query('select public.workspace_save($1::jsonb,$2::bigint,$3::boolean) as result',[JSON.stringify(data),revision,allow])).rows[0].result; }
async function rejects(fn, expected) { await assert.rejects(fn, expected); }
await asUser(OWNER);
const initial = await load(); assert.equal(initial.revision,0); assert.equal(initial.data.demo,false); assert.equal(initial.data.students.length,0);
console.log('PASS Cloud owner starts with an empty non-demo workspace');
const data = structuredClone(initial.data);
data.profile.name = 'Gia sư kiểm thử';
data.students.push({id:STUDENT,name:'Học sinh kiểm thử',grade:'Lớp 9',subject:'Toán',parentName:'',parentPhone:'',startDate:'2026-09-01',mode:'online',rateType:'hour',rate:180000,color:'#4F7CFF',avatar:'',status:'active',notes:'',goals:'',createdAt:now,updatedAt:now});
data.sessions.push({id:SESSION,studentId:STUDENT,scheduleId:null,date:'2026-09-05',startTime:'18:00',endTime:'19:30',subject:'Toán',mode:'online',location:'',notes:'',status:'completed',actualMinutes:90,billable:null,rate:180000,rateType:'hour',lessonNote:{content:'Luyện tập',attitude:'',understanding:'',homework:'',nextPlan:''},createdAt:now,updatedAt:now});
data.invoices.push({id:INVOICE,studentId:STUDENT,code:'TS-202609-1',month:'2026-09',status:'issued',items:[{id:ITEM,sessionId:SESSION,date:'2026-09-05',minutes:90,rate:180000,rateType:'hour',amount:270000,description:'Toán'}],surcharge:0,discount:0,adjustmentNote:'',comment:'Nhận xét',snapshot:{studentName:'Học sinh kiểm thử',grade:'Lớp 9',subject:'Toán',tutorName:'Gia sư kiểm thử',brand:'TutorSpace',bankName:'',bankAccount:'',bankHolder:'',qrImage:''},createdAt:now,updatedAt:now,issuedAt:now});
data.payments.push({id:PAYMENT,invoiceId:INVOICE,amount:100000,date:'2026-10-01',note:'Đợt 1',createdAt:now});
assert.equal(await save(data,0),1);
const first = await load(); assert.equal(first.revision,1); assert.equal(first.data.sessions[0].lessonNote.content,'Luyện tập'); assert.equal(first.data.invoices[0].items[0].amount,270000);
console.log('PASS Normalized student/session/note/invoice/item/payment save and load');
const next = structuredClone(first.data); next.students[0].rate = 240000; next.sessions[0].rate=240000; next.settings.bankHolder='Người mới';
assert.equal(await save(next,1),2); assert.equal((await load()).data.invoices[0].items[0].rate,180000);
console.log('PASS Historical snapshots survive source/rate/settings edits');
await rejects(() => save(first.data,1),/VERSION_CONFLICT/); assert.equal((await load()).revision,2);
console.log('PASS Stale revision rejected without overwriting newer data');
const changed = structuredClone((await load()).data); changed.invoices[0].comment='Sửa âm thầm';
await rejects(() => save(changed,2),/ISSUED_IMMUTABLE/); assert.equal((await load()).data.invoices[0].comment,'Nhận xét');
assert.equal(await save(changed,2,true),3);
console.log('PASS Issued content rejects silent edits; explicit correction succeeds');
const paidTooMuch = structuredClone((await load()).data); paidTooMuch.payments[0].amount=270001;
await rejects(() => save(paidTooMuch,3),/OVERPAYMENT/); assert.equal((await load()).data.payments[0].amount,100000); assert.equal((await load()).revision,3);
console.log('PASS Overpayment rejected and entire transaction rolled back');
const duplicate = structuredClone((await load()).data); duplicate.invoices.push({...duplicate.invoices[0],id:'88888888-8888-4888-8888-888888888888',month:'2026-10',items:duplicate.invoices[0].items.map(i=>({...i,id:'99999999-9999-4999-8999-999999999999'}))});
await rejects(() => save(duplicate,3),/session_billed_once/);
duplicate.invoices[1].month='2026-09'; await rejects(() => save(duplicate,3),/one_issued_invoice_per_month/);
console.log('PASS Duplicate billed lesson and duplicate issued student/month rejected');
const draft = structuredClone((await load()).data); draft.invoices[0].status='draft'; draft.invoices[0].issuedAt=null;
await rejects(() => save(draft,3,true),/DRAFT_PAYMENT/);
console.log('PASS Draft invoices cannot receive payments');

const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+NMhQAAAAASUVORK5CYII=';
const secondImage = `${image.slice(0,-4)}AAAA`; // Different bytes, same recognized PNG header.
const hashImage = uri => createHash('sha256').update(uri,'utf8').digest('hex');
const key = hashImage(image); const secondKey = hashImage(secondImage);
const withImages = structuredClone((await load()).data);
withImages.assets = {[key]:image};
withImages.profile.avatar=`asset:${key}`; withImages.settings.qrImage=`asset:${key}`;
withImages.students[0].avatar=`asset:${key}`; withImages.invoices[0].snapshot.qrImage=`asset:${key}`;
assert.equal(await save(withImages,3,true),4);
const assetRoundtrip = await load();
assert.deepEqual(assetRoundtrip.data.assets,{[key]:image});
assert.equal(assetRoundtrip.data.profile.avatar,`asset:${key}`);
assert.equal(assetRoundtrip.data.invoices[0].snapshot.qrImage,`asset:${key}`);
assert.equal((await db.query('select count(*)::integer as total from public.image_assets')).rows[0].total,1);
assert.equal((await db.query('select snapshot from public.invoices')).rows[0].snapshot.qrImage,`asset:${key}`);
console.log('PASS Repeated avatar/settings/issued-QR bytes intern once and round-trip in one asset dictionary');
const noAssetPayload = structuredClone(assetRoundtrip.data); noAssetPayload.assets = {}; noAssetPayload.settings.bankHolder='Nội dung mới';
assert.equal(await save(noAssetPayload,4),5);
assert.deepEqual((await load()).data.assets,{[key]:image});
console.log('PASS References resolve against existing private assets without resending image bytes');
const missing = structuredClone((await load()).data); missing.profile.avatar=`asset:${'a'.repeat(64)}`;
await rejects(()=>save(missing,5),/ASSET_REFERENCE_MISSING/);
const remote = structuredClone((await load()).data); remote.settings.qrImage='https://example.com/qr.png';
await rejects(()=>save(remote,5),/ASSET_REFERENCE_INVALID/);
remote.settings.qrImage='asset:../other-owner'; await rejects(()=>save(remote,5),/ASSET_REFERENCE_INVALID/);
const malformed = structuredClone((await load()).data); malformed.assets[key]='data:image/png;base64,YWJjZA==';
await rejects(()=>save(malformed,5),/ASSET_IMMUTABLE/);
const mismatched = structuredClone((await load()).data); mismatched.assets['b'.repeat(64)]=secondImage;
await rejects(()=>save(mismatched,5),/ASSET_HASH_MISMATCH/);
const badHeader = structuredClone((await load()).data); const fake='data:image/png;base64,YWJjZA=='; badHeader.assets[hashImage(fake)]=fake;
await rejects(()=>save(badHeader,5),/ASSET_INVALID/);
const oversized = structuredClone((await load()).data); const bigBytes=Buffer.alloc(2097153); Buffer.from('89504e470d0a1a0a','hex').copy(bigBytes); const bigImage=`data:image/png;base64,${bigBytes.toString('base64')}`;
oversized.assets[hashImage(bigImage)]=bigImage; await rejects(()=>save(oversized,5),/ASSET_TOO_LARGE/);
assert.equal((await load()).revision,5); assert.equal((await db.query('select count(*)::integer as total from public.image_assets')).rows[0].total,1);
console.log('PASS Missing/remote/malformed/incorrect-hash/oversized images rejected with transaction rollback');
const swappedSnapshot = structuredClone((await load()).data); swappedSnapshot.assets[secondKey]=secondImage; swappedSnapshot.invoices[0].snapshot.qrImage=`asset:${secondKey}`;
await rejects(()=>save(swappedSnapshot,5),/ISSUED_IMMUTABLE/);
const settingsReplaced = structuredClone((await load()).data); settingsReplaced.assets[secondKey]=secondImage; settingsReplaced.settings.qrImage=`asset:${secondKey}`; settingsReplaced.profile.avatar=''; settingsReplaced.students[0].avatar='';
assert.equal(await save(settingsReplaced,5),6);
const imageHistory = await load(); assert.equal(imageHistory.data.invoices[0].snapshot.qrImage,`asset:${key}`); assert.equal(imageHistory.data.settings.qrImage,`asset:${secondKey}`); assert.equal(Object.keys(imageHistory.data.assets).length,2);
console.log('PASS Replacing current QR preserves old immutable invoice bytes and snapshot reference');
const rollAssetsBack = structuredClone(imageHistory.data); const thirdImage=`${image.slice(0,-4)}AAAB`; const thirdKey=hashImage(thirdImage); rollAssetsBack.assets[thirdKey]=thirdImage; rollAssetsBack.profile.avatar=`asset:${thirdKey}`; rollAssetsBack.payments[0].amount=270001;
await rejects(()=>save(rollAssetsBack,6),/OVERPAYMENT/); assert.equal((await db.query('select count(*)::integer as total from public.image_assets')).rows[0].total,2);
console.log('PASS Failed financial writes also roll back newly interned assets');
await db.exec('reset role;');
const foreignImage = `${image.slice(0,-4)}AAAC`; const foreignKey = hashImage(foreignImage);
await db.query('insert into public.image_assets(owner_id,asset_key,data_uri) values($1,$2,$3)',[OTHER,foreignKey,foreignImage]);
await asUser(OWNER);
const foreignReference=structuredClone((await load()).data); foreignReference.profile.avatar=`asset:${foreignKey}`;
await rejects(()=>save(foreignReference,6),/ASSET_REFERENCE_MISSING/); assert.equal((await db.query('select count(*)::integer as total from public.image_assets')).rows[0].total,2);
assert.equal(Object.keys((await load()).data.assets).length,2);
await rejects(()=>db.query('update public.image_assets set data_uri=$1 where asset_key=$2',[secondImage,key]),/permission denied/);
console.log('PASS Assets cannot resolve across owner boundaries or be mutated through table APIs');
await db.query("insert into storage.objects(id,bucket_id,name) values($1,'tutorspace-private',$2)",[ITEM,`${OWNER}/qr.png`]);
assert.equal((await db.query('select * from storage.objects')).rows.length,1);
await asUser(OTHER);
await rejects(load,/OWNER_ONLY/); await rejects(()=>save(data,0),/OWNER_ONLY/);
assert.equal((await db.query('select * from public.students')).rows.length,0); assert.equal((await db.query('select * from public.invoices')).rows.length,0); assert.equal((await db.query('select * from storage.objects')).rows.length,0);
assert.equal((await db.query('select * from public.image_assets where owner_id=$1',[OWNER])).rows.length,0);
await rejects(()=>db.query("insert into storage.objects(id,bucket_id,name) values($1,'tutorspace-private',$2)",[INVOICE,`${OTHER}/qr.png`]),/row-level security/);
console.log('PASS Non-owner RPC/read/upload blocked by ownership and RLS');
await asUser('', 'anon'); await rejects(load,/permission denied/); await rejects(()=>db.query('select * from public.students'),/permission denied/);
console.log('PASS Anonymous RPC and table reads denied');
await asUser(OWNER);
const emptied=structuredClone(initial.data);
await rejects(()=>save(emptied,6),/ISSUED_IMMUTABLE/); assert.equal(await save(emptied,6,true),7); assert.equal((await load()).data.students.length,0);
assert.equal((await db.query('select count(*)::integer as total from public.image_assets')).rows[0].total,0); assert.deepEqual((await load()).data.assets,{});
console.log('PASS Confirmed reset is transactional; unconfirmed issued deletion denied');

// Upgrade a populated old installation, not only an empty database. All domain
// rows, issued snapshots, private images and the revision counter must survive.
const SCHEDULE = '88888888-8888-4888-8888-888888888888';
const legacyData = structuredClone(imageHistory.data);
legacyData.schedules.push({id:SCHEDULE,studentId:STUDENT,weekdays:[6],startDate:'2026-09-01',endDate:'2026-09-30',startTime:'18:00',endTime:'19:30',subject:'Toán',mode:'online',location:'',notes:'',createdAt:now,updatedAt:now});
legacyData.sessions[0].scheduleId = SCHEDULE;
assert.equal(await save(legacyData,7),8);
const beforeUpgrade = await load();
await db.exec('reset role;');
await db.exec("update storage.buckets set public=true where id='tutorspace-private';");
await db.exec(accountMigration);
assert.equal((await db.query("select public from storage.buckets where id='tutorspace-private'")).rows[0].public,false);
await asUser(OWNER);
assert.deepEqual(await load(),beforeUpgrade);
await db.exec('reset role;');
assert.equal((await db.query('select user_id from public.workspace_owner')).rows[0].user_id,OWNER);
await db.exec(accountMigration);
await asUser(OWNER);
assert.deepEqual(await load(),beforeUpgrade);
await rejects(()=>db.query('select * from public.workspace_owner'),/permission denied/);
console.log('PASS Multi-account upgrade preserves all existing owner data/revision; rerun preserves it again');

await asUser(OTHER);
const friendInitial = await load();
assert.equal(friendInitial.revision,0);
assert.deepEqual(friendInitial.data.students,[]);
assert.deepEqual(friendInitial.data.invoices,[]);
assert.deepEqual(friendInitial.data.assets,{});
const guessedImage = structuredClone(friendInitial.data);
guessedImage.profile.avatar = `asset:${key}`;
await rejects(()=>save(guessedImage,0),/ASSET_REFERENCE_MISSING/);
assert.equal((await load()).revision,0);
console.log('PASS Unregistered second account opens an empty workspace and cannot resolve first account assets');

// Import a backup with identical UUIDs under a different account. Owner-scoped
// keys permit this, and every join/sum must still select only the caller's rows.
const friendData = structuredClone(beforeUpgrade.data);
friendData.profile.name = 'Gia sư bạn bè';
friendData.profile.id = OWNER; // Supplied ownership identifiers must be ignored.
friendData.owner_id = OWNER;
friendData.students[0].name = 'Học sinh của bạn';
friendData.students[0].owner_id = OWNER;
friendData.sessions[0].endTime = '19:00';
friendData.sessions[0].actualMinutes = 60;
friendData.sessions[0].rate = 120000;
friendData.sessions[0].lessonNote.content = 'Nhật ký của bạn';
friendData.invoices[0].items[0].minutes = 60;
friendData.invoices[0].items[0].rate = 120000;
friendData.invoices[0].items[0].amount = 120000;
friendData.invoices[0].snapshot.studentName = 'Học sinh của bạn';
friendData.invoices[0].snapshot.tutorName = 'Gia sư bạn bè';
friendData.invoices[0].comment = 'Hóa đơn của bạn';
friendData.payments[0].amount = 50000;
assert.equal(await save(friendData,0),1);
const friendFirst = await load();
assert.equal(friendFirst.data.profile.name,'Gia sư bạn bè');
assert.equal(friendFirst.data.sessions.length,1);
assert.equal(friendFirst.data.sessions[0].lessonNote.content,'Nhật ký của bạn');
assert.equal(friendFirst.data.invoices[0].items.length,1);
assert.equal(friendFirst.data.invoices[0].items[0].amount,120000);
assert.equal(friendFirst.data.payments[0].amount,50000);
await asUser(OWNER);
assert.deepEqual(await load(),beforeUpgrade);
console.log('PASS Identical imported UUIDs coexist privately; supplied owner fields cannot redirect writes');

const ownerTables = ['workspace_revisions','students','teaching_schedules','teaching_sessions','lesson_notes','invoices','invoice_items','payments','image_assets'];
for (const [signedIn,foreign] of [[OWNER,OTHER],[OTHER,OWNER]]) {
  await asUser(signedIn);
  for (const table of ownerTables) {
    assert.equal((await db.query(`select * from public.${table} where owner_id=$1`,[foreign])).rows.length,0);
    assert.ok((await db.query(`select * from public.${table} where owner_id=$1`,[signedIn])).rows.length > 0);
    await rejects(()=>db.query(`delete from public.${table} where owner_id=$1`,[foreign]),/permission denied/);
  }
  for (const table of ['profiles','app_settings']) {
    assert.equal((await db.query(`select * from public.${table} where id=$1`,[foreign])).rows.length,0);
    assert.equal((await db.query(`select * from public.${table} where id=$1`,[signedIn])).rows.length,1);
    await rejects(()=>db.query(`update public.${table} set id=$1 where id=$2`,[signedIn,foreign]),/permission denied/);
  }
}
console.log('PASS Both accounts read only their own normalized rows; direct cross-account mutations are denied');

await asUser(OTHER);
const friendChanged = structuredClone(friendFirst.data);
friendChanged.students[0].notes = 'Thay đổi riêng';
assert.equal(await save(friendChanged,1),2);
await rejects(()=>save(friendFirst.data,1),/VERSION_CONFLICT/);
const friendOverpaid = structuredClone((await load()).data);
friendOverpaid.payments[0].amount = 120001;
await rejects(()=>save(friendOverpaid,2),/OVERPAYMENT/);
assert.equal((await load()).revision,2);
await asUser(OWNER);
const ownerChanged = structuredClone(beforeUpgrade.data);
ownerChanged.students[0].notes = 'Ghi chú chủ cũ';
assert.equal(await save(ownerChanged,8),9);
const ownerAfterOwnChange = await load();
assert.equal(ownerAfterOwnChange.data.invoices[0].items[0].amount,270000);
assert.equal(ownerAfterOwnChange.data.payments[0].amount,100000);
await asUser(OTHER);
assert.equal((await load()).data.students[0].notes,'Thay đổi riêng');
assert.equal((await load()).revision,2);
console.log('PASS Revisions, financial sums, issued snapshots and rollback remain independent per account');

// Foreign relationships must not link an account's rows to another account,
// even when the attacker knows a UUID that does not exist in their workspace.
const UNIQUE_STUDENT = '99999999-9999-4999-8999-999999999999';
await asUser(OWNER);
const withPrivateStudent = structuredClone(ownerAfterOwnChange.data);
withPrivateStudent.students.push({...withPrivateStudent.students[0],id:UNIQUE_STUDENT,name:'Riêng của chủ cũ'});
assert.equal(await save(withPrivateStudent,9),10);
const ownerPrivateState = await load();
await asUser(OTHER);
const foreignStudentLink = structuredClone((await load()).data);
foreignStudentLink.sessions[0].studentId = UNIQUE_STUDENT;
await rejects(()=>save(foreignStudentLink,2),/foreign key constraint/);
assert.equal((await load()).revision,2);
await asUser(OWNER);
assert.deepEqual(await load(),ownerPrivateState);
console.log('PASS Cross-account foreign-key attempts roll back without changing either account');

await asUser(OTHER);
await db.query("insert into storage.objects(id,bucket_id,name) values($1,'tutorspace-private',$2)",[INVOICE,`${OTHER}/qr.png`]);
assert.equal((await db.query('select * from storage.objects')).rows.length,1);
await rejects(()=>db.query("insert into storage.objects(id,bucket_id,name) values($1,'tutorspace-private',$2)",[SESSION,`${OWNER}/forged.png`]),/row-level security/);
await rejects(()=>db.query("insert into storage.objects(id,bucket_id,name) values($1,'another-bucket',$2)",[SESSION,`${OTHER}/forged.png`]),/row-level security/);
assert.equal((await db.query('delete from storage.objects where name=$1 returning id',[`${OWNER}/qr.png`])).rows.length,0);
assert.equal((await db.query('update storage.objects set name=$1 where name=$2 returning id',[`${OTHER}/stolen.png`,`${OWNER}/qr.png`])).rows.length,0);
await asUser(OWNER);
assert.equal((await db.query('select name from storage.objects')).rows[0].name,`${OWNER}/qr.png`);
assert.equal((await db.query('delete from storage.objects where name=$1 returning id',[`${OTHER}/qr.png`])).rows.length,0);
console.log('PASS Private Storage enforces own UUID folders for reads, uploads and deletes');

await asUser('', 'authenticated');
await rejects(load,/AUTH_REQUIRED/);
await rejects(()=>save(initial.data,0),/AUTH_REQUIRED/);
await asUser(OWNER,'anon');
await rejects(load,/permission denied/);
await rejects(()=>save(initial.data,0),/permission denied/);
await rejects(()=>db.query('select * from public.students'),/permission denied/);
console.log('PASS RPC requires authenticated UID and denies anonymous calls even with a forged claim');

await asUser(OTHER);
await rejects(()=>save(friendInitial.data,2),/ISSUED_IMMUTABLE/);
assert.equal(await save(friendInitial.data,2,true),3);
const friendEmpty = await load();
assert.deepEqual(friendEmpty.data.students,[]);
assert.deepEqual(friendEmpty.data.assets,{});
await asUser(OWNER);
assert.deepEqual(await load(),ownerPrivateState);
console.log('PASS Confirmed reset removes only the caller workspace and preserves the other account');
await db.close();

// Fresh project setup must work without ever inserting a workspace_owner row.
const fresh = new PGlite();
await fresh.exec(stubSql);
await fresh.exec(baseMigration);
await fresh.exec(accountMigration);
assert.equal((await fresh.query('select count(*)::integer as total from public.workspace_owner')).rows[0].total,0);
for (const user of [OWNER,OTHER]) {
  await fresh.exec('reset role; set role authenticated;');
  await fresh.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
  const freshInitial = (await fresh.query('select public.workspace_load() as result')).rows[0].result;
  assert.equal(freshInitial.revision,0);
  assert.equal(freshInitial.data.demo,false);
  assert.deepEqual(freshInitial.data.students,[]);
  freshInitial.data.profile.name = user === OWNER ? 'Tài khoản A' : 'Tài khoản B';
  assert.equal((await fresh.query('select public.workspace_save($1::jsonb,0,false) as result',[JSON.stringify(freshInitial.data)])).rows[0].result,1);
}
await fresh.exec('reset role;');
assert.equal((await fresh.query('select count(*)::integer as total from public.profiles')).rows[0].total,2);
assert.equal((await fresh.query('select count(*)::integer as total from public.workspace_owner')).rows[0].total,0);
console.log('PASS Fresh 001 + 002 setup provisions independent accounts without manual owner registration');
await fresh.close();
