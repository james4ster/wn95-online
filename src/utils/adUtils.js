export const AD_DISPLAY_SECONDS = 8;

export const AD_IMAGES = [
  'bellnbell.jpg',
  'blubber.jpg',
  'cancast-rural.jpg',
  'cancast.jpg',
  'darkside.jpg',
  'houdinisliquor.jpg',
  'justbabes.jpg',
  'knightswear.jpg',
  'la-hanger.jpg',
  'liv95.jpg',
  'tanking.jpg',
  'vaginat-9_v1.png',
  'wolfncline.jpg',
];

export function pickRandomAd() {
  return AD_IMAGES[Math.floor(Math.random() * AD_IMAGES.length)];
}
