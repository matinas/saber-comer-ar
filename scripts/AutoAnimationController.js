// This script plays a configured sequence of animations in order as soon as the tracker detects the target (requires
// a startPlaying patch editor output parameter that sets to true as soon as the target is detected)
// The mapping of names for the animation assets to play is configured in the clipsMapping array
// The current sequence of animations to be played is configured in the animationSequence array

const Scene = require('Scene');
const Animation = require('Animation');
const Reactive = require('Reactive');
const Patches = require('Patches');
export const Diagnostics = require('Diagnostics');

const clipsMapping = {
  "Idle": "mixamo.com",
  "IdleToPushup": "mixamo.com0",
  "Pushup": "mixamo.com1",
  "PushupToIdle": "mixamo.com2",
  "BurpeeStart": "mixamo.com3",
  "Burpee": "mixamo.com4",
  "BurpeeEnd": "mixamo.com5",
  "Talking": "mixamo.com6",
  "IdleToSitup": "mixamo.com9",
  "Situp": "mixamo.com7",
  "SitupToIdle": "mixamo.com8",
  "QuickBow": "mixamo.com10"
};

const animationSequence = [
  "Idle",
  "IdleToPushup", "Pushup", "Pushup", "PushupToIdle",
  "BurpeeStart", "Burpee", "Burpee", "BurpeeEnd",
  //"IdleToSitup", "Situp", "Situp", "Situp", "SitupToIdle",
  //"Talking",
  "QuickBow",
  "Idle"
];

let currentClipIndex = 0;
let playbackController;
let isPlaying;

async function main() {  // Enables async/await in JS [part 1]

  const [model] = await Promise.all([
    Scene.root.findFirst('Miguelito')
  ]);

  playbackController = await Animation.playbackControllers.findFirst('animationPlaybackController0');
  playbackController.looping = Reactive.val(false);
  playbackController.playing = await Patches.outputs.getBoolean('startPlaying');
  isPlaying = playbackController.playing;

  // Diagnostics.watch("Playing: ", isPlaying);

  isPlaying.monitor().subscribe(OnAnimationFinished);

}; // Enables async/await in JS [part 2]

async function OnAnimationFinished()
{
  if (!isPlaying.pinLastValue() && (await Patches.outputs.getBoolean('startPlaying')).pinLastValue())
  {
    // Diagnostics.log("Animation finished!");

    currentClipIndex++;

    if (currentClipIndex < animationSequence.length)
    {  
      var animation = animationSequence[currentClipIndex];
      // Diagnostics.log("Animation: " + animation);
      var clipName = clipsMapping[animation];
      // Diagnostics.log("ClipName: " + clipName);
      var clip = await Animation.animationClips.findFirst(clipName);
      // Diagnostics.log("Clip: " + clip);

      playbackController.setAnimationClip(clip);
      playbackController.reset();

      // if it's the last animation in the sequence we start to wrap up the experience
      if (currentClipIndex == animationSequence.length - 1)
      {
        // let patch editor know when the complete sequence is reproduced (requires animationSequenceCompleted input parameter to be added in the editor!)
        await Patches.inputs.setBoolean('animationSequenceCompleted', true);
      }
    }
  }
}