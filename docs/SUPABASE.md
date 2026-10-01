# Thiết lập kho dữ liệu riêng

TutorSpace dùng một tài khoản chủ sở hữu duy nhất. Khi chưa có hai biến môi trường, ứng dụng chạy **dữ liệu mẫu trên thiết bị** bằng IndexedDB. Chế độ mẫu không phải bản sao lưu đám mây; xuất JSON trước khi xóa dữ liệu trình duyệt hoặc chuyển thiết bị. Khi có cấu hình Supabase, ứng dụng yêu cầu đăng nhập và không đưa dữ liệu mẫu vào kho chính thức.

1. Tạo dự án Supabase trong tài khoản của bạn.
2. Trong Authentication → Providers → Email, tắt **Allow new users to sign up**. Không có trang đăng ký công khai trong ứng dụng.
3. Trong Authentication → Users, tạo tài khoản của chính bạn bằng **Add user**. Dùng mật khẩu mạnh và chọn xác nhận email phù hợp. Sao chép UUID của tài khoản.
4. Chạy toàn bộ `supabase/migrations/202610010001_tutorspace.sql` trong SQL Editor. Chỉ chạy migration một lần trên dự án mới.
5. Đăng ký người sở hữu trong SQL Editor, thay UUID dưới đây bằng UUID vừa tạo:

```sql
insert into public.workspace_owner (singleton, user_id)
values (true, 'UUID_TAI_KHOAN_CUA_BAN');
```

Khóa singleton chỉ cho phép một chủ sở hữu. Không cho ứng dụng tự nhận người đăng nhập đầu tiên làm chủ. Muốn thay người sở hữu, sao lưu dữ liệu và thực hiện chuyển quyền có kiểm soát trong SQL Editor; dữ liệu có khóa ngoại theo tài khoản cũ.

6. Sao chép `.env.example` thành `.env.local`. Điền Project URL và **publishable/anon key dành cho trình duyệt** từ Project Settings → API Keys. Không dùng `service_role`, secret key hay mật khẩu cơ sở dữ liệu.
7. Khởi động lại ứng dụng và đăng nhập bằng tài khoản vừa tạo. Lần đầu, kho chính thức trống. Thêm thông tin gia sư, ngân hàng và học sinh của bạn; có thể nhập bản sao lưu sau khi xem nội dung và xác nhận.
8. Khi triển khai Vercel, thêm hai biến môi trường tương tự rồi triển khai lại. Trong Authentication → URL Configuration, đặt Site URL bằng tên miền Vercel hoặc tên miền chính thức. Ứng dụng dùng đăng nhập bằng mật khẩu, không dùng liên kết đăng nhập qua URL.

## Bảo vệ dữ liệu

- Tất cả 9 bảng nghiệp vụ bật RLS. `workspace_owner`, `workspace_revisions` và kho ảnh `image_assets` cũng bật RLS. Chủ sở hữu xem được dữ liệu của mình; tài khoản khác và khách chưa đăng nhập không đọc được.
- Quyền ghi trực tiếp vào bảng bị thu hồi. `workspace_save` kiểm tra `auth.uid()` đối chiếu người sở hữu, khóa số phiên bản, bảo vệ hóa đơn phát hành và ghi toàn bộ dữ liệu trong một giao dịch. Các hàm `SECURITY DEFINER` đặt `search_path` rỗng và gọi bảng bằng tên đầy đủ.
- Mỗi lần lưu gửi `expected_revision`. Nếu tab hoặc thiết bị khác đã lưu, giao dịch cũ bị từ chối. Ứng dụng tải dữ liệu mới và yêu cầu thực hiện lại thao tác. Chỉ thông báo thành công sau khi kho lưu xác nhận hoàn tất.
- Một học sinh chỉ có một hóa đơn đã phát hành trong tháng. Một buổi học chỉ được xuất hiện một lần trong các hóa đơn đã phát hành. Thanh toán cho bản nháp và thanh toán vượt tổng học phí bị từ chối trong giao dịch.
- Dữ liệu hóa đơn gồm snapshot thông tin học sinh, gia sư, ngân hàng, QR, đơn giá, thời lượng và số tiền từng dòng. Chỉnh sửa lịch, học sinh hoặc cài đặt không thay đổi snapshot cũ. Chỉnh sửa hóa đơn đã phát hành hoặc khôi phục bản sao lưu cần xác nhận rõ trong giao diện và gửi cờ `allow_issued_changes`.
- PNG/JPEG/WEBP tối đa 2 MB, tối đa 6.000 × 6.000 pixel. Bucket `tutorspace-private` không công khai và chỉ người sở hữu được tải lên/đọc/xóa ảnh trong thư mục UUID của mình. Ứng dụng tải ảnh qua phiên đăng nhập; không dùng URL công khai hoặc URL ký có hạn dùng.
- Dữ liệu đồng bộ dùng tham chiếu `asset:<sha256>` và một từ điển ảnh. `image_assets` chỉ lưu một bản mỗi nội dung ảnh cho chủ sở hữu, dù ảnh QR đó xuất hiện trong nhiều hóa đơn. Máy chủ xác minh mã SHA-256, định dạng, chữ ký ảnh và giới hạn 2 MB; tham chiếu chỉ được giải quyết trong kho của đúng chủ sở hữu. API ghi trực tiếp vào bảng ảnh bị khóa, và một mã ảnh không được thay đổi nội dung. Khi tải dữ liệu, ứng dụng ghép ảnh về data URI để giao diện, tệp sao lưu và PNG hoạt động độc lập với URL cloud. Thay QR hiện tại vẫn giữ ảnh cũ được hóa đơn tham chiếu. Ảnh không còn được hồ sơ/cài đặt/hóa đơn nào tham chiếu được dọn khỏi `image_assets` trong lần lưu thành công.
- Mỗi lần đồng bộ giới hạn 50 MB sau khi gộp ảnh trùng. Bản sao lưu JSON chứa đầy đủ data URI cho từng snapshot để có thể khôi phục độc lập; tệp nhập tối đa 100 MB và từng ảnh đồng bộ lên cloud vẫn phải đáp ứng giới hạn 2 MB. Bản sao lưu có thể lớn hơn dữ liệu truyền lên máy chủ vì dữ liệu cloud chỉ gửi mỗi ảnh một lần.
- Token đăng nhập và dữ liệu mẫu lưu bằng IndexedDB. Không lưu kho dữ liệu vào localStorage. Trình duyệt cần HTTPS trên tên miền chính thức.

## Kiểm tra trước khi dùng dữ liệu thật

1. Đăng nhập tài khoản chủ, thêm học sinh và một buổi học; tải lại trang để kiểm tra dữ liệu còn nguyên.
2. Hoàn thành buổi học, tạo và phát hành hóa đơn, ghi nhận một khoản thanh toán; tải lại và đối chiếu số tiền.
3. Chỉnh sửa đơn giá học sinh hoặc lịch đã tính phí; hóa đơn đã phát hành giữ nguyên nội dung cũ.
4. Mở hai tab; lưu thay đổi ở tab A, rồi lưu từ tab B với dữ liệu cũ. Tab B phải báo đã có dữ liệu mới và không ghi đè A.
5. Thử tài khoản khác do bạn tạo để kiểm tra phân quyền. Gọi `workspace_load`/`workspace_save` phải nhận `OWNER_ONLY`; truy vấn bảng không trả dữ liệu của chủ; truy vấn ảnh phải bị từ chối. Xóa tài khoản thử sau khi kiểm tra.
6. Upload QR có sẵn của bạn, phát hành hóa đơn, tải PNG; đối chiếu ảnh QR nguyên tỷ lệ, dấu tiếng Việt và toàn bộ dòng nhận xét.

Các bài kiểm thử tự động trong source kiểm tra phép tính, dữ liệu sao lưu, snapshot và bộ chuyển đổi tham chiếu ảnh. Migration đã được chạy trong Postgres nhúng (PGlite) với schema Auth/Storage mô phỏng: 18 nhóm kiểm tra lưu/tải, RLS, khóa phiên bản, snapshot, gộp ảnh trùng, từ chối tham chiếu thiếu/sai/chủ sở hữu khác, bảo toàn ảnh hóa đơn cũ, từ chối tính trùng, từ chối thanh toán vượt tiền và rollback đều qua kiểm thử. Chưa có thông tin truy cập dự án thật thì không thể xác nhận cấu hình Auth/Storage hoặc triển khai migration trên máy chủ của bạn. Kiểm tra theo các bước trên sau khi cấu hình.

Chạy lại kiểm thử cơ sở dữ liệu nhúng bằng `npm run test:db`. Mã kiểm thử nằm trong `supabase/tests/integration.mjs` và tạo schema Auth/Storage mô phỏng rõ ràng; không kết nối hay sửa bất kỳ dự án Supabase thật nào.

## Nguồn tham khảo chính thức

- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Download từ private bucket](https://supabase.com/docs/reference/javascript/file-buckets-download)
