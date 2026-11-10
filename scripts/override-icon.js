const PREFIX = "sbc-";
const SUFFIX = "-icon";

function setIcon(name) {
    const b = Vars.content.getByName(ContentType.block, name);
    if (b == null) return;
    const icon = Core.atlas.find(PREFIX + name + SUFFIX);
    if (!Core.atlas.isFound(icon)) return;
    b.uiIcon = icon;
    b.fullIcon = icon;
}

Events.on(ClientLoadEvent, () => {
    ["shock-mine"].forEach(name => setIcon(name));
});