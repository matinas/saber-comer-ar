// @ts-nocheck
/**
 * (c) Facebook, Inc. and its affiliates. Confidential and proprietary.
 */
const S = require('Scene');
const P = require('Patches'); 
const R = require('Reactive'); 
const A = require('Animation');
const T = require('Time');
const TG = require('TouchGestures');
const TX = require('Textures');
export const D = require('Diagnostics');

const TARGET_ENVELOPE_SCALE = 1.1;
const ICON_PLANE_DISTANCE = 0.1;
const DEFAULT_PLANE_SIZE = 0.1;
const PLANE_TO_TARGET_TRACKER_RATIO = 3;
const ICON_STATE = {Hidden: 0, Minimized: 1, Maximized: 2}
const ICON_TRANSITION_DURATION = 500;
const ICON_FADE_DURATION = 250;
const ICON_START_DELAY = 0;
const ICON_MAXIMIZE_TIMEOUT = 3000;
const RETICLE_TRANSITION_DURATION = 500;
const RETICLE_FADE_DURATION = 500;
const FIT_SCALE = 0.55;

class TargetTracker {
  constructor(){
    this.iconState = ICON_STATE.Minimized;
    this.iconMaximizationTimeout = null;
    this.reticleTransitionTimeout = null;
    Promise.all([
      S.root.findFirst('Camera'),
      S.root.findFirst('targetTracker0'),
      S.root.findFirst('targetEnvelope'),
      S.root.findFirst('screenFit'),
      S.root.findFirst('icon'),
      S.root.findFirst('reticle'),
      S.root.findFirst('glint'),
      S.root.findFirst('glintPivot'),
      S.root.findFirst('slamNux'),
      TX.findFirst('Saber Comer'),
      P.outputs.getScalar('slamNuxProgress'),
      P.outputs.getBoolean('isFixedTarget')
    ]).then(p=>{
      this.camera = p[0];
      this.targetTracker = p[1];
      this.targetEnvelope = p[2];
      this.screenFit = p[3];
      this.icon = p[4];
      this.reticle = p[5];
      this.glint = p[6];
      this.glintPivot = p[7];
      this.slamNux = p[8];
      this.targetTexture = p[9];
      this.slamNuxProgress = p[10];
      this.isFixedTarget = p[11];
      this.initAfterPromiseResolved();
    }).catch(e=>{
      D.log('Promise Error: '+e.stack);
    });
  }

  initAfterPromiseResolved(){
    this.aspectRatio = this.targetTexture.width.div(this.targetTexture.height);
    this.setupReticleFade();
    this.setupReticleTransition();
    this.setupTargetEnvelope();
    this.setupScreenFit();
    this.setupReticle();
    this.setupIconFade();
    this.setupIconYaw();
    this.setupTouchGestures();
    this.setupGlint();
    this.setupSlamNux();
    this.maximizeIcon();
    this.outputToPatch();
  }

  setupTargetEnvelope(){
    let worldTransform = this.targetTracker.worldTransform;
    this.targetEnvelope.transform.position = worldTransform.position;
    this.targetEnvelope.transform.rotationX = worldTransform.rotationX;
    this.targetEnvelope.transform.rotationY = worldTransform.rotationY;
    this.targetEnvelope.transform.rotationZ = worldTransform.rotationZ;
    this.targetEnvelope.transform.scale = worldTransform.scale
      .mul(R.val(PLANE_TO_TARGET_TRACKER_RATIO))
      .div(this.aspectRatio.gt(1).ifThenElse(R.val(1), this.aspectRatio))
      .mul(TARGET_ENVELOPE_SCALE);
    this.targetInView = this.isTargetInView(
      this.targetEnvelope.transform.position, 
      this.targetEnvelope.transform.scaleX.mul(DEFAULT_PLANE_SIZE));
  }

  setupScreenFit(){
    let iconScale = R.val(ICON_PLANE_DISTANCE).div(this.camera.focalPlane.distance);
    let fitSize = this.camera.focalPlane.width.gt(this.camera.focalPlane.height).ifThenElse(
      this.camera.focalPlane.height, this.camera.focalPlane.width);
    this.screenFit.transform.scaleX = iconScale
      .mul(fitSize).div(DEFAULT_PLANE_SIZE).mul(FIT_SCALE);
    this.screenFit.transform.scaleY = iconScale
      .mul(fitSize).div(DEFAULT_PLANE_SIZE).mul(FIT_SCALE);
    this.screenFit.transform.z = R.val(-ICON_PLANE_DISTANCE);
  }

  setupReticle(){
    this.reticle.transform = R.mix(
      this.screenFit.transform.toSignal(), this.targetEnvelope.transform.toSignal(), 
      this.trackingProgress);
  }

  setupReticleTransition(){
    this.reticleTransitionDriver = A.timeDriver({durationMilliseconds: 1000});
    let animationSampler = A.samplers.easeInOutCubic(0, 1);
    this.trackingProgress = A.animate(this.reticleTransitionDriver, animationSampler);
    P.inputs.setScalar('reticleTransition', this.trackingProgress);
    this.targetTracker.confidence.monitor({fireOnInitialValue: true}).subscribe(v=>{
      if (this.reticleTransitionTimeout != null) {
        T.clearTimeout(this.reticleTransitionTimeout);
      }
      if (v.newValue != 'NOT_TRACKING') {
        this.reticleTransitionDriver.reset();
        this.reticleTransitionDriver.start();
        this.reticleTransitionTimeout = T.setTimeout(t=>{
          this.fadeReticle();
        }, RETICLE_TRANSITION_DURATION + RETICLE_FADE_DURATION);
      } else {
        this.reticleTransitionDriver.reverse();
        this.showReticle();
      }
    });
  }

  setupReticleFade(){
    this.reticleFadeDriver = A.timeDriver({durationMilliseconds: 1000});
    let animationSampler = A.samplers.easeInOutCubic(1, 0);
    P.inputs.setScalar('reticleFade', A.animate(this.reticleFadeDriver, animationSampler));
  }

  fadeReticle(){
    this.reticleFadeDriver.reset();
    this.reticleFadeDriver.start();
  }

  showReticle(){
    this.reticleFadeDriver.reverse();
  }

  setupIconFade(){
    this.iconFadeDriver = A.timeDriver({durationMilliseconds: ICON_FADE_DURATION});
    let animationSampler = A.samplers.easeInOutCubic(0, 1);
    T.setTimeout(t=>{
      this.showIcon();
    },ICON_START_DELAY);
    this.targetTracker.confidence.monitor({fireOnInitialValue: false}).subscribe(v=>{
      if (v.newValue == 'NOT_TRACKING'){
        this.showIcon();
      } else {
        this.fadeIcon();
      }
    });
    P.inputs.setScalar('iconFade', A.animate(this.iconFadeDriver, animationSampler));
  }

  fadeIcon(){
    this.iconFadeDriver.reverse();
  }

  showIcon(){
    this.iconFadeDriver.reset();
    this.iconFadeDriver.start();
    this.maximizeIcon();
  }

  setupTouchGestures(){
    this.iconTransitionDriver = A.timeDriver(
      {durationMilliseconds: ICON_TRANSITION_DURATION});
    let animationSampler = A.samplers.easeInOutCubic(0, 1);
    P.inputs.setScalar('iconTransition', A.animate(this.iconTransitionDriver, animationSampler));
    TG.onTap(this.icon).subscribe(gesture=>{
      if (this.iconState == ICON_STATE.Minimized) {
        this.maximizeIcon();
      } else {
        this.minimizeIcon();
      }
    });
  }

  minimizeIcon(){
    this.iconTransitionDriver.reverse();
    this.clearIconMaximizationTimeout();
    this.iconState = ICON_STATE.Minimized;
  }

  maximizeIcon(){
    this.iconTransitionDriver.reset();
    this.iconTransitionDriver.start();
    this.clearIconMaximizationTimeout();
    this.iconMaximizationTimeout = T.setTimeout(t=>{
      this.minimizeIcon();
    }, ICON_MAXIMIZE_TIMEOUT);
    this.iconState = ICON_STATE.Maximized;
  }

  setupIconYaw(){
    let driver = A.valueDriver(this.slamNuxProgress, 0.0, 1.0);
    let sampler = A.samplers.easeInOutQuad(-0.1, 0.1);
    this.icon.transform.rotationY = A.animate(driver, sampler);
  }

  setupGlint(){
    let targetPositionX = this.targetEnvelope.transform.x;
    let targetPositionY = this.targetEnvelope.transform.y;
    let xSign = R.sign(targetPositionX);
    let ySign = R.sign(targetPositionY);
    let slope = targetPositionX.eq(0).ifThenElse(
      R.val(0), targetPositionY.div(targetPositionX).abs());
    let screenX = R.val(DEFAULT_PLANE_SIZE/2).mul(xSign);
    let screenY = R.val(DEFAULT_PLANE_SIZE/2).mul(ySign);
    let tipPosition = R.point(
      slope.gt(1).ifThenElse(screenX.div(slope), screenX),
      slope.gt(1).ifThenElse(screenY, screenY.mul(slope)), R.val(0));
    this.glint.transform.position = tipPosition;
    this.glintPivot.transform.rotationZ = this.getZEulerRotation(tipPosition).neg();
    this.glintVisibility = this.targetTracker.outOfViewTrackingActive.and(this.targetInView.not());
    this.glintVisibility.monitor({fireOnInitialValue: true}).subscribe(visible=>{
      if (visible.newValue){
        this.glint.hidden = R.val(false);
      } else {
        this.glint.hidden = R.val(true);
      }
    });
  }

  getZEulerRotation(vector3) {
    let normalizedVector = vector3.normalize();
    return vector3.magnitude().eq(0).ifThenElse(
      R.val(0), 
      R.atan2(normalizedVector.x, normalizedVector.y));
  }

  setupSlamNux(){
    this.targetTracker.outOfViewTrackingActive.monitor({
      fireOnInitialValue: true
    }).subscribeWithSnapshot({
      isFixedTarget: this.isFixedTarget
    }, (v,s)=>{
      if (s.isFixedTarget){
        P.inputs.setBoolean('slamNuxHidden', R.val(v.newValue));
      }else{
        P.inputs.setBoolean('slamNuxHidden', R.val(true));
      }
    });
  }

  clearIconMaximizationTimeout(){
    if (this.iconMaximizationTimeout != null){
      T.clearTimeout(this.iconMaximizationTimeout);
    }
  }

  projectToFocalPlane(positionInCameraSpace){
    let focalDistanceOverZ = this.camera.focalPlane.distance.div(positionInCameraSpace.z.abs());
    return R.point(
      positionInCameraSpace.x.mul(focalDistanceOverZ), 
      positionInCameraSpace.y.mul(focalDistanceOverZ),
      this.camera.focalPlane.distance);
  }

  projectSizeOnFocalPlane(positionInCameraSpace, sizeInCameraSpace){
    let focalDistanceOverZ = this.camera.focalPlane.distance.div(positionInCameraSpace.z.abs());
    return sizeInCameraSpace.mul(focalDistanceOverZ);
  }

  isTargetInView(positionInCameraSpace, sizeInCameraSize){
    let position = this.projectToFocalPlane(positionInCameraSpace);
    let size = this.projectSizeOnFocalPlane(positionInCameraSpace, sizeInCameraSize);
    let xEdge = this.camera.focalPlane.width.add(size).div(2);
    let yEdge = this.camera.focalPlane.height.add(size).div(2);
    let isInside = (position.x.lt(xEdge)).and(position.x.gt(xEdge.neg()))
      .and(position.y.lt(yEdge).and(position.y.gt(yEdge.neg())))
      .and(positionInCameraSpace.z.lt(0));
    return isInside;
  }

  isInEditor(){
    let position = this.targetTracker.worldTransform.position;
    let isAtDefaultX = position.x.eq(R.val(0));
    let isAtDefaultY = position.y.eq(R.val(0));
    let isAtDefaultZ = position.z.eq(R.val(0));
    let isAtDefaultPosition = isAtDefaultX.and(isAtDefaultY).and(isAtDefaultZ);
    return isAtDefaultPosition;
  }

  outputToPatch(){
    P.inputs.setScalar('aspectRatio', this.aspectRatio);
    P.inputs.setString('trackingConfidence', this.targetTracker.confidence);
    P.inputs.setBoolean('trackingOutOfView', this.targetTracker.outOfViewTrackingActive);
    P.inputs.setBoolean('trackingTargetIsInView', this.targetInView);
    P.inputs.setBoolean('isInEditor', this.isInEditor());
    D.watch('Aspect ratio', this.aspectRatio);
    D.watch('Tracking confidence', this.targetTracker.confidence);
    D.watch('Out-of-view Tracking', this.targetTracker.outOfViewTrackingActive);
    D.watch('Is target in view', this.targetInView);
    D.watch('Is in editor', this.isInEditor());
  }
}

const instance = new TargetTracker();
export default instance;