# Cài đặt và cấu hình

## Yêu cầu

- Node.js 20.19+ và npm.
- Docker Desktop hoặc Docker Engine cùng Docker Compose nếu chạy bằng container.

## Chạy cục bộ

1. Cài dependencies:

   ~~~bash
   npm ci
   ~~~

2. Tạo tệp môi trường:

   ~~~bash
   cp .env.example .env
   ~~~

   Trên Windows PowerShell:

   ~~~powershell
   Copy-Item .env.example .env
   ~~~

3. Mở .env, đặt JWT_SECRET thành một secret riêng, đủ ngẫu nhiên. Các giá trị còn lại có thể điều chỉnh theo môi trường:

   | Biến | Giá trị mẫu | Mô tả |
   |---|---|---|
   | `PORT` | `3000` | Cổng HTTP server |
   | `NODE_ENV` | `development` | Chế độ chạy |
   | `DATABASE_URL` | `file:./dev.db` | Đường dẫn SQLite; Prisma tạo database trong thư mục `prisma/` |
   | `JWT_SECRET` | `change-me-to-a-strong-random-string` | Secret dùng để ký và xác minh JWT |
   | `JWT_EXPIRES_IN` | `7d` | Thời hạn JWT |
   | `BCRYPT_SALT_ROUNDS` | `10` | Có trong mẫu cấu hình; AuthService hiện truyền cố định 10 rounds cho bcrypt nên biến này chưa thay đổi cấu hình băm |

   Không commit .env hoặc secret thật. Nếu chạy trực tiếp mà thiếu JWT_SECRET, mã nguồn hiện có giá trị fallback; hãy đặt secret riêng trước khi dùng API.

4. Sinh Prisma Client, áp dụng migration và nạp dữ liệu mẫu:

   ~~~bash
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ~~~

5. Khởi động server phát triển:

   ~~~bash
   npm run dev
   ~~~

API chạy mặc định tại http://localhost:3000. Cách dùng API được mô tả trong [04_api-reference.md](./04_api-reference.md).

## Dữ liệu mẫu

`npm run db:seed` tạo 11 thể loại, 5 phim mẫu, một tài khoản test và dữ liệu rating, review, watchlist. Thông tin tài khoản mẫu là `testuser / 123456`; chỉ sử dụng trong môi trường phát triển.

## Npm scripts

| Lệnh | Mô tả |
|---|---|
| `npm start` | Khởi động API server |
| `npm run dev` | Khởi động server phát triển bằng Nodemon |
| `npm run db:generate` | Sinh Prisma Client |
| `npm run db:migrate` | Áp dụng migration ở môi trường phát triển |
| `npm run db:seed` | Nạp dữ liệu mẫu |
| `npm run db:studio` | Mở Prisma Studio |
| `npm test` | Chạy Jest với coverage |
| `npm run lint` | Chạy ESLint trên `src/` |
| `npm run test:load` | Chạy benchmark Autocannon |

## Gặp lỗi Prisma hoặc database

Nếu Prisma Client chưa được tạo hoặc database chưa có migration, chạy lại:

~~~bash
npm run db:generate
npm run db:migrate
~~~
