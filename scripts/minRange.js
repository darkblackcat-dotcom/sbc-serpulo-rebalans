const red = Color.valueOf("ff3333");
const PLAN_SCAN = 1;
let failed = false;

function drawMin(block, x, y) {
    if (block instanceof Turret && block.minRange > 0) {
        const z = Layer.max - 1;

        Draw.z(z);
        Lines.stroke(3, Pal.gray);
        Lines.dashCircle(x, y, block.minRange);

        Draw.z(z + 0.01);
        Lines.stroke(1, red);
        Lines.dashCircle(x, y, block.minRange);

        Draw.reset();
    }
}

function lastTurretPlan(plans) {
    if (plans == null) return null;
    const stop = Math.max(0, plans.size - PLAN_SCAN);
    for (let i = plans.size - 1; i >= stop; i--) {
        const p = plans.get(i);
        if (p != null && !p.breaking && p.block instanceof Turret && p.block.minRange > 0) {
            return p;
        }
    }
    return null;
}

Events.run(Trigger.draw, () => {
    if (failed || Vars.state.isMenu()) return;
    try {
        const input = Vars.control.input;
        const m = Core.input.mouseWorld();

        const b = Vars.world.buildWorld(m.x, m.y);
        if (b != null) drawMin(b.block, b.x, b.y);

        let plan = lastTurretPlan(input.selectPlans);
        if (plan == null) {
            const unit = Vars.player.unit();
            if (unit != null) plan = lastTurretPlan(unit.plans);
        }
        if (plan != null) {
            drawMin(plan.block, plan.drawx(), plan.drawy());
        }
    }catch(e) {
        failed = true;
        Log.err("sbc minRange draw failed: " + e);
    }
});