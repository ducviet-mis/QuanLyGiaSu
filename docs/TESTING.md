# Kết quả kiểm thử TutorSpace

Ngày kiểm tra: 01/10/2026. Môi trường: Windows, Node.js 24.19.0, trình duyệt Chromium nhúng, bản dựng production Vite. Chưa dùng dự án Supabase/Vercel thật hoặc thiết bị iPhone thật.

## Kiểm thử tự động

| Lệnh | Kết quả | Nội dung |
|---|---|---|
| `npm test` | 42/42 đạt, 5 tệp sau nâng cấp đa tài khoản | 35 kiểm tra nghiệp vụ và dữ liệu; 7 kiểm tra hỗ trợ xác thực: đăng ký, chuyển hướng email, gửi lại xác nhận, đặt lại mật khẩu và xử lý lỗi |
| `npm run test:db` | 28/28 nhóm đạt sau nâng cấp đa tài khoản | Migration nền và nâng cấp, giữ dữ liệu cũ, kho trống cho người mới, RLS/RPC/Storage theo từng người, phiên bản độc lập, mã nhập trùng giữa hai kho, hóa đơn, rollback và ảnh riêng |
| `npm run build` | Đạt sau nâng cấp đa tài khoản | TypeScript và bản dựng production; output `dist/` |

Kiểm thử cơ sở dữ liệu sử dụng PGlite chạy PostgreSQL nhúng. Schema `auth`/`storage` và `auth.uid()` được mô phỏng rõ ràng trong chương trình kiểm tra; không kết nối hoặc sửa một dự án cloud. Các kiểm tra quyền dùng vai trò `anon`/`authenticated` và UUID của hai tài khoản độc lập. Chúng không thay thế việc xác nhận cấu hình Supabase thật.

Nâng cấp đa tài khoản kiểm tra cả hai cách cài: dự án mới chạy 001 rồi 002 mà không đăng ký chủ thủ công; dự án cũ chạy 002, giữ hàng nghiệp vụ, ảnh và phiên bản của tài khoản cũ. Migration 002 chạy lại được. Hai kho nhập cùng UUID vẫn lưu/tải độc lập; tài khoản B không thấy hàng hoặc ảnh của A; khách chưa đăng nhập bị từ chối. Phiên bản, ràng buộc lịch/hóa đơn và tham chiếu ảnh được kiểm tra theo từng tài khoản.

Bản dựng có cảnh báo chú thích tối ưu hóa từ Zod và dung lượng JavaScript khoảng 1,02 MB trước gzip. Bản dựng hoàn thành, không có lỗi TypeScript. Thử trình duyệt dùng `npm run preview`; máy sandbox đã hạn chế đường dẫn khi trình tối ưu dependency của máy chủ `dev` quét ổ đĩa, nên chế độ `dev` chưa được xác nhận trong môi trường này.

## Những luồng đã thực hiện qua giao diện

Phần tài khoản đã được kiểm tra riêng qua giao diện production kết nối một máy chủ Auth/RPC giả lập ở địa chỉ cục bộ, không gửi email hay tạo tài khoản thật: đăng ký và xác nhận mật khẩu; chờ xác nhận email; gửi lại xác nhận từ màn hình đăng ký và đăng nhập; yêu cầu đặt lại mật khẩu; nhận liên kết khôi phục, lưu mật khẩu và quay lại đăng nhập; báo lỗi mật khẩu sai và liên kết hết hạn; đăng xuất/đổi tài khoản xóa ô tìm kiếm cũ; tải lại giữ phiên. Giao diện đăng ký được kiểm tra ở màn hình máy tính và 375 × 812, không tràn ngang và trường nhập 16 px trên điện thoại. Ảnh đối chiếu nằm tại `outputs/tutorspace-auth-desktop.png` và `outputs/tutorspace-auth-mobile.png` ở thư mục bàn giao. Máy chủ giả lập chỉ kiểm tra xử lý giao diện và SDK; khả năng cách ly dữ liệu được kiểm tra riêng bằng PostgreSQL nhúng ở trên.

Tất cả dữ liệu dưới đây là dữ liệu kiểm thử trên kho IndexedDB dùng thử. Tên ngân hàng, số tài khoản và ảnh tải lên là giả lập; không có giao dịch hoặc thông tin ngân hàng thật.

| Luồng | Đối chiếu thực tế |
|---|---|
| Thêm học sinh | Tạo “Học sinh kiểm thử”, lớp 9, môn Toán, đơn giá 150.000đ/giờ. Tải lại trang vẫn có học sinh mới. |
| Tạo lịch tuần | Thứ Năm, 09:00–10:00, từ 01/10 đến 15/10/2026: sinh đúng ba buổi ngày 1, 8, 15. |
| Hoàn thành và ghi nhật ký | Xác nhận 90 phút thực tế; lưu nội dung và thái độ. Hồ sơ hiển thị một buổi hoàn thành, 1,5 giờ và nhật ký đã nhập. |
| Tính học phí | 90 phút × 150.000đ/giờ = 225.000đ. Thêm 25.000đ phụ thu và giảm 10.000đ có lý do: tổng 240.000đ. |
| Upload ảnh nhận học phí | Ảnh kiểm thử 240 × 360 px giữ tỷ lệ 2:3 trong Cài đặt, hóa đơn và PNG. Ảnh này chỉ dùng kiểm tra bố cục, không phải mã QR ngân hàng có thể quét. |
| Phát hành | Lưu nháp rồi xác nhận phát hành phiếu `TS-202610-001`. Có nhãn dữ liệu đã lưu tại thời điểm phát hành. |
| Thanh toán từng phần | Ghi nhận 100.000đ ngày 01/10/2026: trạng thái “Thanh toán một phần”, đã thu 100.000đ, còn 140.000đ. Tải lại vẫn giữ khoản thanh toán. |
| Thống kê | Sau khi tải lại, thống kê học sinh ghi 225.000đ học phí phát sinh, 100.000đ thực nhận; bảng công nợ ghi 140.000đ. Phụ thu/giảm trừ thuộc hóa đơn, không làm thay đổi tiền phát sinh từ buổi học. |
| Xuất PNG | Tạo và giải mã thành công bitmap 1520 × 3550 px, khoảng 537,2 KB; có tám đoạn nhận xét tiếng Việt, ảnh thanh toán nguyên tỷ lệ, toàn bộ chân trang. Không có nút điều khiển trong ảnh. |
| Responsive | Đã xem Tổng quan, lịch 30 ngày, biểu mẫu lịch, hồ sơ học sinh và PNG ở 375 × 812 px; trang không tràn ngang. Biểu mẫu cuộn được và có thanh điều hướng dưới. Máy tính kiểm tra ở 1440 × 1000 px. |
| Nhập sao lưu | Chọn JSON mẫu hợp lệ: mở bước xác nhận với đúng 6 học sinh, 166 buổi và 25 hóa đơn; chọn Quay lại giữ nguyên dữ liệu hiện tại. Tệp thiếu schema bị từ chối trước bước khôi phục. |

Trình duyệt nhúng không trả về tệp khi theo dõi sự kiện download của liên kết blob. Việc tạo và hiển thị PNG thực tế đã được xác nhận bằng ảnh đã giải mã và kích thước tự nhiên; việc lưu file vào thư mục Downloads cần kiểm tra thêm bằng Chrome/Safari thông thường. Màn hình PNG có liên kết tải, mở ảnh và hướng dẫn nhấn giữ ảnh trên điện thoại.

Các ảnh minh chứng nằm cạnh thư mục source trong gói bàn giao: `tutorspace-desktop.jpg`, `tutorspace-mobile.jpg`, `tutorspace-mobile-invoice.jpg`.

## Kiểm tra tiếp trên tài khoản chính thức

1. Chạy đúng migration theo [SUPABASE.md](SUPABASE.md): dự án mới chạy 001 rồi 002, dự án đã có 001 chỉ chạy 002. Không thêm UUID vào `workspace_owner` nữa. Nếu nâng cấp dự án cũ, đăng nhập tài khoản cũ và đối chiếu toàn bộ dữ liệu trước khi nhập thêm.
2. Bật đăng ký, Email và xác nhận email; cấu hình Custom SMTP cùng Site URL/Redirect URLs. Đăng ký một email ngoài nhóm quản trị Supabase, kiểm tra email xác nhận, gửi lại xác nhận và đăng nhập. Kho mới phải trống. Thêm học sinh/buổi học, tải lại và đối chiếu lưu cloud.
3. Tạo tài khoản thứ hai trên trình duyệt khác hoặc cửa sổ riêng tư. Mỗi tài khoản chỉ thấy học sinh, lịch, hóa đơn và cài đặt của mình. Chuyển tài khoản trên cùng trình duyệt không được hiển thị dữ liệu của tài khoản vừa đăng xuất.
4. Yêu cầu đặt lại mật khẩu, mở email về `/reset-password`, đặt mật khẩu mới rồi đăng nhập. Thử liên kết hết hạn/đã dùng; giao diện phải báo lỗi và cho yêu cầu email mới.
5. Upload QR thật của bạn; phát hành phiếu; thay QR hiện tại và đơn giá học sinh. Phiếu cũ phải giữ ảnh, đơn giá và thông tin trước đó.
6. Dùng hai tab cùng tài khoản và phiên bản: lưu ở tab thứ nhất rồi thử lưu ở tab còn lại. Tab còn lại phải từ chối ghi đè, tải dữ liệu mới và yêu cầu thao tác lại. Tài khoản thứ hai có phiên bản độc lập.
7. Kiểm tra tài khoản B không đọc được hàng hoặc ảnh của A; `workspace_load` chỉ trả kho B và `workspace_save` không sửa kho A. Khách chưa đăng nhập không truy cập được dữ liệu.
8. Trên Chrome desktop và Safari iPhone, tải PNG rồi mở file lưu được; đối chiếu dấu tiếng Việt, mọi dòng nhận xét và ảnh QR. Kiểm tra thông báo khi ứng dụng đang mở và được cấp quyền.
9. Xuất JSON, thử nhập tệp sai định dạng để xem từ chối. Nhập tệp hợp lệ, kiểm tra số lượng trong bước xác nhận rồi khôi phục trên kho thử riêng. Tải lại và đối chiếu toàn bộ dữ liệu. Kho tài khoản khác phải giữ nguyên.
10. Triển khai Vercel với hai biến môi trường; kiểm tra đường dẫn trực tiếp `/students`, `/calendar`, `/invoices`, `/reset-password` và đăng nhập trên HTTPS.

Email xác nhận, SMTP, phiên đăng nhập từ liên kết email, đặt lại mật khẩu và phân quyền trên Supabase/Vercel thật cần được thực hiện theo danh sách trên. Kết quả PGlite không chứng minh email đã được gửi hoặc dự án cloud đã cấu hình đúng.

## Các sửa lỗi từ kiểm tra

- Trường ngày/giờ xử lý cả sự kiện nhập và thay đổi, tránh chỉ đổi giá trị hiển thị mà dữ liệu biểu mẫu không cập nhật.
- Khi sửa giờ cả chuỗi, giữ nguyên những ngày đã có buổi hoàn thành hoặc đã lên hóa đơn; không sinh buổi mới trùng ngày lịch sử.
- Upload avatar/QR là nút có thể dùng bằng bàn phím, cho phép chọn lại cùng tệp.
- Lịch nhỏ tính đủ bốn, năm hoặc sáu tuần theo tháng.
- Xuất PNG chờ font, ảnh được giải mã và toàn bộ chiều cao; có giới hạn chờ và thông báo lỗi; hiển thị bitmap trước khi tải.
- Ảnh cloud được gộp theo SHA-256, kiểm tra quyền/định dạng/kích thước và giữ nội dung ảnh của hóa đơn cũ.
