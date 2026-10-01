# Kết quả kiểm thử TutorSpace

Ngày kiểm tra: 01/10/2026. Môi trường: Windows, Node.js 24.19.0, trình duyệt Chromium nhúng, bản dựng production Vite. Chưa dùng dự án Supabase/Vercel thật hoặc thiết bị iPhone thật.

## Kiểm thử tự động

| Lệnh | Kết quả | Nội dung |
|---|---|---|
| `npm test` | 35/35 đạt, 4 tệp | Tiền học theo phút/buổi, làm tròn số nguyên VND, ngoại lệ tính phí, lịch tuần, ngày nhuận, xung đột, giữ lịch sử, hóa đơn, thanh toán, snapshot, dữ liệu sao lưu và gộp ảnh |
| `npm run test:db` | 18/18 nhóm đạt | Migration PostgreSQL, lưu/tải bảng chuẩn hóa, RLS, tài khoản chủ, khách và tài khoản khác, khóa phiên bản, tính trùng, thanh toán vượt tiền, rollback, ảnh riêng và snapshot QR |
| `npm run build` | Đạt | TypeScript và bản dựng production; output `dist/` |

Kiểm thử cơ sở dữ liệu sử dụng PGlite chạy PostgreSQL nhúng. Schema `auth`/`storage` và `auth.uid()` được mô phỏng rõ ràng trong chương trình kiểm tra; không kết nối hoặc sửa một dự án cloud. Các kiểm tra quyền dùng vai trò `anon`/`authenticated` và UUID chủ/tài khoản khác. Chúng không thay thế việc xác nhận cấu hình Supabase thật.

Bản dựng có cảnh báo chú thích tối ưu hóa từ Zod và dung lượng JavaScript khoảng 1 MB trước gzip (khoảng 302 KB sau gzip). Bản dựng hoàn thành, không có lỗi TypeScript. Thử trình duyệt dùng `npm run preview`; máy sandbox đã hạn chế đường dẫn khi trình tối ưu dependency của máy chủ `dev` quét ổ đĩa, nên chế độ `dev` chưa được xác nhận trong môi trường này.

## Những luồng đã thực hiện qua giao diện

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

1. Chạy migration, đặt UUID chủ, đăng nhập và thêm một học sinh/buổi học. Tải lại trang và đăng nhập trên trình duyệt thứ hai để kiểm tra lưu cloud.
2. Upload QR thật của bạn; phát hành phiếu; thay QR hiện tại và đơn giá học sinh. Phiếu cũ phải giữ ảnh, đơn giá và thông tin trước đó.
3. Dùng hai tab cùng phiên bản: lưu ở tab A rồi thử lưu ở tab B. Tab B phải từ chối ghi đè, tải dữ liệu mới và yêu cầu thao tác lại.
4. Kiểm tra tài khoản khác không đọc được bảng, RPC và ảnh của chủ.
5. Trên Chrome desktop và Safari iPhone, tải PNG rồi mở file lưu được; đối chiếu dấu tiếng Việt, mọi dòng nhận xét và ảnh QR. Kiểm tra thông báo khi ứng dụng đang mở và được cấp quyền.
6. Xuất JSON, thử nhập tệp sai định dạng để xem từ chối. Nhập tệp hợp lệ, kiểm tra số lượng trong bước xác nhận rồi khôi phục trên kho thử riêng. Tải lại và đối chiếu toàn bộ dữ liệu.
7. Triển khai Vercel với hai biến môi trường; kiểm tra đường dẫn trực tiếp `/students`, `/calendar`, `/invoices` và đăng nhập trên HTTPS.

## Các sửa lỗi từ kiểm tra

- Trường ngày/giờ xử lý cả sự kiện nhập và thay đổi, tránh chỉ đổi giá trị hiển thị mà dữ liệu biểu mẫu không cập nhật.
- Khi sửa giờ cả chuỗi, giữ nguyên những ngày đã có buổi hoàn thành hoặc đã lên hóa đơn; không sinh buổi mới trùng ngày lịch sử.
- Upload avatar/QR là nút có thể dùng bằng bàn phím, cho phép chọn lại cùng tệp.
- Lịch nhỏ tính đủ bốn, năm hoặc sáu tuần theo tháng.
- Xuất PNG chờ font, ảnh được giải mã và toàn bộ chiều cao; có giới hạn chờ và thông báo lỗi; hiển thị bitmap trước khi tải.
- Ảnh cloud được gộp theo SHA-256, kiểm tra quyền/định dạng/kích thước và giữ nội dung ảnh của hóa đơn cũ.
