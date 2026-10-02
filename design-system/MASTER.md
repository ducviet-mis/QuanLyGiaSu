# TutorSpace — Design system

Ứng dụng công việc cá nhân, đặt lịch học và dữ liệu thực tế lên trước. Áp dụng ui-ux-pro-max: bố cục dashboard có mật độ vừa phải, biểu đồ có nhãn và bảng số liệu, form có label, phản hồi lưu và trạng thái lỗi.

- Màu chính: navy #111f33 và cyan #137e98; nền #f5f7fa, trắng #ffffff. Màu trạng thái luôn kèm chữ.
- Font: Be Vietnam Pro tự lưu cùng ứng dụng, hỗ trợ dấu tiếng Việt và xuất ảnh không phụ thuộc Google Fonts.
- Sidebar desktop 232px; mobile có 5 mục ở thanh dưới. Menu Thêm mở Thống kê, Cài đặt và Hướng dẫn; chuyển trang đưa nội dung về đầu.
- Khoảng cách theo thang 4/8px; panel 16px, controls 10px; bóng nhẹ. Không dùng glow hoặc gradient trang trí. Nút thao tác chính cao tối thiểu 44px, chữ nội dung 13–16px và nhãn phụ 11–12px.
- Tổng quan mobile theo thứ tự: Hôm nay → Sắp tới → Học phí cần theo dõi → Thống kê tháng → Biểu đồ → Lịch tháng. Desktop dùng lưới hai cột và hàng thống kê riêng.
- Lịch dạy mở dạng danh sách trên mobile và lưới 30 ngày trên desktop; lưu lựa chọn riêng theo nhóm thiết bị. Mobile thu gọn bộ lọc, luôn hiển thị bộ lọc đang áp dụng.
- Danh sách học sinh mobile mặc định dạng dòng gọn; lịch sử buổi học và hóa đơn trong hồ sơ dùng thẻ xếp dọc. Desktop giữ bảng để so sánh.
- Biểu mẫu học sinh, lịch dạy và nhật ký cảnh báo khi đóng thay đổi chưa lưu. Lỗi gắn với ô nhập và đưa focus tới ô đầu tiên; thanh Lưu bám dưới khi cuộn. Cài đặt hiển thị trạng thái lưu và cùng phạm vi lưu ở các nút.
- Focus rõ ràng, dialog quản lý focus qua Radix, thao tác chính bằng bàn phím, giảm chuyển động khi người dùng yêu cầu.
- Hóa đơn luôn nền trắng; nội dung dài tự xuống dòng; QR object-fit contain, không crop.
- Dữ liệu mẫu được ghi rõ và có thể xóa. Dữ liệu cloud phải đi qua đăng nhập chủ sở hữu.

Kết quả tìm kiếm của skill có phần gợi ý marketing không phù hợp với ứng dụng cá nhân, nên chỉ dùng phần style Data-Dense Dashboard và các nguyên tắc thao tác. Palette và typography theo đúng đặc tả người dùng.
