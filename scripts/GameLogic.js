import { start } from 'repl';

const S = require('Scene');
const P = require('Patches'); 
const R = require('Reactive'); 
const A = require('Animation');
const Au = require('Audio');
const T = require('Time');
const TG = require('TouchGestures');
export const Diagnostics = require('Diagnostics');

const DOOR_OPENING_MAX_ROTATION = -170
const DOOR_OPENING_DURATION = 5000;
const PI = 3.1416;
const STATE = { NotStarted: 0, OpeningDoors: 1, DoorsOpened: 2, ButtonSelect : 3, WorkingOut_Burpees: 4, WorkingOut_Pushups: 5, WorkingOut_Situps: 6, WorkoutCompleted: 7, AllWorkoutsCompleted : 8, DoorsClosed: 9 };

const clipsMapping = {
  "Idle": "mixamo.com",
  "IdleToPushup": "mixamo.com0",
  "Pushup": "mixamo.com1",
  "PushupToIdle": "mixamo.com2",
  "BurpeeStart": "mixamo.com3",
  "Burpee": "mixamo.com4",
  "BurpeeEnd": "mixamo.com5",
  "IdleToSitup": "mixamo.com9",
  "Situp": "mixamo.com7",
  "SitupToIdle": "mixamo.com8",
};

const burpeesAnimationSequence = [
  "BurpeeStart", "Burpee", "BurpeeEnd"
]

const pushupsAnimationSequence = [
  "IdleToPushup", "Pushup", "PushupToIdle",
]

const situpsAnimationSequence = [
  "IdleToSitup", "Situp", "SitupToIdle",
]

var availableWorkouts = [ "Burpees", "Pushups", "Situps" ];

let currentAnimationSequence;
let currentClipIndex = 0;
let playbackController;
let isPlaying;

let audioButtonsController;

let arrowPlaceholders, arrowButtons;

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
    S.root.findFirst('nodes_5_burpees'),
    S.root.findFirst('nodes_5_pushups'),
    S.root.findFirst('nodes_5_situps'),
    P.outputs.getBoolean("buttonsReady"),
    S.root.findFirst('Miguelito'),
    A.playbackControllers.findFirst('animationPlaybackController'),
    S.root.findFirst('arrowPlaceholderBurpees'),
    S.root.findFirst('arrowPlaceholderPushups'),
    S.root.findFirst('arrowPlaceholderSitups'),
    S.root.findFirst('JumpArrow - Button Console'),
    Au.getAudioPlaybackController('audioPlaybackControllerButtons')
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
  const mainButton = assets[8];
  const doorsOpened = assets[9];
  const burpeesButton = assets[10];
  const pushupsButton = assets[11];
  const situpsButton = assets[12];
  const buttonsReady = assets[13];
  const model = assets[14];
  playbackController = assets[15];
  arrowPlaceholders = {
    "Burpees" : assets[16],
    "Pushups" : assets[17],
    "Situps" : assets[18]
  }
  arrowButtons = assets[19];
  audioButtonsController = assets[20];

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

  playbackController.looping = R.val(true);
  isPlaying = playbackController.playing;

  isPlaying.monitor().subscribe(OnAnimationFinished);

  audioButtonsController.setPlaying(false);

  doorsOpened.monitor().subscribe(() =>
  {
    Diagnostics.log("Ready to start!");

    state = R.val(STATE.DoorsOpened);
    P.inputs.setScalar("state", state);
  });

  TG.onTap(mainButton).subscribe(() => 
  {
    state = R.val(STATE.OpeningDoors);
    P.inputs.setScalar("state", state);

    doorOpenDriver.start();
  });

  buttonsReady.monitor().subscribe(() =>
  {
    Diagnostics.log("Ready to select buttons");

    UpdateButtonConsoleArrow();

    state = R.val(STATE.ButtonSelect);
    P.inputs.setScalar("state", state);
  });

  TG.onTap(burpeesButton).subscribe(async () => 
  {
    if (state.pinLastValue() == STATE.ButtonSelect)
    {
      Diagnostics.log("Burpees button pressed!");

      audioButtonsController.reset();
      audioButtonsController.setPlaying(true);

      state = R.val(STATE.WorkingOut_Burpees);
      P.inputs.setScalar("state", state);

      StartWorkout(burpeesAnimationSequence);

      arrowButtons.hidden = R.val(true);
      delete availableWorkouts[0]; // delete the first index (Burpees) in the available workouts array. Note that this lefts the index 0 element in the array but with undefined value
    }
    else
    {
      Diagnostics.log("ERROR: Button console still not ready!");
    }
  });

  TG.onTap(pushupsButton).subscribe(async () => 
  {
    if (state.pinLastValue() == STATE.ButtonSelect)
    {
      Diagnostics.log("Pushups button pressed!");

      audioButtonsController.reset();
      audioButtonsController.setPlaying(true);

      state = R.val(STATE.WorkingOut_Pushups);
      P.inputs.setScalar("state", state);

      StartWorkout(pushupsAnimationSequence);

      arrowButtons.hidden = R.val(true);
      delete availableWorkouts[1];
    }
    else
    {
      Diagnostics.log("ERROR: Button console still not ready!");
    }
  });

  TG.onTap(situpsButton).subscribe(() => 
  {
    if (state.pinLastValue() == STATE.ButtonSelect)
    {
      Diagnostics.log("Situps button pressed!");
      
      audioButtonsController.reset();
      audioButtonsController.setPlaying(true);

      state = R.val(STATE.WorkingOut_Situps);
      P.inputs.setScalar("state", state);

      StartWorkout(situpsAnimationSequence);

      arrowButtons.hidden = R.val(true);
      delete availableWorkouts[2];
    }
    else
    {
      Diagnostics.log("ERROR: Button console still not ready!");
    }
  });

  outputToPatch();

}; // Enables async/await in JS [part 2]

function outputToPatch()
{
  P.inputs.setScalar("state", state);
  Diagnostics.watch("State: ", state);
}

async function StartWorkout(animationSequence)
{
  currentClipIndex = 0;
  currentAnimationSequence = animationSequence;
  
  const clip = await GetCurrentClip();

  playbackController.looping = R.val(false);
  playbackController.setAnimationClip(clip);
  playbackController.reset();
}

async function OnAnimationFinished()
{
  if (!isPlaying.pinLastValue())
  {
    currentClipIndex++;

    if (currentClipIndex < currentAnimationSequence.length)
    {
      const clip = await GetCurrentClip();
  
      playbackController.setAnimationClip(clip);
      playbackController.reset();

      playbackController.playing = R.val(true);
    }
    else
    {
      Diagnostics.log("Workout completed, select another one");

      audioButtonsController.setPlaying(false);

      var clip = await A.animationClips.findFirst(clipsMapping["Idle"]);

      playbackController.setAnimationClip(clip);
      playbackController.reset();

      playbackController.looping = R.val(true);
      playbackController.playing = R.val(true);

      if (GetFirstAvailableIndex() != null) // there are still available workouts to do
      {
        UpdateButtonConsoleArrow();

        state = R.val(STATE.ButtonSelect);
        P.inputs.setScalar("state", state);
      }
      else
      {
        // no more workouts to do...

        Diagnostics.log("Congratulations! All workouts completed");

        state = R.val(STATE.AllWorkoutsCompleted);
        P.inputs.setScalar("state", state);
      }
    }
  }
}

async function GetCurrentClip()
{
  var animation = currentAnimationSequence[currentClipIndex];
  Diagnostics.log("Animation: " + animation);
  var clipName = clipsMapping[animation];
  var clip = await A.animationClips.findFirst(clipName);

  return clip;
}

function UpdateButtonConsoleArrow()
{
  const arrowPlaceholder = arrowPlaceholders[availableWorkouts[GetFirstAvailableIndex()]];
  arrowButtons.transform.position = arrowPlaceholder.transform.position;
  arrowButtons.transform.rotation = arrowPlaceholder.transform.rotation;

  arrowButtons.hidden = R.val(false);
}

function GetFirstAvailableIndex()
{
  for(var i = 0; i < availableWorkouts.length; i++){ 
    if (availableWorkouts[i] != undefined) { 
        return i;
    }
  }
  return null;
}