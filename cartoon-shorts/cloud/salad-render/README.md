# Render Remotion trên SaladCloud: đã thử, KHÔNG dùng được (2026-11-11)

Kết luận: máy Salad không vẽ WebGL bằng GPU được, nên không render được tập phim ở tốc độ dùng được. Render cuối vẫn phải
chạy trên Modal (`scripts/render/render-cloud.sh`) hoặc trên máy (`scripts/render/render.sh`).

## Bằng chứng (đo trên một máy Salad RTX 4090, 32 nhân, 62 GB RAM)
- Container chạy trong WSL2 trên máy Windows của người cho thuê (`uname -r`: `...-microsoft-standard-WSL2`). GPU chỉ vào
  container qua `/dev/dxg` với thư viện CUDA (`libcuda`, `libnvidia-ml`, `libnvidia-encode`). Không có `libEGL_nvidia`,
  `libGLX_nvidia`, Vulkan ICD của NVIDIA, cũng không có `libd3d12.so` (thứ Mesa cần để vẽ GL qua D3D12).
- Chrome Headless Shell của Remotion báo WebGL renderer ở mọi chế độ đều là bộ vẽ bằng CPU:
  - `--use-gl=angle`, `swangle`, `egl`: `SwiftShader Device (Subzero)`
  - `--use-angle=gl-egl`, `--use-angle=vulkan`: `llvmpipe (LLVM 15.0.6)`
  - ép Mesa `GALLIUM_DRIVER=d3d12`: vẫn `SwiftShader`
- Render 20 khung của `CayGaoShort` ở 2K (3 tab): không chế độ nào xong trong 200 giây. `angle` ra khung đầu tiên sau 115
  giây; `egl`, `angle-egl`, `swangle` hết 120 giây chưa có khung nào; `vulkan` làm Chrome sập. Tức dưới 0,1 khung/giây một
  máy, trong khi Modal A10G đạt khoảng 3,5 khung/giây.

Salad vì thế chỉ hợp với việc tính bằng CUDA (tạo ảnh, tạo video AI: `scripts/cloud/salad.py`), không hợp với việc vẽ 3D trong
trình duyệt.

## File ở đây (giữ lại để khỏi phải dò lại nếu Salad đổi hạ tầng)
- `agent.py`, `boot.sh`: container `node:22-bookworm` nhận lệnh shell qua hàng đợi job của Salad, không cần build image.
- `setup.sh`: cài thư viện cho Chrome và `@remotion/renderer` 4.0.290 trong container (mất khoảng 30 giây).
- `../../scripts/cloud/salad_render.py`: `up`, `setup`, `sh '<lệnh>'`, `down` để thử lại. Nhóm máy và hàng đợi `render` đã bị xoá.

Hai điều học được về Salad: kho S4 trả 403 cho User-Agent mặc định của Python (phải đặt User-Agent khác), và lệnh khởi động
container có thể sửa bằng PATCH mà không cần tạo lại nhóm.
