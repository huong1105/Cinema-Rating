# Baseline hiệu năng Pha 1 — Kaggle CPU

## Môi trường và cấu hình

- **Phần cứng:** Intel Xeon 2.20 GHz, 4 vCPU, 31 GB RAM.
- **Runtime và database:** Node.js 20.19.0, SQLite.
- **Tải:** 10 client đồng thời, 10 giây cho mỗi endpoint.
- **Phạm vi:** 18 API endpoint cộng với `/health`, tổng cộng 19 route được đo.

## Kết quả theo endpoint

| Endpoint | RPS | Avg (ms) | p95 (ms) | p99 (ms) |
|---|---:|---:|---:|---:|
| `GET /health` | 2094 | 4.8 | 11.2 | 16.7 |
| `GET /api/genres` | 1467 | 6.8 | 12.5 | 15.5 |
| `GET /api/movies` | 1201 | 8.3 | 14.4 | 18.5 |
| `GET /api/movies/:id` | 1202 | 8.3 | 13.8 | 18.4 |
| `GET /api/movies/:id/ratings/summary` | 1030 | 9.7 | 15.2 | 19.7 |
| `GET /api/movies/:id/reviews` | 868 | 11.5 | 17.0 | 22.9 |
| `GET /api/ratings/me` | 570 | 17.5 | 21.7 | 26.8 |
| `GET /api/auth/profile` | 538 | 18.5 | 25.2 | 29.7 |
| `GET /api/watchlist` | 526 | 19.0 | 24.3 | 30.3 |
| `POST /api/movies/:id/ratings` | 76 | 129.3 | 222.7 | 1707.8 |
| `POST /api/movies` | 76 | 129.5 | 113.8 | 2325.9 |
| `POST /api/movies/:id/reviews` | 74 | 134.1 | 212.9 | 1830.6 |
| `PUT /api/auth/profile` | 64 | 154.6 | 148.3 | 1778.9 |
| `DELETE /api/movies/:id` | 32 | 151.4 | 583.1 | 1173.9 |
| `DELETE /api/watchlist/:movieId` | 32 | 147.7 | 547.3 | 2147.6 |
| `POST /api/watchlist` | 31 | 147.8 | 549.7 | 1854.0 |
| `DELETE /api/reviews/:id` | 30 | 163.0 | 748.6 | 1477.3 |
| `POST /api/auth/login` | 10 | 982.5 | 1585.3 | 1805.9 |
| `POST /api/auth/register` | 10 | 1016.1 | 1355.6 | 1649.0 |

Tổng cộng benchmark ghi nhận **99,478 request trong 193 giây**, tương đương khoảng **515 request/giây gộp**. Có ba request timeout dưới tải ghi đồng thời.

## Nhận xét

- GET đạt khoảng 526–2.094 RPS với latency trung bình dưới 20 ms.
- Các thao tác ghi đạt 10–76 RPS; p99 của nhiều thao tác ghi lên khoảng 1–2 giây.
- Auth (register/login) có độ trễ cao nhất, khoảng 10 RPS. Bcrypt nên được profiling thêm; các số liệu này chưa tự chứng minh Event Loop bị chặn.
- Mức chênh lệch đọc–ghi khoảng 10–60 lần. Kết quả phù hợp với giả thuyết SQLite lock contention, nhưng benchmark này chưa xác nhận đó là nguyên nhân duy nhất.
- Đây là baseline để so sánh trước và sau cải tiến Pha 2 trên cùng phần cứng và cấu hình.

## Hướng cải tiến Pha 2

### Tách luồng đọc và ghi

Các request đọc và ghi hiện đi qua cùng API process và SQLite database. SQLite chỉ cho phép một writer tại một thời điểm; writer đồng thời có thể phải chờ hoặc gặp lỗi lock/busy. Không nên giả định mọi request ghi đều tự xếp hàng tuần tự.

| Loại | RPS | Avg latency |
|---|---:|---:|
| GET endpoints | 526–2094 | 4–19 ms |
| Write endpoints | 10–76 | 129–1016 ms |

Có thể khảo sát CQRS để tách luồng query và command, hoặc bật SQLite WAL mode để giảm tương tranh giữa thao tác đọc và ghi. Cần benchmark lại để đo tác động.

![Sơ đồ CQRS tách đường đọc và ghi](./images/cqrs.svg)

### Thêm cache layer

Với workload đọc nhiều ghi ít, cache giữa service và repository có thể giảm truy vấn lặp lại. Mức cải thiện phụ thuộc tỷ lệ cache hit và chiến lược invalidation, cần đo lại bằng benchmark.

![Sơ đồ cache giữa service và repository](./images/cache-layer.svg)

Dữ liệu phù hợp để khảo sát cache gồm genres, danh sách phim và rating summary. Sau thao tác ghi cần chính sách invalidation như write-through hoặc invalidate-on-write.


## Kaggle CPU Notebook

Các cell bên dưới tạo một database riêng cho mỗi lần chạy, khởi tạo schema và dữ liệu mẫu, khởi chạy API cục bộ trong Kaggle rồi chạy tất cả endpoint benchmark.

Trước khi chạy, bật **Internet** trong phần Notebook options của Kaggle và push phiên bản backend cần đo lên GitHub. Chạy lần lượt ba cell sau.

### Cell 1 — Clone repository và kiểm tra Node.js

~~~python
!git clone --depth 1 https://github.com/huong1105/Cinema-Rating.git /kaggle/working/Cinema-Rating
!node --version
!npm --version
~~~

### Cell 2 — Cấu hình tài khoản benchmark

~~~python
import getpass
import os

os.environ["LOAD_TEST_USERNAME"] = "testuser"
os.environ["LOAD_TEST_PASSWORD"] = getpass.getpass("Nhập mật khẩu test: ")
~~~

### Cell 3 — Tạo database riêng, khởi chạy API và đo tải

~~~bash
%%bash
set -euo pipefail
cd /kaggle/working/Cinema-Rating
node --version
npm ci
export BENCH_RUN_ID="$(date +%s)-$$"
export DATABASE_PATH="/kaggle/working/cinerate-phase1-${BENCH_RUN_ID}.db"
export DATABASE_URL="file:${DATABASE_PATH}"
export NODE_ENV=production
export PORT=3000
export JWT_SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
test ! -e "$DATABASE_PATH" || {
  echo 'Database benchmark đã tồn tại. Chạy lại cell để tạo tên database mới.'
  exit 1
}
npm run db:generate
npx --no-install prisma migrate deploy
npm run db:seed
node src/server.js > "/kaggle/working/cinerate-server-${BENCH_RUN_ID}.log" 2>&1 &
task_server_pid=$!
trap 'kill "$task_server_pid" 2>/dev/null || true' EXIT
for task_attempt in $(seq 1 30); do
  if node -e "fetch('http://127.0.0.1:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"; then
    break
  fi
  sleep 1
done
export BASE_URL='http://127.0.0.1:3000'
export LOAD_TEST_MODE='all'
export LOAD_TEST_DURATION='10'
export LOAD_TEST_CONNECTIONS='10'
npm run test:load
~~~
