// Абилка "Боевой раж": при виде врага (юнит или блок) накладывает на юнита статус
// enemy-boost (описан в content/statuses/enemy-boost.hjson), потом уходит на откат.

// Параметры (меняйте под себя)
const BOOST_RANGE = 8 * 45;        // радиус обнаружения врага (1 тайл = 8), здесь 15 тайлов
const BOOST_DURATION = 60 * 5;     // сколько тиков держится статус (60 тиков = 1 секунда)
const BOOST_COOLDOWN = 60 * 15;    // откат после окончания статуса, в тиках
const CHECK_EVERY = 10;            // проверка врага раз в N тиков (чтобы не грузить игру)

// Список юнитов, которым дать абилку. Для модовых юнитов - имя с префиксом мода.
const BOOST_UNITS = ["crawler"];

// Статус берём из hjson (имя там с префиксом мода, поэтому ищем по концу имени)
let boostStatus = null;

// Когда юнит снова сможет сработать: id юнита -> время (в тиках)
const readyAt = {};

function fmt(v){
    return String(Math.round(v * 100) / 100);
}

function makeEnemyBoost(range){
    return extend(Ability, {
        update(unit){
            if(boostStatus == null) return;
            const now = Time.time;
            // идёт статус или откат
            if(now < (readyAt[unit.id] || 0)) return;
            // у каждого юнита своя фаза проверки, чтобы не считать все в один тик
            if((Math.floor(now) + unit.id) % CHECK_EVERY != 0) return;

            // closestTarget ищет и вражеские юниты, и вражеские блоки
            const target = Units.closestTarget(unit.team, unit.x, unit.y, range, u => true, b => true);
            if(target != null){
                unit.apply(boostStatus, BOOST_DURATION);
                // следующий запуск: после окончания статуса + откат
                readyAt[unit.id] = now + BOOST_DURATION + BOOST_COOLDOWN;
            }
        },
        // юнит погиб - забываем его состояние
        death(unit){
            delete readyAt[unit.id];
        },
        // название абилки в окне юнита
        localized(){
            return Core.bundle.get("ability.enemy-boost", "Enemy Boost");
        },
        // описание и статы абилки в окне юнита (скорость берётся из самого статуса)
        addStats(t){
            // ошибка в тексте описания не должна ронять игру
            try{
                t.add(Core.bundle.get("ability.enemy-boost.description")).wrap().width(300).left();
                t.row();
                t.add(Core.bundle.format("bullet.range", Strings.autoFixed(range / Vars.tilesize, 2))).left();
                t.row();
                t.add(Core.bundle.format("ability.enemy-boost.duration", fmt(BOOST_DURATION / 60))).left();
                t.row();
                t.add(Core.bundle.format("ability.stat.cooldown", fmt(BOOST_COOLDOWN / 60))).left();
                t.row();
                if(boostStatus != null){
                    t.add(Core.bundle.format("ability.enemy-boost.speed", fmt(boostStatus.speedMultiplier))).left();
                    t.row();
                }
            }catch(e){
                Log.err("[enemy-boost] addStats failed: " + e);
            }
        }
    });
}

Events.on(EventType.ContentInitEvent, () => {
    boostStatus = Vars.content.statusEffects().find(s => String(s.name).endsWith("enemy-boost"));
    if(boostStatus == null) Log.warn("[enemy-boost] status not found, check content/statuses/enemy-boost.hjson");

    BOOST_UNITS.forEach(n => {
        const type = Vars.content.getByName(ContentType.unit, n);
        if(type != null) type.abilities.add(makeEnemyBoost(BOOST_RANGE));
        else Log.warn("[enemy-boost] unit not found: " + n);
    });
});
