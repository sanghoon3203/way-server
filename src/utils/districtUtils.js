// 📁 src/utils/districtUtils.js - 서울 지역 구분 유틸리티

const DISTRICT_CENTERS = [
    { id: '강남구', lat: 37.527941, lng: 127.038806 },
    { id: '서초구', lat: 37.491451, lng: 127.003281 },
    { id: '송파구', lat: 37.511169, lng: 127.098242 },
    { id: '강동구', lat: 37.540264, lng: 127.123698 },
    { id: '관악구', lat: 37.460369, lng: 126.95175 },
    { id: '중구', lat: 37.563605, lng: 126.986893 },
    { id: '종로구', lat: 37.575911, lng: 126.976863 },
    { id: '마포구', lat: 37.548748, lng: 126.92207 }
];

const DEFAULT_DISTRICT = '기타';
const NEAREST_RADIUS_METERS = 6000;

function toRadians(deg) {
    return deg * (Math.PI / 180);
}

function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3;
    const φ1 = toRadians(lat1);
    const φ2 = toRadians(lat2);
    const Δφ = toRadians(lat2 - lat1);
    const Δλ = toRadians(lng2 - lng1);

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

function getDistrictFromLocation(lat, lng) {
    if (typeof lat !== 'number' || typeof lng !== 'number') {
        return DEFAULT_DISTRICT;
    }

    let nearest = { id: DEFAULT_DISTRICT, distance: Infinity };

    for (const district of DISTRICT_CENTERS) {
        const distance = calculateDistance(lat, lng, district.lat, district.lng);
        if (distance < nearest.distance) {
            nearest = { id: district.id, distance };
        }
    }

    return nearest.distance <= NEAREST_RADIUS_METERS ? nearest.id : DEFAULT_DISTRICT;
}

module.exports = {
    DISTRICT_CENTERS,
    DEFAULT_DISTRICT,
    NEAREST_RADIUS_METERS,
    calculateDistance,
    getDistrictFromLocation
};
