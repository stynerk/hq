// Project-wide serialization; message IDs are claimed before asynchronous work.
export class LaneJobs {
  constructor({seen = [], persist = () => {}} = {}) {
    this.lanes = new Map(); this.seen = new Set(seen); this.persist = persist;
  }
  get(id) { if (!this.lanes.has(id)) this.lanes.set(id, {active: null, starting: false, queue: [], epoch: 0}); return this.lanes.get(id); }
  claim(id) {
    if (!id || this.seen.has(id)) return false;
    this.seen.add(id);
    while (this.seen.size > 10000) this.seen.delete(this.seen.values().next().value);
    this.persist([...this.seen]); return true;
  }
  find(threadId) { return [...this.lanes.values()].find(l => l.active?.threadId === threadId); }
  stop(id) { const l = this.get(id); l.epoch++; l.queue.length = 0; return l; }
  anyBusy() { return [...this.lanes.values()].some(l => l.active || l.starting); }
}
