# CineRate — Tổng quan dự án

CineRate là backend REST API cho nền tảng cộng đồng đánh giá phim. Pha 1 triển khai nghiệp vụ cốt lõi, thiết lập kiến trúc nền tảng và ghi nhận baseline hiệu năng để các nhóm khác có thể so sánh các cải tiến tiếp theo.

## Chức năng

- Đăng ký, đăng nhập và quản lý hồ sơ người dùng.
- Tra cứu phim và thể loại; người dùng đã đăng nhập có thể thêm hoặc xóa phim.
- Chấm điểm phim theo thang 1–10 và xem điểm tổng hợp.
- Viết nhận xét; chỉ tác giả mới được xóa nhận xét của mình.
- Quản lý watchlist cá nhân.
- Xác thực endpoint riêng tư bằng JWT Bearer token.

Mỗi người dùng có tối đa một rating và một mục watchlist cho mỗi phim.

## Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Runtime | Node.js 20.19+ |
| HTTP framework | Express 4 |
| ORM | Prisma 6 |
| Cơ sở dữ liệu | SQLite |
| Xác thực | JWT, bcryptjs |
| Tài liệu API | OpenAPI 3.0.3, Swagger UI |
| Container | Docker, Docker Compose |
| Unit/integration tests | Jest |
| Đo tải | Autocannon |

## Phạm vi Pha 1

Dự án là baseline để tiếp tục đánh giá khả năng mở rộng. SQLite hiện giới hạn khả năng ghi đồng thời; hệ thống chưa có cache hoặc tầng validation schema riêng. Kết quả đo và các hướng cải tiến được trình bày trong [03_kaggle_cpu_load.md](./03_kaggle_cpu_load.md).

## Tài liệu liên quan

- Cài đặt và cấu hình: [01_installation-setup.md](./01_installation-setup.md)
- Kiến trúc và mô hình dữ liệu: [02_architecture-convention.md](./02_architecture-convention.md)
- Baseline hiệu năng và đề xuất cải tiến: [03_kaggle_cpu_load.md](./03_kaggle_cpu_load.md)
- API: [04_api-reference.md](./04_api-reference.md)
- Docker và triển khai: [05_deployment.md](./05_deployment.md)
