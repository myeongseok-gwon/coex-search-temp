# 🗺️ Booth 위치 자동 추출 가이드

이 폴더에는 PDF 지도에서 booth ID와 위치를 자동으로 추출하는 스크립트들이 있습니다.

## 📋 개요

2025 푸드위크 코리아 부스 배치도 PDF에서 booth ID(A####, B####, S#### 형식)를 자동으로 인식하고, 각 booth의 정확한 좌표(x, y)를 추출하여 데이터베이스에 저장하는 자동화 시스템입니다.

## 🎯 추출 결과

### ✅ 성공적으로 추출
- **총 booth 수**: 420개
  - A홀: 206개
  - B홀: 193개  
  - S홀: 21개

### 📊 매칭 통계
- **JSONL과 매칭**: 340개 ✅
- **PDF에만 있음**: 80개 ⚠️
- **JSONL에만 있음**: 32개 ⚠️

> **Note**: JSONL에만 있는 booth는 PDF에 텍스트로 표기되지 않았거나 다른 형식으로 표기된 경우입니다. (예: G01~G12는 특별 부스)

## 🛠️ 사용 방법

### 1️⃣ 필수 패키지 설치

```bash
pip install PyMuPDF
```

Supabase에 자동 업로드하려면 추가로:
```bash
pip install supabase
```

### 2️⃣ 스크립트 실행

#### 테스트 실행 (PDF 분석만)
```bash
python3 1_test_pdf_extraction.py
```

#### 전체 실행 (추출 + 매칭 + 업로드)
```bash
python3 2_extract_and_upload_booths.py
```

#### PDF → PNG 변환
```bash
python3 3_convert_pdf_to_png.py
```

### 3️⃣ Supabase 설정 (선택사항)

자동 업로드를 원하면 환경 변수 설정:
```bash
export SUPABASE_URL='your-supabase-url'
export SUPABASE_KEY='your-supabase-anon-key'
```

환경 변수가 없으면 `extracted_booths_final.json` 파일로 저장됩니다.

## 📁 파일 설명

### 스크립트 파일

| 파일 | 설명 |
|------|------|
| `1_test_pdf_extraction.py` | PDF 텍스트 추출 테스트 |
| `2_extract_and_upload_booths.py` | 메인 추출 및 업로드 스크립트 |
| `3_convert_pdf_to_png.py` | PDF를 PNG 이미지로 변환 |

### 입력 파일

| 파일 | 설명 |
|------|------|
| `2025 푸드위크 코리아_A,B홀_부스배치도_memo.pdf` | 원본 부스 배치도 |
| `../public/foodweek_selected.jsonl` | 부스 데이터 (참조용) |

### 출력 파일

| 파일 | 설명 |
|------|------|
| `extracted_booths_test.json` | 테스트 추출 결과 |
| `extracted_booths_final.json` | 최종 추출 결과 (Supabase 업로드용) |
| `../public/2025_map.png` | 변환된 지도 이미지 |
| `../dist/2025_map.png` | 빌드용 지도 이미지 |

## 🗄️ 데이터베이스 스키마

booth_positions 테이블이 필요합니다:

```sql
CREATE TABLE IF NOT EXISTS booth_positions (
  booth_id VARCHAR(10) PRIMARY KEY,
  x REAL NOT NULL CHECK (x >= 0 AND x <= 1),
  y REAL NOT NULL CHECK (y >= 0 AND y <= 1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

스키마 생성은 `../create-booth-positions-table.sql` 파일을 실행하세요.

## 📤 Supabase 수동 업로드 방법

환경 변수 설정 없이 실행한 경우:

1. `extracted_booths_final.json` 파일 열기
2. Supabase Dashboard → booth_positions 테이블
3. **Insert** → **Insert from JSON** 선택
4. JSON 내용 복사/붙여넣기
5. **Insert** 클릭

## 🔍 매칭되지 않은 Booth 처리

### JSONL에만 있는 booth (32개)

이들은 수동으로 위치를 입력해야 합니다:
- 관리자 모드로 로그인
- 지도에서 해당 booth 위치 클릭
- 자동으로 저장됨

주요 항목:
- **G01 ~ G12**: 특별 부스 (별도 표기)
- **A2607, A4409, A4410** 등: PDF에서 누락되었거나 다른 형식

### PDF에만 있는 booth (80개)

- 전시에 참여하지 않는 booth
- 공간만 있고 업체 정보가 없는 booth
- 무시해도 됨

## 📈 작동 원리

### 1. PDF 텍스트 인식
- PyMuPDF를 사용하여 PDF에 임베디드된 텍스트 추출
- 정규식(`^[ABS]\d{4}$`)으로 booth ID 패턴 매칭
- 각 텍스트의 바운딩 박스 좌표 추출

### 2. 좌표 정규화
- PDF 페이지 크기: 1191 x 1304.4 points
- 이미지 크기: 4963 x 5435 pixels (300 DPI)
- 좌표를 0~1 사이로 정규화 (비율)
  ```python
  norm_x = center_x / page_width
  norm_y = center_y / page_height
  ```

### 3. 중복 제거
- 동일한 booth_id가 여러 번 나타나는 경우 첫 번째만 사용
- dict를 사용하여 자동 중복 제거

### 4. 매칭 검증
- JSONL 파일의 booth ID와 비교
- 매칭되지 않은 항목 리포트

## 🎨 프론트엔드 연동

`MapPage.tsx`가 자동으로 업데이트되었습니다:
- 이미지 경로: `/2024_map.png` → `/2025_map.png`
- booth_positions 테이블에서 좌표 로드
- 정규화된 좌표를 CSS percentage로 변환하여 마커 표시

## ⚠️ 주의사항

1. **PDF 품질**: PDF가 스캔본이 아닌 벡터 텍스트를 포함해야 합니다.
2. **좌표 정확도**: 자동 추출된 좌표는 텍스트 중심점 기준입니다.
3. **미세 조정**: 일부 booth는 관리자 모드에서 수동 조정이 필요할 수 있습니다.
4. **특수 booth**: G로 시작하는 booth는 별도 처리가 필요합니다.

## 🔧 문제 해결

### Q: "ModuleNotFoundError: No module named 'fitz'"
A: PyMuPDF 설치 필요
```bash
pip install PyMuPDF
```

### Q: Supabase 업로드가 안 돼요
A: 환경 변수 확인 또는 JSON 파일로 수동 업로드

### Q: 일부 booth가 매칭이 안 돼요
A: 정상입니다. JSONL에만 있는 booth는 수동 입력하세요.

### Q: 좌표가 정확하지 않아요
A: 관리자 모드에서 해당 booth를 클릭하여 재조정하세요.

## 📞 지원

문제가 있으면 추출 로그와 함께 문의하세요.

---

**마지막 업데이트**: 2025-10-21  
**추출 버전**: v1.0  
**PDF 버전**: 2025 푸드위크 코리아 A,B홀 부스배치도 (memo)

