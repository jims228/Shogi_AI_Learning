PRINCIPLES = {
    "rope": "駒の紐（連携）",
    "king_safety": "玉形の安全性",
    "tempo_loss": "手損",
    "fork": "両取り/両取りの脅威",
    "piece_activity": "駒の活用/働き",
}

# map simple tags to principle ids
TAG_TO_PRINCIPLES = {
    "悪手": ["tempo_loss"],
    "疑問手": ["piece_activity"],
    "好手": ["piece_activity"],
    "王手": ["king_safety"],
    "駒取り": ["piece_activity", "material_swing"],
}
