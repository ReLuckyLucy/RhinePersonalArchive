import { prefs } from './preferences';
let context:AudioContext|undefined;
export function playClick() {
  if(!prefs.sound) return;
  context ??=new AudioContext(); void context.resume();
  const tone=context.createOscillator(), volume=context.createGain();
  tone.type='sine';tone.frequency.setValueAtTime(940,context.currentTime);tone.frequency.exponentialRampToValueAtTime(620,context.currentTime+.065);
  volume.gain.setValueAtTime(.025,context.currentTime);volume.gain.exponentialRampToValueAtTime(.0001,context.currentTime+.09);
  tone.connect(volume);volume.connect(context.destination);tone.start();tone.stop(context.currentTime+.1);
}
