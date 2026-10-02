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

## Cho phép các buổi học trùng giờ — 02/10/2026

- `npm test`: 42/42 kiểm tra đạt; gồm tạo buổi cùng giờ, trùng một phần, lịch lặp cho học sinh khác, sửa cả chuỗi và giữ buổi lịch sử. Buổi giống hệt của cùng học sinh vẫn được bỏ qua để tránh tạo lại.
- `npm run build`: TypeScript và bản dựng production đạt.
- Qua giao diện production dùng IndexedDB thử riêng: tạo Nguyễn Minh Anh ngày 01/11/2026 lúc 18:00–19:30; tạo bốn buổi Chủ nhật cho Trần Gia Huy từ 01/11 đến 22/11 cùng khung giờ. Cả hai buổi ngày 01/11 đều được lưu và hiển thị.
- Sửa toàn bộ chuỗi của Trần Gia Huy thành 18:00–20:00, tải lại trang và đối chiếu ngày 01/11, 08/11: các buổi giữ giờ mới, buổi của Nguyễn Minh Anh giữ giờ cũ. Ảnh minh chứng: `outputs/tutorspace-overlapping-lessons.png` trong thư mục bàn giao.
- Không thay đổi SQL: schema hiện tại không cấm hai học sinh có buổi học trùng giờ. Kiểm tra giao diện này chưa chạy trên Supabase/Vercel thật.

## Phiếu học phí gọn — 02/10/2026

- Bản xem trước và PNG thay bảng từng buổi bằng số buổi, các ngày học theo thứ tự và đơn giá chung một lần khi các buổi có cùng giá, hình thức tính và không điều chỉnh thành tiền. Ngày có nhiều buổi được ghi rõ số buổi; học phí theo giờ có tổng thời lượng.
- Tổng tiền tiếp tục cộng thành tiền đã lưu của từng buổi, giữ phụ thu, giảm trừ, lý do điều chỉnh, nhận xét và thông tin thanh toán. Mức phí khác nhau hoặc buổi điều chỉnh không bị mô tả bằng một đơn giá chung sai.
- `npm test`: 42/42 đạt. `npm run build`: đạt. Bảy kiểm tra SSR tạm trên component thực đạt: chín buổi cùng giá, làm tròn học phí theo giờ từng buổi, giá/đơn vị khác nhau, điều chỉnh, ngày có nhiều buổi, ngày ngoài kỳ và bản nháp trống.
- Giao diện production trên IndexedDB thử riêng: mở phiếu mẫu có chín buổi tháng 9/2026, 150.000đ/buổi, tổng 1.350.000đ. Bản xem trước và PNG hiển thị đủ chín ngày trên một dòng; PNG đã giải mã thành công 1520 × 2728 px, khoảng 300,1 KB, có nhận xét, ảnh thanh toán thử tỷ lệ 2:3 và toàn bộ chân trang. Ảnh đối chiếu: `outputs/tutorspace-compact-invoice.png` và `outputs/tutorspace-compact-invoice-footer.png` trong thư mục bàn giao.
- Trình duyệt nhúng chưa xác nhận lưu file PNG vào Downloads; ảnh được tạo và hiển thị đầy đủ. Kích thước trang thực tế vẫn 1280 px sau yêu cầu đổi viewport nên lần này không ghi nhận kiểm tra điện thoại mới. Không thay đổi dữ liệu, SQL hay dự án Supabase/Vercel thật.

## Tải ảnh học phí trên điện thoại — 02/10/2026

- Danh sách phiếu điện thoại có nút Tải ảnh trực tiếp; màn hình phiếu có nút Tải ảnh trong phần thao tác dưới. Yêu cầu trực tiếp chờ bản xem trước thực sự gắn vào DOM trước khi tạo PNG.
- Màn hình ảnh đặt nút Tải ảnh về máy và Lưu / chia sẻ ảnh (khi hỗ trợ chia sẻ tệp) trước ảnh, giữ chúng khi cuộn. Ảnh có thể nhấn giữ để lưu. PNG được giữ thành File ngay khi tạo; bảng chia sẻ được gọi trực tiếp từ lần bấm, không chờ tạo hoặc tải ảnh thêm.
- Kiểm tra bố cục production trong iframe cùng nguồn có vùng nội dung 375 × 812 px: bấm Tải ảnh trên phiếu mẫu chín buổi đã tạo PNG 1520 × 2728 px, khoảng 300,1 KB và mở đúng màn hình lưu. Nút tải rộng 292 px, cao 48 px; tên tệp download là `HocPhi_Hocsinhmau_9_2026.png`; ảnh hiển thị rộng 274 px. Minh chứng: `outputs/tutorspace-mobile-download.png` trong thư mục bàn giao.
- `npm test`: 47/47 đạt, 6 tệp, gồm năm kiểm tra mới về chia sẻ File đã sẵn sàng, trình duyệt không hỗ trợ, lỗi kiểm tra khả năng, người dùng hủy và lỗi chia sẻ thực sự. `npm run build`: đạt sau sửa thời điểm bản xem trước và bảo vệ yêu cầu xuất ảnh. Đóng phiếu hoặc rời trang làm kết quả xuất cũ bị bỏ qua và giải phóng URL; không mở lại ảnh sau khi người dùng đã đóng.
- Đây là kiểm tra bố cục điện thoại trên Chromium; bấm liên kết tải trong trình duyệt nhúng không ghi nhận sự kiện download. Bảng chia sẻ hệ điều hành, lưu vào Photos/Downloads và nhấn giữ ảnh cần xác nhận thêm trên Safari iPhone/Chrome Android thật. Không tự động gửi ảnh tới một người nhận hoặc dịch vụ; người dùng chọn nơi lưu/gửi trong bảng chia sẻ. Không thay đổi SQL.

## Logo web và PWA — 02/10/2026

- Mẫu PNG do người dùng cung cấp có nền ô caro ghép sẵn. Biểu tượng sách/chữ T được dựng thành các đường SVG phẳng theo hình mẫu, dùng teal `#137e98`, nền trong suốt bên ngoài tile; chữ TutorSpace dùng font hiện có và đổi màu theo ngữ cảnh sáng/tối.
- Sidebar, trang đăng nhập/đăng ký, màn hình tải và topbar mobile dùng chung BrandLogo. Favicon SVG/PNG, thông báo PNG 192 px, manifest PNG 192/512 px, icon maskable 512 px và Apple Touch Icon 180 px đều dùng biểu tượng mới. Vercel loại đường dẫn `brand/` khỏi rewrite SPA để trả đúng file hình ảnh.
- `npm test`: 49/49 đạt, 7 tệp. Hai kiểm tra mới xác nhận chữ ký PNG, kích thước manifest/Apple/favicon, file tham chiếu tồn tại và route ảnh không bị trả về HTML; các route trang vẫn dùng rewrite. `npm run build`: đạt.
- Kiểm tra giao diện production trên Chromium: sidebar 35 px; iframe điện thoại rộng 375 px (vùng nội dung 360 px sau thanh cuộn) không có tràn ngang; topbar 32 px, logo đăng nhập 35/48 px, mọi ảnh tải thành công. Chuyển sáng/tối trong kho mẫu và trả lại sáng; logo rõ ở cả hai chế độ. Trang đăng nhập được kiểm tra bằng component thực với callback giả lập riêng, không gọi Supabase.
- Minh chứng nằm trong thư mục bàn giao: `outputs/tutorspace-logo-desktop.png`, `outputs/tutorspace-logo-mobile.png`, `outputs/tutorspace-logo-dark.png`. Chưa kiểm tra cài PWA hoặc tốc độ cập nhật icon trên thiết bị thật; icon của lối tắt đã cài có thể cần thêm lại sau deploy. Không thay đổi SQL hay dữ liệu cloud.

## Học phí chỉ tính buổi đã học — 02/10/2026

- Thay quy tắc ngoại lệ cũ bằng điều kiện chung `status === 'completed' && billable !== false`. Buổi học sinh nghỉ, gia sư nghỉ, hủy, đã lên lịch hoặc dời lịch luôn tính 0đ dù dữ liệu cũ có `billable: true`. Buổi hoàn thành vẫn có thể miễn phí bằng `billable: false`.
- Tổng quan, thống kê từng học sinh, biểu đồ tháng, CSV, hồ sơ học sinh và chi tiết lịch dùng cùng phép tính; tổng hợp hóa đơn và kiểm tra phát hành dùng cùng điều kiện đủ học phí. Đổi nhãn/hướng dẫn để lựa chọn tính phí chỉ áp dụng khi hoàn thành.
- `npm test`: 76/76 đạt, 7 tệp. Bao phủ ba buổi hoàn thành × 150.000đ và một buổi nghỉ từng được chọn tính phí: tổng 450.000đ, 3 buổi, 6 giờ; lịch tháng sau chưa học tính 0đ. Bao phủ cả năm trạng thái chưa hoàn thành với ba giá trị billable; chuyển sang hoàn thành mới tính tiền; miễn phí buổi hoàn thành trở lại 0đ.
- Kiểm tra hóa đơn bao phủ loại buổi nghỉ/chưa học khi tổng hợp, chặn phát hành bản nháp lỗi thời và lọc lại khi điều chỉnh; hóa đơn đã phát hành giữ snapshot và số tiền lịch sử. Bản nháp cũ cần chọn Tổng hợp lại trước khi phát hành. `npm run build`: đạt; `git diff --check`: đạt.
- Dữ liệu kiểm thử riêng gồm bốn học sinh với 9/9/3/3 buổi hoàn thành, hai buổi nghỉ và chín buổi lên lịch chưa hoàn thành. Luồng nhập dữ liệu qua giao diện bị ngắt trước xác nhận khôi phục, nên lần này không ghi nhận minh chứng giao diện mới. Không sửa dữ liệu hoặc hóa đơn trên Supabase thật; không cần SQL mới.
