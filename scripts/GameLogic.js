import { setTimeout } from 'timers';

const S = require('Scene');
const P = require('Patches'); 
const R = require('Reactive'); 
const A = require('Animation');
const Au = require('Audio');
const T = require('Time');
const M = require('Materials');
const TG = require('TouchGestures');
export const Diagnostics = require('Diagnostics');

const DEBUG = true; // TODO: disable for production build!

const DOOR_OPENING_MAX_ROTATION = -170
const DOOR_OPENING_DURATION = 1500;
const DOOR_CLOSING_DURATION = 250;
const DOOR_CLOSED_TIME = 250;
const WORKOUT_START_DELAY = 100;

const PI = 3.1416;
const AUDIO_WORKOUT_DELAY =
{
  "Burpees" : 1100,
  "Push-ups" : 300,
  "Sit-ups" : 200
};
const EARLY_VFX_WORKOUT_DELAY =
{
  "Burpees" : 1000,
  "Push-ups" : 500,
  "Sit-ups" : 500
};
const EARLY_VFX_EXPERIENCE_COMPLETED_VFX = 700;

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

const danceClipsMapping = {
  "Victory2": "mixamo.com17",
  "HipHopDancing": "mixamo.com12",
  "SillyDancing2": "mixamo.com14",
  "SillyDancing": "mixamo.com15",
  "SwingDancing": "mixamo.com16",
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

const animationSequencesMapping = {
  0: burpeesAnimationSequence,
  1: pushupsAnimationSequence,
  2: situpsAnimationSequence
}

const cheerMessages = [
  "¡Vamos!", "¡Eso es!", "¡Bien!", "¡Una mas!", "¡Dale!", "¡Si!"
]

var availableWorkouts = [ "Burpees", "Push-ups", "Sit-ups" ];

let currentAnimationSequence;
let currentClipIndex = 0;
let playbackController;
let isPlaying;

let leftDoor, leftBottomDoor, bottomDoor, rightBottomDoor, rightDoor, rightTopDoor, topDoor, leftTopDoor;

let audioButtonsController;
let buttonInstructionsText, workoutInstructionsText_1, workoutInstructionsText_2, cheerMessageText;

let arrowHint, workoutButtonsPlaceholders, workoutArrowPlaceholder, mainButtonArrowPlaceholder;
let burpeesButton, pushupsButton, situpsButton, buttonsMapping;
let buttonMat, buttonMatDisabled;

let lastWorkoutSelected;
let workoutDelayTimer, doorDelayTimer, earlyVfxDelayTimer;

let counterText, counterTextMat, counterCanvas, cheerMessageTextMat, cheerMsgCanvas, finalMsgText0, finalMsgText1, finalMsgText2;
let repCounter = 0;
let boardWorkoutTxt, boardCounterTxt;

let audioWorkoutControllers, endMusicController, endMusicSpeaker;

let whiteboard, chalkboard;
let confettiBlock, glitter;

let state;

/////// time measurements (TODO: remove for production build!)
// let startTime = Date.now();
// let startTimeMs = T.ms;
// Log("Starting fetching assets from scene...");
/////////////////////////////////////////////////

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
    S.root.findFirst('burpeesButton'),
    S.root.findFirst('pushupsButton'),
    S.root.findFirst('situpsButton'),
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
    M.findFirst('counterTextMat'),
    // S.root.findFirst("StretchingTextUI"), // the stretching text ended up not being used as a block but directly on the patch editor as there's no way to access block's material so to implement the fade-out effect
    S.root.findFirst('counterText'),
    Au.getAudioPlaybackController('audioPlaybackControllerGrunt1'),
    Au.getAudioPlaybackController('audioPlaybackControllerGrunt2'),
    Au.getAudioPlaybackController('audioPlaybackControllerGrunt3'),
    Au.getAudioPlaybackController('audioPlaybackControllerGrunt4'),
    Au.getAudioPlaybackController('audioPlaybackControllerGrunt5'),
    Au.getAudioPlaybackController('audioPlaybackControllerGrunt6'),
    Au.getAudioPlaybackController('audioPlaybackControllerGrunt7'),
    Au.getAudioPlaybackController('audioPlaybackControllerGrunt8'),
    S.root.findFirst('counterCanvas'),
    S.root.findFirst('boardWorkoutTxt'),
    S.root.findFirst('boardCounterTxt'),
    S.root.findFirst('whiteboardRoot'),
    S.root.findFirst('chalkboard'),
    P.outputs.getBoolean("readyToDoorShift"),
    S.root.findFirst('spritesheetConfetti'),
    S.root.findFirst('glitterYellow'),
    S.root.findFirst('glitterRed'),
    S.root.findFirst('glitterGreen'),
    Au.getAudioPlaybackController('audioPlaybackMusicController'),
    S.root.findFirst('speakerMusic'),
    S.root.findFirst('cheerMessageText'),
    M.findFirst('cheerMessageTextMat'),
    S.root.findFirst('cheerMsgCanvas'),
    S.root.findFirst('finalMsgText0'),
    S.root.findFirst('finalMsgText1'),
    S.root.findFirst('finalMsgText2'),
  ]
).then(main).catch((error) =>
  {
    // we are catching errors while executing main here as the catch() follows the then()
    Log("Error found while fetching assets");
    Log("Error message: " + error.message);
  }
);

function RadToDeg(radians)
{
  return R.div(R.mul(PI, radians), 180);
}

async function main(assets) { // Enables async/await in JS [part 1]

  /////// time measurements (TODO: remove for production build!)
  // let endTime = Date.now();
  // let endTimeMs = T.ms;
  
  // Log(`[Date] Start time: ${startTime}, End time: ${endTime}`);
  // Log(`[Date] Asset fetching completed in ${endTime - startTime} ms`);
  // Log(`[Time Module] Start time: ${startTimeMs.pinLastValue()}, End time: ${endTimeMs.pinLastValue()}`);
  // Log(`[Time Module] Asset fetching completed in ${endTimeMs.pinLastValue() - startTimeMs.pinLastValue()} ms`);

  // startTime = Date.now();
  // startTimeMs = T.ms;
  // Log(`Starting asset references assignment...`);
  /////////////////////////////////////////////////

  leftDoor = assets[0];
  leftBottomDoor = assets[1];
  bottomDoor = assets[2];
  rightBottomDoor = assets[3];
  rightDoor = assets[4];
  rightTopDoor = assets[5];
  topDoor = assets[6];
  leftTopDoor = assets[7];
  const mainButton = assets[8];
  const doorsOpened = assets[9];
  burpeesButton = assets[10];
  pushupsButton = assets[11];
  situpsButton = assets[12];
  const buttonsReady = assets[13];
  const mainModel = assets[14];
  playbackController = assets[15];
  workoutButtonsPlaceholders = {
    "Burpees" : assets[16],
    "Push-ups" : assets[17],
    "Sit-ups" : assets[18]
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
  counterTextMat = assets[29];
  counterText = assets[30];
  audioWorkoutControllers = [ assets[31], assets[32], assets[33], assets[34], assets[35], assets[36], assets[37], assets[38] ];
  counterCanvas = assets[39];
  boardWorkoutTxt = assets[40];
  boardCounterTxt = assets[41];
  whiteboard = assets[42];
  chalkboard = assets[43];
  const readyToDoorShift = assets[44];
  confettiBlock = assets[45];
  glitter = [ assets[46], assets[47], assets[48] ];
  endMusicController = assets[49];
  endMusicSpeaker = assets[50];
  cheerMessageText = assets[51];
  cheerMessageTextMat = assets[52];
  cheerMsgCanvas = assets[53];
  finalMsgText0 = assets[54];
  finalMsgText1 = assets[55];
  finalMsgText2 = assets[56];

  buttonsMapping = {
    "Burpees" : burpeesButton,
    "Push-ups" : pushupsButton,
    "Sit-ups" : situpsButton
  }
  
  Log("All assets loaded");

  /////// time measurements (TODO: remove for production build!)
  // endTime = Date.now();
  // endTimeMs = T.ms;
  // Log(`[Date] Start time: ${startTime}, End time: ${endTime}`);
  // Log(`[Date] Asset references assignment completed in ${endTime - startTime} ms`);
  // Log(`[Time Module] Start time: ${startTimeMs.pinLastValue()}, End time: ${endTimeMs.pinLastValue()}`);
  // Log(`[Time Module] Asset references assignment completed in (ms from start) ${endTimeMs.pinLastValue() - startTimeMs.pinLastValue()} ms`);
  /////////////////////////////////////////////////

  SetState(STATE.NotStarted);

  playbackController.looping = R.val(true);
  isPlaying = playbackController.playing;

  isPlaying.monitor().subscribe(OnAnimationFinished);

  audioButtonsController.setPlaying(false);

  UpdateArrowHint(true);

  TG.onTap(mainButton).subscribe(() => 
  {
    Log(`Time since first frame is ${T.ms.pinLastValue()}`);

    if (state.pinLastValue() == STATE.NotStarted)
    {
      SetState(STATE.OpeningDoors);

      UpdateArrowHint(false);
      PlayDoorOpenVFX();
    }
  });

  doorsOpened.monitor().subscribe(() =>
  {
    Log("Ready to start!");

    SetState(STATE.DoorsOpened);
  });

  readyToDoorShift.monitor().subscribe(() =>
  {
    if (readyToDoorShift.pinLastValue())
    {
      PlayDoorQuickOpenCloseVFX(DOOR_CLOSED_TIME);
    }
  });

  buttonsReady.monitor().subscribe(() =>
  {
    Log("Ready to select buttons");

    SetState(STATE.ButtonSelect);

    buttonInstructionsText.hidden = R.val(false);
    ShowWorkoutInstruction(false);
    UpdateArrowHint(true);

    P.inputs.setBoolean("hideMessage", true);
  });

  SubscribeWorkoutButtonHandlers();

  // this dummmy plane is used to "fake" the bounding box for the main model, as with the original models' BB there were zones for which the tap wasn't working fine
  // TG.onTap(dummyTouchPlane).subscribe(() =>
  // {
  //   Log("Model tapped!");

  //   if (state.pinLastValue() == STATE.WaitingWorkoutRep)
  //   {
  //     Log("Starting workout's next repetition");

  //     UpdateArrowHint(false);
  //     ShowWorkoutInstruction(false);

  //     SetState(STATE.WorkingOut);
      
  //     // kinda hacky, but this will trigger some effects once the workout is completed, not when the whole rep's animation finishes but right in the middle of it
  //     if (++repCounter >= (currentAnimationSequence.length-1))
  //     {
  //       PlayEarlyWorkoutCompletedVFXs(EARLY_VFX_WORKOUT_DELAY[lastWorkoutSelected], GetFirstAvailableIndex() == null);
  //     }

  //     StartWorkoutRepetition();
  //     PlayCounterVFX();
  //     PlayCheerMessageVFX();
  //     UpdateBoard();
  //   }
  //   else
  //   {
  //     Log("Please select a workout before trying to make a repetition");
  //   }
  // });

  outputToPatch();

  // DEBUG

  // Uncomment this to try stuff on screen tap on SparkAR Studio Simulator
  // TG.onTap().subscribe(async () =>
  // {
  //   // PlayWorkoutSFX();
  //   // PlayCounterVFX();
  //   // PlayCheerMessageVFX();

  //   // if (++repCounter > 3)
  //   // {
  //   //   repCounter = 0;
  //   // }
    
  //   // PlayFinalMsgTextVFX();

  //   // PlayDoorQuickOpenCloseVFX(DOOR_CLOSED_TIME);

  //   // Play a specific animation for the main model
  //   // var clip = await A.animationClips.findFirst(clipsMapping["Dance"]);
  //   // PlayAnimation(clip, true, true);

  //   // Cycle through a sequence of animations
  //   // var clip = await A.animationClips.findFirst(danceClipsMapping[Object.keys(danceClipsMapping)[currentClipIndex++]]);
  //   // PlayAnimation(clip, true, true);

  //   ShowConfetti(true);

  //   // PlayEarlyWorkoutCompletedVFXs(EARLY_VFX_WORKOUT_DELAY["Burpees"], true);
  // });

  // Uncomment this to try workout-related stuff on SparkAR Studio Simulator as due to the fixed perspective of the simulator it doesn't catch the dummy plane tap
  TG.onTap(mainModel).subscribe(() =>
  {
    Log("Model tapped!");

    if (state.pinLastValue() == STATE.WaitingWorkoutRep)
    {
      Log("Starting workout's next repetition");

      UpdateArrowHint(false);
      ShowWorkoutInstruction(false);

      SetState(STATE.WorkingOut);
      
      // kinda hacky, but this will trigger some effects once the workout is completed, not when the whole rep's animation finishes but right in the middle of it
      if (++repCounter >= (currentAnimationSequence.length-1))
      {
        PlayEarlyWorkoutCompletedVFXs(EARLY_VFX_WORKOUT_DELAY[lastWorkoutSelected], GetFirstAvailableIndex() == null);
      }

      StartWorkoutRepetition();
      PlayCounterVFX();
      PlayCheerMessageVFX();
      UpdateBoard();
    }
    else
    {
      Log("Please select a workout before trying to make a repetition");
    }
  });

}; // Enables async/await in JS [part 2]

function SubscribeWorkoutButtonHandlers()
{
  SubscribeWorkoutButtonHandler("Burpees");
  SubscribeWorkoutButtonHandler("Push-ups");
  SubscribeWorkoutButtonHandler("Sit-ups");
}

function SubscribeWorkoutButtonHandler(button)
{
  const buttonSubscription = TG.onTap(buttonsMapping[button]).subscribe(() =>
  {
    if (state.pinLastValue() == STATE.ButtonSelect)
    {
      SetState(STATE.WorkingOut);

      let buttonIndex = GetIndexInMap(buttonsMapping, button);
      lastWorkoutSelected = availableWorkouts[buttonIndex];

      audioButtonsController.reset();
      audioButtonsController.setPlaying(true);

      buttonInstructionsText.hidden = R.val(true);
      arrowHint.hidden = R.val(true);

      SetupWorkoutStart(animationSequencesMapping[buttonIndex]);
      
      delete availableWorkouts[buttonIndex]; // delete the button's slot in the available workouts array. Note that this keeps the memory slot in the array but with undefined value

      // SwitchAvailableButtons(false); // uncomment to disable the other not-yet-selected buttons while doing a workout

      buttonSubscription.unsubscribe();
    }
    else
    {
      Log("ERROR: Button console still not ready!");
    }
  });
}

function GetIndexInMap(array, keyToFind)
{
  let keyIndex = -1;
  for (let i=0; i < Object.keys(array).length; i++)
  {
    if (Object.keys(array)[i] == keyToFind)
    {
      keyIndex = i;
      break;
    }
  }

  return keyIndex;
}

function outputToPatch()
{
  P.inputs.setScalar("state", state);
  Diagnostics.watch("State: ", state);
}

function PlayDoorOpenVFX(open = true)
{
  var doorRotDriver, doorRotSampler, doorRotSignal;  

  if (open) // open
  {
    doorRotDriver = A.timeDriver({durationMilliseconds: DOOR_OPENING_DURATION, loopCount : 1});
    doorRotSampler = A.samplers.easeOutBounce(0, DOOR_OPENING_MAX_ROTATION);
  }
  else // close
  {
    doorRotDriver = A.timeDriver({durationMilliseconds: DOOR_CLOSING_DURATION, loopCount : 1});
    doorRotSampler = A.samplers.easeOutQuad(DOOR_OPENING_MAX_ROTATION, 0);
  }

  doorRotSignal = RadToDeg(A.animate(doorRotDriver, doorRotSampler));

  leftDoor.transform.rotationY = doorRotSignal;
  leftBottomDoor.transform.rotationY = R.clamp(R.sum(doorRotSignal,0.1), DOOR_OPENING_MAX_ROTATION, 0);
  bottomDoor.transform.rotationY = R.clamp(R.sum(doorRotSignal,0.2), DOOR_OPENING_MAX_ROTATION, 0);
  rightBottomDoor.transform.rotationY = R.clamp(R.sum(doorRotSignal,0.3), DOOR_OPENING_MAX_ROTATION, 0);
  rightDoor.transform.rotationY = R.clamp(R.sum(doorRotSignal,0.4), DOOR_OPENING_MAX_ROTATION, 0);
  rightTopDoor.transform.rotationY = R.clamp(R.sum(doorRotSignal,0.5), DOOR_OPENING_MAX_ROTATION, 0);
  topDoor.transform.rotationY = R.clamp(R.sum(doorRotSignal,0.7), DOOR_OPENING_MAX_ROTATION, 0);
  leftTopDoor.transform.rotationY = R.clamp(R.sum(doorRotSignal,0.8), DOOR_OPENING_MAX_ROTATION, 0);

  doorRotDriver.start();

  return doorRotDriver.onCompleted();
}

function PlayDoorQuickOpenCloseVFX(delay)
{
  var onCompletedEvt = PlayDoorOpenVFX(false);
  
  onCompletedEvt.subscribe(() =>
  {
    // add a delay between both animations so the door remains closed for a little bit before opening again
    // the delay here should be set so to match the delay between the "platform down" animation and the "platform up" animation for the platform in the Patch Editor (1 sec right now)

    doorDelayTimer = T.setInterval(function OpenDoor()
    {
      PlayDoorOpenVFX(true);
    }, delay);
    
    // This is another way of passing the parameter value to a parameter callback function
    // delayTimer = T.setInterval(PlayDoorOpenVFX.bind(null, { open : true }), delay);

    T.setTimeout(function StopTimerCallback()
    {
      StopTimer(doorDelayTimer);
    }, delay+1);
  });
}

async function SetupWorkoutStart(animationSequence)
{
  currentAnimationSequence = animationSequence;

  UpdateBoard();

  // start the workout with a little delay so it starts after reproducing the platform's transition animation
  workoutDelayTimer = T.setInterval(StartWorkout, WORKOUT_START_DELAY);

  T.setTimeout(function StopTimerCallback() // cancel the interval timer after doing just one call (kinda hacky but didn't work with delayed signals)
  {
    StopTimer(workoutDelayTimer);
  }, WORKOUT_START_DELAY+1);
}

async function StartWorkout()
{
  ShowConfetti(false); // required so to stop the confetti animation after a workout (otherwise it won't play next time)
  ShowBoard();

  currentClipIndex = 0;
  PlayAnimation(null, true, false);
}

function StartWorkoutRepetition()
{
  if (currentClipIndex < currentAnimationSequence.length)
  {
    PlayAnimation(null, true, false);
    PlayWorkoutSFX(AUDIO_WORKOUT_DELAY[lastWorkoutSelected]);

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
    Log("Animation: " + animation);
    var clipName = clipsMapping[animation];
    clip = await A.animationClips.findFirst(clipName);

    return clip;
  }
}

function PlayWorkoutSFX(delay)
{
  audioButtonsController.setPlaying(false);

  const index = GetRandomIndex(audioWorkoutControllers.length);
  Log("Workout audio index: " + index);

  workoutDelayTimer = T.setInterval(function () {
      PlaySFX(index);
    }, delay);

  T.setTimeout(function StopTimerCallback()
  {
    StopTimer(workoutDelayTimer);
  }, delay + 0.1);
}

function PlaySFX(index)
{
  audioWorkoutControllers[index].reset();
  audioWorkoutControllers[index].setPlaying(true);
}

function GetRandomIndex(numItems)
{
  return Math.floor(Math.random() * numItems);
}

async function OnAnimationFinished()
{
  if (!isPlaying.pinLastValue())
  {
    currentClipIndex++;
    Log("CurrentClipIndex: " + currentClipIndex + ". CurrentAnimationSequence length: " + currentAnimationSequence.length);

    if (currentClipIndex >= currentAnimationSequence.length) // played all animation sequence, set animation back to idle
    {
        Log("Workout completed, select another one");
        
        SwitchButton(lastWorkoutSelected, false);

        var clip;
        if (GetFirstAvailableIndex() != null) // there are still available workouts to do
        {
          clip = await A.animationClips.findFirst(clipsMapping["Idle"]);

          // these are shown as "early" VFX now (before completing the animation), a fixed delay after tapping for the last rep
          // ShowConfetti(true);
          // ShowBoard(false);

          PlayAnimation(clip, true, true);
          SwitchButton(lastWorkoutSelected, false);

          SetState(STATE.ButtonSelect);

          buttonInstructionsText.hidden = R.val(false);
          repCounter = 0;

          UpdateArrowHint(true);
          // SwitchAvailableButtons(true); // uncomment to enable the other not-yet-selected buttons only once the current workout is finished
        }
        else // no more workouts to do
        {
          Log("Congratulations! All workouts completed");

          SetState(STATE.AllWorkoutsCompleted);
          CycleAnimationSequence();
        }
    }
    else
    {
      Log("Ready to do another repetion");

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
    Log("Repetition completed, but still reproducing animation");
  }
}

async function CycleAnimationSequence()
{
  currentClipIndex = 0;
  var keys = Object.keys(danceClipsMapping);

  // play first animation
  var clip = await A.animationClips.findFirst(danceClipsMapping[keys[currentClipIndex++]]);
  PlayAnimation(clip, true, true);

  // cycle through the rest of the animations on each screen tap
  TG.onTap().subscribe(async () =>
  {
    if (currentClipIndex >= keys.length) currentClipIndex = 0;

    var clip = await A.animationClips.findFirst(danceClipsMapping[keys[currentClipIndex++]]);
    PlayAnimation(clip, true, true);
  });
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
  if (enable) { buttonsMapping[button].material = buttonMat; }
  else { buttonsMapping[button].material = buttonMatDisabled; }
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

function StopTimer(timer)
{
  T.clearInterval(timer);
}

function ShowWorkoutInstruction(show)
{
  workoutInstructionsText_1.hidden = R.val(!show);
  workoutInstructionsText_2.hidden = R.val(!show);
}

function UpdateBoard()
{
  boardCounterTxt.text = R.val(repCounter.toString());
  boardWorkoutTxt.text = R.val(lastWorkoutSelected.toUpperCase());

  PlayBoardRollVFX();
}

function PlayBoardRollVFX()
{
  const boardRotationDriver = A.timeDriver({durationMilliseconds: 1500, loopCount : 1});
  const boardRotationSampler = A.samplers.easeOutElastic(-15, -375);
  const boardRotationSignal = A.animate(boardRotationDriver, boardRotationSampler);

  chalkboard.transform.rotationZ = RadToDeg(boardRotationSignal);

  boardRotationDriver.start();
}

function ShowBoard(show=true)
{
  let boardPositionDriver, boardPositionSampler, boardPositionSignal;

  if (show) // make the board appear by animating it down
  {
    whiteboard.hidden = R.val(false);

    boardPositionDriver = A.timeDriver({durationMilliseconds: 1000, loopCount : 1});
    boardPositionSampler = A.samplers.easeOutBounce(5, 0);
    boardPositionSignal = A.animate(boardPositionDriver, boardPositionSampler);
  }
  else // make the board disappear by animating it up
  {
    boardPositionDriver = A.timeDriver({durationMilliseconds: 1000, loopCount : 1});
    boardPositionSampler = A.samplers.easeInOutElastic(0, 5);
    boardPositionSignal = A.animate(boardPositionDriver, boardPositionSampler);

    PlayBoardRollVFX();

    boardPositionDriver.onCompleted().subscribe(() => 
    {
      whiteboard.hidden = R.val(true);
    });
  }

  whiteboard.transform.z = boardPositionSignal;

  boardPositionDriver.start();
}

async function ShowConfetti(show)
{
  await confettiBlock.inputs.setBoolean('Play', show);
}

function ShowGlitter()
{
  glitter.forEach(item =>
  {
    item.hidden = R.val(false);
  });
}

function PlayEndMusic()
{
  endMusicController.setLooping(true);

  const audioVolumeDriver = A.timeDriver( { durationMilliseconds : 3000, loopCount : 1});
  const audioVolumeSampler = A.samplers.linear(0.0, 1.0);
  const audioVolumeSignal = A.animate(audioVolumeDriver, audioVolumeSampler);

  endMusicSpeaker.volume = R.val(0);
  endMusicSpeaker.volume = audioVolumeSignal;

  audioVolumeDriver.start();

  endMusicController.reset();
  endMusicController.setPlaying(true);
}

function PlayEarlyWorkoutCompletedVFXs(delay, isLastWorkout)
{
  earlyVfxDelayTimer = T.setInterval(function ()
  {
    ShowConfetti(true);
    ShowBoard(false);

    if (isLastWorkout)
    {
      const tmpTimer = T.setInterval(function ()
      {
        ShowGlitter();
        PlayEndMusic();
        PlayFinalMsgTextVFX();
      }, delay+EARLY_VFX_EXPERIENCE_COMPLETED_VFX);

      T.setTimeout(function StopTimerCallback()
      {
        StopTimer(tmpTimer);
      }, delay+EARLY_VFX_EXPERIENCE_COMPLETED_VFX+0.1);
    }

  }, delay);

  T.setTimeout(function StopTimerCallback()
  {
    StopTimer(earlyVfxDelayTimer);
  }, delay+0.1);
}

function PlayTextExpandVFX(canvas, text, strValue, textMat, minScale, maxScale, forwardTimeMilis, fadeoutTimeMilis, delay, isCounter = false)
{
  function PlayVFX()
  {
    if (isCounter)
    {
      P.inputs.setPulse("playCounterSFX", R.once()); // send the play sound signal to the patch editor (workaround for no audio effects in the API)
    }

    // move the counter forward
    const canvasPosDriver = A.timeDriver({durationMilliseconds: forwardTimeMilis, loopCount : 1});
    const canvasPosSampler = A.samplers.linear(-0.08, -0.17);
    const canvasPosSignal = A.animate(canvasPosDriver, canvasPosSampler);

    canvas.transform.y = canvasPosSignal;

    text.text = R.val(strValue);
    text.hidden = R.val(false);

    // scale counter
    const textScaleDriver = A.timeDriver({durationMilliseconds: forwardTimeMilis, loopCount : 1});
    const textScaleSampler = A.samplers.linear(minScale, maxScale);
    const textScaleSignal = A.animate(textScaleDriver, textScaleSampler);

    textScaleDriver.onCompleted().subscribe(OnTextVFXCompleted.bind(null, text));

    text.transform.scaleX = textScaleSignal;
    text.transform.scaleY = textScaleSignal;

    // fade-out counter
    const textAlphaDriver = A.timeDriver({durationMilliseconds: fadeoutTimeMilis, loopCount : 1});
    const textAlphaSampler = A.samplers.linear(1, 0);
    const textAlphaSignal = A.animate(textAlphaDriver, textAlphaSampler);

    textMat.opacity = textAlphaSignal;

    canvasPosDriver.start();
    textScaleDriver.start();
    textAlphaDriver.start();
  }

  if (delay > 0)
  {
    const tmpTimer = T.setInterval(PlayVFX, delay);

    T.setTimeout(function StopTimerCallback()
    {
      StopTimer(tmpTimer);
    }, delay+0.1);
  }
  else
  {
    PlayVFX();
  }
}

function OnTextVFXCompleted(text)
{
  text.hidden = R.val(true);
}

function PlayCounterVFX()
{
  var strValue = repCounter.toString();

  PlayTextExpandVFX(counterCanvas, counterText, strValue, counterTextMat, 1, 10, 800, 1000, 0, true);
}

function PlayCheerMessageVFX()
{
  const randomIndex = Math.floor(Math.random() * cheerMessages.length);
  var strValue = cheerMessages[randomIndex];

  PlayTextExpandVFX(cheerMsgCanvas, cheerMessageText, strValue, cheerMessageTextMat, 1, 1.75, 800, 800, 750);
}

function PlayFinalMsgTextVFX()
{
  finalMsgText0.hidden = R.val(false);
  finalMsgText1.hidden = R.val(false);
  finalMsgText2.hidden = R.val(false);

  const msgPosDriver0 = A.timeDriver({durationMilliseconds: 1000, loopCount : 1});
  const msgPosSampler0 = A.samplers.easeOutBounce(-375, 0);
  const msgPosSignal0 = A.animate(msgPosDriver0, msgPosSampler0);

  finalMsgText0.transform.x = msgPosSignal0;

  msgPosDriver0.start();

  const msgPosDriver1 = A.timeDriver({durationMilliseconds: 1000, loopCount : 1});
  const msgPosSampler1 = A.samplers.easeInExpo(-375, 375);
  const msgPosSignal = A.animate(msgPosDriver1, msgPosSampler1);

  msgPosDriver1.onCompleted().subscribe(OnMsgVFXHidden);

  finalMsgText1.transform.x = msgPosSignal;
  finalMsgText2.transform.x = R.neg(msgPosSignal);

  msgPosDriver1.start();
}

function OnMsgVFXHidden()
{
  const msgPosDriver = A.timeDriver({durationMilliseconds: 1000, loopCount : 1});
  const msgPosSampler = A.samplers.easeOutBounce(-375, 0);
  const msgPosSignal = A.animate(msgPosDriver, msgPosSampler);

  finalMsgText1.transform.x = msgPosSignal;
  finalMsgText2.transform.x = R.neg(msgPosSignal);

  msgPosDriver.start();
}

function Log(message)
{
  if (DEBUG)
  {
    Diagnostics.log(message);
  }
}