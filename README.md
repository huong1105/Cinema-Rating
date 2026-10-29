# CineRate API

## TL;DR

Ứng dụng backend REST API hỗ trợ quản lý, đánh giá và tìm kiếm phim. Người dùng tra cứu danh mục phim theo thể loại, xem thông tin chi tiết, chấm điểm định lượng (1–10 sao), viết bài nhận xét cảm nhận và lưu trữ danh sách xem sau (Watchlist) cho riêng mình.

Backend sử dụng **Node.js (v20+), Express 4, Prisma ORM, SQLite, JWT và Docker**.

![Sơ đồ kiến trúc phân tầng của CineRate](./docs/images/architecture-layers.svg)

---

## Chức năng chính

- **Tài khoản & Xác thực:** Đăng ký, mã hóa mật khẩu an toàn bằng `bcryptjs`, đăng nhập cấp mã JSON Web Token (JWT) không trạng thái (stateless), xem và cập nhật thông tin hồ sơ cá nhân (`profile`).
- **Phim & Thể loại:** Tra cứu danh mục phim và thể loại; xem chi tiết từng bộ phim; thêm phim mới có kiểm duyệt nghiệp vụ (năm phát hành 1888 đến hiện tại + 10 năm, thể loại hợp lệ); xóa phim an toàn.
- **Chấm điểm:** Chấm hoặc sửa điểm phim thang điểm từ 1.0 đến 10.0; mỗi người dùng chỉ chấm đúng 1 điểm cho 1 phim; tính điểm trung bình cộng và tổng số lượt đánh giá; xem lại lịch sử chấm điểm.
- **Nhận xét & Bình luận:** Viết bài cảm nhận dạng văn bản; đọc bình luận của cộng đồng; cơ chế phân quyền nghiêm ngặt đảm bảo chỉ tác giả bài viết mới có quyền xóa nhận xét của mình.
- **Danh sách xem sau:** Thêm các bộ phim yêu thích vào danh sách xem sau cá nhân; tự động chặn lưu trùng lặp nhờ ràng buộc cơ sở dữ liệu; gỡ phim khỏi danh sách khi đã xem xong.
- **Kiến trúc phân tầng & Bảo mật:** Áp dụng mô hình **3-Layer Architecture** kết hợp Dependency Injection thủ công; bảo vệ endpoint qua Middleware xác thực JWT tập trung tại tầng Route.

---

## Luồng sử dụng (User Flow)

1. **Đăng ký và đăng nhập:** Người dùng tạo tài khoản mới hoặc đăng nhập bằng tài khoản mẫu có sẵn (`testuser / 123456`) để nhận chuỗi `Bearer Token`.
2. **Khám phá kho phim:** Xem danh sách toàn bộ các bộ phim công khai kèm thể loại (`GET /api/movies`), lọc theo thể loại (`GET /api/genres`), xem chi tiết nội dung, đạo diễn và năm phát hành (`GET /api/movies/:id`).
3. **Chấm điểm & Bình luận:** Đăng nhập để cho điểm phim từ 1–10 (`POST /api/movies/:id/ratings`), xem điểm trung bình cộng đồng (`GET /api/movies/:id/ratings/summary`) và viết bài cảm nhận nhận xét (`POST /api/movies/:id/reviews`).
4. **Lưu danh sách xem sau (Watchlist):** Thêm phim muốn xem vào danh sách cá nhân (`POST /api/watchlist`), xem lại danh sách (`GET /api/watchlist`) và bỏ phim khỏi danh sách khi đã xem xong.
5. **Quản trị phim:** Người dùng đã xác thực có thể thêm phim mới vào hệ sinh thái kèm kiểm tra chặt chẽ hoặc xóa phim lỗi thời (dữ liệu đánh giá liên quan sẽ được tự động dọn sạch).

---

## Chạy nhanh (Quick Start)

### Yêu cầu môi trường
- **Cách 1:** Cần [Docker](https://www.docker.com/) và Docker Compose.
- **Cách 2 :** Yêu cầu **Node.js ≥ 20** và npm.

---

### Cách 1: Chạy bằng Docker Compose

```bash
# 1. Sao chép biến môi trường
cp .env.example .env

# 2. Khởi động ứng dụng cùng database trong container
docker compose up --build -d

# 3. Theo dõi log hoạt động
docker compose logs -f cinerate-api
```
> Dừng hệ thống khi kết thúc: `docker compose down` (thêm `-v` nếu muốn xóa trắng dữ liệu database).

---

### Cách 2: Chạy trực tiếp trên máy cục bộ

```bash
# 1. Cài đặt các thư viện phụ thuộc
npm ci

# 2. Thiết lập cấu hình môi trường
cp .env.example .env

# 3. Khởi tạo Prisma Client và chạy migration database
npm run db:generate
npm run db:migrate

# 4. Nạp sẵn dữ liệu mẫu (Seed 11 thể loại, 5 phim kinh điển và user mẫu)
npm run db:seed

# 5. Khởi động server
npm start
# hoặc chạy chế độ phát triển tự reload: npm run dev
```

Server sẽ lắng nghe tại: **`http://localhost:3000`**.  
Giao diện tài liệu Swagger UI tại: **`http://localhost:3000/api-docs/`**.

> **Tài khoản kiểm thử mẫu đã seed sẵn:**
> - **Username:** `testuser`
> - **Password:** `123456`

---

## Kiểm thử tải trên Kaggle CPU

Xem [báo cáo kiểm thử tải](./docs/03_kaggle_cpu_load.md) và [các cell notebook Kaggle](./docs/03_kaggle_cpu_load.md#kaggle-cpu-notebook). Notebook chạy trên Kaggle CPU; bật Internet và push code backend lên GitHub trước khi chạy.
