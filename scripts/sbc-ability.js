// Универсальные абилки: "условие -> действие -> откат".
// Действие: наложить статус, мгновенно вылечить, дать щит, показать волну.
// Цель: сам юнит, союзники в радиусе или враги в радиусе.
// Новая абилка = новая запись в BOOSTS (+ файл статуса в content/statuses/, если нужен статус).
// Эффекты статуса (множители, лечение, урон) задаются в hjson статуса.

const CHECK_EVERY = 10;          // проверка условий раз в N тиков (чтобы не грузить игру)
const PREFIX = "sbc.ability.";   // префикс наших ключей в бандле

// ---------------- Список абилок ----------------
// Все поля, кроме units, необязательные.
//   status      имя статуса (файл content/statuses/<имя>.hjson). Без него абилка только лечит/даёт щит
//   id          ключ в бандле: sbc.ability.<id> (название) и sbc.ability.<id>.description (описание);
//               если не указан - название и описание берутся из статуса
//   duration    сколько тиков держится статус (60 тиков = 1 секунда), по умолчанию 300
//   cooldown    откат после окончания статуса, в тиках, по умолчанию 900
//   range       радиус для условий и целей (1 тайл = 8), по умолчанию 120 (15 тайлов)
//   when        условие или массив условий (нужны все), по умолчанию "enemy":
//                 "enemy"      враг (юнит или блок) в радиусе
//                 "enemies"    врагов-юнитов в радиусе не меньше count (по умолчанию 3)
//                 "allies"     союзников-юнитов в радиусе не меньше count
//                 "lowHealth"  здоровье не выше healthBelow (доля 0..1, по умолчанию 0.5)
//                 "highHealth" здоровье не ниже healthAbove (по умолчанию 0.8)
//                 "damaged"    юнит получил урон
//                 "shooting"   юнит стреляет
//                 "moving"     юнит движется
//                 "idle"       юнит стоит
//                 "flying"     юнит в воздухе
//                 "grounded"   юнит на земле
//                 "always"     всегда
//               Перед именем можно поставить "!" - условие наоборот, например "!enemy" (нет врагов рядом)
//   target      "self" (по умолчанию), "allies" (союзники в радиусе) или "enemies" (враги в радиусе)
//   heal        мгновенное лечение (здоровье), только для self и allies
//   shield      мгновенный щит, только для self и allies; shieldMax - предел щита (по умолчанию = shield)
//   fx          имя эффекта игры, например "overdriveWave" - волна на юните при срабатывании
//   units       кому дать абилку (для модовых - имя с префиксом мода). Элемент - строка "crawler"
//               или объект {unit: "dagger", id: "dagger-rage"} (свой ключ названия для этого юнита)
const BOOSTS = [
    {status: "enemy-boost", range: 8 * 45, duration: 60 * 5, cooldown: 60 * 15, when: "enemy", units: ["crawler"]}
];

// Множители статуса: поле в hjson -> ключ строки в бандле (sbc.ability.<key>)
const MULTS = [
    {field: "speedMultiplier", key: "speed"},
    {field: "damageMultiplier", key: "damage"},
    {field: "healthMultiplier", key: "health"},
    {field: "reloadMultiplier", key: "reload"},
    {field: "buildSpeedMultiplier", key: "buildspeed"},
    {field: "dragMultiplier", key: "drag"}
];

function fmt(v){
    return String(Math.round(v * 100) / 100);
}

function def(v, d){
    return v == null ? d : v;
}

// у Java-юнитов бывает и поле, и метод с одним именем: читаем безопасно
function flag(u, name){
    const v = u[name];
    return typeof v == "function" ? !!u[name]() : !!v;
}

// статус из hjson (имя там с префиксом мода, поэтому ищем по концу имени)
function findStatus(id){
    return Vars.content.statusEffects().find(s => {
        const n = String(s.name);
        return n == id || n.endsWith("-" + id);
    });
}

// вызвать cons для каждого вражеского юнита в радиусе
function eachEnemy(unit, range, cons){
    Groups.unit.intersect(unit.x - range, unit.y - range, range * 2, range * 2, e => {
        if(e.team != unit.team && e.isValid() && e.within(unit, range)) cons(e);
    });
}

// сколько юнитов рядом: врагов или союзников (себя не считаем)
function countNear(unit, range, enemies){
    const c = {n: 0};
    Groups.unit.intersect(unit.x - range, unit.y - range, range * 2, range * 2, e => {
        if(e == unit || !e.isValid()) return;
        if((e.team != unit.team) != enemies) return;
        if(e.within(unit, range)) c.n++;
    });
    return c.n;
}

function makeAbility(cfg, status, id){
    // когда юнит снова сможет сработать: id юнита -> время (в тиках)
    const readyAt = {};
    // здоровье юнита на прошлой проверке (для условия "damaged")
    const lastHp = {};

    const range = def(cfg.range, 8 * 15);
    const duration = def(cfg.duration, 60 * 5);
    const cooldown = def(cfg.cooldown, 60 * 15);
    const below = def(cfg.healthBelow, 0.5);
    const above = def(cfg.healthAbove, 0.8);
    const count = def(cfg.count, 3);
    const mode = def(cfg.target, "self");
    const need = [].concat(def(cfg.when, "enemy"));

    function check(name, unit){
        switch(name){
            case "enemy":
                // closestTarget ищет и вражеские юниты, и вражеские блоки
                return Units.closestTarget(unit.team, unit.x, unit.y, range, u => true, b => true) != null;
            case "enemies": return countNear(unit, range, true) >= count;
            case "allies": return countNear(unit, range, false) >= count;
            case "lowHealth": return Number(unit.health) / Number(unit.maxHealth) <= below;
            case "highHealth": return Number(unit.health) / Number(unit.maxHealth) >= above;
            case "damaged":{
                const prev = lastHp[unit.id];
                return prev != null && Number(unit.health) < prev - 0.01;
            }
            case "shooting": return flag(unit, "isShooting");
            case "moving": return flag(unit, "moving");
            case "idle": return !flag(unit, "moving");
            case "flying": return flag(unit, "isFlying");
            case "grounded": return flag(unit, "isGrounded");
            case "always": return true;
        }
        return false;
    }

    function checkAll(unit){
        return need.every(c => {
            const s = String(c);
            return s.charAt(0) == "!" ? !check(s.substring(1), unit) : check(s, unit);
        });
    }

    // действие над одним юнитом (себя, союзника или врага)
    function actOn(e){
        if(status != null) e.apply(status, duration);
        if(mode != "enemies"){
            if(cfg.heal) e.heal(cfg.heal);
            if(cfg.shield){
                const cap = def(cfg.shieldMax, cfg.shield);
                if(Number(e.shield) < cap) e.shield = Math.min(Number(e.shield) + cfg.shield, cap);
            }
        }
    }

    function fire(unit){
        if(mode == "allies") Units.nearby(unit.team, unit.x, unit.y, range, e => actOn(e));
        else if(mode == "enemies") eachEnemy(unit, range, actOn);
        else actOn(unit);

        if(cfg.fx != null){
            try{
                const fx = Fx[cfg.fx];
                if(fx != null) fx.at(unit.x, unit.y, range, Color.valueOf("ffd37f"), null);
            }catch(e){ Log.warn("[sbc.ability] fx failed: " + e); }
        }
    }

    return extend(Ability, {
        update(unit){
            const now = Time.time;
            // у каждого юнита своя фаза проверки, чтобы не считать все в один тик
            if((Math.floor(now) + unit.id) % CHECK_EVERY != 0) return;

            const hp = Number(unit.health);
            const ok = now >= (readyAt[unit.id] || 0) && checkAll(unit);
            lastHp[unit.id] = hp;
            if(!ok) return;

            fire(unit);
            // следующий запуск: после окончания статуса + откат
            readyAt[unit.id] = now + (status != null ? duration : 0) + cooldown;
        },
        // юнит погиб - забываем его состояние
        death(unit){
            delete readyAt[unit.id];
            delete lastHp[unit.id];
        },
        // название абилки в окне юнита
        localized(){
            const key = PREFIX + id;
            if(Core.bundle.has(key)) return Core.bundle.get(key);
            return status != null ? String(status.localizedName) : id;
        },
        // описание и статы абилки в окне юнита
        addStats(t){
            // ошибка в тексте описания не должна ронять игру
            try{
                const line = s => { t.add(s).left(); t.row(); };

                const dkey = PREFIX + id + ".description";
                let desc = null;
                if(Core.bundle.has(dkey)) desc = Core.bundle.get(dkey);
                else if(status != null && status.description != null) desc = String(status.description);
                if(desc != null){
                    t.add(desc).wrap().width(300).left();
                    t.row();
                }

                // условия активации
                need.forEach(c => {
                    const s = String(c);
                    const neg = s.charAt(0) == "!";
                    const wk = PREFIX + "when." + (neg ? s.substring(1) : s).toLowerCase();
                    if(!Core.bundle.has(wk)) return;
                    const txt = Core.bundle.format(wk, fmt(range / Vars.tilesize), fmt(below * 100), fmt(above * 100), count);
                    line(neg ? Core.bundle.format(PREFIX + "when.not", txt) : txt);
                });
                if(mode != "self") line(Core.bundle.format(PREFIX + "target." + mode, fmt(range / Vars.tilesize)));
                if(need.indexOf("enemy") >= 0 || need.indexOf("!enemy") >= 0 || mode != "self"){
                    line(Core.bundle.format("bullet.range", Strings.autoFixed(range / Vars.tilesize, 2)));
                }

                if(status != null) line(Core.bundle.format(PREFIX + "duration", fmt(duration / 60)));
                line(Core.bundle.format("ability.stat.cooldown", fmt(cooldown / 60)));

                // мгновенные эффекты
                if(cfg.heal && mode != "enemies") line(Core.bundle.format(PREFIX + "healnow", fmt(cfg.heal)));
                if(cfg.shield && mode != "enemies") line(Core.bundle.format(PREFIX + "shield", fmt(cfg.shield)));

                // эффекты статуса: множители, равные 1, не показываем
                if(status != null){
                    MULTS.forEach(m => {
                        const v = Number(status[m.field]);
                        if(isNaN(v) || Math.abs(v - 1) < 0.001) return;
                        line(Core.bundle.format(PREFIX + m.key, fmt(v)));
                    });
                    // damage на тик: отрицательное = лечение, положительное = урон
                    const dmg = Number(status.damage);
                    if(!isNaN(dmg) && dmg < 0) line(Core.bundle.format(PREFIX + "heal", fmt(-dmg * 60)));
                    else if(!isNaN(dmg) && dmg > 0) line(Core.bundle.format(PREFIX + "dps", fmt(dmg * 60)));
                    if(status.disarm) line(Core.bundle.get(PREFIX + "disarm"));
                }
            }catch(e){
                Log.err("[sbc.ability] addStats failed: " + e);
            }
        }
    });
}

Events.on(EventType.ContentInitEvent, () => {
    BOOSTS.forEach(cfg => {
        let status = null;
        if(cfg.status != null){
            status = findStatus(cfg.status);
            if(status == null){
                Log.warn("[sbc.ability] status not found: " + cfg.status);
                return;
            }
        }
        cfg.units.forEach(u => {
            const n = typeof u == "string" ? u : u.unit;
            const id = typeof u == "string" ? (cfg.id || cfg.status) : u.id;
            const type = Vars.content.getByName(ContentType.unit, n);
            if(type != null) type.abilities.add(makeAbility(cfg, status, id));
            else Log.warn("[sbc.ability] unit not found: " + n);
        });
    });
});
