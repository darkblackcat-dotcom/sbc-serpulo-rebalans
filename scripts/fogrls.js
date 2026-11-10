const MULT = 1.65;
const STEP = 1;          // шаг радиуса в тайлах (больше = легче, но "ступенчатее")
const UPDATE_EVERY = 5;
const PLAN_SCAN = 1;

const RADARS = {
    "sbc-rls-1": MULT,
    "sbc-rls-2": MULT,
    "sbc-rls-3": MULT
};

var tracked = [];
var last = {};
var tick = 0;

function staticRadius(blk){
    const m = RADARS[blk.name];
    return m == null ? 0 : Math.round(blk.fogRadius * m);
}

function track(b){
    if(b != null && RADARS[b.block.name] != null && tracked.indexOf(b) == -1){
        tracked.push(b);
    }
}

Events.on(WorldLoadEvent, () => {
    tracked = [];
    last = {};
    tick = 0;
    Time.run(1, () => Groups.build.each(b => track(b)));
});

Events.on(BlockBuildEndEvent, e => {
    if(!e.breaking && e.tile.build) track(e.tile.build);
});

Events.run(Trigger.update, () => {
    if(!Vars.state.isGame() || !Vars.state.rules.fog || !Vars.state.rules.staticFog) return;

    tick++;

    // список чистим редко, чтобы не создавать массив каждый тик
    if(tick % 60 == 0){
        tracked = tracked.filter(b => b.isValid());
    }

    if(tick % UPDATE_EVERY != 0) return;

    for(let i = 0; i < tracked.length; i++){
        const b = tracked[i];
        if(!b.isValid() || b.efficiency <= 0) continue;

        const blk = b.block;
        const ext = staticRadius(blk);
        const cur = Math.round(ext * b.progress * b.smoothEfficiency / STEP) * STEP;
        if(cur == last[b.id]) continue;
        last[b.id] = cur;

        const small = blk.fogRadius;
        blk.fogRadius = ext;
        try{
            Vars.fogControl.forceUpdate(b.team, b);
        }catch(err){
            Log.err(err);
        }finally{
            blk.fogRadius = small;
        }
    }
});

function drawStatic(blk, x, y){
    const r = staticRadius(blk);
    if(r > 0) Drawf.dashCircle(x, y, r * Vars.tilesize, Pal.lightishGray);
}

function lastRadarPlan(plans){
    if(plans == null) return null;
    const stop = Math.max(0, plans.size - PLAN_SCAN);
    for(let i = plans.size - 1; i >= stop; i--){
        const p = plans.get(i);
        if(p != null && !p.breaking && RADARS[p.block.name] != null) return p;
    }
    return null;
}

Events.run(Trigger.drawOver, () => {
    if(!Vars.state.isGame() || !Vars.state.rules.fog || !Vars.state.rules.staticFog) return;

    const input = Vars.control.input;

    let plan = lastRadarPlan(input.linePlans);
    if(plan == null) plan = lastRadarPlan(input.selectPlans);
    if(plan == null){
        const unit = Vars.player.unit();
        if(unit != null) plan = lastRadarPlan(unit.plans);
    }
    if(plan == null) return;

    Draw.z(Layer.fogOfWar);
    drawStatic(plan.block, plan.drawx(), plan.drawy());
    Draw.reset();
});
