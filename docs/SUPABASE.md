# Thiết lập Supabase cho nhiều tài khoản

TutorSpace cho phép mỗi gia sư tạo tài khoản bằng email và mật khẩu. **Mỗi tài khoản có kho riêng** gồm học sinh, lịch dạy, nhật ký, hóa đơn, thanh toán, ảnh và cài đặt. Bạn chỉ cần chia sẻ địa chỉ website; bạn bè không cần quyền quản trị Supabase hay Vercel.

Khi chưa có cả hai biến môi trường, ứng dụng chạy **Dữ liệu mẫu trên thiết bị** bằng IndexedDB, không có đăng ký cloud. Khi cấu hình Supabase đầy đủ, ứng dụng yêu cầu đăng nhập; kho mới trống và không tự nhận dữ liệu mẫu. Bản sao lưu JSON được khôi phục vào kho của tài khoản đang đăng nhập sau bước kiểm tra và xác nhận.

## 1. Chạy đúng SQL

Mở dự án của bạn trong [Supabase Dashboard](https://supabase.com/dashboard), chọn **SQL Editor → New query**. Sao chép toàn bộ tệp SQL tương ứng, dán vào và bấm **Run**. Không chỉ sao chép tên tệp.

| Tình trạng dự án | SQL cần chạy |
|---|---|
| Dự án mới, chưa có bảng TutorSpace | Chạy `supabase/migrations/202610010001_tutorspace.sql`, đợi thành công; rồi chạy `supabase/migrations/202610010002_multi_account.sql` trong query mới |
| Đã chạy migration 001 theo hướng dẫn cũ | Chỉ chạy `supabase/migrations/202610010002_multi_account.sql` |
| Đã chạy cả 001 và 002 | Không cần chạy thêm SQL để tạo tài khoản mới |

Migration 001 là bản nền cũ, được giữ nguyên để nâng cấp dự án đã dùng. **Không chạy lại 001 trên kho có bảng**, vì các lệnh tạo bảng sẽ báo trùng. Migration 002 chuyển phân quyền sang từng tài khoản, giữ học sinh, lịch, hóa đơn, ảnh và phiên bản dữ liệu của tài khoản cũ. Hãy giữ nguyên tài khoản Auth cũ để tiếp tục truy cập dữ liệu đó.

**Không cần tạo chủ sở hữu hoặc thêm UUID vào `workspace_owner` nữa.** Nếu bạn đã thêm UUID theo hướng dẫn trước, cứ giữ nguyên; migration 002 không xóa dữ liệu cũ. Bảng này chỉ còn là dấu vết cấu hình trước đây và không quyết định quyền truy cập của ứng dụng. Tài khoản đã xác thực được mở kho của chính mình; phiên bản được khởi tạo khi mở kho và hồ sơ được tạo khi lưu lần đầu.

## 2. Cho phép đăng ký bằng email

Trong phần **Authentication** của Supabase:

- Bật **Allow new users to sign up** trong cấu hình người dùng. Đây là thay đổi so với hướng dẫn cũ yêu cầu tắt đăng ký.
- Trong **Providers / Sign In → Email**, bật đăng nhập bằng email.
- Nên bật **Confirm email**. Sau khi đăng ký, người dùng phải mở email xác nhận trước khi đăng nhập. Giao diện TutorSpace có nút gửi lại email nếu chưa nhận được.

Tài khoản mới được tạo ngay từ website bằng tên hiển thị, email, mật khẩu từ 8 ký tự và xác nhận mật khẩu. Bạn không cần tạo thủ công tài khoản cho từng người trong Authentication → Users. Tài khoản đã có tiếp tục đăng nhập bằng email và mật khẩu cũ. [Hướng dẫn đăng nhập bằng mật khẩu của Supabase](https://supabase.com/docs/guides/auth/passwords).

## 3. Cấu hình gửi email cho bạn bè

**Cần Custom SMTP để gửi email xác nhận và đặt lại mật khẩu cho người dùng ngoài nhóm quản trị Supabase.** SMTP mặc định của Supabase chỉ gửi tới email thuộc nhóm dự án, nên email của bạn bè có thể bị từ chối với lỗi `Email address not authorized`. Đây là giới hạn dịch vụ email, không phải lỗi SQL. [Tài liệu SMTP chính thức](https://supabase.com/docs/guides/auth/auth-smtp).

Chọn một dịch vụ gửi email có hỗ trợ SMTP, lấy cấu hình từ dịch vụ đó rồi vào **Authentication → Email → SMTP Settings** của Supabase (hoặc mục **SMTP Settings** trong cấu hình Authentication):

| Trường | Nội dung cần điền |
|---|---|
| Sender email | Địa chỉ gửi đã được xác minh với dịch vụ email của bạn |
| Sender name | Ví dụ `TutorSpace` |
| Host, Port | Máy chủ và cổng SMTP do dịch vụ cung cấp |
| Username, Password | Tên đăng nhập và mật khẩu SMTP do dịch vụ cung cấp |

Bật Custom SMTP và lưu. Thực hiện bước xác minh tên miền/email gửi mà dịch vụ yêu cầu. Thông tin SMTP chỉ nhập trong Supabase; không thêm vào các biến `VITE_` hoặc source. Gửi thử email tới một tài khoản bên ngoài nhóm dự án trước khi chia sẻ website rộng hơn.

## 4. Cấu hình địa chỉ xác nhận và đặt lại mật khẩu

Vào **Authentication → URL Configuration**. Đặt **Site URL** bằng địa chỉ HTTPS chính thức của website, ví dụ `https://ten-ung-dung.vercel.app`.

Thêm các mục sau vào **Redirect URLs**, thay tên miền ví dụ bằng tên miền thật của bạn:

```text
https://ten-ung-dung.vercel.app/
https://ten-ung-dung.vercel.app/reset-password
```

TutorSpace đưa người dùng về trang gốc sau khi xác nhận email; email đặt lại mật khẩu đưa về `/reset-password`. Giữ dấu `/` cuối ở địa chỉ gốc như ví dụ. Nếu dùng thêm tên miền riêng hoặc bản Preview, thêm hai địa chỉ tương ứng cho từng tên miền đó. Ưu tiên khai báo chính xác các địa chỉ được dùng. [Tài liệu Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

Nếu thử trên máy bằng lệnh mặc định trong source, thêm:

```text
http://127.0.0.1:5173/
http://127.0.0.1:5173/reset-password
```

Bản `npm run preview` dùng cổng 4173, nên thêm hai mục tương tự với cổng 4173 nếu cần thử email trên bản dựng. `localhost` và `127.0.0.1` là hai địa chỉ khác nhau; hãy thêm đúng địa chỉ bạn mở.

Giữ liên kết `{{ .ConfirmationURL }}` mặc định trong email xác nhận và email khôi phục của Supabase. SDK Supabase tự tiếp nhận phiên đăng nhập khi trình duyệt mở liên kết về ứng dụng. Không cần sao chép token hay thêm endpoint `/auth/confirm` của hướng dẫn SSR. Nếu bạn đã sửa mẫu email để trỏ tới endpoint khác, khôi phục mẫu liên kết mặc định trước khi thử. [Tài liệu mẫu email](https://supabase.com/docs/guides/auth/auth-email-templates).

## 5. Kết nối ứng dụng và triển khai Vercel

Trong Supabase, lấy **Project URL** và **Publishable key** (hoặc legacy anon key) dành cho trình duyệt. Sao chép `.env.example` thành `.env.local` khi chạy trên máy và điền:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-browser-key
```

Tên biến thứ hai vẫn là `VITE_SUPABASE_ANON_KEY` khi dùng Publishable key. Không dùng `service_role`, secret key hoặc mật khẩu cơ sở dữ liệu trong frontend. [Tài liệu API keys của Supabase](https://supabase.com/docs/guides/getting-started/api-keys).

Trong Vercel → **Settings → Environment Variables**, thêm hai biến cùng tên cho môi trường cần dùng. Đưa source mới lên GitHub, rồi triển khai lại. Nếu website đã có hai biến đúng thì không cần thay giá trị. Vite đưa các biến này vào bản dựng, nên thay biến phải **Redeploy**. `vercel.json` đã chuyển các đường dẫn, kể cả `/reset-password`, về ứng dụng.

Mở website → **Tạo tài khoản**, đăng ký, xác nhận email và đăng nhập. Trong **Cài đặt**, điền hồ sơ gia sư, thông tin nhận học phí và ảnh QR của riêng bạn. Sau đó có thể chia sẻ địa chỉ website cho bạn bè làm tương tự.

## Bảo vệ dữ liệu

- Các bảng nghiệp vụ, phiên bản và ảnh bật RLS theo `auth.uid()`. Người chưa đăng nhập không đọc được; một tài khoản chỉ đọc được hàng có mã chủ sở hữu của mình.
- Quyền ghi trực tiếp vào bảng bị thu hồi. `workspace_load` và `workspace_save` chỉ xử lý kho của người gọi; không nhận mã người khác để chọn kho. Các hàm `SECURITY DEFINER` đặt `search_path` rỗng và gọi bảng bằng tên đầy đủ.
- `workspace_save` khóa phiên bản theo tài khoản và ghi toàn bộ dữ liệu trong một giao dịch. Tab hoặc thiết bị khác của cùng tài khoản đã lưu thì giao dịch dùng phiên bản cũ bị từ chối. Kho của tài khoản khác có phiên bản độc lập.
- Mã dữ liệu, ràng buộc lịch và quy tắc hóa đơn được giới hạn trong từng kho. Hai người có thể nhập cùng bản sao lưu mà không va chạm mã hoặc nhìn thấy dữ liệu của nhau.
- Một học sinh chỉ có một hóa đơn phát hành trong tháng, một buổi chỉ được tính vào một hóa đơn phát hành trong cùng kho. Thanh toán bản nháp hoặc vượt học phí bị từ chối trong giao dịch.
- Hóa đơn đã phát hành giữ snapshot học sinh, gia sư, ngân hàng, QR, đơn giá, thời lượng và số tiền. Đổi cài đặt hay lịch không thay snapshot cũ. Chỉnh hóa đơn phát hành hoặc khôi phục sao lưu cần xác nhận rõ và gửi cờ `allow_issued_changes`.
- PNG/JPEG/WEBP tối đa 2 MB, tối đa 6.000 × 6.000 pixel. Bucket `tutorspace-private` không công khai; người đăng nhập chỉ tải lên/đọc/xóa ảnh trong thư mục UUID của chính mình. Ứng dụng tải ảnh qua phiên đăng nhập, không dùng URL công khai.
- `image_assets` gộp nội dung ảnh theo SHA-256 trong từng kho. Máy chủ xác minh mã, định dạng, chữ ký ảnh và giới hạn 2 MB. Tham chiếu `asset:<sha256>` chỉ được giải quyết trong kho người gọi. Thay QR hiện tại vẫn giữ ảnh được hóa đơn cũ tham chiếu. Ảnh hết tham chiếu được dọn trong lần lưu thành công.
- Mỗi lần đồng bộ giới hạn 50 MB sau khi gộp ảnh trùng. JSON sao lưu chứa đầy đủ ảnh cho từng snapshot để khôi phục độc lập; tệp nhập tối đa 100 MB. Xuất/khôi phục chỉ áp dụng kho đang đăng nhập.
- Token đăng nhập và dữ liệu mẫu được lưu bằng IndexedDB. Không lưu kho nghiệp vụ vào localStorage. Website chính thức cần HTTPS.

## Kiểm tra trước khi chia sẻ

1. Nếu nâng cấp dự án cũ: đăng nhập tài khoản cũ, kiểm tra học sinh, lịch, thanh toán và ảnh vẫn còn trước khi tạo dữ liệu mới.
2. Đăng ký tài khoản A từ website bằng email ngoài nhóm Supabase; kiểm tra email xác nhận, nút gửi lại và đăng nhập. Tạo học sinh, buổi học và tải lại trang để xác nhận lưu cloud.
3. Đăng ký tài khoản B trên trình duyệt riêng hoặc cửa sổ riêng tư. B phải có kho trống, không thấy học sinh hay ảnh của A. Thêm dữ liệu cho B; đăng nhập lại A và đối chiếu dữ liệu A không đổi.
4. Từ **Quên mật khẩu**, yêu cầu email cho B, mở liên kết, đặt mật khẩu mới rồi đăng nhập lại. Thử liên kết hết hạn hoặc đã dùng; ứng dụng phải báo lỗi và cho yêu cầu email mới.
5. Mở hai tab cùng tài khoản A: lưu tab thứ nhất rồi lưu tab còn lại với dữ liệu cũ. Tab còn lại phải báo có dữ liệu mới và không ghi đè.
6. Hoàn thành một buổi, phát hành hóa đơn, ghi thanh toán từng phần; tải lại và đối chiếu. Đổi đơn giá hoặc QR hiện tại; phiếu cũ phải giữ snapshot ban đầu.
7. Kiểm tra quyền: B truy vấn bảng không thấy hàng của A, gọi `workspace_load` chỉ nhận kho B, gọi `workspace_save` không sửa kho A. Đọc ảnh Storage trong thư mục UUID của A bằng phiên B phải bị từ chối.
8. Tải PNG trên Chrome/Safari, đối chiếu QR, dấu tiếng Việt và toàn bộ nhận xét. Xuất JSON của B, kiểm tra bước xác nhận khi khôi phục trong kho thử riêng.

Các bài kiểm thử cơ sở dữ liệu chạy PostgreSQL nhúng PGlite với Auth/Storage mô phỏng. Chạy `npm run test:db`; không có kết nối hay thay đổi dự án Supabase thật. Xem kết quả và các giới hạn trong [TESTING.md](TESTING.md). Cần thực hiện các bước trên để xác nhận SQL, Auth, SMTP và Storage của dự án chính thức.

## Nguồn tham khảo chính thức

- [Cấu hình đăng ký người dùng](https://supabase.com/docs/guides/auth/general-configuration)
- [Email và mật khẩu](https://supabase.com/docs/guides/auth/passwords)
- [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Database Functions](https://supabase.com/docs/guides/database/functions)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Download từ private bucket](https://supabase.com/docs/reference/javascript/file-buckets-download)
