extend(ForceProjector, "force-dome", {
  init(){
    this.itemConsumer = this.consumeItem(Items.phaseFabric).boost();
    this.super$init();
  }
});