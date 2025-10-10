-- ================================================================
-- WAY3 상인 GPS 좌표 업데이트 마이그레이션
-- 작성일: 2025-10-10
-- 목적: 9명의 상인을 실제 서울 지역 좌표로 정확하게 배치
-- ================================================================

-- 강남권 상인들 (Gangnam Region)

-- 1. 서예나 (Seoyena) - 강남구 압구정 로데오거리
UPDATE merchants SET
    district = '강남구',
    lat = 37.527941,
    lng = 127.038806
WHERE id = 'merchant_seoyena';

-- 2. 앨리스 강 (Alicegang) - 서초구 서래마을
UPDATE merchants SET
    district = '서초구',
    lat = 37.491451,
    lng = 127.003281
WHERE id = 'merchant_alicegang';

-- 3. 애니박 (Anipark) - 송파구 롯데월드/석촌호수
UPDATE merchants SET
    district = '송파구',
    lat = 37.511169,
    lng = 127.098242
WHERE id = 'merchant_anipark';

-- 4. 진백호 (Jinbaekho) - 강동구 천호동 (테라 커피하우스)
UPDATE merchants SET
    district = '강동구',
    lat = 37.540264,
    lng = 127.123698
WHERE id = 'merchant_jinbaekho';

-- 5. 주블수 (Jubulsu) - 강동구 천호동 (크래프트타운)
UPDATE merchants SET
    district = '강동구',
    lat = 37.540764,
    lng = 127.124198
WHERE id = 'merchant_jubulsu';

-- 6. 김세휘 (Kimsehwui) - 관악구 서울대학교 인근
UPDATE merchants SET
    district = '관악구',
    lat = 37.460369,
    lng = 126.951750
WHERE id = 'merchant_kimsehwui';

-- 서북권 상인들 (Northwest Region)

-- 7. 카타리나 최 (Catarinachoi) - 중구 명동성당
UPDATE merchants SET
    district = '중구',
    lat = 37.563605,
    lng = 126.986893
WHERE id = 'merchant_catarinachoi';

-- 8. 기주리 (Kijuri) - 종로구 경복궁 인근
UPDATE merchants SET
    district = '종로구',
    lat = 37.575911,
    lng = 126.976863
WHERE id = 'merchant_kijuri';

-- 9. 마리 (Mari) - 마포구 홍대/상수동
UPDATE merchants SET
    district = '마포구',
    lat = 37.548748,
    lng = 126.922070
WHERE id = 'merchant_mari';

-- ================================================================
-- 업데이트 확인 쿼리
-- ================================================================

SELECT
    id,
    name,
    district,
    lat,
    lng,
    ROUND(lat, 6) as lat_rounded,
    ROUND(lng, 6) as lng_rounded
FROM merchants
WHERE id IN (
    'merchant_seoyena',
    'merchant_alicegang',
    'merchant_anipark',
    'merchant_jinbaekho',
    'merchant_jubulsu',
    'merchant_catarinachoi',
    'merchant_kijuri',
    'merchant_kimsehwui',
    'merchant_mari'
)
ORDER BY district, name;

-- ================================================================
-- 지역별 상인 분포 확인
-- ================================================================

SELECT
    district,
    COUNT(*) as merchant_count,
    GROUP_CONCAT(name, ', ') as merchants
FROM merchants
WHERE id IN (
    'merchant_seoyena',
    'merchant_alicegang',
    'merchant_anipark',
    'merchant_jinbaekho',
    'merchant_jubulsu',
    'merchant_catarinachoi',
    'merchant_kijuri',
    'merchant_kimsehwui',
    'merchant_mari'
)
GROUP BY district
ORDER BY district;
