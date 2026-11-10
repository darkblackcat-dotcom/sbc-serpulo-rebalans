const STATUSES = [
    "sbc-thermal-shock",
    "sbc-irradiated"
    ];

function getIconMap() {
    const cls = java.lang.Class.forName("mindustry.ui.Fonts", true, Vars.mods.mainLoader());
    const f = cls.getDeclaredField("unicodeIcons");
    f.setAccessible(true);
    return f.get(null);
}

function freeCode(map) {
    for (let c = 0xE000; c < 0xF8FF; c++) {
        if (!map.containsValue(c)) return c;
    }
    return -1;
}

function registerContentIcon(type, name) {
    const c = Vars.content.getByName(type, name);
    if (c == null) return;
    if (String(c.emoji()).length > 0) return;

    const region = c.uiIcon;
    if (region == null || !region.found()) return;

    const map = getIconMap();
    const code = freeCode(map);
    if (code < 0) return;
    Fonts.registerIcon(name, name, code, region);
    Log.info("content-icons: " + name + " -> " + code);
}

Events.on(ClientLoadEvent, () => {
    STATUSES.forEach(n => {
        try {
            registerContentIcon(ContentType.status, n);
        } catch (err) {
            Log.err("content-icons failed (" + n + "): " + err);
        }
    });
});