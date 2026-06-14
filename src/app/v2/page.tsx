// The ported v2 app lives in the private ./_app module (verbatim from the
// waffles_v2 prototype). It's a self-contained client app driven by its own
// ProtoProvider (currently mock state — Stage B swaps in real data). This route
// simply mounts it for pixel-parity verification before the (app)/(game) swap.
export { default } from "./_app/page";
