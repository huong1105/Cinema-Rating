# Quy ước kiến trúc

## Tổng quan

CineRate áp dụng kiến trúc ba tầng. Các dependency được khởi tạo và nối thủ công tại [`src/container.js`](../src/container.js).

![Sơ đồ kiến trúc phân tầng CineRate](./images/architecture-layers.svg)

### Presentation

Các Express routes chọn endpoint, middleware xác thực JWT, controllers tiếp nhận request và trả JSON response. Controller gọi service thay vì truy vấn database trực tiếp.

### Business logic

Services chứa quy tắc nghiệp vụ và nhận repositories qua constructor. Service không phụ thuộc Express hoặc Prisma. Riêng AuthService hiện đọc cấu hình JWT từ `process.env`.

### Data access

Repositories thực hiện truy vấn dữ liệu qua Prisma ORM. `src/container.js` tạo một PrismaClient dùng chung, inject vào repositories, rồi inject repositories vào services và controllers.

Kiểm tra dữ liệu nghiệp vụ nằm trong services. Hiện chưa có tầng schema validator riêng; [`src/utils/validate-id.js`](../src/utils/validate-id.js) kiểm tra ID.

## Luồng phụ thuộc

~~~text
HTTP request
    → Express route / authentication middleware
    → Controller
    → Service
    → Repository
    → Prisma Client
    → SQLite
~~~

Kết quả đi ngược từ database qua repository, service và controller thành HTTP response. Lỗi bất đồng bộ được chuyển đến error middleware.

## Mô hình dữ liệu

Database gồm bảy bảng:

![Sơ đồ quan hệ dữ liệu CineRate](./images/database-erd.svg)

| Bảng | Vai trò |
|---|---|
| `users` | Tài khoản người dùng |
| `movies` | Thông tin phim |
| `genres` | Danh mục thể loại |
| `movie_genres` | Quan hệ nhiều-nhiều giữa phim và thể loại |
| `reviews` | Nhận xét của người dùng về phim |
| `ratings` | Điểm đánh giá của người dùng cho phim |
| `watchlist` | Phim được người dùng lưu lại |

Quan hệ được cấu hình cascade delete. Các ràng buộc unique trên `(userId, movieId)` của `ratings` và `watchlist` đảm bảo mỗi người dùng chỉ có một rating và một mục watchlist cho mỗi phim.

## Các ranh giới hiện tại

- SQLite chỉ hỗ trợ một writer tại một thời điểm trên cùng database. Tác động dưới tải được phân tích trong [03_kaggle_cpu_load.md](./03_kaggle_cpu_load.md).
- Chưa có cache layer giữa service và repository.
- Chưa có tầng validation schema riêng.
