// sRGB -> CIE Lab, D65; CIE76 distances used for the reproducible edge audit.
export function lab(rgb) {
  const [r,g,b]=rgb.map(v=>{v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;});
  const f=v=>v>216/24389?Math.cbrt(v):(24389/27*v+16)/116;
  const x=f((.4124564*r+.3575761*g+.1804375*b)/.95047);
  const y=f(.2126729*r+.7151522*g+.072175*b);
  const z=f((.0193339*r+.119192*g+.9503041*b)/1.08883);
  return [116*y-16,500*(x-y),200*(y-z)];
}
export const deltaE=(a,b)=>Math.hypot(...lab(a).map((v,i)=>v-lab(b)[i]));
