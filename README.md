# CineRate Backend

REST API đánh giá phim — quản lý phim, chấm điểm, nhận xét và danh sách xem sau.

**Tech stack:** Node.js · Express · Prisma · SQLite · JWT

## Kiến trúc

![Sơ đồ kiến trúc phân tầng của CineRate](./docs/images/architecture-layers.svg)

Phân tầng 3 lớp với dependency injection thủ công qua [`container.js`](./src/container.js). Tầng **Service** chỉ chứa logic nghiệp vụ thuần, không import Express hay Prisma. Tầng **Repository** nhận Prisma Client qua constructor.

## Cấu trúc thư mục

```
src/
├── controllers/      # Đọc request, gọi service, trả response
├── services/         # Nghiệp vụ thuần (không phụ thuộc framework)
├── repositories/     # Truy vấn database qua Prisma
├── routes/           # Khai báo endpoint và gắn middleware
├── middlewares/      # Auth (JWT), error handler
├── utils/            # AppError, catchAsync, validate ID
├── app.js            # Express app setup
├── container.js      # Dependency injection
└── server.js         # Entry point
prisma/
├── schema.prisma     # 7 bảng: users, movies, genres, movie_genres, ratings, reviews, watchlist
├── migrations/
└── seed.js
docs/
├── architecture.md   # Kiến trúc và benchmark
├── images/           # Sơ đồ kiến trúc dạng SVG
└── swagger.yaml      # OpenAPI 3.0 spec
tests/
├── unit/
├── integration/
└── kaggle/           # Load test script
```

## Bắt đầu

> Runtime yêu cầu Node.js ≥ 20. ESLint 10 dùng cho `npm run lint` yêu cầu Node.js `^20.19.0`, `^22.13.0` hoặc `>=24.0.0`; cần npm.

```bash
git clone <repo-url>
cd KTPM-architecture-solution
npm ci
cp .env.example .env        # sửa JWT_SECRET trước khi chạy
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Server chạy tại `http://localhost:3000`. Swagger UI tại `/api-docs/`.

> `npm run db:seed` chỉ dành cho môi trường phát triển/demo. Seed tạo tài khoản mẫu `testuser / 123456` và tạo thêm một review mỗi lần chạy.

## API

Đầy đủ tài liệu tại [Swagger UI](http://localhost:3000/api-docs/) hoặc file [`docs/swagger.yaml`](./docs/swagger.yaml).

| Method | Endpoint | Auth | Mô tả |
|--------|----------|:----:|-------|
| POST | `/api/auth/register` | | Đăng ký |
| POST | `/api/auth/login` | | Đăng nhập, nhận JWT |
| GET | `/api/auth/profile` | 🔒 | Xem profile |
| PUT | `/api/auth/profile` | 🔒 | Cập nhật profile |
| GET | `/api/movies` | | Danh sách phim |
| GET | `/api/movies/:id` | | Chi tiết phim |
| POST | `/api/movies` | 🔒 | Thêm phim |
| DELETE | `/api/movies/:id` | 🔒 | Xóa phim |
| GET | `/api/genres` | | Danh sách thể loại |
| POST | `/api/movies/:id/ratings` | 🔒 | Chấm / chấm lại điểm (1–10) |
| GET | `/api/movies/:id/ratings/summary` | | Điểm trung bình |
| GET | `/api/ratings/me` | 🔒 | Lịch sử chấm điểm của tôi |
| GET | `/api/movies/:id/reviews` | | Danh sách nhận xét |
| POST | `/api/movies/:id/reviews` | 🔒 | Viết nhận xét |
| DELETE | `/api/reviews/:id` | 🔒 | Xóa nhận xét (chỉ tác giả) |
| GET | `/api/watchlist` | 🔒 | Watchlist của tôi |
| POST | `/api/watchlist` | 🔒 | Thêm phim vào watchlist |
| DELETE | `/api/watchlist/:movieId` | 🔒 | Xóa khỏi watchlist |

🔒 = cần Bearer token trong header `Authorization`.

API có 18 endpoint. Load test đo thêm `/health`, nên tổng cộng có 19 route được benchmark.

## Docker

```bash
# Đặt JWT_SECRET trong .env hoặc environment trước
docker compose up --build -d
docker compose logs cinerate-api
docker compose down            # giữ volume; thêm -v để xóa data
```

## Testing

```bash
npm test                       # unit + integration (Jest)
npm run lint                   # ESLint trên src/
npm run test:load              # load test 19 endpoint
```

## Kiểm thử tải Kaggle

Script [`tests/kaggle/load-test.js`](./tests/kaggle/load-test.js) mặc định đo latency và throughput cho 18 API endpoint cùng `/health`. Chế độ `all` tạo fixture rồi dọn dữ liệu benchmark; hãy trỏ API và `DATABASE_URL` tới database riêng cho benchmark, không dùng database production.

| Biến | Mặc định | Ý nghĩa |
|------|----------|---------|
| `BASE_URL` | `http://localhost:3000` | URL server |
| `DATABASE_URL` | Không có | Bắt buộc ở chế độ `all`; database benchmark, phải khớp DB của API |
| `LOAD_TEST_PASSWORD` | Không có | Bắt buộc ở cả hai chế độ; mật khẩu fixture hoặc tài khoản test |
| `LOAD_TEST_USERNAME` | Không có | Bắt buộc ở chế độ `baseline`; tài khoản test có sẵn |
| `LOAD_TEST_MODE` | `all` | `all` đo 19 route; `baseline` chạy 3 kịch bản gốc |
| `LOAD_TEST_MOVIE_ID` | `1` | ID phim có sẵn dùng trong benchmark |
| `LOAD_TEST_DURATION` | `10` | Giây / endpoint |
| `LOAD_TEST_CONNECTIONS` | `10` | Client đồng thời / endpoint ở chế độ `all` |

`baseline` dùng `LOAD_TEST_USERNAME` và `LOAD_TEST_PASSWORD`; `all` dùng `DATABASE_URL` và `LOAD_TEST_PASSWORD`. Xem kết quả baseline trong phần [Benchmark](#benchmark).

## Benchmark

Kết quả baseline trên Kaggle CPU (Intel Xeon 2.20 GHz, 4 vCPU, 31 GB RAM), 10 connections × 10s / endpoint:

| Endpoint | RPS | Avg (ms) | p99 (ms) |
|----------|----:|--------:|---------:|
| `GET /health` | 2094 | 4.8 | 16.7 |
| `GET /api/movies` | 1201 | 8.3 | 18.5 |
| `GET /api/genres` | 1467 | 6.8 | 15.5 |
| `GET /api/movies/:id` | 1202 | 8.3 | 18.4 |
| `GET /api/movies/:id/ratings/summary` | 1030 | 9.7 | 19.7 |
| `GET /api/movies/:id/reviews` | 868 | 11.5 | 22.9 |
| `GET /api/ratings/me` | 570 | 17.5 | 26.8 |
| `GET /api/auth/profile` | 538 | 18.5 | 29.7 |
| `GET /api/watchlist` | 526 | 19.0 | 30.3 |
| `POST /api/movies/:id/ratings` | 76 | 129.3 | 1707.8 |
| `POST /api/movies` | 76 | 129.5 | 2325.9 |
| `POST /api/movies/:id/reviews` | 74 | 134.1 | 1830.6 |
| `POST /api/watchlist` | 31 | 147.8 | 1854.0 |
| `DELETE /api/movies/:id` | 32 | 151.4 | 1173.9 |
| `DELETE /api/watchlist/:movieId` | 32 | 147.7 | 2147.6 |
| `DELETE /api/reviews/:id` | 30 | 163.0 | 1477.3 |
| `POST /api/auth/login` | 10 | 982.5 | 1805.9 |
| `POST /api/auth/register` | 10 | 1016.1 | 1649.0 |
| `PUT /api/auth/profile` | 64 | 154.6 | 1778.9 |

**Tổng: ~99.5K requests trong 193s, ~515 req/s gộp.**

## License

MIT
