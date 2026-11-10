Events.run(Trigger.update, () => {
    if(!Vars.state.isGame()) return;

    if(!Vars.state.rules.fog){
        Vars.state.rules.fog = true;
    }
});