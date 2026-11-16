import test from 'node:test';
import assert from 'node:assert/strict';
import {LaneJobs} from './lane-jobs.mjs';

test('claims message ID synchronously and deduplicates after restart',()=>{
  let persisted;
  const jobs=new LaneJobs({persist:seen=>{persisted=seen;}});
  assert.equal(jobs.claim('m1'),true); assert.equal(jobs.claim('m1'),false); assert.equal(jobs.claim(null),false);
  assert.deepEqual(persisted,['m1']);
  const restarted=new LaneJobs({seen:persisted}); assert.equal(restarted.claim('m1'),false); assert.equal(restarted.claim('m2'),true);
});
test('independent project lanes retain independent active work and queues',()=>{
  const jobs=new LaneJobs(), one=jobs.get('one'),two=jobs.get('two');
  one.active={threadId:'thread-one'}; two.starting=true;two.queue.push({id:'two-pending'});
  assert.equal(jobs.anyBusy(),true);assert.equal(jobs.find('thread-one'),one);assert.equal(jobs.find('missing'),undefined);
  jobs.stop('one');assert.equal(one.epoch,1);assert.equal(two.epoch,0);assert.equal(two.starting,true);assert.equal(two.queue.length,1);
});
test('stop during preparation invalidates captured epoch and clears all queued work',async()=>{
  const jobs=new LaneJobs(), lane=jobs.get('one');lane.starting=true;lane.queue.push('a','b');
  const capturedEpoch=lane.epoch;
  let finishPreparation;
  const prepared=new Promise(resolve=>{finishPreparation=resolve;});
  let executions=0;
  const task=(async()=>{await prepared;if(capturedEpoch!==lane.epoch)return;executions++;})();
  jobs.stop('one');finishPreparation();await task;
  assert.equal(executions,0);assert.equal(lane.queue.length,0);assert.equal(lane.epoch,1);
});
test('seen history is bounded to 10000 newest IDs',()=>{
  const jobs=new LaneJobs({seen:Array.from({length:10000},(_,i)=>'m'+i)});
  jobs.claim('latest');assert.equal(jobs.seen.size,10000);assert.equal(jobs.seen.has('m0'),false);assert.equal(jobs.seen.has('latest'),true);
});
