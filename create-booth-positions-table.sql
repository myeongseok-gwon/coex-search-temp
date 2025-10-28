-- Booth 위치 정보를 저장하는 테이블 생성
CREATE TABLE IF NOT EXISTS booth_positions (
  booth_id VARCHAR(10) PRIMARY KEY,
  x REAL NOT NULL CHECK (x >= 0 AND x <= 1),
  y REAL NOT NULL CHECK (y >= 0 AND y <= 1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_booth_positions_booth_id ON booth_positions(booth_id);

-- RLS (Row Level Security) 설정
ALTER TABLE booth_positions ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기/쓰기 가능하도록 설정
CREATE POLICY "Enable all operations for all users" ON booth_positions FOR ALL USING (true);

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_booth_positions_updated_at 
  BEFORE UPDATE ON booth_positions 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 테이블 설명 추가
COMMENT ON TABLE booth_positions IS '부스 위치 정보를 저장하는 테이블 (좌표는 0~1 사이의 정규화된 값)';
COMMENT ON COLUMN booth_positions.booth_id IS '부스 ID (예: A1234, B5678)';
COMMENT ON COLUMN booth_positions.x IS 'X 좌표 (0~1, 왼쪽에서 오른쪽)';
COMMENT ON COLUMN booth_positions.y IS 'Y 좌표 (0~1, 위에서 아래)';
