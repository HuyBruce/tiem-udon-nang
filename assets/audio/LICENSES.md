# Nguồn và giấy phép âm thanh — GĐ-W H

Kiểm tra nguồn ngày 11/10/2026. Không dùng âm thanh từ Little Corner Tea House.

| Nguồn | Tác giả / giấy phép | File nguồn dùng | Cách sử dụng |
| --- | --- | --- | --- |
| [General Household Sound Effects](https://opengameart.org/content/general-household-sound-effects) | bretbernhoft — [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `kitchensink01.wav`, `fryingpan01.wav`, `kitchencuttingboard01.wav`, `clangingglass01.wav`, `crunchingpapertowels01.wav`, `boilingwater02.wav` | Trích 6 giây, chuyển mono, cắt/trộn/chuẩn hóa để tạo foley bếp, nước và giấy. |
| [Interface Sounds](https://kenney.nl/assets/interface-sounds) | Kenney — CC0 1.0 | `Audio/click_001.ogg` trong gói chính thức | Ba tiếng nút đã biến đổi; runtime dùng WAV, không dùng OGG. |
| Âm tổng hợp gốc | Tiệm mì Udon — mã nguồn tạo âm trong project | `tools/audio/build-bank.mjs` | Các âm không có trường nguồn bản ghi, ba bản nhạc và môi trường. Không phải bản ghi tự nhiên; chất lượng cảm nhận chờ nghe thử. |

CC0 cho phép sao chép, thay đổi và dùng thương mại; nguồn được giữ trong tín dụng dù không bắt buộc ghi công. Không gán CC0 cho mã hoặc toàn bộ project. Metadata, URL tải trực tiếp và mô tả biến đổi: `data/audio-sources.json`; mỗi sự kiện/biến thể, byte và SHA256: `data/audio-events.json`. Cài đặt → Thông tin game hiển thị tín dụng.

## Dựng lại

Yêu cầu Node, PowerShell và ffmpeg có trong PATH. Từ gốc project:

```powershell
node tools/audio/fetch-sources.mjs
node tools/audio/build-bank.mjs
node tools/audio/review-spectra.mjs
```

Nguồn tải vào `test-results/audio-sources/` (không vào bundle); công cụ không xóa thư mục nguồn. `--only=pet` hoặc tên sự kiện khác chỉ dựng lại sự kiện đó. File runtime nằm trong `assets/audio/generated/`. Nhạc 16 giây dùng AAC 64kbps; hiệu ứng mono PCM16 22050Hz. Biến thể tổng hợp được gieo seed cố định; tải lại nguồn có thể thay đổi hash nếu nhà cung cấp thay nội dung.

Ngân sách là **6 MiB**, tính cả mẫu mở khóa im lặng. Kết quả chuẩn hóa/đỉnh đo trên file xuất bằng ffmpeg nằm ở `review/gdw/step2/audio-metrics.json`. Mẫu dưới 400ms không đủ cửa sổ loudness tích hợp: `-inf` ở cột LUFS không có nghĩa file im lặng; chúng dùng RMS đầu vào và limiter, kiểm thêm tín hiệu giải mã thật. Những mẫu bị giảm gain để giữ đỉnh không luôn đạt đúng -16 LUFS.
