# API Reference

## Server và tài liệu

API local mặc định chạy tại http://localhost:3000.

- Swagger UI được cấu hình tại http://localhost:3000/api-docs/.
- Đặc tả OpenAPI 3.0.3 nằm trong [swagger.yaml](./swagger.yaml).
- Mức độ chi tiết request/response trong đặc tả hiện chưa đồng đều giữa các endpoint.
- Nếu Swagger UI không hiển thị, xem log khởi động và kiểm tra YAML. Ứng dụng sẽ tắt route /api-docs nếu không tải được đặc tả.

Có thể mở `swagger.yaml` trong một OpenAPI editor, hoặc import vào [Swagger Editor](https://editor.swagger.io/) để xem đặc tả.

## Xác thực

Các endpoint được bảo vệ yêu cầu header:

~~~http
Authorization: Bearer <token>
~~~

Token được cấp khi gọi `POST /api/auth/login`. Endpoint công khai không cần token.

## Endpoint

| Nhóm | Method | Endpoint | Auth |
|---|---|---|---|
| System | `GET` | `/health` | Không |
| Auth | `POST` | `/api/auth/register` | Không |
| Auth | `POST` | `/api/auth/login` | Không |
| Auth | `GET` | `/api/auth/profile` | Có |
| Auth | `PUT` | `/api/auth/profile` | Có |
| Movies | `GET` | `/api/movies` | Không |
| Movies | `GET` | `/api/movies/:id` | Không |
| Movies | `POST` | `/api/movies` | Có |
| Movies | `DELETE` | `/api/movies/:id` | Có |
| Genres | `GET` | `/api/genres` | Không |
| Ratings | `POST` | `/api/movies/:id/ratings` | Có |
| Ratings | `GET` | `/api/movies/:id/ratings/summary` | Không |
| Ratings | `GET` | `/api/ratings/me` | Có |
| Reviews | `GET` | `/api/movies/:id/reviews` | Không |
| Reviews | `POST` | `/api/movies/:id/reviews` | Có |
| Reviews | `DELETE` | `/api/reviews/:id` | Có, chỉ tác giả |
| Watchlist | `GET` | `/api/watchlist` | Có |
| Watchlist | `POST` | `/api/watchlist` | Có |
| Watchlist | `DELETE` | `/api/watchlist/:movieId` | Có |

Tổng cộng có 18 API endpoint nghiệp vụ và endpoint `/health`. Xem Swagger UI hoặc `swagger.yaml` để biết request body, tham số và response schema.

## Quy trình sử dụng điển hình

1. Đăng ký tài khoản qua `POST /api/auth/register`.
2. Đăng nhập qua `POST /api/auth/login` để nhận JWT.
3. Tra cứu phim và thể loại qua `GET /api/movies` và `GET /api/genres`.
4. Gửi JWT trong header `Authorization: Bearer <token>` để chấm điểm phim, viết review, cập nhật hồ sơ hoặc quản lý watchlist.
5. Xem dữ liệu cá nhân qua `GET /api/ratings/me` và `GET /api/watchlist`. Người dùng chỉ có thể xóa review do mình tạo.

Rating của cùng một người dùng và phim được cập nhật thay vì tạo bản ghi trùng.

## Health check

Gọi endpoint:

~~~bash
curl http://localhost:3000/health
~~~

Phản hồi thành công chứa `status: "ok"` cùng thông điệp và timestamp. Endpoint này xác nhận HTTP server đang phản hồi, nhưng không kiểm tra trạng thái database.
