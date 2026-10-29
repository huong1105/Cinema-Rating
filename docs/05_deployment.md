# Docker và triển khai

## Build image

Dockerfile có ba stage: base, builder và runtime.

![Sơ đồ build Docker image và khởi chạy container](./images/deployment-flow.svg)

1. **Base:** Dùng `node:20-alpine` và cài `openssl`.
2. **Builder:** Sao chép package manifests và `prisma/`, chạy `npm ci` rồi `prisma generate`.
3. **Runtime:** Dùng lại base image, đặt `NODE_ENV=production`, sao chép `node_modules`, `prisma/`, `src/` và `docs/`. Tạo `/app/data` và khai báo cổng `3000`.

Builder cài cả devDependencies; runtime nhận thư mục `node_modules` này vì Prisma CLI được dùng để chạy migration lúc khởi động. Dockerfile không khai báo `USER` nên container chạy bằng user mặc định của image nền.

## Khởi chạy bằng Docker Compose

Tạo .env ở thư mục gốc và đặt JWT_SECRET. Sau đó build và chạy:

~~~bash
docker compose up --build -d
~~~

Kiểm tra trạng thái và log:

~~~bash
docker compose ps
docker compose logs -f cinerate-api
~~~

Dừng ứng dụng:

~~~bash
docker compose down
~~~

Service có tên `cinerate-api` và restart policy `unless-stopped`. Compose ánh xạ cổng máy host từ PORT (mặc định 3000) tới cổng 3000 trong container. Để đổi cổng host, đặt `PORT=3001` trong .env rồi truy cập http://localhost:3001.

## Database 

Compose cấu hình `DATABASE_URL=file:/app/data/prod.db` và mount named volume `sqlite-data` vào `/app/data`. Database được giữ lại khi container dừng hoặc được tạo lại.

`docker compose down` giữ volume. Lệnh `docker compose down -v` xóa volume cùng database được lưu trong đó.

Khi container khởi động, image chạy migration trước HTTP server:

~~~bash
sh -c "./node_modules/.bin/prisma migrate deploy && node src/server.js"
~~~

## Biến môi trường triển khai

| Biến | Local / mặc định | Docker Compose | Ghi chú |
|---|---|---|---|
| `PORT` | `3000` | Host dùng PORT; container dùng `3000` | Cổng HTTP |
| `NODE_ENV` | `development` | `production` | Chế độ chạy |
| `DATABASE_URL` | `file:./dev.db` trong .env.example | `file:/app/data/prod.db` | Database SQLite |
| `JWT_SECRET` | Placeholder trong .env.example | Bắt buộc đặt trước khi chạy | Nếu chạy trực tiếp mà thiếu biến, mã auth có fallback `cinerate-secret-key` |
| `JWT_EXPIRES_IN` | `7d` | `7d` | Thời hạn JWT |


Không đưa .env hoặc secret thật vào image hay repository.

## Xử lý sự cố

### Container không khởi động

Xác nhận .env có JWT_SECRET rồi xem log của service:

~~~bash
docker compose logs cinerate-api
~~~

Image chạy migration trước khi mở HTTP server. Nếu migration lỗi, kiểm tra database URL và quyền ghi vào volume.

### Cổng máy host đang được sử dụng

Đặt PORT=3001 trong .env rồi khởi động lại Compose. API vẫn lắng nghe cổng 3000 bên trong container; truy cập từ host qua http://localhost:3001.
