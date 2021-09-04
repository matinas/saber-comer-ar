// How to load in modules
const S = require('Scene');
const P = require('Patches'); 
const R = require('Reactive'); 
const A = require('Animation');
const T = require('Time');
const TG = require('TouchGestures');
export const Diagnostics = require('Diagnostics');

const DOOR_OPENING_MAX_ROTATION = -170
const DOOR_OPENING_DURATION = 5000;
const PI = 3.1416;
const STATE = { NotStarted: 0, OpeningDoors: 1, DoorsOpened: 2, WorkingOut: 3, WorkoutCompleted: 4, DoorsClosed: 5 };

var state = R.val(STATE.NotStarted);

Promise.all(
  [
    S.root.findFirst('leftDoor'),
    S.root.findFirst('leftBottomDoor'),
    S.root.findFirst('bottomDoor'),
    S.root.findFirst('rightBottomDoor'),
    S.root.findFirst('rightDoor'),
    S.root.findFirst('rightTopDoor'),
    S.root.findFirst('topDoor'),
    S.root.findFirst('leftTopDoor'),
    S.root.findFirst('buttonCap'),
    P.outputs.getBoolean("doorsOpened"),
  ]
).then(main).catch((error) =>
  {
    // we are catching errors while executing main here as the catch() follows the then()
    Diagnostics.log("Error found while fetching assets");
    Diagnostics.log("Error message: " + error.message);
  }
);

function RadToDeg(radians)
{
  return R.div(R.mul(PI, radians), 180);
}

async function main(assets) { // Enables async/await in JS [part 1]

  const leftDoor = assets[0];
  const leftBottomDoor = assets[1];
  const bottomDoor = assets[2];
  const rightBottomDoor = assets[3];
  const rightDoor = assets[4];
  const rightTopDoor = assets[5];
  const topDoor = assets[6];
  const leftTopDoor = assets[7];
  const button = assets[8];
  const doorsOpened = assets[9];

  Diagnostics.log("All assets loaded");

  const doorOpenDriver = A.timeDriver({durationMilliseconds: DOOR_OPENING_DURATION, loopCount : 1});
  const doorOpenSampler = A.samplers.easeOutCubic(0, DOOR_OPENING_MAX_ROTATION);
  const doorOpenSignal = RadToDeg(A.animate(doorOpenDriver, doorOpenSampler));

  leftDoor.transform.rotationY = doorOpenSignal;
  leftBottomDoor.transform.rotationY = R.clamp(R.sum(doorOpenSignal,0.1), DOOR_OPENING_MAX_ROTATION, 0);
  bottomDoor.transform.rotationY = R.clamp(R.sum(doorOpenSignal,0.2), DOOR_OPENING_MAX_ROTATION, 0);
  rightBottomDoor.transform.rotationY = R.clamp(R.sum(doorOpenSignal,0.3), DOOR_OPENING_MAX_ROTATION, 0);
  rightDoor.transform.rotationY = R.clamp(R.sum(doorOpenSignal,0.4), DOOR_OPENING_MAX_ROTATION, 0);
  rightTopDoor.transform.rotationY = R.clamp(R.sum(doorOpenSignal,0.5), DOOR_OPENING_MAX_ROTATION, 0);
  topDoor.transform.rotationY = R.clamp(R.sum(doorOpenSignal,0.7), DOOR_OPENING_MAX_ROTATION, 0);
  leftTopDoor.transform.rotationY = R.clamp(R.sum(doorOpenSignal,0.8), DOOR_OPENING_MAX_ROTATION, 0);

  TG.onTap(button).subscribe(() => 
  {
    state = R.val(STATE.OpeningDoors);
    P.inputs.setScalar("state", state);

    doorOpenDriver.start();
  });

  doorsOpened.monitor().subscribe(() =>
  {
    Diagnostics.log("Ready to start!");

    state = R.val(STATE.DoorsOpened);
    P.inputs.setScalar("state", state);
  });

  outputToPatch();

}; // Enables async/await in JS [part 2]

function outputToPatch()
{
  P.inputs.setScalar("state", state);
  Diagnostics.watch("State: ", state);
}