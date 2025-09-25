-- 상인 테이블에 image_filename 컬럼 추가
-- 파일명: 004_add_image_filename_to_merchants.sql

-- image_filename 컬럼 추가 (상인 이미지 파일명 저장)
ALTER TABLE merchants ADD COLUMN image_filename TEXT;

-- 인덱스 생성 (이미지 파일명으로 검색 최적화)
CREATE INDEX IF NOT EXISTS idx_merchants_image_filename ON merchants(image_filename);