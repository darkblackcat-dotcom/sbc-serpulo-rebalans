const TURRETS = [
    "duo",
    "scatter",
    "scorch",
    "hail",
    "wave",
    "lancer",
    "arc",
    "parallax",
    "swarmer",
    "salvo",
    "segment",
    "tsunami",
    "fuse",
    "ripple",
    "cyclone",
    "foreshadow",
    "spectre",
    "meltdown",
    "sbc-squall",
    "sbc-laser-astra",
    "sbc-laser-byran",
    "sbc-laser-vortex"
];
const CORE_MULT = 1.65;

const CORES = [
    "core-shard",
    "core-foundation",
    "core-nucleus"
];
//turret
function isMine(block) {
    return TURRETS.indexOf(block.name) != -1;
}

function revealStatic(build) {
    const blk = build.block;
    const smallMul = blk.fogRadiusMultiplier;
    const smallRad = blk.fogRadius;
    const full = Math.round(blk.range / Vars.tilesize);

    blk.fogRadiusMultiplier = 1;
    blk.fogRadius = Math.max(full, smallRad);
    try {
        Vars.fogControl.forceUpdate(build.team, build);
    }catch(err) {
        Log.err(err);
    }finally {
        blk.fogRadiusMultiplier = smallMul;
        blk.fogRadius = smallRad;
    }
}

Events.on(BlockBuildEndEvent, e => {
    if (e.breaking || !e.tile.build || !isMine(e.tile.block())) return;
    revealStatic(e.tile.build);
});

Events.on(WorldLoadEvent, () => {
    Time.run(10, () => {
        Groups.build.each(b => {
            if (isMine(b.block)) revealStatic(b);
        });
    });
});
//core

function isCore(block) {
    return CORES.indexOf(block.name) != -1;
}

function revealCore(build) {
    const blk = build.block;
    const small = blk.fogRadius;
    const full = Math.round(small * CORE_MULT);

    blk.fogRadius = full;
    try {
        Vars.fogControl.forceUpdate(build.team, build);
    }catch(err) {
        Log.err(err);
    }finally {
        blk.fogRadius = small;
    }
}

Events.on(BlockBuildEndEvent, e => {
    if (e.breaking || !e.tile.build || !isCore(e.tile.block())) return;
    revealCore(e.tile.build);
});

Events.on(WorldLoadEvent, () => {
    Time.run(15, () => {
        Groups.build.each(b => {
            if (isCore(b.block)) revealCore(b);
        });
    });
});