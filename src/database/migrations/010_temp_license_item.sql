-- Migration: Ensure temporary merchant license personal item template exists
INSERT OR IGNORE INTO personal_item_templates (
    id, name, type, grade, max_stack, cooldown, usage_limit, equip_slot, description, icon_id, is_active
) VALUES (
    'temp_merchant_license',
    '임시 상인증',
    'equipment',
    1,
    1,
    0,
    NULL,
    'license',
    '임시로 상인 활동을 허가받았음을 증명하는 증표',
    1,
    1
);
