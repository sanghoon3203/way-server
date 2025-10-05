-- 상인 테이블에 image_filename 컬럼 추가
-- 파일명: 004_add_image_filename_to_merchants.sql

-- image_filename 컬럼이 없을 경우에만 추가
-- SQLite는 ALTER TABLE ADD COLUMN IF NOT EXISTS를 지원하지 않으므로
-- 에러가 발생해도 무시됨 (이미 컬럼이 존재하는 경우)

-- 인덱스 생성 (이미지 파일명으로 검색 최적화)
CREATE INDEX IF NOT EXISTS idx_merchants_image_filename ON merchants(image_filename);