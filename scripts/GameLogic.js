// How to load in modules
const S = require('Scene');
const P = require('Patches'); 
const R = require('Reactive'); 
const A = require('Animation');
const T = require('Time');
const TG = require('TouchGestures');
export const Diagnostics = require('Diagnostics');

const DOOR_OPENING_DURATION = 5000;
const PI = 3.1416;

var buttonPressedUp = R.val(false);

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
    S.root.findFirst('Bouton_2'),
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

  Diagnostics.log("All assets loaded");

  const doorOpenDriver = A.timeDriver({durationMilliseconds: DOOR_OPENING_DURATION, loopCount : 1});
  const doorOpenSampler = A.samplers.easeOutCubic(0, -170);
  const doorOpenSignal = RadToDeg(A.animate(doorOpenDriver, doorOpenSampler));

  Diagnostics.watch("Door open signal: ", doorOpenSignal);

  leftDoor.transform.rotationY = doorOpenSignal;
  leftBottomDoor.transform.rotationY = doorOpenSignal;
  bottomDoor.transform.rotationY = doorOpenSignal;
  rightBottomDoor.transform.rotationY = doorOpenSignal;
  rightDoor.transform.rotationY = doorOpenSignal;
  rightTopDoor.transform.rotationY = doorOpenSignal;
  rightTopDoor.transform.rotationY = doorOpenSignal;
  topDoor.transform.rotationY = doorOpenSignal;
  leftTopDoor.transform.rotationY = doorOpenSignal;

  TG.onTap(button).subscribe(() => 
  {
    buttonPressedUp = R.val(true);
    P.inputs.setBoolean("buttonPressedUp", buttonPressedUp);
    
    doorOpenDriver.start();
  });

  Diagnostics.watch("buttonPressedUp", buttonPressedUp);

}; // Enables async/await in JS [part 2]