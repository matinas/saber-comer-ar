import { start } from 'repl';

const S = require('Scene');
const P = require('Patches'); 
const R = require('Reactive'); 
const A = require('Animation');
const Au = require('Audio');
const T = require('Time');
const M = require('Materials');
const TG = require('TouchGestures');
export const Diagnostics = require('Diagnostics');

const DOOR_OPENING_MAX_ROTATION = -170
const DOOR_OPENING_DURATION = 5000;
const PI = 3.1416;
const STATE = { NotStarted: 0, OpeningDoors: 1, DoorsOpened: 2, ButtonSelect : 3, WorkingOut: 4, WaitingWorkoutRep : 5, WorkoutCompleted: 6, AllWorkoutsCompleted : 7, DoorsClosed: 8 };

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

// the amount of intermediate steps in these animation sequences ("Burpees" animation in this case) also defines
// the maximum number of repetition that the user needs to do in order to consider the workout completed
// take into account that for all the animations we are using the wrap-up "End" animation already does a repetition
const burpeesAnimationSequence = [
  "BurpeeStart", "Burpee", "Burpee", "BurpeeEnd"
]

const pushupsAnimationSequence = [
  "IdleToPushup", "Pushup", "Pushup", "PushupToIdle",
]

const situpsAnimationSequence = [
  "IdleToSitup", "Situp", "Situp", "SitupToIdle",
]

var availableWorkouts = [ "Burpees", "Pushups", "Situps" ];

let currentAnimationSequence;
let currentClipIndex = 0;
let playbackController;
let isPlaying;

let audioButtonsController;
let buttonInstructionsText, workoutInstructionsText_1, workoutInstructionsText_2;

let arrowHint, workoutButtonsPlaceholders, workoutArrowPlaceholder, mainButtonArrowPlaceholder;
let buttonCaps;
let buttonMat, buttonMatDisabled;

let lastWorkoutSelected;
let delayTimer;

let state;

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
    S.root.findFirst('ArrowHint'),
    Au.getAudioPlaybackController('audioPlaybackControllerButtons'),
    S.root.findFirst('instructionButtonPressText'),
    M.findFirst('buttonCircle'),
    M.findFirst('buttonCircleDisabled'),
    S.root.findFirst('dummyTouchPlane'),
    S.root.findFirst('instructionWorkoutTapText_1'),
    S.root.findFirst('instructionWorkoutTapText_2'),
    S.root.findFirst('arrowWorkoutsPlaceholder'),
    S.root.findFirst('arrowMainButtonPlaceholder'),
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
  workoutButtonsPlaceholders = {
    "Burpees" : assets[16],
    "Pushups" : assets[17],
    "Situps" : assets[18]
  }
  arrowHint = assets[19];
  audioButtonsController = assets[20];
  buttonInstructionsText = assets[21];
  buttonMat = assets[22];
  buttonMatDisabled = assets[23];
  const dummyTouchPlane = assets[24];
  workoutInstructionsText_1 = assets[25];
  workoutInstructionsText_2 = assets[26];
  workoutArrowPlaceholder = assets[27];
  mainButtonArrowPlaceholder = assets[28];

  buttonCaps = {
    "Burpees" : burpeesButton,
    "Pushups" : pushupsButton,
    "Situps" : situpsButton
  }
  
  Diagnostics.log("All assets loaded");

  SetState(STATE.NotStarted);

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

  UpdateArrowHint(true);

  doorsOpened.monitor().subscribe(() =>
  {
    Diagnostics.log("Ready to start!");

    SetState(STATE.DoorsOpened);
  });

  TG.onTap(mainButton).subscribe(() => 
  {
    SetState(STATE.OpeningDoors);

    UpdateArrowHint(false);

    doorOpenDriver.start();
  });

  buttonsReady.monitor().subscribe(() =>
  {
    Diagnostics.log("Ready to select buttons");

    SetState(STATE.ButtonSelect);

    buttonInstructionsText.hidden = R.val(false);
    ShowWorkoutInstruction(false);
    UpdateArrowHint(true);

    P.inputs.setBoolean("hideMessage", true);
  });

  TG.onTap(burpeesButton).subscribe(async () =>
  {
    if (state.pinLastValue() == STATE.ButtonSelect)
    {
      Diagnostics.log("Burpees button pressed!");

      SetState(STATE.WorkingOut);

      lastWorkoutSelected = availableWorkouts[0];

      audioButtonsController.reset();
      audioButtonsController.setPlaying(true);

      buttonInstructionsText.hidden = R.val(true);
      
      SetupWorkoutStart(burpeesAnimationSequence);

      arrowHint.hidden = R.val(true);
      delete availableWorkouts[0]; // delete the first index (Burpees) in the available workouts array. Note that this lefts the index 0 element in the array but with undefined value

      // SwitchAvailableButtons(false); // uncomment to disable the other not-yet-selected buttons while doing a workout
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

      SetState(STATE.WorkingOut);

      lastWorkoutSelected = availableWorkouts[1];

      audioButtonsController.reset();
      audioButtonsController.setPlaying(true);

      buttonInstructionsText.hidden = R.val(true);
      
      SetupWorkoutStart(pushupsAnimationSequence);

      arrowHint.hidden = R.val(true);
      delete availableWorkouts[1];

      // SwitchAvailableButtons(false); // uncomment to disable the other not-yet-selected buttons while doing a workout
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
      
      SetState(STATE.WorkingOut);

      lastWorkoutSelected = availableWorkouts[2];

      audioButtonsController.reset();
      audioButtonsController.setPlaying(true);

      buttonInstructionsText.hidden = R.val(true);

      SetupWorkoutStart(situpsAnimationSequence);

      arrowHint.hidden = R.val(true);
      delete availableWorkouts[2];

      // SwitchAvailableButtons(false); // uncomment to disable the other not-yet-selected buttons while doing a workout
    }
    else
    {
      Diagnostics.log("ERROR: Button console still not ready!");
    }
  });

  // this dummmy plane is used to "fake" the bounding box for the main model, as with the original models' BB there were zones for which the tap wasn't working fine
  // TG.onTap(dummyTouchPlane).subscribe(() =>
  // {
  //   Diagnostics.log("Model tapped!");

  //   if (state.pinLastValue() == STATE.WaitingWorkoutRep)
  //   {
  //     Diagnostics.log("Starting workout's next repetition");

  //     SetState(STATE.WorkingOut);

  //     ShowWorkoutInstruction(false);
  //     UpdateArrowHint(false);
  //     StartWorkoutRepetition();
  //   }
  //   else
  //   {
  //     Diagnostics.log("Please select a workout before trying to make a repetition");
  //   }
  // });

  // Uncomment this to try workout-related stuff on SparkAR Studio Simulator as due to the fixed perspective of the simulator it doesn't catch the dummy plane tap
  TG.onTap(model).subscribe(() =>
  {
    Diagnostics.log("Model tapped!");

    if (state.pinLastValue() == STATE.WaitingWorkoutRep)
    {
      Diagnostics.log("Starting workout's next repetition");

      UpdateArrowHint(false);
      ShowWorkoutInstruction(false);

      SetState(STATE.WorkingOut);
      StartWorkoutRepetition();
    }
    else
    {
      Diagnostics.log("Please select a workout before trying to make a repetition");
    }
  });

  outputToPatch();

}; // Enables async/await in JS [part 2]

function outputToPatch()
{
  P.inputs.setScalar("state", state);
  Diagnostics.watch("State: ", state);
}

async function SetupWorkoutStart(animationSequence)
{
  currentAnimationSequence = animationSequence;

  // start the workout with a little delay so it starts after reproducing the platform's transition animation
  delayTimer = T.setInterval(StartWorkout, 1000);
  const timeoutTimer = T.setTimeout(stopIntervalTimer, 1500); // cancel the interval timer after doing just one call (kinda hacky but didn't work with delayed signals)
}

async function StartWorkout()
{
  currentClipIndex = 0;
  PlayAnimation(null, true, false);
}

function StartWorkoutRepetition()
{
  if (currentClipIndex < currentAnimationSequence.length)
  {
    PlayAnimation(null, true, false);

    audioButtonsController.setPlaying(false);
    P.inputs.setBoolean("hideMessage", false); // avoids showing message multiple times on patch editor, as after first workout rep message should be already hidden
  }
}

async function PlayAnimation(clip, play, loop)
{
  var currentClip;
  
  if (clip) currentClip = clip;
  else currentClip = await GetCurrentClip();

  if (currentClip)
  {
    playbackController.setAnimationClip(currentClip);
    playbackController.reset();

    playbackController.looping = R.val(loop);
    playbackController.playing = R.val(play);
  }
}

async function GetCurrentClip()
{
  var clip = null;

  if (currentClipIndex < currentAnimationSequence.length)
  {
    var animation = currentAnimationSequence[currentClipIndex];
    Diagnostics.log("Animation: " + animation);
    var clipName = clipsMapping[animation];
    clip = await A.animationClips.findFirst(clipName);

    return clip;
  }
}

async function OnAnimationFinished()
{
  if (!isPlaying.pinLastValue())
  {
    currentClipIndex++;
    Diagnostics.log("CurrentClipIndex: " + currentClipIndex + ". CurrentAnimationSequence length: " + currentAnimationSequence.length);

    if (currentClipIndex >= currentAnimationSequence.length) // played all animation sequence, set animation back to idle
    {
        Diagnostics.log("Workout completed, select another one");

        var clip = await A.animationClips.findFirst(clipsMapping["Idle"]);

        PlayAnimation(clip, true, true);
        SwitchButton(lastWorkoutSelected, false);

        if (GetFirstAvailableIndex() != null) // there are still available workouts to do
        {
          SetState(STATE.ButtonSelect);

          buttonInstructionsText.hidden = R.val(false);

          UpdateArrowHint(true);
          // SwitchAvailableButtons(true); // uncomment to enable the other not-yet-selected buttons only once the current workout is finished
        }
        else // no more workouts to do
        {
          Diagnostics.log("Congratulations! All workouts completed");

          SetState(STATE.AllWorkoutsCompleted);
        }
    }
    else
    {
      Diagnostics.log("Ready to do another repetion");

      SetState(STATE.WaitingWorkoutRep);

      if (currentClipIndex == 1) // show workout instructions only before starting the actual workout
      {
        UpdateArrowHint(true);
        ShowWorkoutInstruction(true);
      }
    }
  }
  else
  {
    Diagnostics.log("Repetition completed, but still reproducing animation");
  }
}

function SetState(stateToSet)
{
  state = R.val(stateToSet);
  P.inputs.setScalar("state", state);
}

function SwitchAvailableButtons(enable)
{
  for(var i = 0; i < availableWorkouts.length; i++) {
    var workout = availableWorkouts[i];
    if (workout != undefined) { 
      SwitchButton(workout, enable);
    }
  }
}

function SwitchButton(button, enable)
{
  if (enable) { buttonCaps[button].material = buttonMat; }
  else { buttonCaps[button].material = buttonMatDisabled; }
}

// this function takes care of the positioning of the only instance of the arrow asset based on the proper placeholder for the current state
// take into account that this function should be called AFTER updating the state with SetState()
function UpdateArrowHint(show)
{
  if (!show)
  {
    arrowHint.hidden = R.val(true);
    return;
  }

  var arrowPlaceholder = null;

  switch (state.pinLastValue())
  {
    case STATE.NotStarted:
    {
      arrowPlaceholder = mainButtonArrowPlaceholder;
      break;
    }
    case STATE.ButtonSelect:
    {
      arrowPlaceholder = workoutButtonsPlaceholders[availableWorkouts[GetFirstAvailableIndex()]];
      break;
    }
    case STATE.WaitingWorkoutRep:
    {
      arrowPlaceholder = workoutArrowPlaceholder;
      break;
    }
  }

  if (arrowPlaceholder)
  {
    arrowHint.transform.position = arrowPlaceholder.transform.position;
    arrowHint.transform.rotation = arrowPlaceholder.transform.rotation;
  }
  
  arrowHint.hidden = R.val(!show);
}

function GetFirstAvailableIndex()
{
  for(var i = 0; i < availableWorkouts.length; i++) { 
    if (availableWorkouts[i] != undefined) { 
        return i;
    }
  }
  return null;
}

function stopIntervalTimer()
{
  T.clearInterval(delayTimer);
}

function ShowWorkoutInstruction(show)
{
  workoutInstructionsText_1.hidden = R.val(!show);
  workoutInstructionsText_2.hidden = R.val(!show);
}
