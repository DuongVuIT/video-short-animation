# engine: phần dùng chung của mọi tập

Các tập trong `src/videos/<tập>/` không còn chép lại những file này. Mỗi tập chỉ giữ một file hai dòng cùng tên
(`export * from "../../engine/<tên>"`), nên code của tập vẫn `import ... from "./toon"` như cũ.

| File | Chứa gì |
|---|---|
| `toon.ts` | Vẽ nhân vật 2D (đầu, mặt, thân, tay chân, mũ, đạo cụ cầm tay), các bộ trang phục, hiệu ứng 2D |
| `paint.ts` | Texture vẽ tay: tường, mái, gỗ, đất, nước, mây |
| `build.ts` | Khối dựng cảnh: gộp lưới theo vật liệu, cây, ống thuôn, đạo cụ Kenney, kiểm tra che ống kính |
| `lights.ts` | Bộ ánh sáng: day, golden, dusk, night, morning, memory, lamp, storm |
| `grade.ts` | Chỉnh màu theo từng bộ ánh sáng |
| `shade.ts`, `cardshade.ts` | Tô hai tông cho thế giới 3D và cho thẻ nhân vật |
| `ink.ts`, `lensblur.ts` | Nét mực, xoá phông và hạt phim |

`API.md` liệt kê mọi hàm, kiểu và tham số (tự sinh). **Viết tập mới thì đọc `API.md`, không cần mở các file nguồn.**

## Tập mới

1. Chép thư mục tập gần nhất: `cp -R src/videos/caygao src/videos/<tập>`, đổi tên `CayGao.tsx`, đăng ký trong `src/Root.tsx`.
2. Viết phần riêng của tập: `story.ts` (phân cảnh, máy quay, mốc chữ), `cast.ts` (ai làm gì trong từng shot),
   `village.ts` (bối cảnh), `world.ts` (ghép cảnh, ánh sáng theo shot).
3. Thứ gì chỉ tập này dùng (trang phục, hiệu ứng, texture, bộ ánh sáng chỉnh riêng) viết ngay trong file hai dòng của tập,
   bên dưới dòng `export *`. Ví dụ: `src/videos/mada/lights.ts` giữ ánh trăng riêng của Ma da.
4. Thứ dùng lại được cho các tập sau thì đưa vào `src/engine/`, chỉ **thêm** tuỳ chọn mới, không đổi kết quả mặc định.

## Sau khi sửa engine

```bash
scripts/qa/engine-check.sh
```

Lệnh này render 12 khung của mỗi tập đã xong và so từng byte với bản lưu trong `backup/engine-baseline/` (khoảng 2 phút,
không cần ai nhìn ảnh). Khác một khung là báo lỗi. Nếu thay đổi là cố ý: `scripts/qa/engine-check.sh save`.
Tập mới xong thì thêm một dòng vào `EPISODES` trong script rồi chạy `save`.

```bash
python3 scripts/engine_index.py
```

Lệnh này sinh lại `API.md`.

## Lưu ý

- `bridge` giữ `toon.ts` riêng (bản vẽ nhân vật đời đầu): dùng bản engine thì 4/12 khung kiểm tra đổi hình.
- Tập có mặt đất không ở độ cao 0 và dùng `house()` / `buildTown()` phải gọi `setGround(y)` lúc dựng cảnh (xem `bridge/world.ts`).
- Engine giữ cache vật liệu và texture theo tên. Trong Remotion Studio, đổi sang tập khác thì tải lại trang.
