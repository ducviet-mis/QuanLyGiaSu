# TutorSpace — Không gian quản lý gia sư cá nhân

Ứng dụng tiếng Việt giúp gia sư quản lý học sinh, lịch dạy, nhật ký, học phí và thanh toán. Bạn có thể chia sẻ địa chỉ ứng dụng cho bạn bè: mỗi người đăng ký một tài khoản và có kho dữ liệu riêng. Giao diện hỗ trợ máy tính, điện thoại, chế độ sáng/tối và múi giờ `Asia/Ho_Chi_Minh`. Tiền tệ dùng đồng Việt Nam.

Source đã có đầy đủ giao diện, xử lý dữ liệu và migration Supabase. Bản bàn giao chưa được triển khai lên một dự án Supabase hoặc Vercel thật; cần cấu hình bằng tài khoản của bạn trước khi dùng dữ liệu chính thức.

## Chạy trên máy

Yêu cầu **Node.js từ 22.18.0 trở lên** và npm. Mở terminal trong thư mục chứa README này:

```sh
npm ci
npm run dev
```

Mở [http://127.0.0.1:5173](http://127.0.0.1:5173). Nếu chưa cấu hình Supabase, ứng dụng mở không gian mẫu có nhãn **Dữ liệu mẫu**. Các học sinh, buổi học và khoản thanh toán mẫu chỉ phục vụ thử nghiệm, không phải thông tin hay giao dịch thật.

Kiểm tra bản dựng để triển khai:

```sh
npm run build
npm run preview
```

Mở [http://127.0.0.1:4173](http://127.0.0.1:4173) để xem bản dựng. Kết quả build nằm trong `dist/`.

## Hai chế độ lưu dữ liệu

**Dùng thử trên thiết bị:** để trống cả hai biến môi trường trong `.env.example`. Dữ liệu mẫu và các thay đổi được lưu bằng IndexedDB của trình duyệt, giữ lại sau khi tải trang. Mỗi trình duyệt, địa chỉ và cổng có kho riêng. Xóa dữ liệu trình duyệt có thể xóa kho dùng thử; hãy xuất JSON trước khi chuyển thiết bị hoặc xóa dữ liệu. Trong Cài đặt → Sao lưu dữ liệu, có thể tạo lại mẫu hoặc xóa dữ liệu dùng thử sau bước xác nhận.

**Kho riêng cho từng tài khoản trên Supabase:** điền đủ cả hai biến môi trường, khởi động lại ứng dụng rồi đăng ký hoặc đăng nhập. Ứng dụng có xác nhận email, gửi lại email xác nhận và đặt lại mật khẩu. Tài khoản mới bắt đầu với kho trống; ứng dụng không tự đưa dữ liệu mẫu vào cloud. Học sinh, lịch, hóa đơn, thanh toán, ảnh và cài đặt của từng người được tách riêng. Cấu hình thiếu hoặc sai sẽ báo lỗi, không chuyển sang dùng thử. Chưa có quyền cùng quản lý một kho, tài khoản phụ huynh hoặc tài khoản học sinh.

## Thiết lập Supabase

1. Tạo một dự án Supabase, hoặc dùng dự án TutorSpace bạn đã có.
2. Với **dự án mới**, chạy toàn bộ `supabase/migrations/202610010001_tutorspace.sql`, sau đó chạy `supabase/migrations/202610010002_multi_account.sql` trong SQL Editor. Với **dự án đã chạy migration 001**, chỉ chạy migration 002. Không chạy lại 001 trên kho đã có bảng. Nâng cấp giữ dữ liệu của tài khoản cũ; không cần thêm UUID vào `workspace_owner` nữa.
3. Trong Authentication, bật **Allow new users to sign up** và đăng nhập bằng **Email**. Nên bật **Confirm email** để người dùng xác minh địa chỉ trước khi đăng nhập. Hướng dẫn cũ yêu cầu tắt đăng ký và tạo chủ thủ công đã được thay thế.
4. Cấu hình **Custom SMTP** để gửi email xác nhận và đặt lại mật khẩu cho bạn bè. SMTP mặc định của Supabase chỉ gửi tới email thuộc nhóm quản trị dự án, nên không đủ cho chia sẻ ứng dụng. Làm theo [hướng dẫn SMTP chính thức](https://supabase.com/docs/guides/auth/auth-smtp).
5. Trong Authentication → URL Configuration, đặt **Site URL** bằng địa chỉ HTTPS chính thức. Thêm địa chỉ gốc có dấu `/` cuối và đường dẫn `/reset-password` vào **Redirect URLs**. Xem ví dụ đầy đủ trong [docs/SUPABASE.md](docs/SUPABASE.md).
6. Sao chép `.env.example` thành `.env.local` và điền:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-browser-key
```

Chỉ dùng khóa publishable/anon dành cho trình duyệt. Không đưa `service_role`, secret key hoặc mật khẩu cơ sở dữ liệu vào frontend hay Git. Xem [tài liệu API keys của Supabase](https://supabase.com/docs/guides/getting-started/api-keys) và [cấu hình đăng ký tài khoản](https://supabase.com/docs/guides/auth/general-configuration).

7. Chạy lại `npm run dev`, đăng ký bằng tên, email và mật khẩu từ 8 ký tự. Xác nhận email rồi đăng nhập; thiết lập thông tin gia sư, ngân hàng và ảnh QR có sẵn trong Cài đặt. Bản sao lưu được nhập vào kho của tài khoản đang đăng nhập sau khi xem số liệu và xác nhận thay thế dữ liệu.

Hướng dẫn SQL nâng cấp, cấu hình email, RLS, Storage và kiểm tra hai tài khoản nằm trong [docs/SUPABASE.md](docs/SUPABASE.md).

## Triển khai Vercel

1. Đưa thư mục source này vào kho Git của bạn và nhập dự án vào Vercel. Chọn đúng thư mục gốc chứa `package.json` nếu source nằm trong thư mục con.
2. Chọn preset Vite, lệnh cài đặt `npm ci`, lệnh build `npm run build`, thư mục output `dist`. Dùng Node.js đáp ứng phiên bản tối thiểu nêu trên.
3. Thêm `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` vào môi trường triển khai cần dùng, rồi build/deploy lại. Vite đưa các giá trị này vào bản dựng; thay biến môi trường cần triển khai lại. Xem [hướng dẫn Vite của Vercel](https://vercel.com/docs/frameworks/frontend/vite).
4. Đặt Site URL trong Supabase Authentication bằng tên miền chính thức, thêm Redirect URLs cho `/` và `/reset-password` trên tên miền đó. `vercel.json` đã có cấu hình chuyển các đường dẫn ứng dụng về `index.html`, nên có thể mở trực tiếp `/students`, `/calendar`, `/invoices` hoặc `/reset-password`.
5. Trên tên miền HTTPS, kiểm tra đăng ký, email xác nhận, đăng nhập, đặt lại mật khẩu và dữ liệu độc lập giữa hai tài khoản. Kiểm tra thêm upload QR, phát hành hóa đơn và tải PNG theo tài liệu kiểm thử trước khi nhập dữ liệu thật.

## Chức năng đã triển khai

- **Tài khoản:** đăng ký bằng email, xác nhận/gửi lại email, đăng nhập, quên mật khẩu và đặt mật khẩu mới; mỗi tài khoản có kho riêng.
- **Tổng quan:** KPI từ dữ liệu thực, buổi hôm nay, lịch sắp tới, biểu đồ học phí phát sinh và tiền đã nhận, thao tác nhanh.
- **Học sinh:** thêm/sửa thông tin, avatar, đơn giá theo giờ hoặc buổi, tìm kiếm và lọc trạng thái; hồ sơ có lịch sử học, nhật ký, mục tiêu và học phí. Chuyển trạng thái kết thúc vẫn giữ lịch sử.
- **Lịch dạy:** mặc định 30 ngày từ hôm nay, xem theo tháng hoặc danh sách, chọn ngày và lọc; tạo/sửa buổi, lịch lặp tuần, chỉnh riêng buổi hoặc cả chuỗi, hủy và dời lịch; kiểm tra xung đột thời gian.
- **Nhật ký:** xác nhận thời lượng thực tế, kiến thức, thái độ, mức tiếp thu, bài tập và kế hoạch buổi tiếp theo. Chỉ buổi hoàn thành được tính phí mặc định; có thể đặt ngoại lệ tính phí rõ ràng.
- **Hóa đơn:** tổng hợp học sinh/tháng, đơn giá và thời lượng, chỉnh bản nháp, phụ thu/giảm trừ có lý do, nhận xét, xem trước, phát hành và tải ảnh PNG. Hóa đơn là phiếu thông báo học phí cá nhân, không phải hóa đơn VAT.
- **QR thủ công:** upload ảnh có sẵn, xem trước, thay/xóa ảnh; giữ nguyên tỷ lệ trong hóa đơn và ảnh xuất. Không gọi VietQR hoặc tự tạo mã chuyển khoản.
- **Thanh toán:** ghi nhận tiền và ngày thực nhận, thanh toán từng phần, số còn thiếu và trạng thái tự cập nhật; ngăn ghi nhận vượt số tiền còn lại hoặc vào bản nháp.
- **Thống kê:** bộ lọc tháng/năm, học phí phát sinh, tiền thực nhận, giờ/buổi hoàn thành, tổng hợp theo học sinh và công nợ. Phát hành hóa đơn không tự ghi nhận đã thu tiền.
- **Cài đặt:** hồ sơ gia sư, thông tin ngân hàng, sáng/tối/theo thiết bị, học phí mặc định, thời gian nhắc lịch, xuất JSON và khôi phục có kiểm tra/xác nhận.

Số tiền được xử lý bằng số nguyên VND. Học phí theo giờ dùng số phút thực tế và làm tròn nửa lên một lần cho từng buổi; ví dụ 100 phút × 180.000đ/giờ = 300.000đ. Hóa đơn đã phát hành giữ snapshot học sinh, đơn giá, dòng học phí, ngân hàng và QR. Thay lịch hay cài đặt không sửa hóa đơn cũ; chỉnh hóa đơn đã phát hành cần thao tác xác nhận riêng.

Ứng dụng chỉ báo lưu thành công sau khi kho dữ liệu xác nhận. Cloud ghi trong giao dịch, kiểm tra phiên bản của từng tài khoản và từ chối ghi đè khi tab/thiết bị khác của cùng tài khoản đã lưu. Tất cả bảng và ảnh riêng được bảo vệ theo người đang đăng nhập. Ảnh trùng giữa nhiều hóa đơn được lưu một lần trong kho của từng người và được khôi phục đầy đủ khi xuất JSON/PNG.

## Kiểm thử và giới hạn

```sh
npm test
npm run test:db
npm run build
```

Kiểm thử đơn vị bao phủ tiền học, ngoại lệ tính phí, lịch lặp/xung đột, hóa đơn, thanh toán, snapshot, ngày Việt Nam, sao lưu và tham chiếu ảnh. Kiểm thử cơ sở dữ liệu chạy Postgres nhúng PGlite với schema Auth/Storage mô phỏng, không truy cập dự án Supabase thật. Kết quả và kiểm tra giao diện nằm trong [docs/TESTING.md](docs/TESTING.md).

- Nhắc lịch bằng Browser Notifications chỉ hoạt động khi ứng dụng đang mở và trình duyệt đã được cấp quyền. Chưa có push nền, SMS hoặc Zalo tự động.
- Thanh toán cập nhật thủ công; không kết nối ngân hàng hoặc đối soát giao dịch tự động.
- Ảnh PNG/JPEG/WEBP tối đa 2 MB, kích thước tối đa 6.000 × 6.000 pixel. Tệp nhập sao lưu tối đa 100 MB; mỗi lần đồng bộ cloud tối đa 50 MB sau khi gộp ảnh trùng.
- Có manifest hỗ trợ mở từ màn hình chính tùy trình duyệt. Chưa có service worker hoặc chế độ làm việc offline cho kho cloud.
- Cấu hình Auth, RLS và Storage trên Supabase thật, triển khai Vercel và kiểm tra trên thiết bị iPhone thật cần được thực hiện sau khi kết nối tài khoản của bạn.

## Cấu trúc source

```text
src/
  components/       Thành phần giao diện và biểu mẫu
  pages/            Sáu màn hình chính
  data/             IndexedDB, kết nối cloud và gộp ảnh
  domain.ts         Tiền học, KPI, ngày và kiểm tra sao lưu
  calendar.ts       Lịch lặp và xung đột buổi học
  invoice-engine.ts Hóa đơn, thanh toán và tên ảnh xuất
  store.tsx         Phiên đăng nhập, tải/lưu và xử lý xung đột
  types.ts          Kiểu dữ liệu nghiệp vụ
supabase/
  migrations/       Schema, RLS, giao dịch và private Storage
  tests/            Kiểm thử PostgreSQL nhúng
tests/              Kiểm thử dữ liệu và ảnh
docs/               Thiết lập Supabase và kết quả kiểm thử
public/             Icon và manifest
```

Stack chính: React, TypeScript, Vite, React Router, Supabase, Lucide, Recharts, Zod, Sonner và html-to-image. Font Be Vietnam Pro được đóng gói trong source để hỗ trợ dấu tiếng Việt và xuất ảnh.
